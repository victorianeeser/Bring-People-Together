// Edit cover (11/22): the same full-screen editor as a spread. The cover sits in the middle and the
// Edit panel is on the right with the same tabs: Photos, Text, Stickers, and Cover (color, pattern,
// a photo cover, tape and the label sticker). Add photos, notes and stickers on top of the cover,
// then drag, resize, rotate or remove them. The back arrow (top left) goes back to the library.
// It opens on top of the New book / Book settings form and hands the finished cover back to it.

import { COVER_COLORS, COVER_PATTERNS, PAGE_BG_GROUPS, TEXT_COLORS, coverStyle, uid } from './model.js';
import { coverHtml, patternSvg, hydrateCovers } from './covers.js';
import { putPhoto, resizeImage, deletePhotos } from './storage.js';
import { STICKERS, TRAY, ELEMENT_TRAY } from './stickers.js';
import { STICKER_WIDTH, STICKER_ASPECT } from './editor.js';
import { ICONS, esc, toast, confirmDialog } from './ui.js';

const UPLOAD_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15"/></svg>';
const UNDO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
const REDO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>';
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const TYPE_NAME = { photo: 'Photo', text: 'Text', sticker: 'Sticker' };
const ALIGN_ICONS = {
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 10h10M4 14h16M4 18h10"/></svg>',
  center: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 10h10M4 14h16M7 18h10"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M10 10h10M4 14h16M10 18h10"/></svg>',
};
const TITLE_LABELS = { none: 'None', paper: 'Paper', pill: 'Pill', stamp: 'Stamp', tag: 'Tag', band: 'Band' };
const LABEL_COLORS = { Paper: '#FBF5F1', White: '#FFFFFF', Butter: '#F4E2B4', Rose: '#F3DCD8', Blush: '#FFD6D6', Sage: '#DCE8E1', Maroon: '#510C0D' };
// The cover's own tape and label sticker become normal stickers you can move, resize or remove (11/22).
const PIECE_KIND = {
  tape: { olive: 'e-tape-olive', pink: 'e-tape-pink' },
  doodle: { 'elements/doodle-heart': 'e-heart', 'elements/doodle-sparkle': 'e-sparkle', 'elements/doodle-star': 'e-doodle-star', 'elements/star-small': 'e-star-small', 'elements/doodle-loop': 'e-loop', mark: 'e-mark' },
};
const TABS = [['photos', 'Photos'], ['text', 'Text'], ['stickers', 'Stickers'], ['cover', 'Cover']];
let lastTab = 'cover'; // the panel opens on the tab you used last

// cover: the cover to start from. title / seed: for the preview.
// onDone(cover, newPhotoKeys): the finished cover and the photos uploaded here that it uses.
// onBack(): the back arrow, to leave everything and go back to the library.
export function openCoverEditor({ cover, title = 'Your title', seed = 'cover', onDone, onBack } = {}) {
  const now = coverStyle(cover, seed);
  const startPlace = { tapePos: now.tapePos, doodlePos: now.doodlePos };
  const look = { spine: now.spine, label: now.label, place: now.place,
    titleAlign: now.titleAlign, titleSize: now.titleSize, titleColor: now.titleColor, labelColor: now.labelColor,
    paper: now.paper, bgOpacity: now.bgOpacity, bgSize: now.bgSize };
  const items = JSON.parse(JSON.stringify(cover?.items || []));
  let draft = cover?.type === 'photo'
    ? { type: 'photo', photoKey: cover.photoKey, tape: now.tape, doodle: now.doodle, ...look, ...startPlace, items }
    : { type: 'custom', color: now.color, pattern: now.pattern, tape: now.tape, doodle: now.doodle, ...look, ...startPlace, items };
  let lastColors = { color: now.color, pattern: cover?.type === 'photo' ? 'dots' : now.pattern };
  const uploaded = []; // photos uploaded here, removed again if they don't end up on the cover
  let startJson = JSON.stringify(draft);
  const history = { undo: [], redo: [] };
  let selectedId = null;
  let tab = lastTab;
  let done = false;

  const defaultAlign = () => (['pill', 'stamp'].includes(draft.label) ? 'center' : 'left');
  const record = () => { history.undo.push(JSON.stringify(draft)); if (history.undo.length > 60) history.undo.shift(); history.redo = []; };
  const findItem = (id) => draft.items.find((i) => i.id === id) || null;
  const topZ = () => Math.max(0, ...draft.items.map((i) => i.z || 0));

  const dialog = document.createElement('dialog');
  dialog.className = 'cover-editor-dialog';
  dialog.setAttribute('aria-labelledby', 'ce-title');
  document.body.append(dialog);

  // ---- The panel (same pieces as the Edit panel) ----
  const tile = (group, value, label, swatchHtml, on) => `
    <button type="button" class="bg-mini ce-tile" data-set="${group}" data-value="${esc(value)}" aria-pressed="${on}" aria-label="${esc(label)}">
      ${swatchHtml}<span class="bg-name">${esc(label)}</span>
    </button>`;

  function selectedHtml() {
    const it = findItem(selectedId);
    if (!it) return '';
    const textBits = it.type === 'text' ? `
      <div class="sel-group">
        <h4>Text</h4>
        <textarea class="ce-text-input" rows="2" maxlength="120" aria-label="Text on the cover">${esc(it.content || '')}</textarea>
        <h4 class="sel-sub">Color</h4>
        <div class="swatch-row">${Object.entries(TEXT_COLORS).map(([name, hex]) => `<button type="button" class="color-chip" data-edit="text-color" data-color="${hex}" aria-pressed="${String((it.color || '').toLowerCase() === hex.toLowerCase())}"><span class="swatch-dot" style="background:${hex}"></span>${name}</button>`).join('')}</div>
      </div>` : '';
    return `
      <section class="panel-section selected-tools">
        <h3>Selected: ${TYPE_NAME[it.type]}</h3>
        <button type="button" class="pill-btn small sel-done" data-edit="deselect">Done</button>
        <div id="sel-edit-tools">
          <div class="sel-group">
            <h4>Size &amp; angle</h4>
            <label class="slider-row"><span>Size</span><input type="range" class="ce-size" min="5" max="100" step="1" value="${Math.round(it.width)}"><output>${Math.round(it.width)}%</output></label>
            <label class="slider-row"><span>Rotate</span><input type="range" class="ce-rotate" min="-180" max="180" step="1" value="${Math.round(it.rotation || 0)}"><output>${Math.round(it.rotation || 0)}°</output></label>
          </div>
          ${textBits}
          <div class="sel-group">
            <h4>Arrange</h4>
            <div class="selected-actions">
              <button type="button" class="pill-btn small" data-edit="forward">Bring forward</button>
              <button type="button" class="pill-btn small" data-edit="backward">Send backward</button>
              <button type="button" class="pill-btn small" data-edit="duplicate">Duplicate</button>
            </div>
            <button type="button" class="pill-btn small danger-text sel-remove" data-edit="delete">Remove</button>
          </div>
        </div>
      </section>`;
  }

  function tabHtml() {
    const photo = draft.type === 'photo';
    const base = photo ? lastColors.color : draft.color;
    const swatch = (style, inner = '') => `<span class="bg-swatch ce-sw" style="${style}">${inner}</span>`;
    const img = (src) => swatch('background:#FFFFFF', `<img src="${src}" alt="">`);
    const none = swatch('', '<span class="ce-none-line"></span>');
    const trayBtn = (kind) => `<button type="button" class="tray-btn" data-edit="add-sticker" data-kind="${kind}" aria-label="Add ${esc(STICKERS[kind].label)}">${STICKERS[kind].svg()}</button>`;
    switch (tab) {
      case 'photos': return `
        <div class="dropzone ce-drop">
          <p>Add photos to your cover</p>
          <button type="button" class="pill-btn" data-edit="add-photo">Browse</button>
          <p class="panel-hint">Or make a photo the whole cover on the Cover tab.</p>
        </div>`;
      case 'text': return `
        <h4 class="bg-group">Book title</h4>
        <div class="ce-title-opts">
          <h4 class="sel-sub">Align</h4>
          <div class="align-row">${['left', 'center', 'right'].map((a) => `<button type="button" class="align-btn" data-title="titleAlign" data-value="${a}" aria-label="Align ${a}" aria-pressed="${(draft.titleAlign || defaultAlign()) === a}">${ALIGN_ICONS[a]}</button>`).join('')}</div>
          <label class="slider-row"><span>Size</span><input type="range" class="ce-title-size" min="60" max="160" step="5" value="${Math.round((draft.titleSize || 1) * 100)}"><output>${Math.round((draft.titleSize || 1) * 100)}%</output></label>
          <h4 class="sel-sub">Color</h4>
          <div class="swatch-row ce-two">${Object.entries({ ...TEXT_COLORS, White: '#FBF5F1' }).map(([name, hex]) => `<button type="button" class="color-chip" data-title="titleColor" data-value="${hex}" aria-pressed="${String((draft.titleColor || '').toLowerCase() === hex.toLowerCase())}"><span class="swatch-dot" style="background:${hex}"></span>${name}</button>`).join('')}</div>
          <h4 class="sel-sub">Behind the title</h4>
          <div class="label-row ce-labels">${Object.entries(TITLE_LABELS).map(([id, name]) => `<button type="button" class="label-chip" data-title="label" data-value="${id}" aria-pressed="${(draft.label || 'paper') === id}"><span class="label-sample ce-lbl-${id}">Aa</span>${name}</button>`).join('')}</div>
          ${draft.label !== 'none' ? `<h4 class="sel-sub">Label color</h4>
          <div class="swatch-row ce-two">${Object.entries(LABEL_COLORS).map(([name, hex]) => `<button type="button" class="color-chip" data-title="labelColor" data-value="${hex}" aria-pressed="${String((draft.labelColor || '').toLowerCase() === hex.toLowerCase())}"><span class="swatch-dot" style="background:${hex}"></span>${name}</button>`).join('')}</div>` : ''}
          <h4 class="sel-sub">Where</h4>
          <div class="align-row ce-where">${[['top', 'Top'], ['center', 'Middle'], ['bottom', 'Bottom']].map(([id, name]) => `<button type="button" class="align-btn ce-where-btn" data-title="place" data-value="${id}" aria-pressed="${(draft.place || 'bottom') === id}">${name}</button>`).join('')}</div>
        </div>
        <h4 class="bg-group">More text</h4>
        <button type="button" class="pill-btn" data-edit="add-text">+ Add text box</button>
        <p class="panel-hint">Type in the box under Selected.</p>`;
      case 'stickers': return `
        <div class="sticker-grid">${TRAY.map(trayBtn).join('')}</div>
        <h3 class="tray-sub">Tape &amp; doodles</h3>
        <div class="sticker-grid element-grid">${ELEMENT_TRAY.map(trayBtn).join('')}</div>
        <p class="panel-hint">Click a sticker to add it. Drag anything on the cover to move it.</p>`;
      default: {
        // Laid out like the Page tab: opacity and size on top, then groups of tiles.
        const hasPattern = !photo && (draft.paper || (draft.pattern && draft.pattern !== 'none'));
        const op = Math.round((draft.bgOpacity ?? 1) * 100);
        const size = Math.round((draft.bgSize || 1) * 100);
        return `
        ${hasPattern ? `<div class="bg-adjust">
          <label class="slider-row"><span>Opacity</span><input type="range" class="ce-bg-op" min="10" max="100" step="5" value="${op}"><output>${op}%</output></label>
          <label class="slider-row"><span>Size</span><input type="range" class="ce-bg-size" min="50" max="250" step="10" value="${size}"><output>${size}%</output></label>
          <button type="button" class="link-btn" data-edit="bg-reset">Reset opacity and size</button>
        </div>` : ''}
        <h4 class="bg-group">Color</h4>
        <div class="bg-row">${Object.entries(COVER_COLORS).map(([name, hex]) => tile('color', hex, name, swatch(`background:${hex}`), !photo && !draft.paper && draft.color === hex)).join('')}</div>
        <h4 class="bg-group">Pattern</h4>
        ${photo ? '<p class="panel-hint">Photo covers don\'t have a pattern. Pick a color to use one.</p>' : `<div class="bg-row">${Object.entries(COVER_PATTERNS).map(([id, name]) => tile('pattern', id, name,
          swatch(`background:${esc(base)}`, patternSvg({ id: seed, pattern: id, ink: '#510C0D' })), !draft.paper && draft.pattern === id)).join('')}</div>`}
        ${PAGE_BG_GROUPS.map(([group, papers]) => `
          <h4 class="bg-group">${group} paper</h4>
          <div class="bg-row">${Object.entries(papers).map(([id, name]) => tile('paper', id, name, `<span class="bg-swatch" data-bg="${id}"></span>`, !photo && draft.paper === id)).join('')}</div>`).join('')}
        <h4 class="bg-group">Photo cover</h4>
        <div class="bg-row">${tile('kind', 'photo', draft.photoKey ? 'Your photo' : 'Upload photo', swatch('background:#FFFFFF', `<span class="ce-upload">${UPLOAD_ICON}</span>`), photo)}</div>
        ${photo ? '<button type="button" class="link-btn ce-link" data-set="upload">Choose a different photo</button>' : ''}`;
      }
    }
  }

  function panelBodyHtml() {
    return `
      <div class="panel-tabs ce-tabs" role="tablist" aria-label="Edit the cover">${TABS.map(([id, name]) =>
        `<button type="button" class="panel-tab" role="tab" data-ce-tab="${id}" aria-selected="${tab === id}" tabindex="${tab === id ? 0 : -1}">${name}</button>`).join('')}</div>
      ${selectedHtml()}
      <section class="panel-section tab-panel ce-tab-body" role="tabpanel">${tabHtml()}</section>`;
  }

  dialog.innerHTML = `
    <form method="dialog" class="cover-editor ce-full" novalidate>
      <div class="ce-stage">
        <button type="button" class="icon-btn glass ce-back" data-edit="back" aria-label="Back to the library">${ICONS.back}</button>
        <div class="ce-preview"><span class="book"></span></div>
        <p class="ce-hint">Click anything on the cover to select it, then drag to move it.</p>

      </div>
      <aside class="edit-panel tabs-mode ce-panel" aria-labelledby="ce-title">
        <div class="panel-head">
          <h2 id="ce-title">Edit cover</h2>
          <div class="panel-head-tools">
            <button type="button" class="pill-btn small icon-only" data-edit="undo" aria-label="Undo" title="Undo">${UNDO}</button>
            <button type="button" class="pill-btn small icon-only" data-edit="redo" aria-label="Redo" title="Redo">${REDO}</button>
            <button type="submit" class="pill-btn panel-done">Done editing</button>
          </div>
        </div>
        <div class="ce-controls"></div>
      </aside>
      <input type="file" class="ce-file-cover" accept="image/*" hidden>
      <input type="file" class="ce-file-items" accept="image/*" multiple hidden>
    </form>`;
  const form = dialog.querySelector('form');
  const preview = form.querySelector('.ce-preview .book');
  const controls = form.querySelector('.ce-controls');
  const coverFile = form.querySelector('.ce-file-cover');
  const itemFiles = form.querySelector('.ce-file-items');

  // ---- Drawing ----
  function renderPreview() {
    preview.innerHTML = coverHtml({ id: seed, title, cover: draft });
    hydrateCovers(preview);
    preview.querySelector('.cover-tape')?.setAttribute('data-piece', 'tapePos');
    preview.querySelector('.cover-doodle')?.setAttribute('data-piece', 'doodlePos');
    preview.querySelectorAll('.cover-items .pi').forEach((el) => {
      el.classList.toggle('selected', el.dataset.id === selectedId);
      el.tabIndex = 0;
    });

  }
  function renderPanel({ focus } = {}) {
    const scroll = controls.closest('.ce-panel').scrollTop;
    controls.innerHTML = panelBodyHtml();
    controls.closest('.ce-panel').scrollTop = scroll;
    form.querySelector('[data-edit="undo"]').disabled = !history.undo.length;
    form.querySelector('[data-edit="redo"]').disabled = !history.redo.length;
    if (focus) controls.querySelector(focus)?.focus();
  }
  function render(opts) { renderPreview(); renderPanel(opts); }

  // ---- Adding things ----
  function addItem(item) {
    record();
    item.id = uid('ci');
    item.z = topZ() + 1;
    draft.items.push(item);
    selectedId = item.id;
    render();
  }
  const addSticker = (kind) => {
    const width = STICKER_WIDTH[kind] || 22;
    const h = width * 0.75 * (STICKER_ASPECT[kind] || 1);
    addItem({ type: 'sticker', kind, width, x: 50 - width / 2 + (Math.random() - 0.5) * 10, y: 40 - h / 2 + (Math.random() - 0.5) * 10, rotation: Math.round((Math.random() - 0.5) * 14) });
  };
  const addText = () => addItem({ type: 'text', content: 'Your text', font: 'avenir', size: 9, color: '#510C0D', width: 62, x: 19, y: 30, rotation: 0 });
  async function addPhotos(files) {
    const list = [...(files || [])].filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    for (const file of list) {
      try {
        const { blob, width, height } = await resizeImage(file, 1200);
        const key = await putPhoto(blob);
        uploaded.push(key);
        addItem({ type: 'photo', photoKey: key, aspect: height / width, frame: 'polaroid', width: 46, x: 27 + (Math.random() - 0.5) * 10, y: 20 + (Math.random() - 0.5) * 10, rotation: Math.round((Math.random() - 0.5) * 10) });
      } catch {
        toast(`Couldn't add ${file.name}`);
      }
    }
  }
  async function useCoverPhoto(file) {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const { blob } = await resizeImage(file, 1200);
      const key = await putPhoto(blob);
      uploaded.push(key);
      record();
      const { color, pattern, ...rest } = draft;
      draft = { ...rest, type: 'photo', photoKey: key };
      render();
    } catch {
      toast("Couldn't use that photo");
    }
  }

  // ---- Changing the selected thing ----
  function changeSelected(fn, { panel = true } = {}) {
    const it = findItem(selectedId);
    if (!it) return;
    fn(it);
    renderPreview();
    if (panel) renderPanel();
  }
  const actions = {
    'add-sticker': (btn) => addSticker(btn.dataset.kind),
    'add-text': addText,
    'add-photo': () => itemFiles.click(),
    deselect: () => { selectedId = null; render(); },
    delete: () => { record(); draft.items = draft.items.filter((i) => i.id !== selectedId); selectedId = null; render(); },
    duplicate: () => {
      const it = findItem(selectedId);
      if (!it) return;
      addItem({ ...JSON.parse(JSON.stringify(it)), x: it.x + 4, y: it.y + 4 });
    },
    forward: () => restack(1),
    backward: () => restack(-1),
    'text-color': (btn) => { record(); changeSelected((it) => { it.color = btn.dataset.color; }); },
    undo: () => step(history.undo, history.redo),
    redo: () => step(history.redo, history.undo),
    back: () => goBack(),
    'bg-reset': () => { record(); draft = { ...draft, bgOpacity: 1, bgSize: 1 }; render(); },
  };
  function restack(dir) {
    const it = findItem(selectedId);
    if (!it) return;
    record();
    const order = [...draft.items].sort((a, b) => (a.z || 0) - (b.z || 0));
    const i = order.indexOf(it);
    const j = clamp(i + dir, 0, order.length - 1);
    order.splice(i, 1);
    order.splice(j, 0, it);
    order.forEach((x, k) => { x.z = k + 1; });
    render();
  }
  function step(from, to) {
    if (!from.length) return;
    to.push(JSON.stringify(draft));
    draft = JSON.parse(from.pop());
    if (!findItem(selectedId)) selectedId = null;
    render();
  }

  // ---- Clicks in the panel ----
  controls.addEventListener('click', (event) => {
    const tabBtn = event.target.closest('[data-ce-tab]');
    if (tabBtn) { tab = tabBtn.dataset.ceTab; lastTab = tab; renderPanel({ focus: `[data-ce-tab="${tab}"]` }); return; }
    const titleBtn = event.target.closest('[data-title]');
    if (titleBtn) {
      const { title: field, value } = titleBtn.dataset;
      record();
      draft = { ...draft, [field]: draft[field] === value && (field === 'titleColor' || field === 'labelColor') ? null : value };
      render({ focus: `[data-title="${field}"][data-value="${CSS.escape(value)}"]` });
      return;
    }
    const edit = event.target.closest('[data-edit]');
    if (edit) { actions[edit.dataset.edit]?.(edit); return; }
    const btn = event.target.closest('[data-set]');
    if (!btn) return;
    const { set, value } = btn.dataset;
    if (set === 'upload') { coverFile.click(); return; }
    record();
    if (set === 'kind') {
      if (draft.type === 'photo') { history.undo.pop(); return; }
      lastColors = { color: draft.color, pattern: draft.pattern };
      const key = uploaded.find((k) => !draft.items.some((i) => i.photoKey === k)) || (cover?.type === 'photo' ? cover.photoKey : null);
      if (!key) { history.undo.pop(); coverFile.click(); return; }
      const { color, pattern, ...rest } = draft;
      draft = { ...rest, type: 'photo', photoKey: key };
    } else if (set === 'paper') {
      const { photoKey, ...rest } = draft;
      draft = { ...rest, type: 'custom', paper: value };
    } else if ((set === 'color' || set === 'pattern') && draft.paper) {
      draft = { ...draft, paper: null, [set]: value };
    } else if (set === 'color' && draft.type === 'photo') {
      const { photoKey, ...rest } = draft;
      draft = { ...rest, type: 'custom', color: value, pattern: lastColors.pattern };
    } else {
      draft = { ...draft, [set]: value };
    }
    render({ focus: `[data-set="${set}"][data-value="${CSS.escape(value)}"]` });
  });
  form.querySelector('.ce-panel .panel-head').addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit]');
    if (edit) actions[edit.dataset.edit]?.(edit);
  });
  form.querySelector('.ce-stage').addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit="back"]');
    if (edit) { goBack(); return; }
    if (event.target.closest('[data-set="reset"]')) { record(); draft = { ...draft, tapePos: startPlace.tapePos || null, doodlePos: startPlace.doodlePos || null }; render(); }
  });
  // Sliders and the text box change things live; one undo step per drag / typing session.
  let liveSnap = null;
  controls.addEventListener('input', (event) => {
    const t = event.target;
    // Book title size and the background's opacity / size
    const coverSlider = { 'ce-title-size': 'titleSize', 'ce-bg-op': 'bgOpacity', 'ce-bg-size': 'bgSize' };
    const field = Object.entries(coverSlider).find(([cls]) => t.classList.contains(cls))?.[1];
    if (field) {
      if (!liveSnap) liveSnap = JSON.stringify(draft);
      draft[field] = Number(t.value) / 100;
      t.nextElementSibling.textContent = `${t.value}%`;
      renderPreview();
      return;
    }
    const it = findItem(selectedId);
    if (!it) return;
    if (!liveSnap) liveSnap = JSON.stringify(draft);
    if (t.classList.contains('ce-size')) { it.width = Number(t.value); t.nextElementSibling.textContent = `${t.value}%`; }
    else if (t.classList.contains('ce-rotate')) { it.rotation = Number(t.value); t.nextElementSibling.textContent = `${t.value}°`; }
    else if (t.classList.contains('ce-text-input')) { it.content = t.value; }
    else return;
    renderPreview();
  });
  controls.addEventListener('change', () => {
    if (liveSnap && liveSnap !== JSON.stringify(draft)) { history.undo.push(liveSnap); history.redo = []; renderPanel(); }
    liveSnap = null;
  });
  coverFile.addEventListener('change', () => { useCoverPhoto(coverFile.files[0]); coverFile.value = ''; });
  itemFiles.addEventListener('change', () => { addPhotos(itemFiles.files); itemFiles.value = ''; });

  // ---- On the cover: select and drag things (and the tape / label sticker) ----
  preview.addEventListener('pointerdown', (event) => {
    const box = preview.querySelector('.cover')?.getBoundingClientRect();
    if (!box) return;
    const itemEl = event.target.closest('.cover-items .pi');
    const piece = event.target.closest('[data-piece]');
    if (!itemEl && !piece) {
      if (selectedId) { selectedId = null; render(); }
      return;
    }
    event.preventDefault();
    const target = itemEl || piece;
    const r = target.getBoundingClientRect();
    const grab = { x: event.clientX - (r.left + r.width / 2), y: event.clientY - (r.top + r.height / 2) };
    const start = { x: event.clientX, y: event.clientY };
    const snap = JSON.stringify(draft);
    let moved = false;
    if (itemEl && selectedId !== itemEl.dataset.id) { selectedId = itemEl.dataset.id; renderPanel(); preview.querySelectorAll('.cover-items .pi').forEach((el) => el.classList.toggle('selected', el.dataset.id === selectedId)); }
    const el = itemEl ? preview.querySelector(`.cover-items .pi[data-id="${CSS.escape(selectedId)}"]`) : piece;
    const it = itemEl ? findItem(selectedId) : null;
    const startXY = it ? { x: it.x, y: it.y } : null;
    el.setPointerCapture?.(event.pointerId);
    el.classList.add('is-dragging');
    const onMove = (e) => {
      if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 3) return;
      moved = true;
      if (it) {
        it.x = startXY.x + ((e.clientX - start.x) / box.width) * 100;
        it.y = startXY.y + ((e.clientY - start.y) / box.height) * 100;
        el.style.left = `${it.x}%`;
        el.style.top = `${it.y}%`;
      } else {
        const deg = piece.dataset.piece === 'tapePos' ? -7 : 8;
        const pos = {
          x: Math.round(clamp(((e.clientX - grab.x - box.left) / box.width) * 100, 0, 100) * 10) / 10,
          y: Math.round(clamp(((e.clientY - grab.y - box.top) / box.height) * 100, 0, 100) * 10) / 10,
        };
        draft[piece.dataset.piece] = pos;
        Object.assign(piece.style, { left: `${pos.x}%`, top: `${pos.y}%`, right: 'auto', bottom: 'auto', transform: `translate(-50%,-50%) rotate(${deg}deg)` });
      }
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.classList.remove('is-dragging');
      if (moved) { history.undo.push(snap); history.redo = []; render(); }
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  });

  // Keyboard: Delete removes, Esc lets go of the selection, Cmd/Ctrl+Z undoes.
  dialog.addEventListener('keydown', (event) => {
    if (event.target.matches('textarea, input')) return;
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === 'z') { event.preventDefault(); (event.shiftKey ? actions.redo : actions.undo)(); return; }
    if (!selectedId) return;
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); actions.delete(); }
    if (event.key === 'Escape') { event.preventDefault(); actions.deselect(); }
  });

  // ---- Leaving ----
  const changed = () => JSON.stringify(draft) !== startJson;
  async function goBack() {
    if (changed()) {
      const ok = await confirmDialog({ title: 'Leave without saving?', body: 'Your cover changes will be lost.', confirmLabel: 'Leave', danger: true });
      if (!ok) return;
    }
    dialog.close();
    onBack?.();
  }
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); if (selectedId) actions.deselect(); });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    done = true;
    const result = JSON.parse(JSON.stringify(draft));
    if (!result.tapePos) delete result.tapePos;
    if (!result.doodlePos) delete result.doodlePos;
    if (!result.items.length) delete result.items;
    const used = new Set([result.photoKey, ...(result.items || []).map((i) => i.photoKey)].filter(Boolean));
    dialog.close();
    onDone?.(result, uploaded.filter((k) => used.has(k)));
  });

  dialog.addEventListener('close', () => {
    const used = done ? new Set([draft.photoKey, ...draft.items.map((i) => i.photoKey)].filter(Boolean)) : new Set();
    const unused = uploaded.filter((k) => !used.has(k));
    if (unused.length) deletePhotos(unused).catch(() => {});
    dialog.remove();
  }, { once: true });

  render();
  dialog.showModal();
  piecesToStickers();
  controls.querySelector(`[data-ce-tab="${tab}"]`)?.focus();

  // The tape and label sticker drawn on presets become normal stickers, right where they are,
  // so they can be selected, moved, resized or removed like anything else.
  function piecesToStickers() {
    const box = preview.querySelector('.cover')?.getBoundingClientRect();
    if (!box || !box.width) return;
    let z = topZ();
    for (const [field, cls, deg] of [['tape', '.cover-tape', -7], ['doodle', '.cover-doodle', 8]]) {
      const kind = PIECE_KIND[field][draft[field]];
      const el = preview.querySelector(cls);
      if (!kind || !el) continue;
      const r = el.getBoundingClientRect();
      const width = (r.width / box.width) * 100 * 0.94; // its unrotated width, about
      const h = width * 0.75 * (STICKER_ASPECT[kind] || 1);
      const cx = ((r.left + r.width / 2 - box.left) / box.width) * 100;
      const cy = ((r.top + r.height / 2 - box.top) / box.height) * 100;
      draft.items.push({ id: uid('ci'), type: 'sticker', kind, width, x: cx - width / 2, y: cy - h / 2, rotation: deg, z: ++z });
    }
    draft = { ...draft, tape: 'none', doodle: 'none', tapePos: null, doodlePos: null };
    startJson = JSON.stringify(draft); // this isn't a change you made, so Back won't ask about it
    render();
  }
}
