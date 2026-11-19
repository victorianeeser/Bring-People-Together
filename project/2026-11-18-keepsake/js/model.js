// The data model: constants, factories, and pure helpers. No DOM code here.

export const CATEGORIES = {
  Adventure: '#D0C96B',
  Trip: '#BCD4C9',
  Food: '#FF9797',
  Chill: '#E1CFCD',
  Creative: '#F2CF72',
};

export const COSTS = ['Free', '$', '$$', '$$$'];

// Bucket list items are sorted and filtered by season, in this order.
export const SEASONS = ['Summer', 'Fall', 'Winter', 'Spring', 'Someday'];

// Guesses a season from a free-text "when" (used for older saved items that have no season).
export function guessSeason(when = '') {
  const w = when.toLowerCase();
  if (/summer|june|july|august|beach/.test(w)) return 'Summer';
  if (/fall|autumn|september|october|november|halloween|thanksgiving/.test(w)) return 'Fall';
  if (/winter|december|january|february|over break|christmas|holiday/.test(w)) return 'Winter';
  if (/spring|march|april|may|finals|graduation/.test(w)) return 'Spring';
  return 'Someday';
}

// Avatar colors for members, used in order for new people.
// Keepsake person colors: taupe, berry, olive first (Maya, Tori, Leandra on the brand board), then the sticker colors.
export const MEMBER_COLORS = ['#9B9090', '#D06B6B', '#D0C96B', '#FF9797', '#F2CF72', '#BCD4C9', '#E1CFCD', '#510C0D', '#C99A6B', '#8FA89B'];

// Invite codes: 6 letters and numbers, without ones that are easy to mix up (0/O, 1/I/L).
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const normalizeCode = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const randomCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
// The same code every time for the same book id (for older books saved before codes existed).
export function codeFromId(id) {
  let h = 2166136261;
  for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return Array.from({ length: 6 }, (_, i) => CODE_CHARS[(h >>> (i * 5)) % CODE_CHARS.length]).join('');
}

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Keepsake note fonts: Miniver for everyday notes, Kalam Bold (standing in for Figma Hand) for big moments,
// like "our first trip" on the brand board. Notes saved with the old fonts show in Miniver.
// Every font on the Keepsake brand board, for notes (11/18 crit: add the secondary type, Avenir).
// Figma Hand isn't a web font, so Kalam Bold stands in for it, like everywhere else in the app.
export const FONTS = {
  miniver: { label: 'Miniver', role: 'Notes', family: 'var(--hand)', size: 1 },
  kalam: { label: 'Figma Hand', role: 'Big moments', family: 'var(--big)', weight: 700, size: 1 },
  avenir: { label: 'Avenir', role: 'Headlines', family: 'var(--display)', weight: 500, size: 0.82 },
  inter: { label: 'Inter', role: 'Body', family: 'var(--ui)', size: 0.78 },
};
// Note colors and tape colors, from the brand palette.
export const TEXT_COLORS = { Maroon: '#510C0D', Berry: '#D06B6B', Taupe: '#7D6463', Olive: '#8E8A2E', Pink: '#FF9797', Ink: '#2B2B2B' };
export const TAPE_COLORS = { Olive: '#D0C96B', Pink: '#FF9797', Berry: '#D06B6B', Rose: '#E1CFCD', Butter: '#F2CF72', Sage: '#BCD4C9', Taupe: '#9B9090', Maroon: '#510C0D' };
export const fontOf = (item) => FONTS[item?.font] || FONTS.miniver;
export const fontCss = (item) => `font-family:${fontOf(item).family};font-weight:${fontOf(item).weight || 400}`;

// Preset covers. `ink` is the title color that reads well on `color`.
export const COVER_PRESETS = [
  // Same ids as before (so saved books keep their cover), now in the Keepsake palette.
  { id: 'terracotta-dots', color: '#D06B6B', pattern: 'dots', ink: '#510C0D', tape: 'olive', doodle: 'elements/doodle-heart' },
  { id: 'sun-arch', color: '#F2CF72', pattern: 'arch', ink: '#510C0D', tape: 'pink', doodle: 'elements/doodle-sparkle' },
  { id: 'night-stars', color: '#510C0D', pattern: 'stars', ink: '#510C0D', tape: 'olive', doodle: 'elements/star-small' },
  { id: 'sage-stripes', color: '#D0C96B', pattern: 'stripes', ink: '#510C0D', tape: 'pink', doodle: 'elements/doodle-star' },
  { id: 'lilac-waves', color: '#9B9090', pattern: 'waves', ink: '#510C0D', tape: 'olive', doodle: 'elements/doodle-loop' },
  { id: 'cream-checker', color: '#E1CFCD', pattern: 'checker', ink: '#510C0D', tape: 'olive', doodle: 'mark' },
  { id: 'blush-confetti', color: '#FF9797', pattern: 'confetti', ink: '#510C0D', tape: 'olive', doodle: 'elements/doodle-heart' },
  { id: 'teal-grid', color: '#BCD4C9', pattern: 'grid', ink: '#510C0D', tape: 'pink', doodle: 'elements/doodle-sparkle' },
];

// Page backgrounds (bucket list and any spread), in the Keepsake palette.
export const PAGE_BACKGROUNDS = {
  paper: 'Paper',
  grid: 'Graph paper',
  dots: 'Dots',
  lined: 'Lined',
  gingham: 'Gingham',
  rose: 'Rose',
  butter: 'Butter',
  sage: 'Sage',
};
export const pageBg = (value) => (PAGE_BACKGROUNDS[value] ? value : 'paper');

export const coverPreset = (id) => COVER_PRESETS.find((p) => p.id === id) || COVER_PRESETS[0];

export const uid = (prefix = 'id') => `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

export function createBook({ title, cover, members, hasBucketList }) {
  return {
    id: uid('book'),
    title,
    cover: cover || { type: 'preset', presetId: COVER_PRESETS[0].id },
    members,
    hasBucketList: Boolean(hasBucketList),
    code: randomCode(), // friends join the book with this code
    bucketList: [],
    // Without a bucket list the book starts with one blank spread.
    spreads: hasBucketList ? [] : [createSpread()],
    createdAt: new Date().toISOString(),
  };
}

export function createSpread(title = '', linkedItemId = null) {
  return { id: uid('spread'), title, linkedItemId, leftPage: { items: [] }, rightPage: { items: [] } };
}

export function createBucketItem(fields) {
  return {
    id: uid('item'),
    title: '',
    addedBy: null,
    addedAt: new Date().toISOString(),
    location: '',
    when: '',
    cost: 'Free',
    category: 'Adventure',
    season: 'Someday',
    notes: '',
    whosIn: [],
    status: 'idea',
    spreadId: null,
    ...fields,
  };
}

// Positions and sizes are percentages of the page, so items scale with it.
export function createPageItem(type, props) {
  return { id: uid('pi'), type, x: 10, y: 10, width: 30, rotation: 0, z: 1, ...props };
}

// The table of contents (when on) is pages 1–2 and isn't stored in `spreads`.
export const spreadCount = (book) => book.spreads.length + (book.hasBucketList ? 1 : 0);
export const pageCount = (book) => spreadCount(book) * 2;

// Page numbers for a spread in `book.spreads`, e.g. [3, 4].
export function pagesForSpread(book, spreadIndex) {
  const first = (spreadIndex + (book.hasBucketList ? 1 : 0)) * 2 + 1;
  return [first, first + 1];
}

export function photoKeysInBook(book) {
  const keys = [];
  if (book.cover?.type === 'photo' && book.cover.photoKey) keys.push(book.cover.photoKey);
  for (const spread of book.spreads) {
    for (const page of [spread.leftPage, spread.rightPage]) {
      for (const item of page.items) if (item.type === 'photo' && item.photoKey) keys.push(item.photoKey);
    }
  }
  return keys;
}
