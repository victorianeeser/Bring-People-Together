// Edit cover: design a cover piece by piece, with a live preview.
// Pick a color and pattern (or a photo), then the tape and the sticker, and drag those two to place them.
// It opens on top of the New book / Book settings form and hands the finished cover back to it.

import { COVER_COLORS, COVER_PATTERNS, COVER_TAPES, COVER_DOODLES, coverStyle } from './model.js';
import { coverHtml, patternSvg, hydrateCovers } from './covers.js';
import { putPhoto, resizeImage, deletePhotos } from './storage.js';
import { esc, toast } from './ui.js';

const UPLOAD_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15"/></svg>';
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// cover: the cover to start from. title / seed: for the preview.
// onDone(cover, newPhotoKey): the finished cover; newPhotoKey is a photo uploaded here that it uses (or null).
export function openCoverEditor({ cover, title = 'Your title', seed = 'cover', onDone } = {}) {
  const now = coverStyle(cover, seed);
  const startPlace = { tapePos: now.tapePos, doodlePos: now.doodlePos };
  let draft = cover?.type === 'photo'
    ? { type: 'photo', photoKey: cover.photoKey, tape: now.tape, doodle: now.doodle, spine: now.spine, label: now.label, place: now.place, ...startPlace }
    : { type: 'custom', color: now.color, pattern: now.pattern, tape: now.tape, doodle: now.doodle, spine: now.spine, label: now.label, place: now.place, ...startPlace };
  let lastColors = { color: now.color, pattern: cover?.type === 'photo' ? 'dots' : now.pattern };
  const uploaded = []; // photos uploaded here, removed again if they don't end up on the cover
  let done = false;

  // Its own dialog, so it can sit on top of the book form.
  const dialog = document.createElement('dialog');
  dialog.className = 'confirm wide cover-editor-dialog';
  dialog.setAttribute('aria-labelledby', 'ce-title');
  document.body.append(dialog);

  // Same look as the Edit panel (11/21): tabs, then paper-style tiles three to a row, with the name under each.
  const tile = (group, value, label, swatchHtml, on) => `
    <button type="button" class="bg-mini ce-tile" data-set="${group}" data-value="${esc(value)}" aria-pressed="${on}" aria-label="${esc(label)}">
      ${swatchHtml}<span class="bg-name">${esc(label)}</span>
    </button>`;
  const TABS = [['cover', 'Cover'], ['pattern', 'Pattern'], ['tape', 'Tape'], ['sticker', 'Sticker']];
  let tab = 'cover';

  function controlsHtml() {
    const photo = draft.type === 'photo';
    const base = photo ? lastColors.color : draft.color;
    const swatch = (style, inner = '') => `<span class="bg-swatch ce-sw" style="${style}">${inner}</span>`;
    const img = (src) => swatch('background:#FFFFFF', `<img src="${src}" alt="">`);
    const none = swatch('', '<span class="ce-none-line"></span>');
    const tabs = `<div class="panel-tabs ce-tabs" role="tablist" aria-label="Cover parts">${TABS.map(([id, name]) =>
      `<button type="button" class="panel-tab" role="tab" data-ce-tab="${id}" aria-selected="${tab === id}">${name}</button>`).join('')}</div>`;
    const panels = {
      cover: `
        <h4 class="bg-group">Color</h4>
        <div class="bg-row">${Object.entries(COVER_COLORS).map(([name, hex]) => tile('color', hex, name, swatch(`background:${hex}`), !photo && draft.color === hex)).join('')}</div>
        <h4 class="bg-group">Photo</h4>
        <div class="bg-row">
          ${tile('kind', 'photo', draft.photoKey ? 'Your photo' : 'Upload photo', swatch('background:#FFFFFF', `<span class="ce-upload">${UPLOAD_ICON}</span>`), photo)}
        </div>
        ${photo ? '<button type="button" class="link-btn ce-link" data-set="upload">Choose a different photo</button>' : ''}`,
      pattern: photo
        ? '<p class="panel-hint">Photo covers don\'t have a pattern. Pick a color on the Cover tab to use one.</p>'
        : `<div class="bg-row">${Object.entries(COVER_PATTERNS).map(([id, name]) => tile('pattern', id, name,
            swatch(`background:${esc(base)}`, patternSvg({ id: seed, pattern: id, ink: '#510C0D' })), draft.pattern === id)).join('')}</div>`,
      tape: `<div class="bg-row">${Object.entries(COVER_TAPES).map(([id, name]) => tile('tape', id, name,
        id === 'none' ? none : img(`./brand/elements/tape-${id}.svg`), draft.tape === id)).join('')}</div>`,
      sticker: `<div class="bg-row">${Object.entries(COVER_DOODLES).map(([id, name]) => tile('doodle', id, name,
        id === 'none' ? none : img(`./brand/${id}.svg`), draft.doodle === id)).join('')}</div>`,
    };
    return `${tabs}<div class="ce-tab-body" role="tabpanel">${panels[tab]}</div>`;
  }

  dialog.innerHTML = `
    <form method="dialog" class="cover-editor" novalidate>
      <div class="panel-head ce-head">
        <h2 id="ce-title">Edit cover</h2>
        <div class="panel-head-tools">
          <button type="button" class="pill-btn small" data-close>Cancel</button>
          <button type="submit" class="pill-btn panel-done">Done</button>
        </div>
      </div>
      <div class="ce-layout">
        <div class="ce-left">
          <div class="ce-preview"><span class="book"></span></div>
          <p class="ce-hint">Drag the tape and the sticker to move them.</p>
          <button type="button" class="link-btn ce-reset" data-set="reset">Put them back</button>
        </div>
        <div class="ce-controls edit-panel-look"></div>
      </div>
      <input type="file" accept="image/*" hidden>
    </form>`;
  const form = dialog.querySelector('form');
  const preview = form.querySelector('.ce-preview .book');
  const controls = form.querySelector('.ce-controls');
  const fileInput = form.querySelector('input[type="file"]');
  const resetBtn = form.querySelector('.ce-reset');

  function renderPreview() {
    preview.innerHTML = coverHtml({ id: seed, title, cover: draft });
    hydrateCovers(preview);
    preview.querySelector('.cover-tape')?.setAttribute('data-piece', 'tapePos');
    preview.querySelector('.cover-doodle')?.setAttribute('data-piece', 'doodlePos');
    resetBtn.hidden = !draft.tapePos && !draft.doodlePos;
  }

  function render({ keepFocus } = {}) {
    renderPreview();
    controls.innerHTML = controlsHtml();
    if (keepFocus) controls.querySelector(`[data-set="${keepFocus.set}"][data-value="${CSS.escape(keepFocus.value)}"]`)?.focus();
  }

  // Drag the tape or the sticker around the cover.
  preview.addEventListener('pointerdown', (event) => {
    const piece = event.target.closest('[data-piece]');
    if (!piece) return;
    event.preventDefault();
    const box = preview.querySelector('.cover').getBoundingClientRect();
    const r = piece.getBoundingClientRect();
    // Keep the spot you grabbed under the pointer.
    const grab = { x: event.clientX - (r.left + r.width / 2), y: event.clientY - (r.top + r.height / 2) };
    const deg = piece.dataset.piece === 'tapePos' ? -7 : 8;
    piece.setPointerCapture(event.pointerId);
    piece.classList.add('is-dragging');
    let pos = null;
    const onMove = (e) => {
      pos = {
        x: Math.round(clamp(((e.clientX - grab.x - box.left) / box.width) * 100, 0, 100) * 10) / 10,
        y: Math.round(clamp(((e.clientY - grab.y - box.top) / box.height) * 100, 0, 100) * 10) / 10,
      };
      Object.assign(piece.style, { left: `${pos.x}%`, top: `${pos.y}%`, right: 'auto', bottom: 'auto', transform: `translate(-50%,-50%) rotate(${deg}deg)` });
    };
    const onUp = () => {
      piece.removeEventListener('pointermove', onMove);
      piece.removeEventListener('pointerup', onUp);
      piece.removeEventListener('pointercancel', onUp);
      piece.classList.remove('is-dragging');
      if (pos) { draft = { ...draft, [piece.dataset.piece]: pos }; renderPreview(); }
    };
    piece.addEventListener('pointermove', onMove);
    piece.addEventListener('pointerup', onUp);
    piece.addEventListener('pointercancel', onUp);
  });

  async function usePhoto(file) {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const { blob } = await resizeImage(file, 1200);
      const key = await putPhoto(blob);
      uploaded.push(key);
      draft = { ...draft, type: 'photo', photoKey: key };
      delete draft.color; delete draft.pattern;
      render({ keepFocus: { set: 'kind', value: 'photo' } });
    } catch {
      toast("Couldn't use that photo");
    }
  }

  form.addEventListener('click', (event) => {
    const tabBtn = event.target.closest('[data-ce-tab]');
    if (tabBtn) {
      tab = tabBtn.dataset.ceTab;
      controls.innerHTML = controlsHtml();
      controls.querySelector(`[data-ce-tab="${tab}"]`)?.focus();
      return;
    }
    const btn = event.target.closest('[data-set]');
    if (!btn) return;
    const { set, value } = btn.dataset;
    if (set === 'upload') { fileInput.click(); return; }
    if (set === 'reset') { draft = { ...draft, tapePos: null, doodlePos: null }; renderPreview(); return; }
    if (set === 'kind') {
      if (value === 'photo') {
        if (draft.type === 'photo') return;
        lastColors = { color: draft.color, pattern: draft.pattern };
        // Reuse a photo picked earlier, otherwise ask for one.
        const key = uploaded.at(-1) || (cover?.type === 'photo' ? cover.photoKey : null);
        if (!key) { fileInput.click(); return; }
        draft = { type: 'photo', photoKey: key, tape: draft.tape, doodle: draft.doodle, spine: draft.spine, label: draft.label, place: draft.place, tapePos: draft.tapePos, doodlePos: draft.doodlePos };
      } else if (draft.type === 'photo') {
        draft = { type: 'custom', ...lastColors, tape: draft.tape, doodle: draft.doodle, spine: draft.spine, label: draft.label, place: draft.place, tapePos: draft.tapePos, doodlePos: draft.doodlePos };
      }
    } else if (set === 'color' && draft.type === 'photo') {
      // Picking a color while a photo is on: back to a color cover (with the last pattern you had).
      draft = { type: 'custom', color: value, pattern: lastColors.pattern, tape: draft.tape, doodle: draft.doodle, spine: draft.spine, label: draft.label, place: draft.place, tapePos: draft.tapePos, doodlePos: draft.doodlePos };
    } else {
      draft = { ...draft, [set]: value };
    }
    render({ keepFocus: { set, value } });
  });
  fileInput.addEventListener('change', () => { usePhoto(fileInput.files[0]); fileInput.value = ''; });
  form.querySelector('[data-close]').addEventListener('click', () => dialog.close());

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    done = true;
    // Only keep positions that were actually set.
    const result = { ...draft };
    if (!result.tapePos) delete result.tapePos;
    if (!result.doodlePos) delete result.doodlePos;
    const newKey = result.type === 'photo' && uploaded.includes(result.photoKey) ? result.photoKey : null;
    dialog.close();
    onDone?.(result, newKey);
  });

  dialog.addEventListener('close', () => {
    const keep = done && draft.type === 'photo' ? draft.photoKey : null;
    const unused = uploaded.filter((k) => k !== keep);
    if (unused.length) deletePhotos(unused).catch(() => {});
    dialog.remove();
  }, { once: true });

  render();
  dialog.showModal();
  controls.querySelector('[aria-pressed="true"]')?.focus();
}
