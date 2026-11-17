// Safety rules from threats.md, in one place:
// - Credit: every photo, note and sticker remembers who added it ("Nothing is anonymous").
// - Own-only edits: you can only change or remove your own things; the book's creator can change anything
//   ("Erasing someone from the year").
// - Reports: something you report is hidden for you right away and for everyone after 2 reports.
//   An intimate photo is hidden for everyone on the first report ("Piling on", "An ex who's still in the group").
// - Limits: one person can add at most ADD_LIMIT things to a spread per minute ("Piling on").

import { ME } from './identity.js';

export const REPORTS_TO_HIDE = 2;
export const ADD_LIMIT = 10;
const WINDOW_MS = 60_000;

const reportsOf = (thing) => (Array.isArray(thing?.reports) ? thing.reports : []);

// Hidden for this person: removed for everyone, reported by enough people, or reported by them.
export const isHidden = (thing) => Boolean(thing?.removedForAll)
  || reportsOf(thing).length >= REPORTS_TO_HIDE
  || reportsOf(thing).includes(ME);

export const hasReported = (thing) => reportsOf(thing).includes(ME);

// Things from before credit existed (the demo books) have no addedBy, so anyone can still change them.
export const isOwnerOfBook = (book) => Boolean(book?.createdBy) && book.createdBy === ME;
export const canChange = (book, item) => !item?.addedBy || item.addedBy === ME || isOwnerOfBook(book);
export const canReport = (item) => Boolean(item) && item.addedBy !== ME;

export function adderOf(book, item) {
  if (!item?.addedBy) return null;
  return book.members.find((m) => m.id === item.addedBy) || { id: item.addedBy, name: 'someone who left', color: '#9AA0AE' };
}

// Adds `count` new things to `spreadId` if that stays under the limit. Kept per browser, per spread.
const recentAdds = new Map();
export function allowAdds(spreadId, count = 1) {
  const now = Date.now();
  const recent = (recentAdds.get(spreadId) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length + count > ADD_LIMIT) {
    recentAdds.set(spreadId, recent);
    const wait = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
    return { ok: false, wait };
  }
  for (let i = 0; i < count; i += 1) recent.push(now);
  recentAdds.set(spreadId, recent);
  return { ok: true, wait: 0 };
}
