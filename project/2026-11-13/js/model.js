// The data model: constants, factories, and pure helpers. No DOM code here.

export const CATEGORIES = {
  Adventure: '#A8E2DC',
  Trip: '#BFD4FD',
  Food: '#FFC7B8',
  Chill: '#D9D4F7',
  Creative: '#FBD5F8',
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
export const MEMBER_COLORS = ['#F4A988', '#9CC5A1', '#8FB3E8', '#D7A6E0', '#F2CF72', '#A8E2DC', '#FFC7B8', '#BFD4FD', '#E7B7C3', '#C9D99A'];

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const FONTS = {
  caveat: { label: 'Caveat', family: "'Caveat', cursive" },
  homemade: { label: 'Homemade Apple', family: "'Homemade Apple', cursive" },
  reenie: { label: 'Reenie Beanie', family: "'Reenie Beanie', cursive" },
};

// Preset covers. `ink` is the title color that reads well on `color`.
export const COVER_PRESETS = [
  { id: 'terracotta-dots', color: '#D98B6F', pattern: 'dots', ink: '#2A1B14' },
  { id: 'sun-arch', color: '#F2C46B', pattern: 'arch', ink: '#2E2410' },
  { id: 'night-stars', color: '#2F3B5C', pattern: 'stars', ink: '#FBFAF6' },
  { id: 'sage-stripes', color: '#9DB89A', pattern: 'stripes', ink: '#1C2A1B' },
  { id: 'lilac-waves', color: '#B9A9D9', pattern: 'waves', ink: '#231B33' },
  { id: 'cream-checker', color: '#EADFC8', pattern: 'checker', ink: '#2B2519' },
  { id: 'blush-confetti', color: '#E7B7C3', pattern: 'confetti', ink: '#33191F' },
  { id: 'teal-grid', color: '#457772', pattern: 'grid', ink: '#FBFAF6' },
];

export const coverPreset = (id) => COVER_PRESETS.find((p) => p.id === id) || COVER_PRESETS[0];

export const uid = (prefix = 'id') => `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

export function createBook({ title, cover, members, hasBucketList }) {
  return {
    id: uid('book'),
    title,
    cover: cover || { type: 'preset', presetId: COVER_PRESETS[0].id },
    members,
    hasBucketList: Boolean(hasBucketList),
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
