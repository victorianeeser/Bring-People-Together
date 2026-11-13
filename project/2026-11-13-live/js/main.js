// Entry point: a small hash router between the library and an open book,
// with a subtle open/close transition (transitions.js).
// The full 3D version is in opening.js, turned off for now.

import { mountLibrary, showInLibrary } from './library.js';
import { mountBook } from './book.js';
import { openTransition, closeTransition } from './transitions.js';
import { isAnimating, setAnimating, initDevPanel } from './animation.js';
import { startLive, ensureMe, getBook } from './state.js';
import { ME, ME_NAME, hasName, setMyName } from './identity.js';
import { ROOM, liveEnabled, onStatus, onPresence, startPresence, setPresenceBook } from './sync.js';
import { esc, toast } from './ui.js';

const app = document.getElementById('app');
const backdrop = document.getElementById('backdrop');
let current = null; // { type, id, root, cleanup, api }
let skipHash = null;

const bookIdFromHash = () => {
  const match = location.hash.match(/^#\/book\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
};

function newRoot(hidden = false) {
  const root = document.createElement('div');
  root.className = 'view';
  if (hidden) root.style.visibility = 'hidden';
  app.append(root);
  return root;
}

function setHash(hash) {
  if (location.hash === hash || (hash === '#/' && !location.hash)) return;
  skipHash = hash;
  location.hash = hash;
}

function teardown() {
  current?.cleanup?.();
  current?.root.remove();
  current = null;
}

// Plain mount: first load, and browser back/forward.
function mountFromHash() {
  teardown();
  const id = bookIdFromHash();
  const root = newRoot();
  if (id) {
    const api = mountBook(root, id);
    current = { type: 'book', id, root, api, cleanup: api.cleanup };
    backdrop.style.opacity = '1';
    api.focus();
  } else {
    current = { type: 'library', root, cleanup: mountLibrary(root) };
    backdrop.style.opacity = '0';
  }
}

async function openBook({ id, el }) {
  if (isAnimating() || current?.type !== 'library') return;
  setAnimating(true);
  try {
    const root = newRoot(true);
    const api = mountBook(root, id);
    await openTransition({ coverEl: el, libraryRoot: current.root, bookRoot: root, backdrop });
    teardown();
    current = { type: 'book', id, root, api, cleanup: api.cleanup };
    setHash(`#/book/${encodeURIComponent(id)}`);
    api.focus();
  } catch (error) {
    recover(`#/book/${encodeURIComponent(id)}`, error);
  } finally {
    setAnimating(false);
  }
}

// If a transition fails, skip it and just show the destination.
function recover(hash, error) {
  console.warn('Transition skipped:', error);
  document.querySelectorAll('.flip-layer, .anim-layer').forEach((el) => el.remove());
  app.querySelectorAll('.view').forEach((el) => { if (el !== current?.root) el.remove(); });
  backdrop.getAnimations().forEach((a) => a.cancel());
  if (location.hash === hash) mountFromHash();
  else { skipHash = null; location.hash = hash; mountFromHash(); skipHash = hash; }
}

async function closeBook({ id }) {
  if (isAnimating() || current?.type !== 'book') return;
  setAnimating(true);
  try {
    showInLibrary(id);
    const root = newRoot(true);
    const cleanup = mountLibrary(root, { focus: false });
    const coverEl = root.querySelector('.slot.is-center .book') || root.querySelector('.grid-book[aria-current="true"] .book');
    await closeTransition({ coverEl, libraryRoot: root, bookRoot: current.root, backdrop });
    teardown();
    current = { type: 'library', root, cleanup };
    setHash('#/');
    (root.querySelector('.slot.is-center') || root.querySelector('.grid-book[aria-current="true"]'))?.focus({ preventScroll: true });
  } catch (error) {
    recover('#/', error);
  } finally {
    setAnimating(false);
  }
}

window.addEventListener('book:open', (event) => openBook(event.detail));
window.addEventListener('book:close', (event) => closeBook(event.detail));
window.addEventListener('hashchange', () => {
  if (skipHash && location.hash === skipHash) { skipHash = null; return; }
  skipHash = null;
  if (!isAnimating()) mountFromHash();
});

// Show focus rings only for keyboard users: keys turn them on, a click or tap turns them off.
const NAV_KEYS = new Set(['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' ', 'Escape', 'Home', 'End', 'PageUp', 'PageDown']);
document.addEventListener('keydown', (event) => { if (NAV_KEYS.has(event.key)) document.documentElement.classList.add('kbd'); }, true);
document.addEventListener('pointerdown', () => document.documentElement.classList.remove('kbd'), true);

initDevPanel();
mountFromHash();

// ---------- live: your name, the shared room, and who's here ----------

function askName() {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'join-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="join-form">
        <h2>Join the scrapbook</h2>
        <p>Everyone with this link shares the same books${liveEnabled ? ` (room <strong>${esc(ROOM)}</strong>)` : ''}. What should your friends call you?</p>
        <label for="join-name" class="visually-hidden">Your name</label>
        <input id="join-name" name="name" maxlength="24" required autocomplete="given-name" placeholder="Your name">
        <button type="submit" class="pill-btn">Join</button>
      </form>`;
    document.body.append(dialog);
    dialog.addEventListener('cancel', (event) => event.preventDefault()); // a name is needed to join
    dialog.querySelector('form').addEventListener('submit', (event) => {
      const name = dialog.querySelector('#join-name').value.trim().slice(0, 24);
      if (!name) { event.preventDefault(); return; }
      setMyName(name);
      dialog.close();
      dialog.remove();
      resolve(name);
    });
    dialog.showModal();
  });
}

const STATUS_TEXT = {
  off: 'Not live: only you see your changes',
  connecting: 'Connecting…',
  live: 'Live',
  error: "Can't reach the shared books. Changes are only saved on this computer.",
};

function mountPresenceBar() {
  const bar = document.createElement('div');
  bar.className = 'presence-bar';
  bar.setAttribute('role', 'status');
  document.body.append(bar);
  let status = 'off';
  let people = {};
  function render() {
    const here = Object.entries(people).map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => (b.id === ME) - (a.id === ME) || String(a.name).localeCompare(String(b.name)));
    const faces = here.map((p) => {
      const where = p.book ? getBook(p.book)?.title : '';
      const label = `${p.id === ME ? 'You' : p.name || 'Someone'}${where ? `, in ${where}` : ', in the library'}`;
      return `<span class="presence-face" style="background:${esc(p.color || '#ccc')}" title="${esc(label)}" aria-label="${esc(label)}">${esc(String(p.name || '?').slice(0, 1).toUpperCase())}</span>`;
    }).join('');
    bar.innerHTML = `
      <span class="presence-dot is-${status}" aria-hidden="true"></span>
      <span class="presence-text">${esc(STATUS_TEXT[status] || '')}${status === 'live' ? ` · ${here.length} here` : ''}</span>
      ${status === 'live' ? `<span class="presence-faces">${faces}</span>` : ''}
      ${liveEnabled ? '<button type="button" class="presence-copy">Copy link</button>' : ''}`;
  }
  bar.addEventListener('click', (event) => {
    if (!event.target.closest('.presence-copy')) return;
    const url = new URL(location.href);
    url.hash = '';
    url.searchParams.set('room', ROOM);
    navigator.clipboard.writeText(url.toString()).then(() => toast('Link copied. Send it to your friends.'), () => toast(url.toString()));
  });
  onStatus((next) => { status = next; render(); });
  onPresence((next) => { people = next; render(); });
}

async function startLiveMode() {
  mountPresenceBar();
  if (!hasName()) await askName();
  ensureMe();
  if (!liveEnabled) return;
  startLive();
  const myColor = getBook(bookIdFromHash())?.members.find((m) => m.id === ME)?.color || '#F4A988';
  startPresence({ id: ME, name: ME_NAME, color: myColor });
  setPresenceBook(bookIdFromHash());
  window.addEventListener('hashchange', () => setPresenceBook(bookIdFromHash()));
  // setHash() changes the hash without always firing our router, so check after transitions too.
  window.addEventListener('book:open', () => setTimeout(() => setPresenceBook(bookIdFromHash()), 1500));
  window.addEventListener('book:close', () => setTimeout(() => setPresenceBook(bookIdFromHash()), 1500));
}

startLiveMode();
