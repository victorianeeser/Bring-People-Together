// In-place spread editor: select, move, resize, rotate, and delete page items;
// add photos (file picker or drag-and-drop), text, and stickers; undo and redo.
// Every change saves right away. Item positions are percentages of the page.

import { commit } from './state.js';
import { createPageItem, uid } from './model.js';
import { putPhoto, resizeImage } from './storage.js';
import { STICKERS, STICKER_COLORS, TRAY, stickerSvg } from './stickers.js';
import { itemStyle, textFontSize, itemLabel } from './pages.js';
import { esc, toast, announce } from './ui.js';

const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
const ROTATE_ICON = svg('<path d="M19 12a7 7 0 1 1-2.1-5M19 4v4.5h-4.5"/>');
const STICKER_WIDTH = { yay: 26, bestday: 34, omg: 22, us: 18, 'washi-pink': 40, 'washi-blue': 40, 'washi-mint': 40 };
const STICKER_ASPECT = { yay: 0.5, bestday: 0.36, omg: 0.6, us: 0.7, 'washi-pink': 0.24, 'washi-blue': 0.24, 'washi-mint': 0.24 };
const HISTORY_LIMIT = 60;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
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
        <label class="slider-row"><span>Rotate</span><input type="range" id="sel-rotate" min="-180" max="180" step="1"><output id="sel-rotate-out"></output></label>
        <label class="slider-row"><span>Size</span><input type="range" id="sel-size" min="5" max="100" step="1"><output id="sel-size-out"></output></label>
        <div class="swatch-row" id="sel-colors" role="group" aria-label="Sticker color">
          ${Object.entries(STICKER_COLORS).map(([name, hex]) => `<button type="button" class="swatch" data-edit="color" data-color="${hex}" style="background:${hex}" aria-label="${name}" aria-pressed="false"></button>`).join('')}
        </div>
        <div class="selected-actions">
          <button type="button" class="pill-btn small" data-edit="forward">Bring forward</button>
          <button type="button" class="pill-btn small" data-edit="backward">Send backward</button>
          <button type="button" class="pill-btn small" data-edit="duplicate">Duplicate</button>
          <button type="button" class="pill-btn small danger-text" data-edit="delete">Remove</button>
        </div>
      </section>

      <section class="panel-section" aria-labelledby="photos-title">
        <h3 id="photos-title">Photos <span class="muted" id="photo-count"></span></h3>
        <div class="dropzone" id="dropzone">
          <p>Drag photos here</p>
          <button type="button" class="pill-btn" data-edit="photo">Browse</button>
        </div>
        <input type="file" id="photo-input" accept="image/*" multiple hidden>
      </section>

      <section class="panel-section" aria-labelledby="text-title">
        <h3 id="text-title">Text</h3>
        <button type="button" class="pill-btn" data-edit="text">+ Add text box</button>
      </section>

      <section class="panel-section" aria-labelledby="stickers-title">
        <h3 id="stickers-title">Stickers</h3>
        <div class="sticker-grid">
          ${TRAY.map((kind) => `<button type="button" class="tray-btn" data-edit="add-sticker" data-kind="${kind}" aria-label="Add ${esc(STICKERS[kind].label)}">${STICKERS[kind].svg()}</button>`).join('')}
        </div>
        <p class="panel-hint">Drag a sticker onto the page or click to drop it in the middle. Click anything on the page to move, rotate, or resize it.</p>
      </section>

      <div class="panel-foot">
        <button type="button" class="pill-btn small" data-edit="undo">Undo</button>
        <button type="button" class="pill-btn small" data-edit="redo">Redo</button>
      </div>
    </aside>`;
}

export function createEditor({ root, book, spreadEl, currentSpread, rerender, isEnabled = () => true, onDone }) {
  // Editing only works on a regular spread while edit mode is on.
  const editable = () => Boolean(currentSpread()) && isEnabled();
  const panel = root.querySelector('#edit-panel');
  const view = root.querySelector('.book-view');
  const selTools = panel.querySelector('#selected-tools');
  const rotateInput = panel.querySelector('#sel-rotate');
  const sizeInput = panel.querySelector('#sel-size');
  const fileInput = panel.querySelector('#photo-input');
  const dropzone = panel.querySelector('#dropzone');
  let selectedId = null;
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

  // ---- Selection ----
  function clearHandles() {
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
    if (el) {
      el.classList.add('selected');
      el.setAttribute('aria-pressed', 'true');
      if (editingId !== selectedId) {
        // No whitespace between handles: notes read their text from the element.
        el.insertAdjacentHTML('beforeend', `<span class="handle h-rotate" aria-hidden="true">${ROTATE_ICON}</span><span class="handle h-resize" aria-hidden="true"></span>`);
      }
    }
    updatePanel();
  }

  // The panel's "Selected" section mirrors the selected item.
  function updatePanel() {
    const found = find(selectedId);
    selTools.hidden = !found;
    if (found) {
      const { item } = found;
      panel.querySelector('#selected-title').textContent = `Selected: ${TYPE_NAME[item.type]}`;
      rotateInput.value = Math.round(item.rotation || 0);
      panel.querySelector('#sel-rotate-out').textContent = `${Math.round(item.rotation || 0)}°`;
      sizeInput.value = Math.round(item.width);
      panel.querySelector('#sel-size-out').textContent = `${Math.round(item.width)}%`;
      const colors = panel.querySelector('#sel-colors');
      colors.hidden = item.type !== 'sticker' || String(item.kind).startsWith('washi');
      colors.querySelectorAll('.swatch').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === item.color)));
    }
    const spread = currentSpread();
    const photos = spread ? allItems(spread).filter((i) => i.type === 'photo').length : 0;
    panel.querySelector('#photo-count').textContent = photos ? `${photos} on this spread` : '';
    panel.querySelector('[data-edit="undo"]').disabled = !history.undo.length;
    panel.querySelector('[data-edit="redo"]').disabled = !history.redo.length;
  }

  function select(id, { focus = false } = {}) {
    if (editingId && editingId !== id) finishEditing();
    selectedId = id;
    applySelection();
    if (focus) itemEl(id)?.focus({ preventScroll: true });
  }

  function deselect() {
    if (editingId) finishEditing();
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
    const images = [...files].filter((f) => f.type.startsWith('image/'));
    if (!spread) return;
    if (!images.length) { toast('Only image files can be added as photos'); return; }
    toast(images.length > 1 ? `Adding ${images.length} photos…` : 'Adding photo…');
    const snap = snapshot();
    let lastId = null;
    for (const [i, file] of images.entries()) {
      try {
        const { blob, width, height } = await resizeImage(file);
        const photoKey = await putPhoto(blob);
        const item = createPageItem('photo', { width: 42, rotation: Math.round((Math.random() - 0.5) * 8), photoKey, aspect: height / width });
        placeNew(spread, side || targetSide(spread), item, point ? { x: point.x + i * 4, y: point.y + i * 4 } : null);
        lastId = item.id;
      } catch {
        toast(`Couldn't add ${file.name}`);
      }
    }
    if (!lastId) return;
    record(snap);
    save();
    selectedId = lastId;
    redraw({ focus: true });
    announce(images.length > 1 ? `${images.length} photos added` : 'Photo added');
  }

  function addText() {
    const spread = currentSpread();
    if (!spread) return;
    record();
    const item = createPageItem('text', { width: 56, content: '', font: 'caveat', size: 7, color: '#2B2B2B' });
    placeNew(spread, targetSide(spread), item);
    save();
    selectedId = item.id;
    redraw();
    startEditing(item.id);
  }

  function addSticker(kind, { side, point } = {}) {
    const spread = currentSpread();
    if (!spread) return;
    record();
    const item = createPageItem('sticker', { kind, width: STICKER_WIDTH[kind] || 18, rotation: Math.round((Math.random() - 0.5) * 16) });
    placeNew(spread, side || targetSide(spread), item, point);
    save();
    selectedId = item.id;
    redraw({ focus: true });
    announce(`${STICKERS[kind].label} added`);
  }

  function removeSelected() {
    const found = find(selectedId);
    if (!found) return;
    record();
    found.page.items = found.page.items.filter((i) => i.id !== selectedId);
    save();
    selectedId = null;
    redraw();
    spreadEl.focus({ preventScroll: true });
    announce(`${itemLabel(found.item)} deleted`);
  }

  function restack(direction) {
    const found = find(selectedId);
    if (!found) return;
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
    if (!found) return;
    record();
    const copy = { ...JSON.parse(JSON.stringify(found.item)), id: uid('pi'), x: found.item.x + 4, y: found.item.y + 4, z: topZ(found.spread) + 1 };
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
    book.spreads = JSON.parse(from.pop());
    save();
    redraw();
    announce(redo ? 'Redone' : 'Undone');
  }

  // ---- Text editing (type right on the page) ----
  let editSnap = null;
  function startEditing(id) {
    const el = itemEl(id);
    const found = find(id);
    if (!el || !found || found.item.type !== 'text') return;
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
  function onTextBlur() { if (editingId) finishEditing(); }
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

  // ---- Pointer: move, resize, rotate ----
  function startMove(event, el, found) {
    const pageEl = el.closest('.page');
    const rect = pageEl.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY, ix: found.item.x, iy: found.item.y };
    const snap = snapshot();
    let moved = false;
    el.setPointerCapture(event.pointerId);

    const onMove = (e) => {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      if (!moved) el.classList.add('lifting');
      moved = true;
      found.item.x = start.ix + (dx / rect.width) * 100;
      found.item.y = start.iy + (dy / rect.height) * 100;
      el.style.left = `${found.item.x}%`;
      el.style.top = `${found.item.y}%`;
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.classList.remove('lifting');
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
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      el.classList.remove('lifting');
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
    const handle = event.target.closest('.handle');
    if (el) {
      const found = find(el.dataset.id);
      if (!found) return;
      event.preventDefault();
      if (selectedId !== found.item.id) select(found.item.id);
      el.focus({ preventScroll: true });
      if (handle) startHandle(event, el, found, handle.classList.contains('h-resize') ? 'resize' : 'rotate');
      else startMove(event, el, found);
      return;
    }
    if (pageEl) deselect();
  }

  function onDoubleClick(event) {
    const el = event.target.closest('.page-inner .pi-text');
    if (el && editable()) startEditing(el.dataset.id);
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
    const pageEl = event.target.closest('.page') || spreadEl.querySelector('.page.left');
    const rect = pageEl.getBoundingClientRect();
    const side = pageEl.classList.contains('left') ? 'left' : 'right';
    const point = { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 };
    addPhotos(event.dataTransfer.files, side, point);
  }

  // ---- Panel ----
  function setColor(color) {
    const found = find(selectedId);
    if (!found || found.item.type !== 'sticker') return;
    record();
    found.item.color = color;
    save();
    redraw();
  }

  // Sliders: one undo step per drag of a slider.
  let sliderSnap = null;
  function onSlider(event) {
    const found = find(selectedId);
    if (!found) return;
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
      if (item.type === 'text') el.style.fontSize = textFontSize(item);
      panel.querySelector('#sel-size-out').textContent = `${item.width}%`;
    }
  }
  function onSliderDone() {
    if (sliderSnap && sliderSnap !== snapshot()) { record(sliderSnap); save(); updatePanel(); }
    sliderSnap = null;
  }
  rotateInput.addEventListener('input', onSlider);
  sizeInput.addEventListener('input', onSlider);
  rotateInput.addEventListener('change', onSliderDone);
  sizeInput.addEventListener('change', onSliderDone);

  let stickerDragged = false;
  const panelActions = {
    done: () => onDone?.(),
    photo: () => fileInput.click(),
    text: addText,
    'add-sticker': (btn) => addSticker(btn.dataset.kind),
    color: (btn) => setColor(btn.dataset.color),
    delete: removeSelected,
    forward: () => restack(1),
    backward: () => restack(-1),
    duplicate,
    undo: () => undo(),
    redo: () => undo(true),
  };
  panel.addEventListener('pointerdown', (event) => {
    // Keep the selection (and note focus) while using panel buttons.
    if (event.target.closest('button[data-edit]')) event.preventDefault();
  });
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
    if (performance.now() - lastNudge > 700) record();
    lastNudge = performance.now();
    change(found.item);
    const el = itemEl(selectedId);
    el.style.cssText = itemStyle(found.item) + (found.item.type === 'text' ? `;font-family:var(--page-font);font-size:${textFontSize(found.item)};color:${found.item.color || '#2B2B2B'}` : '');
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
    destroy() {
      document.removeEventListener('pointerdown', onOutside);
    },
  };
}
