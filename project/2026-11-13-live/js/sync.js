// Live sync through Firebase Realtime Database.
//
// Everyone who opens the same ?room= link shares one set of books. The data is stored in small
// pieces (one per book's details, member, bucket list idea and spread), so two people editing
// different spreads or ideas at the same time don't overwrite each other. Two people editing the
// SAME spread at the same moment: the last save wins.
//
//   rooms/<room>/books/<bookId>/info              book details (title, cover, ...)
//   rooms/<room>/books/<bookId>/members/<id>      one per person
//   rooms/<room>/books/<bookId>/bucket/<id>       one per bucket list idea
//   rooms/<room>/books/<bookId>/spreads/<id>      one per spread
//   rooms/<room>/photos/<photoKey>                photo as a data URL
//   rooms/<room>/presence/<personId>              who has the page open right now
//   rooms/<room>/seeded                           true once the room has its starting books
//
// Each piece is saved as a JSON string with sorted keys, so every browser writes the exact same
// text for the same content and nobody re-saves something that didn't change.

import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

export const ROOM = ((new URLSearchParams(location.search).get('room') || 'class')
  .toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40)) || 'class';

export const liveEnabled = Boolean(FIREBASE_CONFIG?.apiKey && FIREBASE_CONFIG?.databaseURL);

let fb = null; // Firebase functions plus the database, once loaded
let loading = null;

function init() {
  if (!liveEnabled) return Promise.resolve(null);
  if (!loading) {
    loading = Promise.all([import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-database.js`)])
      .then(([appSdk, dbSdk]) => {
        const app = appSdk.initializeApp(FIREBASE_CONFIG);
        fb = { ...dbSdk, db: dbSdk.getDatabase(app) };
        return fb;
      })
      .catch((error) => {
        console.warn('Live sync could not start:', error);
        return null;
      });
  }
  return loading;
}

const roomRef = (path = '') => fb.ref(fb.db, `rooms/${ROOM}${path ? `/${path}` : ''}`);

// ---------- status ----------
let status = liveEnabled ? 'connecting' : 'off';
const statusListeners = new Set();
function setStatus(next) {
  status = next;
  statusListeners.forEach((fn) => fn(status));
}
export const getStatus = () => status;
export function onStatus(fn) {
  statusListeners.add(fn);
  fn(status);
  return () => statusListeners.delete(fn);
}

// ---------- turning books into pieces and back ----------
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter((k) => value[k] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function flatten(data) {
  const out = {};
  data.books.forEach((book, i) => {
    const { bucketList, spreads, members, ...info } = book;
    out[`${book.id}/info`] = stable({ ...info, _i: i });
    (members || []).forEach((m, j) => { out[`${book.id}/members/${m.id}`] = stable({ ...m, _i: j }); });
    (bucketList || []).forEach((it, j) => { out[`${book.id}/bucket/${it.id}`] = stable({ ...it, _i: j }); });
    (spreads || []).forEach((s, j) => { out[`${book.id}/spreads/${s.id}`] = stable({ ...s, _i: j }); });
  });
  return out;
}

// The raw tree from Firebase as the same flat path -> text map.
function flattenTree(tree) {
  const out = {};
  for (const [bookId, node] of Object.entries(tree || {})) {
    if (typeof node?.info === 'string') out[`${bookId}/info`] = node.info;
    for (const group of ['members', 'bucket', 'spreads']) {
      for (const [id, text] of Object.entries(node?.[group] || {})) out[`${bookId}/${group}/${id}`] = text;
    }
  }
  return out;
}

const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };
const byOrder = (a, b) => (a._i - b._i) || String(a.id).localeCompare(String(b.id));
const list = (obj) => Object.values(obj || {}).map(parse).filter(Boolean).sort(byOrder).map(({ _i, ...rest }) => rest);

function unflatten(tree) {
  const books = [];
  for (const [bookId, node] of Object.entries(tree || {})) {
    const info = parse(node?.info);
    if (!info) continue;
    const { _i, ...rest } = info;
    books.push({ _i, id: bookId, book: { ...rest, id: bookId, members: list(node.members), bucketList: list(node.bucket), spreads: list(node.spreads) } });
  }
  books.sort(byOrder);
  return { version: 1, books: books.map((b) => b.book) };
}

// ---------- syncing ----------
let remoteFlat = null; // what Firebase has right now, as a flat map; null until the first answer

export async function startSync({ getData, applyRemote }) {
  const api = await init();
  if (!api) { setStatus(liveEnabled ? 'error' : 'off'); return; }

  api.onValue(api.ref(api.db, '.info/connected'), (snap) => {
    if (remoteFlat !== null) setStatus(snap.val() ? 'live' : 'connecting');
  });

  api.onValue(roomRef('books'), async (snap) => {
    const tree = snap.val();
    if (!tree) {
      // An empty room: give it the starting books, unless it was set up before and someone deleted everything.
      const seeded = (await api.get(roomRef('seeded'))).val();
      remoteFlat = {};
      if (!seeded) {
        await api.set(roomRef('seeded'), true);
        push(getData());
        setStatus('live');
        return;
      }
    } else {
      remoteFlat = flattenTree(tree);
    }
    applyRemote(unflatten(tree));
    setStatus('live');
  }, (error) => {
    console.warn('Live sync stopped:', error);
    setStatus('error');
  });
}

// Sends only the pieces that differ from what Firebase has.
export function push(data) {
  if (!fb || remoteFlat === null) return;
  const local = flatten(data);
  const changes = {};
  for (const [path, text] of Object.entries(local)) if (remoteFlat[path] !== text) changes[`books/${path}`] = text;
  for (const path of Object.keys(remoteFlat)) if (!(path in local)) changes[`books/${path}`] = null;
  if (!Object.keys(changes).length) return;
  fb.update(roomRef(), changes).catch((error) => {
    console.warn('Could not save to the shared book:', error);
    setStatus('error');
  });
}

// Keeps the same objects (so open views keep working) and copies the new values into them.
// Arrays of things with ids are matched up by id.
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
export function reconcile(target, source) {
  if (Array.isArray(target) && Array.isArray(source)) {
    const byId = new Map(target.filter((x) => isObj(x) && x.id != null).map((x) => [x.id, x]));
    const next = source.map((s) => {
      const match = isObj(s) && s.id != null ? byId.get(s.id) : null;
      return match ? reconcile(match, s) : s;
    });
    target.length = 0;
    target.push(...next);
    return target;
  }
  if (isObj(target) && isObj(source)) {
    for (const key of Object.keys(target)) if (!(key in source)) delete target[key];
    for (const [key, value] of Object.entries(source)) {
      const current = target[key];
      if ((Array.isArray(current) && Array.isArray(value)) || (isObj(current) && isObj(value))) reconcile(current, value);
      else target[key] = value;
    }
    return target;
  }
  return source;
}

// ---------- photos ----------
const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

export async function uploadPhoto(key, blob) {
  if (!(await init())) return;
  await fb.set(roomRef(`photos/${key}`), await blobToDataUrl(blob));
}

export async function downloadPhoto(key) {
  if (!(await init())) return null;
  const text = (await fb.get(roomRef(`photos/${key}`))).val();
  return text ? (await fetch(text)).blob() : null;
}

export async function removeRemotePhotos(keys) {
  if (!keys.length || !(await init())) return;
  await fb.update(roomRef('photos'), Object.fromEntries(keys.map((k) => [k, null])));
}

export async function clearRemotePhotos() {
  if (!(await init())) return;
  await fb.remove(roomRef('photos'));
}

// ---------- presence: who has the page open ----------
let presence = {};
let myPresence = null;
const presenceListeners = new Set();

export function onPresence(fn) {
  presenceListeners.add(fn);
  fn(presence);
  return () => presenceListeners.delete(fn);
}

export async function startPresence(me) {
  const api = await init();
  if (!api) return;
  myPresence = { ref: roomRef(`presence/${me.id}`), value: { name: me.name, color: me.color, book: '' } };
  api.onValue(api.ref(api.db, '.info/connected'), (snap) => {
    if (!snap.val()) return;
    api.onDisconnect(myPresence.ref).remove();
    api.set(myPresence.ref, { ...myPresence.value, at: api.serverTimestamp() });
  });
  api.onValue(roomRef('presence'), (snap) => {
    presence = snap.val() || {};
    presenceListeners.forEach((fn) => fn(presence));
  });
}

export function setPresenceBook(bookId) {
  if (!fb || !myPresence) return;
  myPresence.value.book = bookId || '';
  fb.update(myPresence.ref, { book: myPresence.value.book }).catch(() => {});
}
