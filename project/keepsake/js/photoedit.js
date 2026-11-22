// The photo editor (11/18 crit): double-click a photo (or click "Edit photo") to crop it, pick a frame
// or turn it into a cut-out sticker, and add a filter. The preview on the left is exactly how it'll look.

import { photoUrl } from './storage.js';
import { esc } from './ui.js';
import { FILTERS, FRAMES, SHAPES, cropOf, srcAspectOf, shownAspect, photoLookHtml } from './photolook.js';
import { TAPE_COLORS } from './model.js';

const RATIOS = { free: 'Free', square: 'Square', '4:3': '4:3', '3:4': '3:4', '16:9': '16:9' };
const ratioValue = { square: 1, '4:3': 3 / 4, '3:4': 4 / 3, '16:9': 9 / 16 }; // height / width on the page
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export async function openPhotoEditor(item, { onSave }) {
  const url = item.photoKey ? await photoUrl(item.photoKey).catch(() => null) : null;
  const src = srcAspectOf(item);
  const state = {
    crop: { ...cropOf(item) },
    frame: FRAMES[item.frame] ? item.frame : 'polaroid',
    shape: SHAPES[item.shape] ? item.shape : 'circle',
    filter: FILTERS[item.filter] ? item.filter : 'none',
    tape: item.tape || '',
    ratio: 'free',
    tab: 'crop',
  };
  // Demo photos have no file, just a soft color block; they can still get a frame, cut-out shape or filter.
  const mediaTag = (cls = '') => (!item.photoKey
    ? `<span class="${cls} photo-fill" style="--ar:1 / ${srcAspectOf(item)};background:${esc(item.placeholder || '#DDD6CA')}"></span>`
    : item.video
    ? `<video class="${cls}" src="${url || ''}" muted loop playsinline autoplay></video>`
    : `<img class="${cls}" src="${url || ''}" alt="" draggable="false">`);

  const dialog = document.createElement('dialog');
  dialog.className = 'confirm wide photo-editor';
  dialog.setAttribute('aria-labelledby', 'pe-title');
  document.body.append(dialog);
  dialog.innerHTML = `
    <div class="confirm-box">
      <h2 id="pe-title">Edit ${item.video ? 'video' : 'photo'}</h2>
      <div class="pe-body">
        <div class="pe-left">
          <div class="pe-preview" title="Drag to move the photo inside its frame"><div class="pe-preview-item"></div></div>
          <label class="pe-zoom"><span>Zoom</span><input type="range" min="1" max="4" step="0.01" value="1" data-zoom aria-label="Zoom the photo inside its frame"></label>
          <p class="pe-hint pe-fit-hint">Drag the photo above to move it, and zoom to fit it in the frame or sticker shape.</p>
        </div>
        <div class="pe-controls">
          <div class="pe-tabs" role="tablist">
            <button type="button" role="tab" data-tab="crop">Crop</button>
            <button type="button" role="tab" data-tab="frame">Frame &amp; cut-out</button>
            <button type="button" role="tab" data-tab="filter">Filter</button>
          </div>
          <div class="pe-panel" data-panel="crop">
            <p class="pe-hint">Drag the box to move it. Drag its corner to resize.</p>
            <div class="crop-stage">${mediaTag('crop-source')}<div class="crop-rect"><span class="crop-corner"></span></div></div>
            <div class="pe-chips">${Object.entries(RATIOS).map(([id, label]) => `<button type="button" class="pe-chip" data-ratio="${id}">${label}</button>`).join('')}<button type="button" class="pe-chip" data-reset-crop>Reset</button></div>
          </div>
          <div class="pe-panel" data-panel="frame">
            <div class="pe-chips">${Object.entries(FRAMES).map(([id, label]) => `<button type="button" class="pe-chip" data-frame="${id}">${label}</button>`).join('')}</div>
            <div class="pe-tape">
              <p class="pe-hint">Tape on the polaroid:</p>
              <div class="pe-chips pe-tape-row">
                <button type="button" class="pe-chip" data-tape="">Default</button>
                ${Object.entries(TAPE_COLORS).map(([name, hex]) => `<button type="button" class="pe-tape-swatch" data-tape="${hex}" style="background:${hex}" aria-label="${name} tape" title="${name}"></button>`).join('')}
                <button type="button" class="pe-chip" data-tape="none">No tape</button>
              </div>
            </div>
            <div class="pe-shapes">
              <p class="pe-hint">Cut-out shape (a white sticker edge, like the sticker set):</p>
              <div class="pe-chips">${Object.entries(SHAPES).map(([id, label]) => `<button type="button" class="pe-chip" data-shape="${id}">${label}</button>`).join('')}</div>
            </div>
          </div>
          <div class="pe-panel" data-panel="filter">
            <div class="pe-filters">${Object.entries(FILTERS).map(([id, f]) => `<button type="button" class="pe-filter" data-filter="${id}"><span class="pe-filter-img" style="filter:${f.css}">${mediaTag()}</span>${esc(f.label)}</button>`).join('')}</div>
          </div>
        </div>
      </div>
      <div class="confirm-actions">
        <button type="button" class="pill-btn" data-cancel>Cancel</button>
        <button type="button" class="pill-btn solid" data-save>Save</button>
      </div>
    </div>`;

  const previewEl = dialog.querySelector('.pe-preview-item');
  const stage = dialog.querySelector('.crop-stage');
  const rect = dialog.querySelector('.crop-rect');

  const look = () => ({ ...item, crop: state.crop, srcAspect: src, frame: state.frame, shape: state.shape, filter: state.filter, tape: state.tape });
  // The biggest crop at the current shape (so zoom 1 = the whole photo fits), and how zoomed in we are.
  function maxCrop() {
    const a = shownAspect(src, state.crop); // keep the frame's shape while zooming and moving
    let w = 1, h = a / src;
    if (h > 1) { h = 1; w = src / a; }
    return { w, h };
  }
  const zoomOf = () => maxCrop().w / state.crop.w;
  function setZoom(z) {
    const m = maxCrop();
    const c = state.crop;
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    const w = m.w / z, h = m.h / z;
    state.crop = { w, h, x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h) };
  }

  function paint() {
    const zoomInput = dialog.querySelector('[data-zoom]');
    if (document.activeElement !== zoomInput) zoomInput.value = String(Math.min(4, Math.max(1, zoomOf())).toFixed(2));
    previewEl.innerHTML = photoLookHtml(look(), mediaTag('photo-img'));
    previewEl.className = `pe-preview-item pi-photo frame-is-${state.frame}`;
    const c = state.crop;
    Object.assign(rect.style, { left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%` });
    dialog.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)));
    dialog.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== state.tab; });
    dialog.querySelectorAll('[data-ratio]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ratio === state.ratio)));
    dialog.querySelectorAll('[data-frame]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.frame === state.frame)));
    dialog.querySelectorAll('[data-shape]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.shape === state.shape)));
    dialog.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter)));
    dialog.querySelector('.pe-shapes').hidden = state.frame !== 'cutout';
    dialog.querySelector('.pe-tape').hidden = state.frame !== 'polaroid';
    dialog.querySelectorAll('[data-tape]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tape === state.tape)));
  }

  // Keep the crop's shape at the chosen ratio (or free), as big as it fits around its center.
  function applyRatio(id) {
    state.ratio = id;
    const r = ratioValue[id];
    if (!r) return;
    const c = state.crop;
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    let w = c.w, h = (r * w) / src;
    if (h > 1) { h = 1; w = (h * src) / r; }
    if (w > 1) { w = 1; h = (r * w) / src; }
    state.crop = { w, h, x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h) };
  }

  // Zoom slider, and dragging the photo inside the preview's frame to move it.
  dialog.querySelector('[data-zoom]').addEventListener('input', (event) => { setZoom(Number(event.target.value)); paint(); });
  const previewBox = dialog.querySelector('.pe-preview');
  previewBox.addEventListener('pointerdown', (event) => {
    const target = previewBox.querySelector('.crop-box');
    if (!target) return;
    event.preventDefault();
    const box = target.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY, crop: { ...state.crop } };
    previewBox.setPointerCapture(event.pointerId);
    previewBox.classList.add('is-dragging');
    const move = (e) => {
      // Dragging the photo right shows more of its left side, like moving a photo behind a window.
      const c = { ...start.crop };
      c.x = clamp(c.x - ((e.clientX - start.x) / box.width) * c.w, 0, 1 - c.w);
      c.y = clamp(c.y - ((e.clientY - start.y) / box.height) * c.h, 0, 1 - c.h);
      state.crop = c;
      paint();
    };
    const up = () => { previewBox.classList.remove('is-dragging'); previewBox.removeEventListener('pointermove', move); previewBox.removeEventListener('pointerup', up); };
    previewBox.addEventListener('pointermove', move);
    previewBox.addEventListener('pointerup', up);
  });

  // Dragging the crop box (move) or its corner (resize).
  rect.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const resize = event.target.classList.contains('crop-corner');
    const box = stage.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY, crop: { ...state.crop } };
    rect.setPointerCapture(event.pointerId);
    const move = (e) => {
      const dx = (e.clientX - start.x) / box.width, dy = (e.clientY - start.y) / box.height;
      const c = { ...start.crop };
      if (resize) {
        c.w = clamp(c.w + dx, 0.08, 1 - c.x);
        const r = ratioValue[state.ratio];
        c.h = r ? (r * c.w) / src : clamp(c.h + dy, 0.08, 1 - c.y);
        if (c.y + c.h > 1) { c.h = 1 - c.y; if (r) c.w = (c.h * src) / r; }
      } else {
        c.x = clamp(c.x + dx, 0, 1 - c.w);
        c.y = clamp(c.y + dy, 0, 1 - c.h);
      }
      state.crop = c;
      paint();
    };
    const up = () => { rect.removeEventListener('pointermove', move); rect.removeEventListener('pointerup', up); };
    rect.addEventListener('pointermove', move);
    rect.addEventListener('pointerup', up);
  });

  return new Promise((resolve) => {
    const finish = (changes) => { dialog.close(); dialog.remove(); resolve(changes); };
    dialog.addEventListener('click', (event) => {
      const t = event.target.closest('button');
      if (!t) return;
      if (t.dataset.tab) state.tab = t.dataset.tab;
      if (t.dataset.ratio) applyRatio(t.dataset.ratio);
      if (t.hasAttribute('data-reset-crop')) { state.crop = { x: 0, y: 0, w: 1, h: 1 }; state.ratio = 'free'; }
      if (t.dataset.frame) state.frame = t.dataset.frame;
      if (t.dataset.shape) {
        state.shape = t.dataset.shape;
        state.frame = 'cutout';
        // Round shapes look best square, so square up the crop if it isn't already.
        if (t.dataset.shape !== 'rounded' && Math.abs(shownAspect(src, state.crop) - 1) > 0.05) applyRatio('square');
      }
      if (t.dataset.filter) state.filter = t.dataset.filter;
      if ('tape' in t.dataset) state.tape = t.dataset.tape;
      if (t.hasAttribute('data-cancel')) { finish(null); return; }
      if (t.hasAttribute('data-save')) {
        const crop = state.crop;
        const full = crop.x === 0 && crop.y === 0 && crop.w === 1 && crop.h === 1;
        const changes = { crop: full ? null : crop, srcAspect: src, aspect: shownAspect(src, crop), frame: state.frame, shape: state.shape, filter: state.filter, tape: state.tape || null };
        onSave(changes);
        finish(changes);
        return;
      }
      paint();
    });
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(null); });
    paint();
    dialog.showModal();
    dialog.querySelector('[data-save]').focus();
  });
}
