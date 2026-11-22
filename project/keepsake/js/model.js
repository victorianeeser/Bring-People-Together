// The data model: constants, factories, and pure helpers. No DOM code here.

export const CATEGORIES = {
  Adventure: '#B9D18C',
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
export const MEMBER_COLORS = ['#9B9090', '#D06B6B', '#B9D18C', '#FF9797', '#F2CF72', '#BCD4C9', '#E1CFCD', '#510C0D']; // brand colors only

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

// Note fonts: notes are Avenir only. Figma Hand is kept for the logo, the bucket list heading and book titles,
// so notes saved in Figma Hand (Kalam), Miniver, Inter or older fonts all show in Avenir.
// 11/22: three note fonts. Figma Hand (shown as Kalam) is always lowercase, like everywhere else.
export const FONTS = {
  avenir: { label: 'Avenir', role: 'Clean', family: 'var(--display)', weight: 500, size: 0.82 },
  kalam: { label: 'Figma Hand', role: 'Big moments', family: 'var(--big)', weight: 700, size: 1, lowercase: true },
  script: { label: 'Script', role: 'Handwritten', family: 'var(--script)', weight: 400, size: 1.05 },
};
// Note colors and tape colors, from the brand palette.
export const TEXT_COLORS = { Maroon: '#510C0D', Berry: '#D06B6B', Taupe: '#7D6463', Olive: '#7E9A4E', Pink: '#FF9797', Ink: '#2B2B2B' };
export const TAPE_COLORS = { Olive: '#B9D18C', Pink: '#FF9797', Berry: '#D06B6B', Rose: '#E1CFCD', Butter: '#F2CF72', Sage: '#BCD4C9', Taupe: '#9B9090', Maroon: '#510C0D' };
// Notes saved in Miniver (before 11/21) show in Script, which is Miniver again.
export const fontOf = (item) => FONTS[item?.font] || (item?.font === 'miniver' ? FONTS.script : FONTS.avenir);
export const fontCss = (item) => `font-family:${fontOf(item).family};font-weight:${fontOf(item).weight || 400};text-transform:${fontOf(item).lowercase ? 'lowercase' : 'none'}`;

// Preset covers. `ink` is the title color that reads well on `color`.
export const COVER_PRESETS = [
  // Same ids as before (so saved books keep their cover), now in the Keepsake palette.
  // 11/21: each one its own notebook. spine: rings / cloth / none. label: paper / pill / stamp / tag / band.
  // place: where the title label sits (top / center / bottom). tapePos / doodlePos: their usual spots.
  { id: 'terracotta-dots', color: '#D06B6B', pattern: 'dots', ink: '#510C0D', tape: 'olive', doodle: 'elements/doodle-heart',
    spine: 'rings', label: 'paper', place: 'bottom' },
  { id: 'sun-arch', color: '#F2CF72', pattern: 'arch', ink: '#510C0D', tape: 'none', doodle: 'elements/doodle-sparkle',
    spine: 'none', label: 'pill', place: 'top', doodlePos: { x: 18, y: 36 } },
  { id: 'night-stars', color: '#510C0D', pattern: 'stars', ink: '#510C0D', tape: 'pink', doodle: 'elements/star-small',
    spine: 'cloth', label: 'stamp', place: 'center', tapePos: { x: 30, y: 7 }, doodlePos: { x: 80, y: 66 } },
  { id: 'sage-stripes', color: '#B9D18C', pattern: 'stripes', ink: '#510C0D', tape: 'pink', doodle: 'elements/doodle-star',
    spine: 'rings', label: 'tag', place: 'top', tapePos: { x: 66, y: 90 }, doodlePos: { x: 82, y: 40 } },
  { id: 'lilac-waves', color: '#9B9090', pattern: 'waves', ink: '#510C0D', tape: 'none', doodle: 'elements/doodle-loop',
    spine: 'none', label: 'band', place: 'bottom', doodlePos: { x: 30, y: 20 } },
  { id: 'cream-checker', color: '#E1CFCD', pattern: 'checker', ink: '#510C0D', tape: 'olive', doodle: 'mark',
    spine: 'cloth', label: 'paper', place: 'center', tapePos: { x: 62, y: 34 }, doodlePos: { x: 80, y: 80 } },
  { id: 'blush-confetti', color: '#FF9797', pattern: 'confetti', ink: '#510C0D', tape: 'olive', doodle: 'elements/doodle-heart',
    spine: 'none', label: 'paper', place: 'top', tapePos: { x: 50, y: 10 }, doodlePos: { x: 78, y: 82 } },
  { id: 'teal-grid', color: '#BCD4C9', pattern: 'grid', ink: '#510C0D', tape: 'pink', doodle: 'elements/doodle-sparkle',
    spine: 'rings', label: 'pill', place: 'bottom', tapePos: { x: 70, y: 9 }, doodlePos: { x: 30, y: 30 } },
];

// Page backgrounds (bucket list and any spread), in the Keepsake palette.
// Grouped for the Page tab (11/21: more choices, like small, medium and large dots). Old ids keep working.
export const PAGE_BG_GROUPS = [
  ['Plain', { paper: 'Paper', rose: 'Rose', blush: 'Blush', butter: 'Butter', mint: 'Mint', sage: 'Sage' }],
  ['Dots', { 'dots-sm': 'Small dots', dots: 'Medium dots', 'dots-lg': 'Large dots', 'dots-berry': 'Berry dots', 'dots-rose': 'Rose dots', 'dots-butter': 'Butter dots' }],
  ['Grid', { 'grid-sm': 'Small grid', grid: 'Medium grid', 'grid-lg': 'Large grid' }],
  ['Lines', { 'lined-sm': 'Narrow lines', lined: 'Medium lines', 'lined-lg': 'Wide lines' }],
  ['Patterns', { gingham: 'Gingham', 'gingham-lg': 'Big gingham', 'gingham-sage': 'Sage gingham', stripes: 'Pink stripes', 'stripes-butter': 'Butter stripes', 'stripes-sage': 'Sage stripes' }],
];
export const PAGE_BACKGROUNDS = Object.assign({}, ...PAGE_BG_GROUPS.map(([, items]) => items));
// Plain colors have no pattern, so only their opacity can change (not their size).
export const PLAIN_BGS = new Set(Object.keys(PAGE_BG_GROUPS[0][1]));
// A page's background settings: opacity 0.1–1 and pattern size 0.5–2.5 (1 = as drawn).
export const bgOpacity = (spread) => clampNum(spread?.bgOpacity, 0.1, 1, 1);
export const bgSize = (spread) => clampNum(spread?.bgSize, 0.5, 2.5, 1);
function clampNum(v, lo, hi, fallback) { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback; }
export const pageBg = (value) => (PAGE_BACKGROUNDS[value] ? value : 'paper');

export const coverPreset = (id) => COVER_PRESETS.find((p) => p.id === id) || COVER_PRESETS[0];

// Edit cover: a cover can also be built piece by piece ({ type: 'custom', color, pattern, tape, doodle }),
// and a photo cover can pick its own tape and sticker. Everything in the Keepsake palette and brand kit.
export const COVER_COLORS = { Berry: '#D06B6B', Pink: '#FF9797', Rose: '#E1CFCD', Butter: '#F2CF72', Olive: '#B9D18C', Sage: '#BCD4C9', Taupe: '#9B9090', Maroon: '#510C0D' };
export const COVER_PATTERNS = { none: 'Plain', dots: 'Dots', stripes: 'Stripes', grid: 'Grid', checker: 'Gingham', waves: 'Waves', stars: 'Stars', confetti: 'Confetti', arch: 'Sunrise' };
export const COVER_TAPES = { olive: 'Olive', pink: 'Pink', none: 'No tape' };
export const COVER_DOODLES = {
  'elements/doodle-heart': 'Heart', 'elements/doodle-sparkle': 'Sparkle', 'elements/doodle-star': 'Star',
  'elements/star-small': 'Small star', 'elements/doodle-loop': 'Loop', mark: 'Keepsake mark', none: 'None',
};

// Everything needed to draw a cover, whichever kind it is. `seed` keeps random patterns the same each time.
export function coverStyle(cover, seed = 'cover') {
  // tapePos / doodlePos: where you dragged them, as the center point in % of the cover (unset = the usual spot).
  const place = { tapePos: cover?.tapePos || null, doodlePos: cover?.doodlePos || null };
  // The notebook's look (spine, label style, label spot); edited covers keep the look they started from.
  const look = { spine: cover?.spine || 'rings', label: cover?.label || 'paper', place: cover?.place || 'bottom' };
  // 11/22: the title's format, a page paper instead of a pattern, and how strong / big the background is.
  const fmt = {
    titleAlign: cover?.titleAlign || null, titleSize: Number(cover?.titleSize) || 1, titleColor: cover?.titleColor || null, labelColor: cover?.labelColor || null,
    paper: cover?.paper || null, bgOpacity: cover?.bgOpacity ?? 1, bgSize: Number(cover?.bgSize) || 1,
  };
  if (cover?.type === 'custom') {
    return { id: seed, color: fmt.paper ? '#FFFDFB' : (cover.color || COVER_COLORS.Berry), pattern: fmt.paper ? 'none' : (cover.pattern || 'none'), ink: '#510C0D', tape: cover.tape || 'olive', doodle: cover.doodle || 'none', ...look, ...place, ...fmt };
  }
  if (cover?.type === 'photo') {
    return { id: seed, color: '#510C0D', pattern: 'none', ink: '#510C0D', tape: cover.tape || 'pink', doodle: cover.doodle || 'elements/doodle-heart', ...look, ...place, ...fmt, paper: null };
  }
  const preset = coverPreset(cover?.presetId);
  return { ...preset, tapePos: place.tapePos || preset.tapePos || null, doodlePos: place.doodlePos || preset.doodlePos || null };
}

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
