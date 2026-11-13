// Who "you" are in this browser: a random id plus the name you typed when you joined.
// Kept in localStorage so a reload keeps you as the same person.

const KEY = 'scrapbook.identity';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

const saved = load();

export const ME = saved.id || `me-${Math.random().toString(36).slice(2, 10)}`;
export let ME_NAME = saved.name || '';

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ id: ME, name: ME_NAME }));
  } catch {
    // Private mode: you stay the same person until the tab closes.
  }
}
if (!saved.id) persist();

export function setMyName(name) {
  ME_NAME = name;
  persist();
}

export const hasName = () => Boolean(ME_NAME);
