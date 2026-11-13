// App state: the single source of truth for book data, saved on every change.

import { loadData, saveData, deletePhotos, clearPhotos } from './storage.js';
import { createSeed } from './seed.js';
import { photoKeysInBook, MEMBER_COLORS, uid, createSpread, createBucketItem, guessSeason } from './model.js';
import { ME } from './seed.js';

const isValid = (data) => data && data.version === 1 && Array.isArray(data.books);

let data = loadData();
if (!isValid(data)) {
  data = createSeed();
  saveData(data);
}
// Update older saved data: the demo book was renamed, and old ideas have no season (guess one from "when").
for (const book of data.books) {
  if (book.id === 'book-roomies' && book.title === 'The Roomies') book.title = 'Friends';
  for (const item of book.bucketList) if (!item.season) item.season = guessSeason(item.when);
}

const listeners = new Set();
let saveFailed = false;

export const getBooks = () => data.books;
export const getBook = (id) => data.books.find((b) => b.id === id) || null;

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Call after any change to the data. Returns false if saving failed (storage full).
export function commit() {
  const ok = saveData(data);
  saveFailed = !ok;
  listeners.forEach((listener) => listener());
  return ok;
}

export const lastSaveFailed = () => saveFailed;

export function addBook(book) {
  data.books.push(book);
  return commit();
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
  const used = new Set(book.members.map((m) => m.color));
  const color = MEMBER_COLORS.find((c) => !used.has(c)) || MEMBER_COLORS[book.members.length % MEMBER_COLORS.length];
  const member = { id: uid('member'), name, email, color };
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

export async function resetDemo() {
  await clearPhotos();
  data = createSeed();
  return commit();
}
