// In-place spread editor: select, move, resize, rotate, and delete page items;
// add photos (file picker or drag-and-drop), text, and stickers; undo and redo.
// Every change saves right away. Item positions are percentages of the page.

import { commit, reportPageItem } from './state.js';
import { track, EVENTS } from './analytics.js';
import { ME } from './identity.js';
import { canChange, canReport, adderOf, allowAdds } from './moderation.js';
import { openReportDialog, showTakeDownHelp } from './report.js';
import { createPageItem, uid, FONTS, fontCss, fontOf, PAGE_BG_GROUPS, PLAIN_BGS, bgOpacity, bgSize, pageBg, TEXT_COLORS, TAPE_COLORS } from './model.js';
import { storeMedia, addToRoll, rollOf, tileHtml, mediaFiles, MAX_VIDEO_MB } from './media.js';
import { hydratePhotos } from './pages.js';
import { LAYOUTS, layoutById, layoutPreview, cropToSlot } from './layouts.js';
import { openPhotoEditor } from './photoedit.js';
import { putPhoto, resizeImage } from './storage.js';
import { STICKERS, STICKER_COLORS, TRAY, ELEMENT_TRAY, stickerSvg, isBrandSticker, isTape } from './stickers.js';
import { itemStyle, textFontSize, itemLabel, NOTE_ALIGNS, NOTE_LABELS } from './pages.js';
import { esc, toast, announce, brandColor } from './ui.js';

const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
const ROTATE_ICON = svg('<path d="M19 12a7 7 0 1 1-2.1-5M19 4v4.5h-4.5"/>');
export const STICKER_WIDTH = { yay: 26, bestday: 34, omg: 22, us: 18, 'washi-pink': 40, 'washi-blue': 40, 'washi-mint': 40 };
export const STICKER_ASPECT = { yay: 0.5, bestday: 0.36, omg: 0.6, us: 0.7, 'washi-pink': 0.24, 'washi-blue': 0.24, 'washi-mint': 0.24 };
// Keepsake stickers: a little bigger by default, and the wide ones (labels, tape) wider still.
Object.assign(STICKER_WIDTH, { 'e-tape-olive': 36, 'e-tape-pink': 36, 'e-star': 14, 'e-star-small': 9, 'e-mark': 14, 'e-notebook': 16, 'e-heart': 16, 'e-loop': 30, 'e-doodle-star': 14, 'e-sparkle': 10, 'e-arrow': 34, 'e-underline': 50, 'k-heart': 24, 'k-star': 22, 'k-smiley': 22, 'k-sun': 24, 'k-flower': 24, 'k-polaroid': 26, 'k-we-did-it': 30, 'k-best-day': 36, 'k-done': 20, 'k-together': 34, 'k-leaf-star': 20, 'k-tape': 38, 'k-bff': 24, 'k-you': 26 });
Object.assign(STICKER_ASPECT, { 'e-tape-olive': 0.24, 'e-tape-pink': 0.24, 'e-star': 1.15, 'e-star-small': 1.14, 'e-mark': 0.95, 'e-notebook': 1.29, 'e-heart': 0.93, 'e-loop': 0.66, 'e-doodle-star': 0.93, 'e-sparkle': 1, 'e-arrow': 0.33, 'e-underline': 0.1, 'k-heart': 0.97, 'k-star': 1, 'k-smiley': 1.04, 'k-sun': 1, 'k-flower': 1.02, 'k-polaroid': 1.11, 'k-we-did-it': 0.89, 'k-best-day': 0.49, 'k-done': 1.02, 'k-together': 0.76, 'k-leaf-star': 1.09, 'k-tape': 0.53, 'k-bff': 1.06, 'k-you': 0.95 });
const HISTORY_LIMIT = 60;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const ALIGN_ICONS = {
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 10h10M4 14h16M4 18h10"/></svg>',
  center: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 10h10M4 14h16M7 18h10"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M10 10h10M4 14h16M10 18h10"/></svg>',
};
const TYPE_NAME = { photo: 'Photo', text: 'Text', sticker: 'Sticker' };

// The edit panel that slides in from the right while editing.
export function panelHtml() {
  return `
    <aside class="edit-panel" id="edit-panel" aria-label="Edit this spread" hidden>
      <div class="panel-head">
        <h2>Edit spread</h2>
        <button type="button" class="pill-btn panel-done" data-edit="done">Done</button>
      </div>

      <section class="panel-section selected-tools" id="selected-tools" hidden aria-labelledby="selected-title">
        <h3 id="selected-title">Selected</h3>
        <p class="sel-credit" id="sel-credit" hidden></p>
        <p class="multi-hint">Drag any of them to move them all together. Shift-click to add or take one out.</p>
        <div id="sel-edit-tools">
          <div class="sel-group" id="sel-size-group">
            <h4>Size &amp; angle</h4>
            <label class="slider-row"><span>Size</span><input type="range" id="sel-size" min="5" max="100" step="1"><output id="sel-size-out"></output></label>
            <label class="slider-row"><span>Rotate</span><input type="range" id="sel-rotate" min="-180" max="180" step="1"><output id="sel-rotate-out"></output></label>
          </div>
          <div class="sel-group" id="sel-tape-group" hidden>
            <h4>Tape color</h4>
            <div class="swatch-row" id="sel-tape-colors" role="group" aria-label="Tape color">
              ${Object.entries(TAPE_COLORS).map(([name, hex]) => `<button type="button" class="color-chip" data-edit="color" data-color="${hex}" aria-label="${name} tape" aria-pressed="false"><span class="swatch-dot tape-dot" style="background:${hex}"></span>${name}</button>`).join('')}
            </div>
          </div>
          <div class="sel-group" id="sel-color-group" hidden>
            <h4>Color</h4>
            <div class="swatch-row" id="sel-colors" role="group" aria-label="Sticker color">
              ${Object.entries(STICKER_COLORS).map(([name, hex]) => `<button type="button" class="swatch" data-edit="color" data-color="${hex}" style="background:${hex}" aria-label="${name}" aria-pressed="false"></button>`).join('')}
            </div>
          </div>
          <div class="sel-group">
            <h4>Arrange</h4>
            <div class="selected-actions">
              <button type="button" class="pill-btn small" data-edit="fill-slot" id="sel-fill-slot" hidden>Choose photo</button>
              <button type="button" class="pill-btn small" data-edit="edit-photo" id="sel-edit-photo" hidden>Edit photo</button>
              <button type="button" class="pill-btn small" data-edit="forward">Bring forward</button>
              <button type="button" class="pill-btn small" data-edit="backward">Send backward</button>
              <button type="button" class="pill-btn small" data-edit="duplicate">Duplicate</button>
              <button type="button" class="pill-btn small" data-edit="center">Center on page</button>
              <button type="button" class="pill-btn small" data-edit="lock" id="sel-lock">Lock in place</button>
            </div>
            <button type="button" class="pill-btn small danger-text sel-remove" data-edit="delete">Remove</button>
          </div>
        </div>
        <button type="button" class="link-btn report-btn" data-edit="report" hidden>Report</button>
      </section>

      <section class="panel-section" aria-labelledby="photos-title">
        <h3 id="photos-title">Photos &amp; videos <span class="muted" id="photo-count"></span></h3>
        <div class="dropzone" id="dropzone">
          <p>Drag photos or videos here</p>
          <button type="button" class="pill-btn" data-edit="photo">Browse</button>
          <p class="panel-hint">Videos up to ${MAX_VIDEO_MB} MB play on a loop, with no sound.</p>
        </div>
        <input type="file" id="photo-input" accept="image/*,video/*" multiple hidden>
        <div class="recent" id="recent" hidden>
          <div class="recent-head"><h4>Recently uploaded</h4><button type="button" class="link-btn" data-edit="camera-roll">Camera roll</button></div>
          <div class="recent-row" id="recent-row"></div>
        </div>
      </section>

      <section class="panel-section" aria-labelledby="layouts-title">
        <h3 id="layouts-title">Layouts</h3>
        <div class="layout-side" role="group" aria-label="Which page the layout goes on">
          <span>Add to</span>
          <button type="button" class="side-btn" data-edit="layout-side" data-side="left" aria-pressed="true">Left page</button>
          <button type="button" class="side-btn" data-edit="layout-side" data-side="right" aria-pressed="false">Right page</button>
        </div>
        <div class="layout-row">
          ${LAYOUTS.map((l) => `<button type="button" class="layout-btn" data-edit="layout" data-layout="${l.id}"><span class="layout-pic">${layoutPreview(l)}</span><span class="bg-name">${l.name}</span></button>`).join('')}
        </div>
        <p class="panel-hint layout-note" id="layout-note"></p>
        <input type="file" id="slot-input" accept="image/*,video/*" hidden>
      </section>

      <section class="panel-section" aria-labelledby="bg-title">
        <h3 id="bg-title">Page background</h3>
        <div class="bg-adjust" id="bg-adjust" hidden>
          <label class="slider-row"><span>Opacity</span><input type="range" id="bg-op" min="10" max="100" step="5"><output id="bg-op-out"></output></label>
          <label class="slider-row" id="bg-size-row"><span>Size</span><input type="range" id="bg-size" min="50" max="250" step="10"><output id="bg-size-out"></output></label>
          <button type="button" class="link-btn" data-edit="bg-reset">Reset opacity and size</button>
        </div>
        ${PAGE_BG_GROUPS.map(([group, items]) => `
          <h4 class="bg-group">${group}</h4>
          <div class="bg-row" role="group" aria-label="${group} backgrounds">
            ${Object.entries(items).map(([id, label]) => `<button type="button" class="bg-mini" data-edit="page-bg" data-bg-choice="${id}" aria-label="${label}" aria-pressed="false"><span class="bg-swatch" data-bg="${id}"></span><span class="bg-name">${label}</span></button>`).join('')}
          </div>`).join('')}
        <button type="button" class="link-btn remove-pages-link" data-action="remove-spread">Remove these pages</button>
      </section>

      <section class="panel-section" aria-labelledby="text-title">
        <h3 id="text-title">Text</h3>
        <button type="button" class="pill-btn" data-edit="text">+ Add text box</button>
        <!-- The note's options drop down right here when a note is selected (11/19 feedback) -->
          <div class="text-drop" id="sel-font-group" hidden>
            <p class="text-drop-head">Your note</p>
            <div id="text-size-slot"></div>
            ${Object.keys(FONTS).length > 1 ? `<h4>Font</h4>` : ''}
            <div class="font-grid" id="sel-fonts" role="group" aria-label="Note font" ${Object.keys(FONTS).length > 1 ? '' : 'hidden'}>
              ${Object.entries(FONTS).map(([id, f]) => `<button type="button" class="font-card" data-edit="font" data-font="${id}" aria-pressed="false">
                <span class="font-sample" style="font-family:${f.family};font-weight:${f.weight || 400};font-size:${Math.round(30 * (f.size || 1))}px">Aa</span>
                <span class="font-name">${f.label}</span><span class="font-role">${f.role}</span></button>`).join('')}
            </div>
            <h4 class="sel-sub">Align</h4>
            <div class="align-row" id="sel-align" role="group" aria-label="Text alignment">
              ${NOTE_ALIGNS.map((a) => `<button type="button" class="align-btn" data-edit="align" data-align="${a}" aria-label="Align ${a}" aria-pressed="false">${ALIGN_ICONS[a]}</button>`).join('')}
            </div>
            <h4 class="sel-sub">Label</h4>
            <div class="label-row" id="sel-label" role="group" aria-label="Label behind the text">
              ${Object.entries(NOTE_LABELS).map(([id, name]) => `<button type="button" class="label-chip" data-edit="label" data-label="${id}" aria-pressed="false"><span class="label-sample label-${id}">Aa</span>${name}</button>`).join('')}
            </div>
            <h4 class="sel-sub">Color</h4>
            <div class="swatch-row" id="sel-text-colors" role="group" aria-label="Note color">
              ${Object.entries(TEXT_COLORS).map(([name, hex]) => `<button type="button" class="color-chip" data-edit="text-color" data-color="${hex}" aria-label="${name}" aria-pressed="false"><span class="swatch-dot" style="background:${hex}"></span>${name}</button>`).join('')}
            </div>
          </div>
      </section>

      <section class="panel-section" aria-labelledby="stickers-title">
        <h3 id="stickers-title">Stickers</h3>
        <div class="sticker-grid">
          ${TRAY.map((kind) => `<button type="button" class="tray-btn" data-edit="add-sticker" data-kind="${kind}" aria-label="Add ${esc(STICKERS[kind].label)}">${STICKERS[kind].svg()}</button>`).join('')}
        </div>
        <h3 class="tray-sub">Tape &amp; doodles</h3>
        <div class="sticker-grid element-grid">
          ${ELEMENT_TRAY.map((kind) => `<button type="button" class="tray-btn" data-edit="add-sticker" data-kind="${kind}" aria-label="Add ${esc(STICKERS[kind].label)}">${STICKERS[kind].svg()}</button>`).join('')}
        </div>
        <p class="panel-hint">Drag a sticker onto the page or click to drop it in the middle. Click anything on the page to move, rotate, or resize it.</p>
      </section>

      <div class="panel-foot">
        <button type="button" class="pill-btn small" data-edit="undo">Undo</button>
        <button type="button" class="pill-btn small" data-edit="redo">Redo</button>
      </div>
    </aside>`;
}

// 11/21 try-out: the edit panel in tabs (Photos, Text, Stickers, Page), Undo/Redo up in the header, and a note's
// font and color inside Selected with its other tools. Set PANEL_TABS to false to go back to the one long list.
const PANEL_TABS = true;
const TABS = [
  ['photos', 'Photos', 'photos-title'],
  ['text', 'Text', 'text-title'],
  ['stickers', 'Stickers', 'stickers-title'],
  ['layouts', 'Layouts', 'layouts-title'],
  ['page', 'Page', 'bg-title'],
];
const TAB_KEY = 'keepsake.editTab';

function arrangePanelTabs(panel) {
  panel.classList.add('tabs-mode');
  // Undo / Redo / Done together in the header.
  const head = panel.querySelector('.panel-head');
  const foot = panel.querySelector('.panel-foot');
  const tools = document.createElement('div');
  tools.className = 'panel-head-tools';
  const close = head.querySelector('.panel-done');
  // This one leaves the editor, so it says "Done editing"; "Done" on the Selected card only finishes with the item.
  close.textContent = 'Done editing';
  // Undo / Redo as small arrow buttons so the header fits on one line.
  const UNDO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
  const REDO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>';
  [['undo', UNDO, 'Undo'], ['redo', REDO, 'Redo']].forEach(([id, icon, label]) => {
    const btn = foot.querySelector(`[data-edit="${id}"]`);
    btn.innerHTML = icon;
    btn.classList.add('icon-only');
    btn.setAttribute('aria-label', label);
    btn.title = label;
  });
  tools.append(...foot.children, close);
  head.append(tools);
  foot.remove();
  panel.querySelector('#selected-title').insertAdjacentHTML('afterend',
    '<button type="button" class="pill-btn small sel-done" data-edit="deselect" aria-label="Done with this item">Done</button>');
  // A note's font and color live with the rest of the Selected tools.
  panel.querySelector('#sel-edit-tools').prepend(panel.querySelector('#sel-font-group'));
  // The tab bar, then the Selected card, then one section per tab.
  const bar = document.createElement('div');
  bar.className = 'panel-tabs';
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', 'Add to the page');
  // Tabs always sit at the top, right under the header; the Selected card goes between them and the tab's content.
  const selected = panel.querySelector('#selected-tools');
  selected.before(bar);
  let after = selected;
  const sections = {};
  for (const [id, label, titleId] of TABS) {
    const section = panel.querySelector(`[aria-labelledby="${titleId}"]`);
    section.classList.add('tab-panel');
    section.id = `tab-panel-${id}`;
    section.setAttribute('role', 'tabpanel');
    section.setAttribute('aria-labelledby', `tab-${id}`);
    after.after(section);
    after = section;
    sections[id] = section;
    bar.insertAdjacentHTML('beforeend', `<button type="button" class="panel-tab" role="tab" id="tab-${id}" data-tab="${id}" aria-controls="tab-panel-${id}">${label}</button>`);
  }
  const show = (id, { focus = false } = {}) => {
    bar.querySelectorAll('.panel-tab').forEach((t) => {
      const on = t.dataset.tab === id;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    Object.entries(sections).forEach(([key, el]) => { el.hidden = key !== id; });
    try { localStorage.setItem(TAB_KEY, id); } catch { /* remembering the tab is only a convenience */ }
  };
  bar.addEventListener('click', (event) => {
    const tab = event.target.closest('.panel-tab');
    if (tab) show(tab.dataset.tab);
  });
  bar.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    event.stopPropagation();
    const ids = TABS.map(([id]) => id);
    const now = ids.indexOf(bar.querySelector('[aria-selected="true"]')?.dataset.tab);
    show(ids[(now + (event.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length], { focus: true });
  });
  let saved = null;
  try { saved = localStorage.getItem(TAB_KEY); } catch { /* private mode */ }
  show(TABS.some(([id]) => id === saved) ? saved : 'photos');
}

export function createEditor({ root, book, spreadEl, currentSpread, rerender, isEnabled = () => true, onDone, onSelect, onLive, onCameraRoll }) {
  // Editing only works on a regular spread while edit mode is on.
  const editable = () => Boolean(currentSpread()) && isEnabled();
  const panel = root.querySelector('#edit-panel');
  if (PANEL_TABS) arrangePanelTabs(panel);
  const view = root.querySelector('.book-view');
  const selTools = panel.querySelector('#selected-tools');
  const rotateInput = panel.querySelector('#sel-rotate');
  const sizeInput = panel.querySelector('#sel-size');
  const fileInput = panel.querySelector('#photo-input');
  const dropzone = panel.querySelector('#dropzone');
  let selectedId = null;
  // Shift-click to select several things (11/21). selectedId is the one you clicked last; multiIds holds them all.
  const multiIds = new Set();
  let editingId = null;
  let activeSide = null;
  const history = { undo: [], redo: [] };

  // ---- Data helpers ----
  const snapshot = () => JSON.stringify(book.spreads);
  function record(snap = snapshot()) {
    history.undo.push(snap);
    if (history.undo.length > HISTORY_LIMIT) history.undo.shift();
    history.redo = [];
  }
  const pageOf = (spread, side) => (side === 'left' ? spread.leftPage : spread.rightPage);
  function find(id) {
    const spread = currentSpread();
    if (!spread || !id) return null;
    for (const side of ['left', 'right']) {
      const page = pageOf(spread, side);
      const item = page.items.find((i) => i.id === id);
      if (item) return { item, side, page, spread };
    }
    return null;
  }
  const itemEl = (id) => (id ? spreadEl.querySelector(`.page-inner .pi[data-id="${CSS.escape(id)}"]`) : null);
  const allItems = (spread) => [...spread.leftPage.items, ...spread.rightPage.items];
  const topZ = (spread) => Math.max(0, ...allItems(spread).map((i) => i.z || 0));
  function targetSide(spread) {
    if (activeSide) return activeSide;
    return spread.leftPage.items.length <= spread.rightPage.items.length ? 'left' : 'right';
  }
  const save = () => commit();
  // Only your own things (or anything, if you made the book) can be moved, changed or removed.
  const mine = (found) => Boolean(found) && canChange(book, found.item);
  // Photos and videos are a group thing: anyone in the book can edit them (crop, frame, filter, move, resize).
  // Removing one still stays with the person who added it (and the book's creator).
  const canEdit = (found) => mine(found) || (Boolean(found) && found.item.type === 'photo');
  function explainLocked(found) {
    const adder = adderOf(book, found.item);
    const who = adder?.name || 'the person who added it';
    toast(found.item.type === 'photo' ? `Only ${who} can remove this. You can report it if it's not OK.` : `Only ${who} can change this. You can report it if it's not OK.`);
  }
  // A cap on how fast one person can add things to a spread (threats.md: "Piling on").
  function underLimit(spread, count = 1) {
    const { ok, wait } = allowAdds(spread.id, count);
    if (!ok) toast(`That's a lot at once. You can add more to this spread in ${wait} seconds.`);
    return ok;
  }

  // ---- Selection ----
  function clearHandles() {
    spreadEl.querySelectorAll('.pi.multi-selected').forEach((el) => el.classList.remove('multi-selected'));
    spreadEl.querySelectorAll('.pi.selected').forEach((el) => {
      el.classList.remove('selected');
      el.setAttribute('aria-pressed', 'false');
      el.querySelectorAll('.handle').forEach((h) => h.remove());
    });
  }

  function applySelection() {
    clearHandles();
    const el = itemEl(selectedId);
    if (!el) selectedId = null;
    for (const id of [...multiIds]) if (!itemEl(id) || !selectedId) multiIds.delete(id);
    if (multiIds.size === 1) multiIds.clear();
    multiIds.forEach((id) => { if (id !== selectedId) itemEl(id)?.classList.add('multi-selected'); });
    if (el) {
      el.classList.add('selected');
      el.setAttribute('aria-pressed', 'true');
      if (multiIds.size < 2 && editingId !== selectedId && canEdit(find(selectedId)) && !find(selectedId).item.locked) {
        // No whitespace between handles: notes read their text from the element.
        el.insertAdjacentHTML('beforeend', `<span class="handle h-rotate" aria-hidden="true">${ROTATE_ICON}</span><span class="handle h-resize" aria-hidden="true"></span>`);
      }
      // A × on the corner to remove it (11/18 crit: "can't delete elements"). On other people's things it explains who can.
      // The × to remove it is drawn by the book view in a layer above the spread (so tape or the page edge can't hide it).
    }
    updatePanel();
    onSelect?.(selectedId); // live: others see what you've selected
  }

  // The panel's "Selected" section mirrors the selected item.
  function updatePanel() {
    const found = find(selectedId);
    selTools.hidden = !found;
    const many = multiIds.size > 1;
    selTools.classList.toggle('is-multi', many);
    if (found) {
      const { item } = found;
      panel.querySelector('#selected-title').textContent = many ? `${multiIds.size} things selected` : `Selected: ${TYPE_NAME[item.type]}`;
      const adder = adderOf(book, item);
      const credit = panel.querySelector('#sel-credit');
      credit.hidden = !adder;
      if (adder) {
        credit.innerHTML = `Added by <span class="credit-name" style="--by:${esc(brandColor(adder.color))}">${adder.id === ME ? 'you' : esc(adder.name)}</span>`
          + (mine(found) ? '' : item.type === 'photo' ? `. Anyone can edit it. Only ${esc(adder.name)} can remove it.` : `. Only ${esc(adder.name)} can change it.`);
      }
      panel.querySelector('#sel-edit-tools').hidden = !canEdit(found);
      const locked = Boolean(item.locked);
      panel.querySelector('#sel-lock').textContent = locked ? 'Unlock' : 'Lock in place';
      panel.querySelector('#sel-lock').setAttribute('aria-pressed', String(locked));
      panel.querySelector('#selected-tools').classList.toggle('is-locked', locked);
      panel.querySelector('[data-edit="delete"]').hidden = !mine(found);
      panel.querySelector('[data-edit="report"]').hidden = !canReport(item);
      rotateInput.value = Math.round(item.rotation || 0);
      panel.querySelector('#sel-rotate-out').textContent = `${Math.round(item.rotation || 0)}°`;
      sizeInput.value = Math.round(item.width);
      panel.querySelector('#sel-size-out').textContent = `${Math.round(item.width)}%`;
      panel.querySelector('#sel-edit-photo').hidden = item.type !== 'photo' || Boolean(item.slot);
      panel.querySelector('#sel-fill-slot').hidden = !item.slot;
      panel.querySelector('#sel-edit-photo').textContent = item.video ? 'Edit video' : 'Edit photo';
      const tape = item.type === 'sticker' && isTape(item.kind);
      panel.querySelector('#sel-color-group').hidden = item.type !== 'sticker' || tape || isBrandSticker(item.kind);
      panel.querySelector('#sel-colors').querySelectorAll('.swatch').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === item.color)));
      panel.querySelector('#sel-tape-group').hidden = !tape;
      panel.querySelector('#sel-tape-colors').querySelectorAll('.color-chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === item.color)));

      const current = FONTS[item.font] ? item.font : 'avenir';
      panel.querySelectorAll('#sel-fonts .font-card').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.font === current)));
      panel.querySelectorAll('#sel-align .align-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.align === (item.align || 'left'))));
      panel.querySelectorAll('#sel-label .label-chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.label === (item.label || 'none'))));
      panel.querySelectorAll('#sel-text-colors .color-chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color.toLowerCase() === String(item.color || '').toLowerCase())));
    }
    const textDrop = panel.querySelector('#sel-font-group');
    const wasHidden = textDrop.hidden;
    const isNote = Boolean(found && found.item.type === 'text' && mine(found));
    textDrop.hidden = !isNote;
    // For a note, its Size & angle sliders sit in the note dropdown with its font and color, so it's all together.
    const sizeGroup = panel.querySelector('#sel-size-group');
    const home = isNote ? panel.querySelector('#text-size-slot') : panel.querySelector('#sel-edit-tools');
    if (sizeGroup.parentElement !== home) home.prepend(sizeGroup);
    // When a note is picked, bring its options into view under "+ Add text box".
    if (wasHidden && !textDrop.hidden) requestAnimationFrame(() => textDrop.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    const spread = currentSpread();
    renderRecent();
    panel.querySelectorAll('[data-edit="layout-side"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.side === (activeSide || 'left'))));
    if (spread) {
      const side = activeSide || 'left';
      const page = pageOf(spread, side);
      const state = layoutState(page);
      panel.querySelectorAll('[data-edit="layout"]').forEach((b) => {
        b.disabled = state === 'full';
        b.setAttribute('aria-pressed', String(state !== 'full' && page.layout === b.dataset.layout));
      });
      panel.querySelector('#layout-note').textContent = state === 'full'
        ? `The ${side} page already has things on it. Layouts are for starting a blank page.`
        : state === 'swap'
          ? 'Pick a different layout to swap it. Once you add a photo or write a note, it stays.'
          : 'Pick one to start this page. Then double-click a photo box to fill it, or drop a photo on it.';
    }
    const bgNow = pageBg(spread?.bg);
    panel.querySelectorAll('[data-edit="page-bg"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bgChoice === bgNow)));
    // Opacity for any paper but plain white; Size only for papers with a pattern.
    const adjust = panel.querySelector('#bg-adjust');
    adjust.hidden = !spread || bgNow === 'paper';
    panel.querySelector('#bg-size-row').hidden = PLAIN_BGS.has(bgNow);
    if (spread) {
      const op = Math.round(bgOpacity(spread) * 100);
      const size = Math.round(bgSize(spread) * 100);
      panel.querySelector('#bg-op').value = op;
      panel.querySelector('#bg-op-out').textContent = `${op}%`;
      panel.querySelector('#bg-size').value = size;
      panel.querySelector('#bg-size-out').textContent = `${size}%`;
    }
    const photos = spread ? allItems(spread).filter((i) => i.type === 'photo').length : 0;
    panel.querySelector('#photo-count').textContent = photos ? `${photos} on this spread` : '';
    panel.querySelector('[data-edit="undo"]').disabled = !history.undo.length;
    panel.querySelector('[data-edit="redo"]').disabled = !history.redo.length;
  }

  function select(id, { focus = false, add = false } = {}) {
    if (editingId && editingId !== id) finishEditing();
    if (add) {
      // Shift-click: add it to the group, or take it out if it's already in.
      if (selectedId) multiIds.add(selectedId);
      if (multiIds.has(id) && multiIds.size > 1) {
        multiIds.delete(id);
        selectedId = [...multiIds].at(-1) || null;
        applySelection();
        return;
      }
      multiIds.add(id);
    } else if (!multiIds.has(id)) {
      multiIds.clear();
    }
    selectedId = id;
    applySelection();
    if (focus) itemEl(id)?.focus({ preventScroll: true });
  }

  function deselect() {
    if (editingId) finishEditing();
    multiIds.clear();
    selectedId = null;
    applySelection();
  }

  // Re-render the spread but keep the selection.
  function redraw({ focus = false } = {}) {
    rerender();
    applySelection();
    if (focus && selectedId) itemEl(selectedId)?.focus({ preventScroll: true });
  }

  // ---- Adding things ----
  function placeNew(spread, side, item, point) {
    const page = pageOf(spread, side);
    const jitter = () => (Math.random() - 0.5) * 8;
    // Height as a % of the page (pages are 3:4), so a dropped item centers on the pointer.
    const aspect = item.type === 'photo' ? (item.aspect || 0.78) : item.type === 'text' ? 0.2 : (STICKER_ASPECT[item.kind] || 1);
    const height = item.width * 0.75 * aspect;
    item.x = point ? clamp(point.x - item.width / 2, -10, 100 - item.width / 2) : clamp(50 - item.width / 2 + jitter(), 2, 98 - item.width);
    item.y = point ? clamp(point.y - height / 2, -5, 95 - height / 2) : clamp(36 + jitter(), 4, 80);
    item.z = topZ(spread) + 1;
    page.items.push(item);
  }

  async function addPhotos(files, side, point) {
    const spread = currentSpread();
    const media = mediaFiles(files);
    if (!spread) return;
    if (!media.length) { toast('Only photos and videos can be added here'); return; }
    if (!underLimit(spread, media.length)) return;
    toast(media.length > 1 ? `Adding ${media.length} photos and videos…` : 'Adding it…');
    const snap = snapshot();
    const stored = await storeMedia(media);
    if (!stored.length) return;
    addToRoll(book, stored);
    record(snap);
    const lastId = placeMedia(spread, stored, side, point);
    save();
    track(EVENTS.addedPhoto);
    selectedId = lastId;
    redraw({ focus: true });
    announce(stored.length > 1 ? `${stored.length} added` : stored[0].video ? 'Video added' : 'Photo added');
  }

  // Puts photos/videos (already saved) on the page. Returns the last one's id.
  function placeMedia(spread, entries, side, point) {
    let lastId = null;
    entries.forEach((e, i) => {
      const item = createPageItem('photo', { addedBy: ME, width: 42, rotation: Math.round((Math.random() - 0.5) * 8), photoKey: e.key, aspect: e.aspect || 0.78, ...(e.video ? { video: true } : {}) });
      placeNew(spread, side || targetSide(spread), item, point ? { x: point.x + i * 4, y: point.y + i * 4 } : null);
      lastId = item.id;
    });
    return lastId;
  }

  // Adds something from the camera roll (or the recently uploaded row) to the page you're on.
  function addFromRoll(key) {
    const spread = currentSpread();
    const entry = rollOf(book).find((e) => e.key === key);
    if (!spread || !entry || !underLimit(spread)) return false;
    record();
    selectedId = placeMedia(spread, [entry]);
    save();
    redraw({ focus: true });
    announce(entry.video ? 'Video added' : 'Photo added');
    return true;
  }

  // The newest 8 photos and videos in this book, under the drop zone.
  function renderRecent() {
    const recent = rollOf(book).slice(0, 8);
    const box = panel.querySelector('#recent');
    box.hidden = !recent.length;
    panel.querySelector('#recent-row').innerHTML = recent.map((e) => tileHtml(e, `data-edit="from-roll" aria-label="Add this ${e.video ? 'video' : 'photo'} to the page"`)).join('');
    hydratePhotos(box);
  }

  function addText() {
    const spread = currentSpread();
    if (!spread || !underLimit(spread)) return;
    record();
    track(EVENTS.addedNote);
    const item = createPageItem('text', { addedBy: ME, width: 56, content: '', font: 'avenir', size: 7, color: '#510C0D' });
    placeNew(spread, targetSide(spread), item);
    save();
    selectedId = item.id;
    redraw();
    startEditing(item.id);
  }

  function addSticker(kind, { side, point } = {}) {
    const spread = currentSpread();
    if (!spread || !underLimit(spread)) return;
    record();
    track(EVENTS.addedSticker);
    const item = createPageItem('sticker', { addedBy: ME, kind, width: STICKER_WIDTH[kind] || 18, rotation: Math.round((Math.random() - 0.5) * 16) });
    placeNew(spread, side || targetSide(spread), item, point);
    save();
    selectedId = item.id;
    redraw({ focus: true });
    announce(`${STICKERS[kind].label} added`);
  }

  function removeSelected() {
    if (multiIds.size > 1) { removeGroup(); return; }
    const found = find(selectedId);
    if (!found) return;
    if (!mine(found)) { explainLocked(found); return; }
    if (found.item.locked) { toast('It\'s locked. Unlock it to remove it.'); return; }
    record();
    found.page.items = found.page.items.filter((i) => i.id !== selectedId);
    save();
    selectedId = null;
    redraw();
    spreadEl.focus({ preventScroll: true });
    announce(`${itemLabel(found.item)} deleted`);
  }

  // ---- Layouts (11/21): photo boxes and notes in a ready-made arrangement ----
  // One layout per page, to start a page (so layouts don't get stacked). A blank page can take any layout.
  // A page that only has an untouched layout on it (empty photo boxes and empty notes) can swap to another.
  // Once something's been added or filled in, the layouts are done for that page.
  const untouched = (item) => item.addedBy === ME && ((item.type === 'photo' && item.slot && !item.photoKey) || (item.type === 'text' && !String(item.content || '').trim()));
  function layoutState(page) {
    if (!page.items.length) return 'blank';
    if (page.layout && page.items.every(untouched)) return 'swap';
    return 'full';
  }
  function applyLayout(id) {
    const spread = currentSpread();
    const layout = layoutById(id);
    if (!spread || !layout) return;
    const side = activeSide || 'left';
    const page = pageOf(spread, side);
    const state = layoutState(page);
    if (state === 'full') { toast(`Layouts are for starting a page. The ${side} page already has things on it.`); return; }
    if (page.layout === id) return;
    if (!underLimit(spread, layout.items.length)) return;
    record();
    if (state === 'swap') page.items = []; // swap out the untouched layout for the new one
    page.layout = id;
    let z = topZ(spread);
    const added = layout.items.map((it) => (it.type === 'photo'
      ? createPageItem('photo', { addedBy: ME, slot: true, x: it.x, y: it.y, width: it.width, rotation: it.rotation || 0, aspect: it.aspect, z: ++z })
      : createPageItem('text', { addedBy: ME, x: it.x, y: it.y, width: it.width, rotation: 0, content: '', font: 'avenir', size: it.size || 7, color: '#510C0D', z: ++z, ...(it.align ? { align: it.align } : {}), ...(it.label ? { label: it.label } : {}) })));
    pageOf(spread, side).items.push(...added);
    save();
    selectedId = null;
    redraw();
    toast(`${state === 'swap' ? 'Switched to' : 'Added'} "${layout.name}" on the ${side} page. Double-click a photo box to fill it.`);
  }

  // Put a photo into a photo box, cropped from the middle to fit the box.
  const slotInput = panel.querySelector('#slot-input');
  let slotTarget = null;
  function pickSlotPhoto(id) {
    const found = find(id);
    if (!found || !found.item.slot) return;
    slotTarget = id;
    slotInput.click();
  }
  slotInput.addEventListener('change', () => { if (slotTarget) fillSlot(slotTarget, slotInput.files); slotInput.value = ''; });
  async function fillSlot(id, files) {
    const found = find(id);
    const media = mediaFiles(files);
    if (!found || !media.length) return;
    toast('Adding it…');
    const snap = snapshot();
    const [entry] = await storeMedia([media[0]]);
    if (!entry) return;
    addToRoll(book, [entry]);
    const again = find(id); // the spread may have redrawn while it uploaded
    if (!again) return;
    record(snap);
    const { item } = again;
    item.photoKey = entry.key;
    if (entry.video) item.video = true;
    item.srcAspect = entry.aspect || 0.78;
    item.crop = cropToSlot(item.srcAspect, item.aspect || 0.78);
    delete item.slot;
    delete item.placeholder;
    save();
    track(EVENTS.addedPhoto);
    selectedId = item.id;
    redraw({ focus: true });
    announce('Photo added');
  }

  // Center the selected thing (or things) left-to-right on its page.
  function centerOnPage() {
    const found = find(selectedId);
    const el = itemEl(selectedId);
    if (!found || !el || !canEdit(found)) return;
    if (found.item.locked) { toast('It\'s locked. Unlock it to move it.'); return; }
    const rect = el.closest('.page').getBoundingClientRect();
    const b = boxOf(el, rect);
    const shift = 50 - (b.l + b.w / 2);
    if (Math.abs(shift) < 0.05) return;
    record();
    found.item.x += shift;
    save();
    redraw({ focus: true });
    announce('Centered on the page');
  }

  // Lock something in place (like a background photo) so it can't be moved or removed by accident.
  function toggleLock(id = selectedId) {
    const found = find(id);
    if (!found || !canEdit(found)) return;
    record();
    if (found.item.locked) delete found.item.locked; else found.item.locked = true;
    save();
    selectedId = found.item.id;
    redraw({ focus: true });
    announce(found.item.locked ? 'Locked in place' : 'Unlocked');
  }

  // Remove everything selected that you're allowed to (not locked, and yours to remove).
  function removeGroup() {
    const all = [...multiIds].map((id) => find(id)).filter(Boolean);
    const ok = all.filter((f) => mine(f) && !f.item.locked);
    if (!ok.length) { toast('None of these can be removed (they\'re locked or someone else added them).'); return; }
    record();
    for (const f of ok) f.page.items = f.page.items.filter((i) => i.id !== f.item.id);
    save();
    multiIds.clear();
    selectedId = null;
    redraw();
    spreadEl.focus({ preventScroll: true });
    const skipped = all.length - ok.length;
    announce(`${ok.length} removed`);
    if (skipped) toast(`Removed ${ok.length}. ${skipped} ${skipped === 1 ? 'is' : 'are'} locked or someone else's, so ${skipped === 1 ? 'it stayed' : 'they stayed'}.`);
  }

  function restack(direction) {
    const found = find(selectedId);
    if (!found || !canEdit(found)) return;
    record();
    const items = allItems(found.spread).sort((a, b) => (a.z || 0) - (b.z || 0));
    const i = items.indexOf(found.item);
    const j = clamp(i + direction, 0, items.length - 1);
    items.splice(i, 1);
    items.splice(j, 0, found.item);
    items.forEach((it, k) => { it.z = k + 1; });
    save();
    redraw({ focus: true });
  }

  function duplicate() {
    const found = find(selectedId);
    if (!found || !canEdit(found) || !underLimit(found.spread)) return;
    record();
    const { reports, removedForAll, ...rest } = JSON.parse(JSON.stringify(found.item));
    const copy = { ...rest, addedBy: ME, id: uid('pi'), x: found.item.x + 4, y: found.item.y + 4, z: topZ(found.spread) + 1 };
    found.page.items.push(copy);
    save();
    selectedId = copy.id;
    redraw({ focus: true });
  }

  function undo(redo = false) {
    const from = redo ? history.redo : history.undo;
    const to = redo ? history.undo : history.redo;
    if (!from.length) return;
    if (editingId) finishEditing();
    to.push(snapshot());
    restoreSpreads(JSON.parse(from.pop()));
    save();
    redraw();
    announce(redo ? 'Redone' : 'Undone');
  }

  // Undo puts back only things you're allowed to change. Other people's things stay as they are now,
  // so undo can never erase what someone else added (threats.md: "Erasing someone from the year").
  function restoreSpreads(saved) {
    const savedById = new Map(saved.map((sp) => [sp.id, sp]));
    for (const spread of book.spreads) {
      const old = savedById.get(spread.id);
      if (!old) continue;
      for (const side of ['leftPage', 'rightPage']) {
        const keepTheirs = spread[side].items.filter((item) => !canChange(book, item));
        const theirIds = new Set(keepTheirs.map((item) => item.id));
        const restoreMine = old[side].items.filter((item) => canChange(book, item) && !theirIds.has(item.id));
        spread[side].items = [...keepTheirs, ...restoreMine];
      }
    }
  }

  // ---- Reporting ----
  async function reportSelected() {
    const found = find(selectedId);
    if (!found || !canReport(found.item)) return;
    const result = await openReportDialog(found.item.type);
    if (!result) return;
    reportPageItem(book.id, found.item.id, { intimate: result.intimate });
    selectedId = null;
    redraw();
    if (result.intimate) showTakeDownHelp();
    else toast("Reported. It's hidden for you now.");
  }

  // ---- Text editing (type right on the page) ----
  let editSnap = null;
  function startEditing(id) {
    const el = itemEl(id);
    const found = find(id);
    if (!el || !found || found.item.type !== 'text') return;
    if (!mine(found)) { explainLocked(found); return; }
    editingId = id;
    editSnap = snapshot();
    el.textContent = found.item.content; // start from the clean text (drops the handles too)
    el.contentEditable = 'plaintext-only';
    if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
    el.classList.add('editing');
    el.setAttribute('role', 'textbox');
    el.setAttribute('aria-label', 'Note text');
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    el.addEventListener('input', onTextInput);
    el.addEventListener('keydown', onTextKey);
    el.addEventListener('blur', onTextBlur);
  }
  function onTextInput(event) {
    const found = find(editingId);
    if (found) found.item.content = event.currentTarget.innerText.replace(/\n$/, '');
  }
  function onTextKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finishEditing({ keepFocus: true }); }
  }
  // Using the edit panel (a font, a color, the sliders) doesn't count as clicking off the note: you stay in it.
  function onTextBlur(event) {
    if (!editingId) return;
    if (event?.relatedTarget && panel.contains(event.relatedTarget)) return;
    finishEditing();
  }
  // Put the caret back at the end of the note you're typing in.
  function resumeTyping() {
    const el = itemEl(editingId);
    if (!el) return;
    el.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  }
  function finishEditing({ keepFocus = false } = {}) {
    const id = editingId;
    const el = itemEl(id);
    editingId = null;
    if (el) {
      el.removeEventListener('input', onTextInput);
      el.removeEventListener('keydown', onTextKey);
      el.removeEventListener('blur', onTextBlur);
      el.removeAttribute('contenteditable');
      el.classList.remove('editing');
      el.setAttribute('role', 'button');
    }
    const found = find(id);
    if (found && !found.item.content.trim()) {
      // An empty note goes away when you click off it.
      found.page.items = found.page.items.filter((i) => i.id !== id);
      if (snapshot() !== editSnap) save();
      if (selectedId === id) selectedId = null;
      redraw();
      return;
    }
    if (snapshot() !== editSnap) { record(editSnap); save(); }
    if (el) el.setAttribute('aria-label', itemLabel(found.item));
    applySelection();
    if (keepFocus) el?.focus({ preventScroll: true });
  }

  // ---- Snap guides (11/21): while dragging, an item snaps to the page's center lines and to the
  // edges and centers of other things on the page, and a line shows what it lined up with.
  // Hold Option/Alt to drag freely.
  const SNAP = 1.2; // how close (in % of the page) counts as lined up
  const boxOf = (el, rect) => {
    const r = el.getBoundingClientRect();
    return { l: ((r.left - rect.left) / rect.width) * 100, t: ((r.top - rect.top) / rect.height) * 100, w: (r.width / rect.width) * 100, h: (r.height / rect.height) * 100 };
  };
  function snapTargets(pageEl, rect, skip) {
    const xs = [{ v: 50, page: true }];
    const ys = [{ v: 50, page: true }];
    pageEl.querySelectorAll('.page-inner .pi').forEach((other) => {
      if (skip.has(other.dataset.id)) return;
      const b = boxOf(other, rect);
      xs.push({ v: b.l }, { v: b.l + b.w / 2 }, { v: b.l + b.w });
      ys.push({ v: b.t }, { v: b.t + b.h / 2 }, { v: b.t + b.h });
    });
    return { xs, ys };
  }
  // Which of the box's left / center / right (or top / middle / bottom) is nearest a target.
  function bestSnap(starts, size, targets) {
    let best = null;
    for (const [k, off] of [[0, 0], [1, size / 2], [2, size]]) {
      for (const t of targets) {
        const d = t.v - (starts + off);
        if (Math.abs(d) <= SNAP && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, line: t.v, k };
      }
    }
    return best;
  }
  function showGuides(pageEl, sx, sy) {
    pageEl.querySelectorAll('.snap-guide').forEach((g) => g.remove());
    if (sx) pageEl.insertAdjacentHTML('beforeend', `<span class="snap-guide v${sx.line === 50 ? ' is-center' : ''}" style="left:${sx.line}%"></span>`);
    if (sy) pageEl.insertAdjacentHTML('beforeend', `<span class="snap-guide h${sy.line === 50 ? ' is-center' : ''}" style="top:${sy.line}%"></span>`);
  }

  // ---- Pointer: move, resize, rotate ----
  function startMove(event, el, found) {
    const pageEl = el.closest('.page');
    const rect = pageEl.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY, ix: found.item.x, iy: found.item.y };
    const snap = snapshot();
    let moved = false;
    el.setPointerCapture(event.pointerId);
    // Everything else that's selected moves along with it (select several with Shift).
    const group = [...multiIds].filter((id) => id !== found.item.id).map((id) => find(id))
      .filter((f) => f && canEdit(f) && !f.item.locked).map((f) => ({ f, el: itemEl(f.item.id), ix: f.item.x, iy: f.item.y }));
    const box0 = boxOf(el, rect);
    let targets = null;

    const onMove = (e) => {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      if (!moved) { el.classList.add('lifting'); targets = snapTargets(pageEl, rect, new Set([found.item.id, ...group.map((g) => g.f.item.id)])); }
      moved = true;
      let mx = (dx / rect.width) * 100;
      let my = (dy / rect.height) * 100;
      const sx = e.altKey ? null : bestSnap(box0.l + mx, box0.w, targets.xs);
      const sy = e.altKey ? null : bestSnap(box0.t + my, box0.h, targets.ys);
      if (sx) mx += sx.d;
      if (sy) my += sy.d;
      showGuides(pageEl, sx, sy);
      found.item.x = start.ix + mx;
      found.item.y = start.iy + my;
      el.style.left = `${found.item.x}%`;
      el.style.top = `${found.item.y}%`;
      for (const g of group) {
        g.f.item.x = g.ix + mx;
        g.f.item.y = g.iy + my;
        if (g.el) { g.el.style.left = `${g.f.item.x}%`; g.el.style.top = `${g.f.item.y}%`; }
      }
      onLive?.(found); // live: others see it move while you drag
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.classList.remove('lifting');
      pageEl.querySelectorAll('.snap-guide').forEach((g) => g.remove());
      onLive?.(null);
      if (!moved) return;
      // Dropped past the fold: move the item onto the other page.
      const box = el.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      let changedPage = false;
      if (found.side === 'right' && cx < rect.left) changedPage = transfer(found, 'left', 100);
      if (found.side === 'left' && cx > rect.right) changedPage = transfer(found, 'right', -100);
      record(snap);
      save();
      if (changedPage) redraw({ focus: true });
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  }

  function transfer(found, side, shift) {
    found.page.items = found.page.items.filter((i) => i.id !== found.item.id);
    found.item.x += shift;
    pageOf(found.spread, side).items.push(found.item);
    activeSide = side;
    return true;
  }

  function startHandle(event, el, found, kind) {
    event.stopPropagation();
    const box = el.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const startDist = Math.max(8, Math.hypot(event.clientX - cx, event.clientY - cy));
    const startAngle = Math.atan2(event.clientY - cy, event.clientX - cx);
    const { width, size = 7, rotation = 0 } = found.item;
    const snap = snapshot();
    const handle = event.target.closest('.handle');
    handle.setPointerCapture(event.pointerId);
    el.classList.add('lifting');

    const onMove = (e) => {
      if (kind === 'resize') {
        const factor = Math.hypot(e.clientX - cx, e.clientY - cy) / startDist;
        found.item.width = clamp(width * factor, 5, 100);
        el.style.width = `${found.item.width}%`;
        el.style.setProperty('--w', `${found.item.width}%`);
        if (found.item.type === 'text') {
          found.item.size = clamp(size * factor, 2, 30);
          el.style.fontSize = textFontSize(found.item);
        }
      } else {
        let deg = rotation + ((Math.atan2(e.clientY - cy, e.clientX - cx) - startAngle) * 180) / Math.PI;
        if (e.shiftKey) deg = Math.round(deg / 15) * 15;
        found.item.rotation = Math.round(((deg + 540) % 360) - 180);
        el.style.transform = `rotate(${found.item.rotation}deg)`;
      }
      onLive?.(found);
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      el.classList.remove('lifting');
      onLive?.(null);
      if (snapshot() !== snap) { record(snap); save(); }
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }

  function onPointerDown(event) {
    if (event.button !== 0 || !editable()) return;
    if (event.target.closest('.turn-leaf')) return;
    const pageEl = event.target.closest('.page');
    if (pageEl) activeSide = pageEl.classList.contains('left') ? 'left' : 'right';
    const el = event.target.closest('.page-inner .pi');
    if (el && el.dataset.id === editingId) return; // clicking inside the note you're typing
    if (event.target.closest('button, a')) return; // e.g. "back to contents"
    if (event.target.closest('.h-delete')) { event.preventDefault(); event.stopPropagation(); removeSelected(); return; }
    const handle = event.target.closest('.handle');
    if (el) {
      const found = find(el.dataset.id);
      if (!found) return;
      event.preventDefault();
      if (event.shiftKey && selectedId) {
        select(found.item.id, { add: true });
        if (!multiIds.has(found.item.id)) return; // took it out of the group
      } else if (selectedId !== found.item.id) select(found.item.id);
      el.focus({ preventScroll: true });
      if (!canEdit(found)) return; // you can select it (to see who added it, or report it), not move it
      if (found.item.locked) return; // locked in place: select it to unlock, but it doesn't move
      if (handle) startHandle(event, el, found, handle.classList.contains('h-resize') ? 'resize' : 'rotate');
      else startMove(event, el, found);
      return;
    }
    if (pageEl) deselect();
  }

  function onDoubleClick(event) {
    const el = event.target.closest('.page-inner .pi-text');
    if (el && editable()) startEditing(el.dataset.id);
    // Double-click a photo or video to crop it, change its frame, or add a filter (11/18 crit).
    const photo = event.target.closest('.page-inner .pi-photo');
    if (photo && editable()) {
      if (photo.classList.contains('is-slot')) pickSlotPhoto(photo.dataset.id);
      else editPhoto(photo.dataset.id);
    }
  }

  async function editPhoto(id = selectedId) {
    const found = find(id);
    if (!found || found.item.type !== 'photo') return;
    if (!canEdit(found)) { explainLocked(found); return; }
    const snap = snapshot();
    await openPhotoEditor(found.item, {
      onSave: (changes) => {
        record(snap);
        Object.assign(found.item, changes);
        if (!changes.crop) delete found.item.crop;
        save();
        selectedId = found.item.id;
        redraw({ focus: true });
        announce('Photo updated');
      },
    });
  }

  // Clicking anywhere outside the spread and the panel deselects.
  function onOutside(event) {
    if (!selectedId && !editingId) return;
    if (spreadEl.contains(event.target) || panel.contains(event.target) || event.target.closest('dialog, .idea-pop, .toast')) return;
    deselect();
  }

  // ---- Drag and drop photos onto a page ----
  const hasFiles = (event) => [...(event.dataTransfer?.types || [])].includes('Files');
  function onDragOver(event) {
    if (!hasFiles(event) || !editable()) return;
    event.preventDefault();
    const pageEl = event.target.closest('.page');
    spreadEl.querySelectorAll('.page.drop-over').forEach((p) => { if (p !== pageEl) p.classList.remove('drop-over'); });
    pageEl?.classList.add('drop-over');
  }
  function onDragLeave(event) {
    if (!spreadEl.contains(event.relatedTarget)) spreadEl.querySelectorAll('.drop-over').forEach((p) => p.classList.remove('drop-over'));
  }
  function onDrop(event) {
    if (!hasFiles(event) || !editable()) return;
    event.preventDefault();
    spreadEl.querySelectorAll('.drop-over').forEach((p) => p.classList.remove('drop-over'));
    // Dropped right on a photo box: fill it.
    const slotEl = event.target.closest('.page-inner .pi-photo.is-slot');
    if (slotEl) { fillSlot(slotEl.dataset.id, event.dataTransfer.files); return; }
    const pageEl = event.target.closest('.page') || spreadEl.querySelector('.page.left');
    const rect = pageEl.getBoundingClientRect();
    const side = pageEl.classList.contains('left') ? 'left' : 'right';
    const point = { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 };
    addPhotos(event.dataTransfer.files, side, point);
  }

  // ---- Panel ----
  function setFont(font) {
    const found = find(selectedId);
    if (!found || found.item.type !== 'text' || !mine(found) || !FONTS[font]) return;
    record();
    found.item.font = font;
    save();
    // While you're typing in the note, change it in place so you keep typing (and the panel stays as it is).
    if (editingId === found.item.id) {
      const el = itemEl(found.item.id);
      const f = fontOf(found.item);
      if (el) { el.style.fontFamily = f.family; el.style.fontWeight = String(f.weight || 400); }
      updatePanel();
      resumeTyping();
      return;
    }
    redraw();
  }

  // A note's alignment or label. While you're typing, it changes in place so you keep typing.
  function setNoteStyle(field, value, plain) {
    const found = find(selectedId);
    if (!found || found.item.type !== 'text' || !mine(found)) return;
    if ((found.item[field] || plain) === value) return;
    record();
    if (value === plain) delete found.item[field]; else found.item[field] = value;
    save();
    if (editingId === found.item.id) {
      const el = itemEl(found.item.id);
      if (el) {
        el.className = el.className.replace(new RegExp(`\\s?${field}-\\S+`, 'g'), '');
        if (value !== plain) el.classList.add(`${field}-${value}`);
      }
      updatePanel();
      resumeTyping();
      return;
    }
    redraw();
  }

  function setColor(color) {
    const found = find(selectedId);
    if (!found || found.item.type !== 'sticker' || !mine(found)) return;
    record();
    found.item.color = color;
    save();
    redraw();
  }

  // Sliders: one undo step per drag of a slider.
  let sliderSnap = null;
  function onSlider(event) {
    const found = find(selectedId);
    if (!found || !canEdit(found) || found.item.locked) return;
    if (!sliderSnap) sliderSnap = snapshot();
    const { item } = found;
    const el = itemEl(selectedId);
    if (event.target === rotateInput) {
      item.rotation = Number(rotateInput.value);
      el.style.transform = `rotate(${item.rotation}deg)`;
      panel.querySelector('#sel-rotate-out').textContent = `${item.rotation}°`;
    } else {
      const next = Number(sizeInput.value);
      if (item.type === 'text') item.size = clamp((item.size || 7) * (next / item.width), 2, 30);
      item.width = next;
      el.style.width = `${item.width}%`;
      el.style.setProperty('--w', `${item.width}%`);
      if (item.type === 'text') el.style.fontSize = textFontSize(item);
      panel.querySelector('#sel-size-out').textContent = `${item.width}%`;
    }
    onLive?.(found);
  }
  function onSliderDone() {
    onLive?.(null);
    if (sliderSnap && sliderSnap !== snapshot()) { record(sliderSnap); save(); updatePanel(); }
    sliderSnap = null;
  }
  // Page background opacity and size: they change live while you drag, and save as one undo step.
  let bgSnap = null;
  const bgSliders = { 'bg-op': 'bgOpacity', 'bg-size': 'bgSize' };
  for (const [id, field] of Object.entries(bgSliders)) {
    const input = panel.querySelector(`#${id}`);
    input.addEventListener('input', () => {
      const spread = currentSpread();
      if (!spread) return;
      if (!bgSnap) bgSnap = snapshot();
      spread[field] = Number(input.value) / 100;
      panel.querySelector(`#${id}-out`).textContent = `${input.value}%`;
      spreadEl.style.setProperty(field === 'bgOpacity' ? '--bg-op' : '--bg-scale', String(spread[field]));
    });
    input.addEventListener('change', () => {
      if (bgSnap && bgSnap !== snapshot()) { record(bgSnap); save(); }
      bgSnap = null;
    });
  }
  rotateInput.addEventListener('input', onSlider);
  sizeInput.addEventListener('input', onSlider);
  rotateInput.addEventListener('change', onSliderDone);
  sizeInput.addEventListener('change', onSliderDone);

  let stickerDragged = false;
  const panelActions = {
    done: () => onDone?.(),
    lock: () => toggleLock(),
    'layout-side': (btn) => { activeSide = btn.dataset.side; updatePanel(); },
    layout: (btn) => applyLayout(btn.dataset.layout),
    'fill-slot': () => pickSlotPhoto(selectedId),
    center: () => centerOnPage(),
    align: (btn) => setNoteStyle('align', btn.dataset.align, 'left'),
    label: (btn) => setNoteStyle('label', btn.dataset.label, 'none'),
    // Done with the selected item: back to the tabs, still editing.
    deselect: () => deselect(),
    photo: () => fileInput.click(),
    'edit-photo': () => editPhoto(),
    'from-roll': (btn) => addFromRoll(btn.closest('[data-roll-key]').dataset.rollKey),
    'camera-roll': () => onCameraRoll?.(),
    text: addText,
    'add-sticker': (btn) => addSticker(btn.dataset.kind),
    color: (btn) => setColor(btn.dataset.color),
    'text-color': (btn) => {
      const found = find(selectedId);
      if (!found || found.item.type !== 'text' || !mine(found)) return;
      record();
      found.item.color = btn.dataset.color;
      save();
      if (editingId === found.item.id) {
        const el = itemEl(found.item.id);
        if (el) el.style.color = found.item.color;
        updatePanel();
        resumeTyping();
        return;
      }
      redraw();
    },
    font: (btn) => setFont(btn.dataset.font),
    'bg-reset': () => {
      const spread = currentSpread();
      if (!spread || (bgOpacity(spread) === 1 && bgSize(spread) === 1)) return;
      record();
      delete spread.bgOpacity;
      delete spread.bgSize;
      save();
      rerender();
    },
    'page-bg': (btn) => {
      const spread = currentSpread();
      if (!spread || pageBg(spread.bg) === btn.dataset.bgChoice) return;
      record();
      spread.bg = btn.dataset.bgChoice;
      save();
      rerender();
    },
    delete: removeSelected,
    forward: () => restack(1),
    backward: () => restack(-1),
    duplicate,
    report: reportSelected,
    undo: () => undo(),
    redo: () => undo(true),
  };
  panel.addEventListener('pointerdown', (event) => {
    // Keep the selection (and note focus) while using panel buttons.
    if (event.target.closest('button[data-edit]')) event.preventDefault();
  });
  // While you're typing in a note, clicking a button in the panel keeps the cursor in the note (Safari and Chrome).
  panel.addEventListener('mousedown', (event) => { if (editingId && event.target.closest('button')) event.preventDefault(); });
  panel.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-edit]');
    if (!btn || btn.disabled) return;
    if (btn.dataset.edit === 'add-sticker' && stickerDragged) { stickerDragged = false; return; }
    panelActions[btn.dataset.edit]?.(btn);
  });
  fileInput.addEventListener('change', () => {
    addPhotos(fileInput.files);
    fileInput.value = '';
  });

  // Drop photos on the panel's drop zone too.
  dropzone.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dropzone.classList.add('over');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('over'));
  dropzone.addEventListener('drop', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dropzone.classList.remove('over');
    addPhotos(event.dataTransfer.files);
  });

  // Drag a sticker from the panel onto a page.
  panel.querySelector('.sticker-grid').addEventListener('pointerdown', (event) => {
    const btn = event.target.closest('.tray-btn');
    if (!btn || event.button !== 0) return;
    const start = { x: event.clientX, y: event.clientY };
    let ghost = null;
    stickerDragged = false;
    btn.setPointerCapture(event.pointerId);
    const onMove = (e) => {
      if (!ghost && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) return;
      if (!ghost) {
        stickerDragged = true;
        ghost = document.createElement('div');
        ghost.className = 'sticker-ghost';
        ghost.innerHTML = stickerSvg(btn.dataset.kind);
        document.body.append(ghost);
      }
      ghost.style.left = `${e.clientX}px`;
      ghost.style.top = `${e.clientY}px`;
    };
    const onUp = (e) => {
      btn.removeEventListener('pointermove', onMove);
      btn.removeEventListener('pointerup', onUp);
      btn.removeEventListener('pointercancel', onUp);
      if (!ghost) return;
      ghost.remove();
      const pageEl = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.matches?.('.spread .page'));
      if (!pageEl) return;
      const rect = pageEl.getBoundingClientRect();
      addSticker(btn.dataset.kind, {
        side: pageEl.classList.contains('left') ? 'left' : 'right',
        point: { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 },
      });
    };
    btn.addEventListener('pointermove', onMove);
    btn.addEventListener('pointerup', onUp);
    btn.addEventListener('pointercancel', onUp);
  });

  // ---- Keyboard ----
  let lastNudge = 0;
  function nudge(change) {
    const found = find(selectedId);
    if (!found) return;
    if (!canEdit(found)) { explainLocked(found); return; }
    if (found.item.locked) { toast('It\'s locked. Unlock it to move it.'); return; }
    if (performance.now() - lastNudge > 700) record();
    lastNudge = performance.now();
    change(found.item);
    // Arrow keys move the whole group (other changes, like size, stay with the one you clicked).
    if (multiIds.size > 1) {
      const probe = { x: 0, y: 0, width: found.item.width, rotation: 0, size: 0 };
      change(probe);
      for (const id of multiIds) {
        if (id === selectedId) continue;
        const f = find(id);
        if (!f || !canEdit(f) || f.item.locked) continue;
        f.item.x += probe.x;
        f.item.y += probe.y;
        const other = itemEl(id);
        if (other) { other.style.left = `${f.item.x}%`; other.style.top = `${f.item.y}%`; }
      }
    }
    const el = itemEl(selectedId);
    el.style.cssText = itemStyle(found.item) + (found.item.type === 'text' ? `;${fontCss(found.item)};font-size:${textFontSize(found.item)};color:${found.item.color || '#2B2B2B'}` : '');
    save();
  }

  // Returns true when the editor used the key.
  function handleKey(event) {
    if (!editable()) return false;
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undo(event.shiftKey);
      return true;
    }
    if (mod && event.key.toLowerCase() === 'y') { event.preventDefault(); undo(true); return true; }
    // Enter or Space on a focused item selects it.
    const focusedItem = event.target.closest?.('.page-inner .pi');
    if (focusedItem && !selectedId && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      select(focusedItem.dataset.id, { focus: true });
      return true;
    }
    if (!selectedId) return false;
    const step = event.shiftKey ? 5 : 1;
    switch (event.key) {
      case 'Escape': event.preventDefault(); { const id = selectedId; deselect(); itemEl(id)?.focus({ preventScroll: true }); } return true;
      case 'Delete':
      case 'Backspace': event.preventDefault(); removeSelected(); return true;
      case 'Enter': if (find(selectedId)?.item.type === 'text') { event.preventDefault(); startEditing(selectedId); return true; } return false;
      case 'ArrowLeft': event.preventDefault(); nudge((i) => { i.x -= step; }); return true;
      case 'ArrowRight': event.preventDefault(); nudge((i) => { i.x += step; }); return true;
      case 'ArrowUp': event.preventDefault(); nudge((i) => { i.y -= step; }); return true;
      case 'ArrowDown': event.preventDefault(); nudge((i) => { i.y += step; }); return true;
      case '+': case '=': event.preventDefault(); nudge((i) => { i.width = clamp(i.width * 1.08, 5, 100); if (i.type === 'text') i.size = clamp((i.size || 7) * 1.08, 2, 30); }); return true;
      case '-': case '_': event.preventDefault(); nudge((i) => { i.width = clamp(i.width / 1.08, 5, 100); if (i.type === 'text') i.size = clamp((i.size || 7) / 1.08, 2, 30); }); return true;
      case '[': event.preventDefault(); nudge((i) => { i.rotation = (i.rotation || 0) - (event.shiftKey ? 15 : 5); }); return true;
      case ']': event.preventDefault(); nudge((i) => { i.rotation = (i.rotation || 0) + (event.shiftKey ? 15 : 5); }); return true;
      default: return false;
    }
  }

  spreadEl.addEventListener('pointerdown', onPointerDown);
  spreadEl.addEventListener('dblclick', onDoubleClick);
  spreadEl.addEventListener('dragover', onDragOver);
  spreadEl.addEventListener('dragleave', onDragLeave);
  spreadEl.addEventListener('drop', onDrop);
  document.addEventListener('pointerdown', onOutside);

  return {
    // Call after the spread is re-rendered (page turn, overview jump).
    refresh() {
      panel.hidden = !editable();
      view.classList.toggle('editing', editable());
      if (!editable()) { selectedId = null; editingId = null; }
      // Items can only be reached with Tab while editing.
      spreadEl.querySelectorAll('.page-inner .pi').forEach((el) => {
        el.tabIndex = editable() ? 0 : -1;
        if (editable()) el.setAttribute('role', 'button'); else el.removeAttribute('role');
      });
      applySelection();
    },
    deselect,
    handleKey,
    isEditingText: () => Boolean(editingId),
    editPhoto: (id) => { select(id); editPhoto(id); },
    removeSelected,
    // For the floating ×: what's selected, and whether you can remove it.
    selection: () => {
      if (!selectedId || editingId === selectedId) return null;
      const found = find(selectedId);
      const many = multiIds.size > 1;
      return { id: selectedId, many, canRemove: many || mine(found), canLock: !many && canEdit(found), locked: !many && Boolean(found?.item.locked) };
    },
    toggleLock,
    addFromRoll,
    destroy() {
      document.removeEventListener('pointerdown', onOutside);
    },
  };
}
