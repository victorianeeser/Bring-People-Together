// App state: the single source of truth for book data, saved on every change.
// In the live version every change is also sent to the shared room (sync.js), and changes
// from other people are copied into the same objects so open views stay valid.

import { loadData, saveData, deletePhotos, clearPhotos } from './storage.js';
import { createSeed } from './seed.js';
import { photoKeysInBook, MEMBER_COLORS, uid, createSpread, createBucketItem, guessSeason } from './model.js';
import { ME, ME_NAME } from './identity.js';
import { startSync, push, reconcile, clearRemotePhotos } from './sync.js';

const isValid = (data) => data && data.version === 1 && Array.isArray(data.books);

let data = loadData();
if (!isValid(data)) {
  data = createSeed();
  saveData(data);
}

// Update older saved data: the demo book was renamed, and old ideas have no season (guess one from "when").
function migrate() {
  for (const book of data.books) {
    if (book.id === 'book-roomies' && book.title === 'The Roomies') book.title = 'Friends';
    for (const item of book.bucketList) if (!item.season) item.season = guessSeason(item.when);
  }
}
migrate();

const listeners = new Set();
let saveFailed = false;

export const getBooks = () => data.books;
export const getBook = (id) => data.books.find((b) => b.id === id) || null;

// Listeners get { remote: true } when the change came from someone else.
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const notify = (info = {}) => listeners.forEach((listener) => listener(info));

// Call after any change to the data. Returns false if saving failed (storage full).
export function commit() {
  const ok = saveData(data);
  saveFailed = !ok;
  push(data);
  notify();
  return ok;
}

export const lastSaveFailed = () => saveFailed;

// Everyone who joins the room is added to every book, so their "I'm in" and ideas show their face.
function nextColor(book) {
  const used = new Set(book.members.map((m) => m.color));
  return MEMBER_COLORS.find((c) => !used.has(c)) || MEMBER_COLORS[book.members.length % MEMBER_COLORS.length];
}

export function ensureMe() {
  if (!ME_NAME) return false;
  let changed = false;
  for (const book of data.books) {
    const me = book.members.find((m) => m.id === ME);
    if (!me) {
      book.members.push({ id: ME, name: ME_NAME, color: nextColor(book) });
      changed = true;
    } else if (me.name !== ME_NAME) {
      me.name = ME_NAME;
      changed = true;
    }
  }
  if (changed) commit();
  return changed;
}

// Someone else changed the shared books.
function applyRemote(remote) {
  reconcile(data.books, remote.books);
  migrate();
  saveData(data);
  notify({ remote: true });
  ensureMe();
}

export function startLive() {
  startSync({ getData: () => data, applyRemote });
}

export function addBook(book) {
  data.books.push(book);
  const ok = commit();
  ensureMe();
  return ok;
}

export function updateBook(id, fields) {
  const book = getBook(id);
  if (!book) return null;
  Object.assign(book, fields);
  commit();
  return book;
}

// Adds a person to a book. Their email is stored; this prototype doesn't send invites.
export function addMember(bookId, { name, email }) {
  const book = getBook(bookId);
  if (!book) return null;
  const member = { id: uid('member'), name, email, color: nextColor(book) };
  book.members.push(member);
  commit();
  return member;
}

// Bucket list actions. "You" are the member with id ME.
const findItem = (book, itemId) => book?.bucketList.find((i) => i.id === itemId) || null;

export function toggleImIn(bookId, itemId, memberId = ME) {
  const item = findItem(getBook(bookId), itemId);
  if (!item) return false;
  item.whosIn = item.whosIn.includes(memberId) ? item.whosIn.filter((id) => id !== memberId) : [...item.whosIn, memberId];
  commit();
  return item.whosIn.includes(memberId);
}

// "We did it!": marks the idea done, adds a spread titled after it at the end of the book,
// and links the two. Returns the new spread.
export function markDone(bookId, itemId) {
  const book = getBook(bookId);
  const item = findItem(book, itemId);
  if (!item) return null;
  if (item.spreadId) return book.spreads.find((s) => s.id === item.spreadId) || null;
  const spread = createSpread(item.title, item.id);
  book.spreads.push(spread);
  item.status = 'done';
  item.spreadId = spread.id;
  item.doneAt = new Date().toISOString();
  commit();
  return spread;
}

export function addBucketItem(bookId, fields) {
  const book = getBook(bookId);
  if (!book) return null;
  const item = createBucketItem({ ...fields, addedBy: ME, whosIn: [ME] });
  book.bucketList.push(item);
  commit();
  return item;
}

export function deleteBook(id) {
  const book = getBook(id);
  if (!book) return false;
  data.books = data.books.filter((b) => b.id !== id);
  deletePhotos(photoKeysInBook(book)).catch(() => {});
  return commit();
}

// Resets the whole room for everyone: starting books back, everyone's photos removed.
export async function resetDemo() {
  await clearPhotos();
  await clearRemotePhotos().catch(() => {});
  data = createSeed();
  const ok = commit();
  ensureMe();
  return ok;
}
