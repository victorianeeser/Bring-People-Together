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

// Your live color: your cursor, your outline on things you've selected, and your circle in "who's here".
// Bright enough for white text, and picked from your id so it stays the same on every visit.
export const LIVE_COLORS = ['#3D6FE0', '#D9534F', '#8A4FC7', '#1E9467', '#D9730D', '#D23C8A', '#0F86A0', '#8B5A2B'];
const hash = [...ME].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const MY_COLOR = LIVE_COLORS[hash % LIVE_COLORS.length];
