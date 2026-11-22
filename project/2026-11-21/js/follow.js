// Follow someone (11/18 crit): click a person in the "who's here" list and you go wherever they go:
// their book and the pages they're on, page turn by page turn, until you stop or turn a page yourself.

let following = null; // { id, name }
const listeners = new Set();

export const getFollow = () => following;
export function setFollow(next) {
  following = next ? { id: next.id, name: next.name || 'someone' } : null;
  listeners.forEach((fn) => fn(following));
}
export const stopFollow = () => { if (following) setFollow(null); };
export function onFollow(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
