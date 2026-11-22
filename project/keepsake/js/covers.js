// Book covers: preset colors with CSS/SVG patterns, or an uploaded photo.

import { coverStyle, pageCount } from './model.js';
import { photoUrl } from './storage.js';
import { esc } from './ui.js';

// Small seeded random so a pattern looks the same every time it draws.
function random(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// Keepsake cover patterns: drawn in the brand palette with the brand's shapes (the berry star,
// the hand-drawn heart, graph paper, gingham, stripes), so every cover reads as part of the same set.
const STAR = (x, y, r, fill, op = 1) => `<path d="M${x} ${y - r}L${x + r * 0.22} ${y - r * 0.33}L${x + r} ${y - r * 0.25}L${x + r * 0.44} ${y}L${x + r} ${y + r * 0.5}L${x + r * 0.22} ${y + r * 0.33}L${x} ${y + r}L${x - r * 0.22} ${y + r * 0.33}L${x - r} ${y + r * 0.5}L${x - r * 0.44} ${y}L${x - r} ${y - r * 0.25}L${x - r * 0.22} ${y - r * 0.33}Z" fill="${fill}" opacity="${op}"/>`;
const HEART = (x, y, k, stroke, op = 1) => `<path transform="translate(${x} ${y}) scale(${k})" d="M0 6C-1-2-12-4-12 4c0 6 8 11 12 15 4-4 12-9 12-15 0-8-11-6-12 2Z" fill="none" stroke="${stroke}" stroke-width="${2.4 / k}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`;
const PATTERNS = {
  dots() {
    let s = '';
    for (let row = 0; row < 13; row++) {
      for (let col = 0; col < 10; col++) s += `<circle cx="${col * 34 + (row % 2) * 17 + 8}" cy="${row * 32 + 14}" r="6" fill="#E1CFCD" opacity=".5"/>`;
    }
    return s;
  },
  stripes() {
    let s = '';
    for (let x = 0; x < 320; x += 40) s += `<rect x="${x}" y="0" width="16" height="400" fill="#FBF5F1" opacity=".35"/>`;
    return s;
  },
  grid() {
    let s = '';
    for (let x = 0; x <= 300; x += 20) s += `<path d="M${x} 0v400" stroke="#FFFFFF" stroke-width="${x % 100 ? 1 : 2}" opacity=".55"/>`;
    for (let y = 0; y <= 400; y += 20) s += `<path d="M0 ${y}h300" stroke="#FFFFFF" stroke-width="${y % 100 ? 1 : 2}" opacity=".55"/>`;
    return s;
  },
  waves() {
    let s = '';
    for (let y = 40; y < 420; y += 54) s += `<path d="M-30 ${y}q40-22 80 0t80 0t80 0t80 0t80 0" stroke="#FBF5F1" stroke-width="7" fill="none" stroke-linecap="round" opacity=".45"/>`;
    return s;
  },
  arch() {
    const rings = [['#D06B6B', 150], ['#FF9797', 118], ['#E1CFCD', 86], ['#FBF5F1', 54]];
    return rings.map(([c, r]) => `<path d="M${150 - r} 400a${r} ${r} 0 0 1 ${r * 2} 0z" fill="${c}"/>`).join('') + STAR(226, 84, 26, '#FBF5F1', 0.95);
  },
  stars(ink, seed) {
    const r = random(seed);
    const colors = ['#D06B6B', '#FF9797', '#B9D18C', '#FBF5F1'];
    let s = '';
    for (let i = 0; i < 22; i++) s += STAR(r() * 300, r() * 400, 5 + r() * 9, colors[i % colors.length], 0.55 + r() * 0.4);
    return s;
  },
  checker() {
    let s = '';
    for (let x = 0; x < 320; x += 30) s += `<rect x="${x}" y="0" width="15" height="400" fill="#D06B6B" opacity=".16"/>`;
    for (let y = 0; y < 420; y += 30) s += `<rect x="0" y="${y}" width="300" height="15" fill="#D06B6B" opacity=".16"/>`;
    return s;
  },
  confetti(ink, seed) {
    const r = random(seed);
    const colors = ['#FBF5F1', '#D06B6B', '#B9D18C', '#510C0D'];
    let s = '';
    for (let i = 0; i < 26; i++) {
      const x = r() * 300, y = r() * 380, c = colors[i % colors.length];
      s += i % 2 ? STAR(x, y, 5 + r() * 6, c, 0.8) : HEART(x, y, 0.8 + r() * 0.5, c, 0.8);
    }
    return s;
  },
};

export function patternSvg(preset) {
  if (preset.pattern === 'none') return '';
  const draw = PATTERNS[preset.pattern] || PATTERNS.dots;
  return `<svg class="cover-pattern" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${draw(preset.ink, preset.id)}</svg>`;
}

export const coverColor = (book) => coverStyle(book.cover, book.id).color;

// The notebook's spiral rings down the spine (from the little notebook on the Keepsake board).
const RINGS = `<svg class="cover-rings" viewBox="0 0 20 400" preserveAspectRatio="none" aria-hidden="true" focusable="false">${
  Array.from({ length: 11 }, (_, i) => `<rect x="3" y="${18 + i * 35}" width="17" height="10" rx="5" fill="#7F3F3F"/><rect x="6" y="${20.5 + i * 35}" width="9" height="5" rx="2.5" fill="#FBF5F1" opacity=".55"/>`).join('')
}</svg>`;

// Tape across the top and a doodle on the label: the real Figma elements.
// A placed piece sits with its center on the spot you dragged it to.
const placed = (pos, deg) => (pos ? ` style="left:${pos.x}%;top:${pos.y}%;right:auto;bottom:auto;transform:translate(-50%,-50%) rotate(${deg}deg)"` : '');
const coverBits = (style) => `
  ${style.tape === 'none' ? '' : `<img class="cover-tape" src="./brand/elements/tape-${style.tape || 'olive'}.svg" alt="" draggable="false"${placed(style.tapePos, -7)}>`}
  ${style.doodle === 'none' ? '' : `<img class="cover-doodle" src="./brand/${style.doodle || 'elements/doodle-star'}.svg" alt="" draggable="false"${placed(style.doodlePos, 8)}>`}`;

// Each preset is its own notebook: spiral rings, a cloth spine, or no spine; and a label style and spot.
const lookClasses = (style) => `spine-${style.spine || 'rings'} lbl-${style.label || 'paper'} at-${style.place || 'bottom'}`;
const spineHtml = (style) => (style.spine === 'none' ? '' : `<span class="cover-spine" aria-hidden="true">${style.spine === 'cloth' ? '' : RINGS}</span>`);

// Just the cover art (pattern or photo, spiral spine, tape, and the handwritten title label).
export function coverHtml(book) {
  const cover = book.cover || {};
  const style = coverStyle(cover, book.id || book.title || 'cover');
  if (cover.type === 'photo') {
    return `
      <span class="cover photo-cover ${lookClasses(style)}" data-photo-key="${esc(cover.photoKey)}" style="--cover-bg:#510C0D;--cover-ink:#510C0D">
        <img class="cover-photo" alt="" hidden>
        ${coverBits(style)}
        <span class="cover-label"><span class="cover-title">${esc(book.title)}</span></span>
        ${spineHtml(style)}
      </span>`;
  }
  return `
    <span class="cover ${lookClasses(style)}" style="--cover-bg:${style.color};--cover-ink:${style.ink}">
      ${patternSvg(style)}
      ${coverBits(style)}
      <span class="cover-label"><span class="cover-title">${esc(book.title)}</span></span>
      ${spineHtml(style)}
    </span>`;
}

// The full book object: cover art plus page-edge thickness.
export const bookHtml = (book) => `<span class="book">${coverHtml(book)}</span>`;

// Fills in uploaded photo covers after the HTML is on the page.
export function hydrateCovers(root) {
  root.querySelectorAll('.cover[data-photo-key]').forEach(async (el) => {
    const url = await photoUrl(el.dataset.photoKey).catch(() => null);
    const img = el.querySelector('.cover-photo');
    if (url && img) { img.src = url; img.hidden = false; }
  });
}

export const pagesLabel = (book) => {
  const n = pageCount(book);
  return `${n} ${n === 1 ? 'page' : 'pages'}`;
};
