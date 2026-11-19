// App state: the single source of truth for book data, saved on every change.
// In the live version every change is also sent to the shared room (sync.js), and changes
// from other people are copied into the same objects so open views stay valid.

import { loadData, saveData, deletePhotos, clearPhotos } from './storage.js';
import { createSeed, classBook, CLASS_BOOK_ID } from './seed.js';
import { photoKeysInBook, MEMBER_COLORS, uid, createSpread, createBucketItem, guessSeason, codeFromId, normalizeCode } from './model.js';
import { ME, ME_NAME } from './identity.js';
import { track, EVENTS } from './analytics.js';
import { startSync, push, reconcile, removeRemotePhotos, liveEnabled, getMyColor } from './sync.js';

const isValid = (data) => data && data.version === 1 && Array.isArray(data.books);

let data = loadData();
if (!isValid(data)) {
  data = createSeed();
  saveData(data);
}

// Update older saved data: the demo book was renamed, old ideas have no season (guess one from "when"),
// older books have no invite code, and older rooms don't have the IXD415 class book yet.
// Returns true if anything changed, so it can be shared with the room.
const SEED_CODES = { 'book-roomies': 'FRND26', 'book-summer': 'SUMR26', 'book-movies': 'MOVIE5' };
function migrate() {
  let changed = false;
  for (const book of data.books) {
    if (book.id === 'book-roomies' && book.title === 'The Roomies') { book.title = 'Friends'; changed = true; }
    if (!book.code) { book.code = SEED_CODES[book.id] || codeFromId(book.id); changed = true; }
    for (const item of book.bucketList) if (!item.season) { item.season = guessSeason(item.when); changed = true; }
  }
  if (!data.books.some((b) => b.id === CLASS_BOOK_ID)) { data.books.unshift(classBook()); changed = true; }
  return changed;
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

function nextColor(book) {
  const used = new Set(book.members.map((m) => m.color));
  return MEMBER_COLORS.find((c) => !used.has(c)) || MEMBER_COLORS[book.members.length % MEMBER_COLORS.length];
}

// The library shows only books you're in. Others are joined with their invite code.
export const isMine = (book) => book.members.some((m) => m.id === ME);
export const myBooks = () => data.books.filter(isMine);
export const findByCode = (code) => data.books.find((b) => normalizeCode(b.code) === normalizeCode(code)) || null;

// Takes you out of a book. The book stays for everyone else.
export function leaveBook(bookId) {
  const book = getBook(bookId);
  if (!book || !isMine(book)) return false;
  book.members = book.members.filter((m) => m.id !== ME);
  for (const item of book.bucketList) item.whosIn = item.whosIn.filter((id) => id !== ME);
  commit();
  track(EVENTS.leftBook, whichBook(bookId));
  return true;
}

// Adds you to a book you picked.
export function joinBook(bookId) {
  const book = getBook(bookId);
  if (!book || !ME_NAME || isMine(book)) return false;
  book.members.push({ id: ME, name: ME_NAME, color: getMyColor() || nextColor(book) });
  commit();
  track(EVENTS.joinedBook, whichBook(bookId));
  return true;
}

// Your circle uses the same color in every book you're in (your live color).
export function setMyColor(color) {
  let changed = false;
  for (const book of data.books) {
    const me = book.members.find((m) => m.id === ME);
    if (me && me.color !== color) { me.color = color; changed = true; }
  }
  if (changed) commit();
}

// Keeps your name up to date in the books you're in. In live mode you pick which books to join;
// without live sync (one person on one computer) you're simply in every book.
export function ensureMe() {
  if (!ME_NAME) return false;
  let changed = false;
  for (const book of data.books) {
    const me = book.members.find((m) => m.id === ME);
    if (!me && !liveEnabled) {
      book.members.push({ id: ME, name: ME_NAME, color: nextColor(book) });
      changed = true;
    } else if (me && me.name !== ME_NAME) {
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
  if (migrate()) push(data);
  saveData(data);
  notify({ remote: true });
  ensureMe();
}

export function startLive() {
  startSync({ getData: () => data, applyRemote });
}

export function addBook(book) {
  if (!book.createdBy) book.createdBy = ME; // the creator can change or remove anything in the book
  data.books.push(book);
  const ok = commit();
  ensureMe();
  track(EVENTS.createdBook);
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
// Labels for analytics: only whether it's the class book, never a book's title or code.
const whichBook = (bookId) => ({ book: bookId === CLASS_BOOK_ID ? 'IxD 415 class book' : 'other book' });

const findItem = (book, itemId) => book?.bucketList.find((i) => i.id === itemId) || null;

export function toggleImIn(bookId, itemId, memberId = ME) {
  const item = findItem(getBook(bookId), itemId);
  if (!item) return false;
  item.whosIn = item.whosIn.includes(memberId) ? item.whosIn.filter((id) => id !== memberId) : [...item.whosIn, memberId];
  commit();
  if (item.whosIn.includes(memberId)) track(EVENTS.imIn, whichBook(bookId));
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
  track(EVENTS.weDidIt, whichBook(bookId));
  return spread;
}

// Adds two blank pages (a spread) at a spot in book.spreads. Returns the new spread.
export function addSpread(bookId, at) {
  const book = getBook(bookId);
  if (!book) return null;
  const spread = createSpread();
  book.spreads.splice(Math.max(0, Math.min(at, book.spreads.length)), 0, spread);
  commit();
  track(EVENTS.addedPages, whichBook(bookId));
  return spread;
}

export function addBucketItem(bookId, fields) {
  const book = getBook(bookId);
  if (!book) return null;
  const item = createBucketItem({ ...fields, addedBy: ME, whosIn: [ME] });
  book.bucketList.push(item);
  commit();
  track(EVENTS.addedIdea, whichBook(bookId));
  return item;
}

// Reports (threats.md): hidden for you right away, for everyone after 2 reports.
// An intimate photo is removed for everyone on the first report.
function addReport(thing, { intimate = false } = {}) {
  thing.reports = [...new Set([...(Array.isArray(thing.reports) ? thing.reports : []), ME])];
  if (intimate) thing.removedForAll = true;
}

export function reportPageItem(bookId, itemId, options) {
  const book = getBook(bookId);
  for (const spread of book?.spreads || []) {
    const item = [...spread.leftPage.items, ...spread.rightPage.items].find((i) => i.id === itemId);
    if (item) { addReport(item, options); commit(); track(EVENTS.reported, { kind: item.type }); return true; }
  }
  return false;
}

export function reportIdea(bookId, itemId) {
  const item = findItem(getBook(bookId), itemId);
  if (!item) return false;
  addReport(item);
  commit();
  track(EVENTS.reported, { kind: 'plan' });
  return true;
}

// People who have actually opened the scrapbook have ids starting with "me-". Names typed into the
// New book form (and the demo people) are only labels, so they don't keep a book alive.
const realPeople = (book) => book.members.filter((m) => String(m.id).startsWith('me-'));
// True when deleting the book would remove it for nobody but you.
export const onlyMeLeft = (book) => realPeople(book).every((m) => m.id === ME);

// Delete takes the book off your shelf only; everyone else keeps it. If you're the last real person in it,
// it's deleted for good (with its photos).
export function deleteBook(id) {
  const book = getBook(id);
  if (!book) return false;
  if (!onlyMeLeft(book)) return leaveBook(id);
  data.books = data.books.filter((b) => b.id !== id);
  deletePhotos(photoKeysInBook(book)).catch(() => {});
  return commit();
}

// Resets the whole room for everyone: starting books back, everyone's photos removed.
export async function resetDemo() {
  // The database rules don't allow deleting all photos in one go, so remove each book's photos one by one.
  const keys = data.books.flatMap((book) => photoKeysInBook(book));
  await clearPhotos();
  await removeRemotePhotos(keys).catch(() => {});
  data = createSeed();
  const ok = commit();
  ensureMe();
  return ok;
}
