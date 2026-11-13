// Book covers: preset colors with CSS/SVG patterns, or an uploaded photo.

import { coverPreset, pageCount } from './model.js';
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

const PATTERNS = {
  dots(ink) {
    let s = '';
    for (let row = 0; row < 13; row++) {
      for (let col = 0; col < 10; col++) {
        s += `<circle cx="${col * 34 + (row % 2) * 17 + 8}" cy="${row * 32 + 14}" r="5" fill="${ink}" opacity=".14"/>`;
      }
    }
    return s;
  },
  stripes() {
    let s = '';
    for (let x = -400; x < 700; x += 38) s += `<path d="M${x} 0l-400 400" stroke="#FFFFFF" stroke-width="12" opacity=".2"/>`;
    return s;
  },
  grid() {
    let s = '';
    for (let x = 0; x <= 300; x += 30) s += `<path d="M${x} 0v400" stroke="#FFFFFF" stroke-width="1.5" opacity=".22"/>`;
    for (let y = 0; y <= 400; y += 30) s += `<path d="M0 ${y}h300" stroke="#FFFFFF" stroke-width="1.5" opacity=".22"/>`;
    return s;
  },
  waves() {
    let s = '';
    for (let y = 40; y < 420; y += 54) s += `<path d="M-30 ${y}q40-24 80 0t80 0t80 0t80 0t80 0" stroke="#FFFFFF" stroke-width="8" fill="none" stroke-linecap="round" opacity=".32"/>`;
    return s;
  },
  arch() {
    const rings = [['#E28E52', 150], ['#F6A96B', 118], ['#F9D58E', 86], ['#FBF0D2', 54]];
    return rings.map(([c, r]) => `<path d="M${150 - r} 400a${r} ${r} 0 0 1 ${r * 2} 0z" fill="${c}"/>`).join('')
      + '<circle cx="232" cy="78" r="26" fill="#FBF0D2" opacity=".9"/>';
  },
  stars(ink, seed) {
    const r = random(seed);
    let s = '';
    for (let i = 0; i < 26; i++) {
      const x = r() * 300, y = r() * 300, size = 3 + r() * 9;
      s += `<path d="M${x} ${y - size}C${x + size * 0.15} ${y - size * 0.15} ${x + size * 0.15} ${y - size * 0.15} ${x + size} ${y}C${x + size * 0.15} ${y + size * 0.15} ${x + size * 0.15} ${y + size * 0.15} ${x} ${y + size}C${x - size * 0.15} ${y + size * 0.15} ${x - size * 0.15} ${y + size * 0.15} ${x - size} ${y}C${x - size * 0.15} ${y - size * 0.15} ${x - size * 0.15} ${y - size * 0.15} ${x} ${y - size}Z" fill="#F7E3A6" opacity="${0.45 + r() * 0.5}"/>`;
    }
    return s + '<circle cx="226" cy="70" r="30" fill="#F7E3A6" opacity=".9"/><circle cx="240" cy="62" r="28" fill="#2F3B5C"/>';
  },
  checker(ink) {
    let s = '';
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 8; col++) if ((row + col) % 2 === 0) s += `<rect x="${col * 40}" y="${row * 40}" width="40" height="40" fill="${ink}" opacity=".07"/>`;
    }
    return s;
  },
  confetti(ink, seed) {
    const r = random(seed);
    const colors = ['#FFFFFF', '#F7E3A6', '#9CC5A1', '#8FB3E8'];
    let s = '';
    for (let i = 0; i < 30; i++) {
      const x = r() * 300, y = r() * 330, c = colors[i % colors.length], rot = Math.round(r() * 180);
      const kind = i % 3;
      if (kind === 0) s += `<circle cx="${x}" cy="${y}" r="${4 + r() * 5}" fill="${c}" opacity=".85"/>`;
      if (kind === 1) s += `<rect x="${x}" y="${y}" width="16" height="6" rx="3" fill="${c}" opacity=".85" transform="rotate(${rot} ${x} ${y})"/>`;
      if (kind === 2) s += `<path d="M${x} ${y}q6-8 12 0t12 0" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".9" transform="rotate(${rot} ${x} ${y})"/>`;
    }
    return s;
  },
};

export function patternSvg(preset) {
  const draw = PATTERNS[preset.pattern] || PATTERNS.dots;
  return `<svg class="cover-pattern" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${draw(preset.ink, preset.id)}</svg>`;
}

export const coverColor = (book) => (book.cover?.type === 'photo' ? '#3B4568' : coverPreset(book.cover?.presetId).color);

// Just the cover art (pattern or photo, spine strip, title).
export function coverHtml(book) {
  const cover = book.cover || {};
  if (cover.type === 'photo') {
    return `
      <span class="cover photo-cover" data-photo-key="${esc(cover.photoKey)}" style="--cover-bg:#3B4568;--cover-ink:#FBFAF6">
        <img class="cover-photo" alt="" hidden>
        <span class="cover-title on-photo">${esc(book.title)}</span>
        <span class="cover-spine" aria-hidden="true"></span>
      </span>`;
  }
  const preset = coverPreset(cover.presetId);
  return `
    <span class="cover" style="--cover-bg:${preset.color};--cover-ink:${preset.ink}">
      ${patternSvg(preset)}
      <span class="cover-title">${esc(book.title)}</span>
      <span class="cover-spine" aria-hidden="true"></span>
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
