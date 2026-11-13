// Rendering pages and spreads to HTML. Used by the open book, the overview, and the open/close animation.

import { CATEGORIES, SEASONS } from './model.js';
import { stickerSvg, STICKERS } from './stickers.js';
import { photoUrl } from './storage.js';
import { esc } from './ui.js';

// The book as a list of spreads. With a bucket list on, the table of contents is spread 0.
export function spreadsOf(book) {
  const list = book.spreads.map((spread) => ({ kind: 'spread', spread }));
  return book.hasBucketList ? [{ kind: 'toc' }, ...list] : list;
}

export const spreadPageNumbers = (index) => [index * 2 + 1, index * 2 + 2];
export const ppLabel = (index) => {
  const [a, b] = spreadPageNumbers(index);
  return `pp. ${a}–${b}`;
};

export function spreadTitle(book, index) {
  const entry = spreadsOf(book)[index];
  if (!entry) return '';
  return entry.kind === 'toc' ? 'Our bucket list' : entry.spread.title || 'Untitled spread';
}

export function itemStyle(item) {
  return `left:${item.x}%;top:${item.y}%;width:${item.width}%;transform:rotate(${item.rotation || 0}deg);z-index:${item.z || 1}`;
}

// Plain sans for now (branding will bring back the handwriting fonts in FONTS).
// Sizes were set for handwriting, which runs larger, so they're scaled down.
export const textFontSize = (item) => `${(item.size || 7) * 0.6}cqw`;

export function itemLabel(item) {
  if (item.type === 'photo') return 'Photo';
  if (item.type === 'text') return item.content.trim() ? `Note: ${item.content.trim().slice(0, 40)}` : 'Empty note';
  return `${STICKERS[item.kind]?.label || 'Sticker'} sticker`;
}

// In the open book, items can be selected (and reached with Tab), so they get a role and label.
function itemHtml(item, interactive) {
  const attrs = `data-id="${esc(item.id)}" style="${itemStyle(item)}${item.type === 'text' ? `;font-family:var(--page-font);font-size:${textFontSize(item)};color:${esc(item.color || '#2B2B2B')}` : ''}"`
    + (interactive ? ` tabindex="0" role="button" aria-pressed="false" aria-label="${esc(itemLabel(item))}"` : '');
  if (item.type === 'photo') {
    const fill = item.photoKey
      ? `<img class="photo-img" data-photo-key="${esc(item.photoKey)}" alt="" draggable="false">`
      : `<span class="photo-fill" style="--ar:1 / ${item.aspect || 0.78};background:${esc(item.placeholder || '#DDD6CA')}"></span>`;
    return `<div class="pi pi-photo" ${attrs}><span class="photo-frame">${fill}</span></div>`;
  }
  if (item.type === 'text') {
    return `<div class="pi pi-text" ${attrs} data-placeholder="Write something">${esc(item.content)}</div>`;
  }
  return `<div class="pi pi-sticker" ${attrs}>${stickerSvg(item.kind, item.color)}</div>`;
}

export const pageItemsHtml = (page, interactive = false) =>
  [...page.items].sort((a, b) => (a.z || 0) - (b.z || 0)).map((item) => itemHtml(item, interactive)).join('');

// Table of contents: the bucket list. In the open book it's interactive (buttons);
// in thumbnails and the opening cover it's a plain copy, so nothing nests inside other buttons.
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const TOC_LEFT = 5;

export const spreadIndexOf = (book, spreadId) => spreadsOf(book).findIndex((e) => e.kind === 'spread' && e.spread.id === spreadId);

function tocEntryHtml(book, item, interactive) {
  const members = Object.fromEntries(book.members.map((m) => [m.id, m]));
  const adder = members[item.addedBy];
  const going = item.whosIn.map((id) => members[id]).filter(Boolean);
  const spreadIndex = spreadIndexOf(book, item.spreadId);
  const page = spreadIndex > 0 ? spreadPageNumbers(spreadIndex)[0] : null;
  const done = item.status === 'done';
  const face = (m) => `<span class="avatar" style="--avatar:${esc(m.color)}" title="${esc(m.name)}">${esc(m.name.charAt(0))}</span>`;
  const title = interactive
    ? `<button type="button" class="toc-title toc-open" data-action="toc-item" data-id="${esc(item.id)}" aria-haspopup="dialog">${esc(item.title)}<span class="visually-hidden">${done ? ', done' : ''}</span></button>`
    : `<span class="toc-title">${esc(item.title)}</span>`;
  const link = done && page
    ? (interactive
      ? `<button type="button" class="toc-link" data-action="toc-link" data-index="${spreadIndex}" aria-label="Go to page ${page}, ${esc(item.title)}">p. ${page} →</button>`
      : `<span class="toc-link">p. ${page} →</span>`)
    : '';
  return `
    <li class="toc-entry ${done ? 'is-done' : ''}">
      <span class="toc-mark" aria-hidden="true">${done ? CHECK : ''}</span>
      <span class="toc-main">
        ${title}
        <span class="toc-meta">
          <span class="cat-dot" style="background:${CATEGORIES[item.category] || '#DDD'}"></span>${esc(item.category)} · ${esc(item.season || 'Someday')}
          ${adder ? `<span class="toc-by">added by ${face(adder)}</span>` : ''}
        </span>
      </span>
      <span class="avatars toc-going" aria-label="${going.length} in">${going.slice(0, 4).map(face).join('')}</span>
      ${link}
    </li>`;
}

// Ideas in season order (Summer, Fall, Winter, Spring, Someday), optionally just one season.
export function sortedIdeas(book, season = null) {
  const rank = (i) => { const r = SEASONS.indexOf(i.season || 'Someday'); return r < 0 ? SEASONS.length : r; };
  return book.bucketList
    .map((item, order) => ({ item, order }))
    .filter(({ item }) => !season || (item.season || 'Someday') === season)
    .sort((a, b) => rank(a.item) - rank(b.item) || a.order - b.order)
    .map(({ item }) => item);
}

function seasonTabsHtml(season, interactive) {
  const tab = (value, label) => {
    const on = (season || null) === value;
    return interactive
      ? `<button type="button" class="season-tab" data-action="toc-season" data-season="${value || ''}" aria-pressed="${on}">${label}</button>`
      : `<span class="season-tab" aria-pressed="${on}">${label}</span>`;
  };
  return `<div class="season-tabs" role="group" aria-label="Show ideas for">${tab(null, 'All')}${SEASONS.map((s) => tab(s, s)).join('')}</div>`;
}

function tocHtml(book, interactive, season = null) {
  const items = sortedIdeas(book, season);
  const left = items.slice(0, TOC_LEFT);
  const right = items.slice(TOC_LEFT);
  const add = interactive
    ? '<button type="button" class="toc-add" data-action="add-idea">+ Add an idea</button>'
    : '<span class="toc-add">+ Add an idea</span>';
  const empty = !items.length
    ? `<p class="toc-empty">${season ? `Nothing for ${season.toLowerCase() === 'someday' ? 'someday' : season} yet.` : 'Nothing here yet. Add the first thing your group wants to do.'}</p>`
    : '';
  return {
    left: `<div class="toc"><h2 class="toc-heading">Our bucket list</h2>${book.bucketList.length ? seasonTabsHtml(season, interactive) : ''}${empty}<ul class="toc-list">${left.map((i) => tocEntryHtml(book, i, interactive)).join('')}</ul>${items.length < TOC_LEFT ? add : ''}</div>`,
    right: `<div class="toc toc-right"><ul class="toc-list">${right.map((i) => tocEntryHtml(book, i, interactive)).join('')}</ul>${items.length >= TOC_LEFT ? add : ''}</div>`,
  };
}

// HTML for both pages of spread `index`.
export function spreadPagesHtml(book, index, { interactive = false, season = null } = {}) {
  const entry = spreadsOf(book)[index];
  if (!entry) return { left: '', right: '' };
  if (entry.kind === 'toc') return tocHtml(book, interactive, season);
  const { spread } = entry;
  // Finished spreads link back to the table of contents.
  const back = book.hasBucketList && spread.linkedItemId
    ? (interactive
      ? '<button type="button" class="back-contents" data-action="back-to-contents">← back to contents</button>'
      : '<span class="back-contents">← back to contents</span>')
    : '';
  const isEmpty = !spread.leftPage.items.length && !spread.rightPage.items.length;
  const hint = isEmpty && interactive
    ? `<p class="page-empty"><strong>${esc(spread.title || 'New spread')}</strong>This spread is ready for photos, notes, and stickers.</p>`
    : '';
  return { left: back + pageItemsHtml(spread.leftPage, interactive), right: hint + pageItemsHtml(spread.rightPage, interactive) };
}

// Uploaded photos live in IndexedDB; fill them in after the HTML is on the page.
export function hydratePhotos(root) {
  root.querySelectorAll('img[data-photo-key]:not([src])').forEach(async (img) => {
    const url = await photoUrl(img.dataset.photoKey).catch(() => null);
    if (url) img.src = url;
  });
}
