// The scrapbook editor, the scrapbook grid and the finished page view.

const PAGE_W = 800;
const PAGE_H = 600;
const MAX_PHOTOS = 6;
const PHOTO_EDGE = 1000;
const PHOTO_SLOTS = [[40, 40], [295, 30], [550, 50], [60, 300], [305, 305], [550, 290]];

const TEXT_SIZE = 34;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const EMPTY_TEXT = 'Type your text';
const textLabel = (t) => `Text box: ${t.text || 'empty'}. Press Delete to remove`;

const editor = { id: null, dirty: false, draft: null, selected: null, scale: 1, z: 20, suppressClick: false };
const bookView = { active: false, spread: 0, leaves: 0, pages: [] };
let fitObserver = null;

function stopFit() {
  if (fitObserver) fitObserver.disconnect();
  fitObserver = null;
  bookView.active = false;
}

// Shrinks the fixed-size page to fit smaller windows. Saved positions stay in page pixels.
function fitPage(stage, wrap, page) {
  const apply = () => {
    const style = getComputedStyle(stage);
    const width = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const useHeight = stage.dataset.fit === 'both' && window.innerWidth > 820;
    const scale = Math.max(0.3, Math.min(1, width / PAGE_W, useHeight ? height / PAGE_H : 1));
    page.style.transform = `scale(${scale})`;
    wrap.style.width = `${PAGE_W * scale}px`;
    wrap.style.height = `${PAGE_H * scale}px`;
    editor.scale = scale;
  };
  apply();
  fitObserver = new ResizeObserver(apply);
  fitObserver.observe(stage);
}

function itemStyle(item) {
  return `left:${item.x}px;top:${item.y}px;z-index:${item.z || 1};--rot:${item.rot || 0}deg`;
}

function pageItemsHtml(page, title, live) {
  const open = (kind, id, label, style, cls) => (live
    ? `<button type="button" class="item ${cls}" data-kind="${kind}" data-id="${esc(id)}" aria-label="${esc(label)}. Arrow keys move it." style="${style}">`
    : `<div class="item ${cls}" style="${style}">`);
  const close = live ? '</button>' : '</div>';

  const rotateHandle = live ? `<span class="handle rotate" data-handle="rotate" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.5-5.8M20 3v5h-5"/></svg></span>` : '';
  const resizeHandle = live ? '<span class="handle resize" data-handle="resize" aria-hidden="true"></span>' : '';

  const photos = page.photos.map((p, i) => `
    ${open('photo', p.id, `Photo ${i + 1}, press Delete to remove`, itemStyle(p), 'polaroid')}
      <img src="${esc(p.src)}" alt="${live ? '' : `Photo ${i + 1} from ${esc(title)}`}" draggable="false">
      ${rotateHandle}
    ${close}`).join('');

  const stickers = page.stickers.map((s) => {
    const def = STICKERS[s.type];
    const scale = s.scale || 1;
    const style = `${itemStyle(s)};width:${def.w * scale}px;height:${def.h * scale}px${s.color ? `;--sticker:${esc(s.color)}` : ''}`;
    return `${open('sticker', s.id, `${def.label} sticker, press Delete to remove`, style, 'sticker')}${def.svg}${rotateHandle}${resizeHandle}${close}`;
  }).join('');

  const texts = page.texts.filter((t) => live || t.text).map((t) => {
    const style = `${itemStyle(t)};--fs:${TEXT_SIZE * (t.scale || 1)}px`;
    return `${open('text', t.id, textLabel(t), style, `textbox ${t.text ? '' : 'is-empty'}`)}<span class="text-body">${esc(t.text || EMPTY_TEXT)}</span>${rotateHandle}${resizeHandle}${close}`;
  }).join('');

  return photos + stickers + texts;
}

// Editor

function emptyPage() {
  return { photos: [], stickers: [], texts: [] };
}

function renderEditor(activity) {
  editor.id = activity.id;
  editor.dirty = false;
  editor.selected = null;
  editor.draft = activity.page ? JSON.parse(JSON.stringify(activity.page)) : emptyPage();
  document.title = `${activity.title} | Bucket List`;
  const back = activity.done ? `#/page/${activity.id}` : '#/list';

  main.innerHTML = `
    <div class="editor">
      <header class="editor-bar">
        <a class="btn" href="${back}">Back</a>
        <h2>${esc(activity.title)}</h2>
        <button type="button" class="btn primary" id="save-page">Save to scrapbook</button>
      </header>
      <div class="editor-work">
        <div class="stage" id="stage" data-fit="both">
          <div class="page-wrap" id="wrap"><div class="page" id="page" tabindex="-1"></div></div>
        </div>
        <section class="tools" id="tools" aria-label="Page tools">
          <div class="selected-tools" id="selected-tools" hidden></div>
          <div>
            <h3>Photos <span class="muted" id="photo-count"></span></h3>
            <div class="dropzone" id="dropzone">
              <p>Drag photos here</p>
              <button type="button" class="btn" id="browse">Browse</button>
              <input type="file" id="file-input" class="visually-hidden" accept="image/*" multiple tabindex="-1" aria-label="Choose photos">
            </div>
          </div>
          <div>
            <h3>Text</h3>
            <button type="button" class="btn" id="add-text">+ Add text box</button>
          </div>
          <div>
            <h3>Stickers</h3>
            <div class="tray">
              ${Object.entries(STICKERS).map(([type, def]) => `<button type="button" class="tray-btn" data-sticker="${type}" aria-label="Add ${def.label} sticker">${def.svg}</button>`).join('')}
            </div>
            <p class="hint">Drag a sticker onto the page or click to drop it in the middle. Click anything on the page to move, rotate, or resize it.</p>
          </div>
        </section>
      </div>
    </div>`;

  const page = document.getElementById('page');
  fitPage(document.getElementById('stage'), document.getElementById('wrap'), page);
  renderEditorItems();
  bindEditor(page, activity);
}

function renderEditorItems() {
  document.getElementById('page').innerHTML = pageItemsHtml(editor.draft, '', true);
  document.getElementById('photo-count').textContent = `${editor.draft.photos.length} of ${MAX_PHOTOS}`;
  if (editor.selected) markSelected(editor.selected.kind, editor.selected.id);
  renderSelectedTools();
}

function renderSelectedTools() {
  const box = document.getElementById('selected-tools');
  if (!box) return;
  box.hidden = !editor.selected;
  if (!editor.selected) {
    box.innerHTML = '';
    return;
  }
  const { kind, id } = editor.selected;
  const data = dataFor(kind, id);
  const title = { photo: 'Photo', sticker: 'Sticker', text: 'Text box' }[kind];
  const current = kind === 'sticker' ? data.color : null;
  box.innerHTML = `
    <h3>Selected: ${title}</h3>
    ${kind === 'text' ? `
      <div class="field">
        <label for="sel-text">Text</label>
        <textarea id="sel-text" class="text-input" rows="2" maxlength="120" placeholder="What happened?">${esc(data.text)}</textarea>
      </div>` : ''}
    <div class="field">
      <label for="sel-rotate">Rotate</label>
      <input type="range" id="sel-rotate" min="-180" max="180" step="1" value="${data.rot || 0}">
    </div>
    ${kind === 'photo' ? '' : `
      <div class="field">
        <label for="sel-size">Size</label>
        <input type="range" id="sel-size" min="${MIN_SCALE * 100}" max="${MAX_SCALE * 100}" step="5" value="${Math.round((data.scale || 1) * 100)}">
      </div>`}
    ${kind === 'sticker' ? `
      <fieldset>
        <legend>Color</legend>
        <div class="swatches">
          ${Object.entries(STICKER_COLORS).map(([name, hex]) => `<button type="button" class="swatch" data-color="${hex}" style="background:${hex}" aria-label="${name}" aria-pressed="${current === hex}"></button>`).join('')}
        </div>
      </fieldset>` : ''}
    <button type="button" class="btn" id="sel-remove">Remove</button>`;
}

function setRotation(el, data, rot) {
  data.rot = Math.round(((rot + 540) % 360) - 180);
  el.style.setProperty('--rot', `${data.rot}deg`);
  editor.dirty = true;
  const slider = document.getElementById('sel-rotate');
  if (slider) slider.value = data.rot;
}

// Resizing keeps the item's center in place.
function setScale(el, data, scale) {
  const centerX = data.x + el.offsetWidth / 2;
  const centerY = data.y + el.offsetHeight / 2;
  data.scale = Math.round(Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale)) * 100) / 100;
  if (el.dataset.kind === 'sticker') {
    const def = STICKERS[data.type];
    el.style.width = `${def.w * data.scale}px`;
    el.style.height = `${def.h * data.scale}px`;
  } else {
    el.style.setProperty('--fs', `${TEXT_SIZE * data.scale}px`);
  }
  moveItem(el, centerX - el.offsetWidth / 2, centerY - el.offsetHeight / 2);
  const slider = document.getElementById('sel-size');
  if (slider) slider.value = Math.round(data.scale * 100);
}

function followPointer(el, event, onMove) {
  el.setPointerCapture(event.pointerId);
  const onEnd = () => {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onEnd);
    el.removeEventListener('pointercancel', onEnd);
  };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onEnd);
  el.addEventListener('pointercancel', onEnd);
}

function startHandleDrag(el, data, type, event) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  if (type === 'rotate') {
    const angle = (e) => (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
    const startAngle = angle(event);
    const startRot = data.rot || 0;
    followPointer(el, event, (move) => setRotation(el, data, startRot + angle(move) - startAngle));
  } else {
    const distance = (e) => Math.hypot(e.clientX - cx, e.clientY - cy);
    const startDistance = distance(event);
    const startScale = data.scale || 1;
    followPointer(el, event, (move) => setScale(el, data, (startScale * distance(move)) / startDistance));
  }
}

function itemEl(kind, id) {
  return document.querySelector(`.item[data-kind="${kind}"][data-id="${CSS.escape(id)}"]`);
}

function dataFor(kind, id) {
  return editor.draft[{ photo: 'photos', sticker: 'stickers', text: 'texts' }[kind]].find((item) => item.id === id);
}

function markSelected(kind, id) {
  document.querySelectorAll('.item.selected').forEach((el) => el.classList.remove('selected'));
  const el = itemEl(kind, id);
  if (el) el.classList.add('selected');
}

function selectItem(el) {
  const { kind, id } = el.dataset;
  const already = editor.selected && editor.selected.kind === kind && editor.selected.id === id;
  editor.selected = { kind, id };
  markSelected(kind, id);
  if (already) return;
  editor.z += 1;
  el.style.zIndex = editor.z;
  dataFor(kind, id).z = editor.z;
  renderSelectedTools();
}

function deselect() {
  editor.selected = null;
  document.querySelectorAll('.item.selected').forEach((el) => el.classList.remove('selected'));
  renderSelectedTools();
}

function moveItem(el, x, y) {
  const data = dataFor(el.dataset.kind, el.dataset.id);
  data.x = Math.round(Math.max(0, Math.min(PAGE_W - el.offsetWidth, x)));
  data.y = Math.round(Math.max(0, Math.min(PAGE_H - el.offsetHeight, y)));
  el.style.left = `${data.x}px`;
  el.style.top = `${data.y}px`;
  editor.dirty = true;
}

function removeSelected() {
  const { kind, id } = editor.selected;
  const list = { photo: 'photos', sticker: 'stickers', text: 'texts' }[kind];
  editor.draft[list] = editor.draft[list].filter((item) => item.id !== id);
  editor.selected = null;
  editor.dirty = true;
  renderEditorItems();
  document.getElementById('page').focus({ preventScroll: true });
}

function addSticker(type, x, y) {
  const def = STICKERS[type];
  const sticker = {
    id: uid(), type, rot: Math.round(Math.random() * 24 - 12), z: ++editor.z,
    x: Math.round(Math.max(0, Math.min(PAGE_W - def.w, x))),
    y: Math.round(Math.max(0, Math.min(PAGE_H - def.h, y))),
  };
  editor.draft.stickers.push(sticker);
  editor.dirty = true;
  editor.selected = { kind: 'sticker', id: sticker.id };
  renderEditorItems();
  itemEl('sticker', sticker.id).focus({ preventScroll: true });
}

function addText() {
  const count = editor.draft.texts.length;
  const text = { id: uid(), text: '', x: 280 + (count % 4) * 24, y: 250 + (count % 4) * 44, rot: 0, z: ++editor.z };
  editor.draft.texts.push(text);
  editor.dirty = true;
  editor.selected = { kind: 'text', id: text.id };
  renderEditorItems();
  document.getElementById('sel-text').focus();
}

function nextPhotoSpot() {
  const isFree = ([x, y]) => !editor.draft.photos.some((p) => Math.abs(p.x - x) < 90 && Math.abs(p.y - y) < 90);
  return PHOTO_SLOTS.find(isFree) || [Math.round(Math.random() * 500), Math.round(Math.random() * 300)];
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      if (!image.naturalWidth) return reject(new Error('No image size'));
      const ratio = Math.min(1, PHOTO_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.naturalWidth * ratio);
      canvas.height = Math.round(image.naturalHeight * ratio);
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unreadable image'));
    };
    image.src = url;
  });
}

async function addPhotos(fileList) {
  const draft = editor.draft;
  const images = [...fileList].filter((file) => file.type.startsWith('image/'));
  if (!images.length) return toast('Those files are not images.');
  const room = MAX_PHOTOS - draft.photos.length;
  if (room <= 0) return toast(`A page holds ${MAX_PHOTOS} photos. Remove one to add another.`);
  if (images.length > room) toast(`A page holds ${MAX_PHOTOS} photos, so only the first ${room} were added.`);

  for (const file of images.slice(0, room)) {
    try {
      const src = await compressImage(file);
      if (editor.draft !== draft || draft.photos.length >= MAX_PHOTOS) return;
      const [x, y] = nextPhotoSpot();
      draft.photos.push({ id: uid(), src, x, y, rot: Math.round(Math.random() * 12 - 6), z: ++editor.z });
      editor.dirty = true;
      renderEditorItems();
    } catch {
      toast(`Couldn't read ${file.name}.`);
    }
  }
}

function bindEditor(page, activity) {
  page.addEventListener('pointerdown', (event) => {
    const el = event.target.closest('.item');
    if (!el) {
      deselect();
      return;
    }
    selectItem(el);
    el.focus({ preventScroll: true });
    const data = dataFor(el.dataset.kind, el.dataset.id);
    const handle = event.target.closest('[data-handle]');
    if (handle) {
      startHandleDrag(el, data, handle.dataset.handle, event);
      return;
    }
    const start = { px: event.clientX, py: event.clientY, x: data.x, y: data.y };
    followPointer(el, event, (move) => {
      moveItem(el, start.x + (move.clientX - start.px) / editor.scale, start.y + (move.clientY - start.py) / editor.scale);
    });
  });

  document.getElementById('stage').addEventListener('pointerdown', (event) => {
    if (!event.target.closest('#page')) deselect();
  });

  page.addEventListener('focusin', (event) => {
    const el = event.target.closest('.item');
    if (el) selectItem(el);
  });
  page.addEventListener('focusout', (event) => {
    const next = event.relatedTarget;
    if (next && !page.contains(next) && !document.getElementById('tools').contains(next)) deselect();
  });

  page.addEventListener('keydown', (event) => {
    if (!editor.selected) return;
    const el = itemEl(editor.selected.kind, editor.selected.id);
    const data = dataFor(editor.selected.kind, editor.selected.id);
    const nudges = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      removeSelected();
    } else if (event.key === 'Escape') {
      deselect();
      page.focus({ preventScroll: true });
    } else if (nudges[event.key]) {
      event.preventDefault();
      moveItem(el, data.x + nudges[event.key][0], data.y + nudges[event.key][1]);
    }
  });

  const input = document.getElementById('file-input');
  document.getElementById('browse').addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    addPhotos(input.files);
    input.value = '';
  });

  document.getElementById('add-text').addEventListener('click', addText);

  const selectedTools = document.getElementById('selected-tools');
  selectedTools.addEventListener('input', (event) => {
    const { kind, id } = editor.selected;
    const el = itemEl(kind, id);
    const data = dataFor(kind, id);
    if (event.target.id === 'sel-rotate') setRotation(el, data, Number(event.target.value));
    if (event.target.id === 'sel-size') setScale(el, data, Number(event.target.value) / 100);
    if (event.target.id === 'sel-text') {
      data.text = event.target.value;
      el.querySelector('.text-body').textContent = data.text || EMPTY_TEXT;
      el.classList.toggle('is-empty', !data.text);
      el.setAttribute('aria-label', textLabel(data));
      moveItem(el, data.x, data.y);
    }
  });
  selectedTools.addEventListener('click', (event) => {
    if (event.target.id === 'sel-remove') {
      removeSelected();
      return;
    }
    const swatch = event.target.closest('.swatch');
    if (!swatch) return;
    const { kind, id } = editor.selected;
    dataFor(kind, id).color = swatch.dataset.color;
    itemEl(kind, id).style.setProperty('--sticker', swatch.dataset.color);
    selectedTools.querySelectorAll('.swatch').forEach((b) => b.setAttribute('aria-pressed', b === swatch));
    editor.dirty = true;
  });

  document.querySelectorAll('.tray-btn').forEach((button) => {
    button.addEventListener('pointerdown', startTrayDrag);
    button.addEventListener('click', () => {
      if (editor.suppressClick) return;
      const def = STICKERS[button.dataset.sticker];
      addSticker(button.dataset.sticker, (PAGE_W - def.w) / 2, (PAGE_H - def.h) / 2);
    });
  });

  document.getElementById('save-page').addEventListener('click', () => savePage(activity));
}

function startTrayDrag(event) {
  const type = event.currentTarget.dataset.sticker;
  const def = STICKERS[type];
  const start = { x: event.clientX, y: event.clientY };
  let ghost = null;
  editor.suppressClick = false;

  const onMove = (move) => {
    if (!ghost && Math.hypot(move.clientX - start.x, move.clientY - start.y) > 5) {
      ghost = document.createElement('div');
      ghost.className = 'sticker-ghost';
      ghost.innerHTML = def.svg;
      ghost.style.width = `${def.w * editor.scale}px`;
      ghost.style.height = `${def.h * editor.scale}px`;
      document.body.append(ghost);
      editor.suppressClick = true;
    }
    if (ghost) {
      ghost.style.left = `${move.clientX - (def.w * editor.scale) / 2}px`;
      ghost.style.top = `${move.clientY - (def.h * editor.scale) / 2}px`;
    }
  };
  const onEnd = (end) => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onEnd);
    document.removeEventListener('pointercancel', onEnd);
    if (!ghost) return;
    setTimeout(() => { editor.suppressClick = false; }, 0);
    ghost.remove();
    const rect = document.getElementById('page').getBoundingClientRect();
    const inside = end.type === 'pointerup' && end.clientX >= rect.left && end.clientX <= rect.right && end.clientY >= rect.top && end.clientY <= rect.bottom;
    if (inside) addSticker(type, (end.clientX - rect.left) / editor.scale - def.w / 2, (end.clientY - rect.top) / editor.scale - def.h / 2);
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onEnd);
  document.addEventListener('pointercancel', onEnd);
}

function savePage(activity) {
  const before = { page: activity.page, done: activity.done, doneAt: activity.doneAt };
  activity.page = { ...editor.draft, createdBy: editor.draft.createdBy || ME };
  activity.done = true;
  activity.doneAt = activity.doneAt || new Date().toISOString();
  if (!save()) {
    Object.assign(activity, before);
    toast("Couldn't save. This browser's storage is full, so try removing a photo.");
    return;
  }
  editor.dirty = false;
  location.hash = `#/page/${activity.id}`;
  toast('Saved to the scrapbook');
}

// Lets a dropped file land anywhere in the editor instead of opening in the browser.
const dragHasFiles = (event) => event.dataTransfer && [...event.dataTransfer.types].includes('Files');
const setDropHighlight = (on) => {
  const zone = document.getElementById('dropzone');
  if (zone) zone.classList.toggle('over', on);
};
document.addEventListener('dragover', (event) => {
  if (!editor.id || !dragHasFiles(event)) return;
  event.preventDefault();
  setDropHighlight(true);
});
document.addEventListener('dragleave', (event) => {
  if (editor.id && !event.relatedTarget) setDropHighlight(false);
});
document.addEventListener('drop', (event) => {
  if (!editor.id || !dragHasFiles(event)) return;
  event.preventDefault();
  setDropHighlight(false);
  addPhotos(event.dataTransfer.files);
});

// Scrapbook grid

function finishedPages() {
  return currentGroup().activities.filter((a) => a.done && a.page).sort((a, b) => b.doneAt.localeCompare(a.doneAt));
}

const madeBy = (activity) => nameOf(activity.page.createdBy || activity.addedBy);

function scrapbookHead(view) {
  return `
    <header class="page-head scrap-head">
      <div>
        <h2 class="view-title">Scrapbook</h2>
        <p class="muted">Everything we actually did.</p>
      </div>
      <nav class="view-switch" aria-label="Scrapbook view">
        <a href="#/scrapbook" ${view === 'grid' ? 'aria-current="page"' : ''}>All pages</a>
        <a href="#/book" ${view === 'book' ? 'aria-current="page"' : ''}>Flip through</a>
      </nav>
    </header>`;
}

function renderScrapbook() {
  document.title = 'Scrapbook | Bucket List';
  const pages = finishedPages();
  const tilts = [-2, 1.5, -1, 2, -1.5, 1];
  const thumbs = pages.map((a, i) => {
    const cover = a.page.photos[0];
    return `
      <a class="thumb" href="#/page/${esc(a.id)}" style="--tilt:${tilts[i % tilts.length]}deg">
        ${cover ? `<img src="${esc(cover.src)}" alt="">` : '<span class="thumb-blank">No photos yet</span>'}
        <span class="thumb-title">${esc(a.title)}</span>
        <span class="thumb-date">${esc(formatDate(a.doneAt))} · Made by ${esc(madeBy(a))}</span>
      </a>`;
  }).join('');

  main.innerHTML = `
    <div class="container">
      ${scrapbookHead('grid')}
      ${pages.length
        ? `<div class="masonry">${thumbs}</div>`
        : '<div class="empty"><p>No pages yet. Finish something on the list and make the first one.</p><a class="btn" href="#/list">Go to the bucket list</a></div>'}
    </div>`;
}

// Finished page

function renderPageView(activity) {
  document.title = `${activity.title} | Bucket List`;
  const meta = [formatDate(activity.doneAt), activity.location].filter(Boolean).join(' · ');
  main.innerHTML = `
    <div class="container narrow">
      <a class="back-link" href="#/scrapbook">Back to scrapbook</a>
      <header class="finished-head">
        <div>
          <h2 class="view-title">${esc(activity.title)}</h2>
          <p class="muted">${esc(meta)}</p>
          <p class="muted">Page made by ${esc(madeBy(activity))}</p>
        </div>
        <a class="btn" href="#/editor/${esc(activity.id)}">Edit page</a>
      </header>
      <div class="finished-stage" id="stage">
        <div class="page-wrap" id="wrap"><div class="page" id="page">${pageItemsHtml(activity.page, activity.title, false)}</div></div>
      </div>
      <section class="who">
        <h3>Who was there</h3>
        ${activity.inIds.length
          ? `<ul class="who-list">${activity.inIds.map((id) => `<li>${avatar(id)}<span>${esc(nameOf(id))}</span></li>`).join('')}</ul>`
          : '<p class="muted">Nobody marked themselves in.</p>'}
      </section>
    </div>`;
  fitPage(document.getElementById('stage'), document.getElementById('wrap'), document.getElementById('page'));
}

// Flip-through book. Each leaf has a front and a back, so each finished
// activity gets a two-page spread: its story on the left, its page on the right.

function bookInfoHtml(activity) {
  const place = [formatDate(activity.doneAt), activity.location].filter(Boolean).join(' · ');
  return `
    <div class="book-info">
      <h3>${esc(activity.title)}</h3>
      <p class="muted">${esc(place)}</p>
      ${activity.notes ? `<p class="book-note">${esc(activity.notes)}</p>` : ''}
      <div class="book-who">
        <p class="muted">Who was there</p>
        <ul class="who-list">${activity.inIds.map((id) => `<li>${avatar(id)}<span>${esc(nameOf(id))}</span></li>`).join('')}</ul>
      </div>
      <p class="muted book-made">Page made by ${esc(madeBy(activity))}</p>
    </div>`;
}

function bookFrontHtml(index) {
  if (index === 0) {
    return `
      <div class="book-cover">
        <div class="cover-star">${STICKERS.star.svg}</div>
        <p>Our scrapbook</p>
        <h3>${esc(currentGroup().name)}</h3>
        <div class="cover-heart">${STICKERS.heart.svg}</div>
      </div>`;
  }
  const activity = bookView.pages[index - 1];
  return `<div class="page">${pageItemsHtml(activity.page, activity.title, false)}</div>`;
}

function bookBackHtml(index) {
  if (index < bookView.pages.length) return bookInfoHtml(bookView.pages[index]);
  return '<div class="book-end"><p>To be continued...</p></div>';
}

function renderBook() {
  document.title = 'Flip through | Bucket List';
  bookView.pages = finishedPages().reverse();
  bookView.leaves = bookView.pages.length + 1;
  bookView.spread = 0;

  if (!bookView.pages.length) {
    main.innerHTML = `
      <div class="container">
        ${scrapbookHead('book')}
        <div class="empty"><p>No pages to flip through yet. Finish something on the list and make the first one.</p><a class="btn" href="#/list">Go to the bucket list</a></div>
      </div>`;
    return;
  }

  const leaves = Array.from({ length: bookView.leaves }, (_, i) => `
    <div class="leaf" data-leaf="${i}">
      <div class="face front">${bookFrontHtml(i)}</div>
      <div class="face back">${bookBackHtml(i)}</div>
    </div>`).join('');

  main.innerHTML = `
    <div class="container">
      ${scrapbookHead('book')}
      <div class="book-stage" id="book-stage"><div class="book" id="book">${leaves}</div></div>
      <div class="book-controls">
        <button type="button" class="btn" id="book-prev">Previous page</button>
        <p id="book-status" role="status"></p>
        <button type="button" class="btn primary" id="book-next">Next page</button>
      </div>
    </div>`;

  const stage = document.getElementById('book-stage');
  const book = document.getElementById('book');
  const fit = () => {
    const width = Math.floor(Math.min(600, stage.clientWidth / 2, ((window.innerHeight - 280) * 4) / 3));
    const pageWidth = Math.max(150, width);
    book.style.setProperty('--w', `${pageWidth}px`);
    book.style.setProperty('--h', `${pageWidth * 0.75}px`);
    book.style.setProperty('--s', pageWidth / PAGE_W);
  };
  fit();
  fitObserver = new ResizeObserver(fit);
  fitObserver.observe(stage);

  document.getElementById('book-prev').addEventListener('click', () => flipTo(bookView.spread - 1));
  document.getElementById('book-next').addEventListener('click', () => flipTo(bookView.spread + 1));
  book.addEventListener('click', (event) => {
    const leaf = event.target.closest('.leaf');
    if (leaf) flipTo(bookView.spread + (leaf.classList.contains('flipped') ? -1 : 1));
  });
  bookView.active = true;
  layoutBook(null);
}

function layoutBook(turning) {
  const { spread, leaves, pages } = bookView;
  const book = document.getElementById('book');
  book.dataset.position = spread === 0 ? 'closed' : spread === leaves ? 'end' : 'open';

  book.querySelectorAll('.leaf').forEach((leaf, i) => {
    const flipped = i < spread;
    leaf.classList.toggle('flipped', flipped);
    leaf.style.zIndex = i === turning ? leaves + 2 : flipped ? i + 1 : leaves - i;
    leaf.querySelector('.front').setAttribute('aria-hidden', i !== spread);
    leaf.querySelector('.back').setAttribute('aria-hidden', i !== spread - 1);
  });

  let status = 'Cover';
  if (spread === leaves) status = 'The end';
  else if (spread > 0) status = `${pages[spread - 1].title} (${spread} of ${pages.length})`;
  document.getElementById('book-status').textContent = status;
  document.getElementById('book-prev').setAttribute('aria-disabled', spread === 0);
  document.getElementById('book-next').setAttribute('aria-disabled', spread === leaves);
}

function flipTo(spread) {
  if (spread < 0 || spread > bookView.leaves || spread === bookView.spread) return;
  const turning = Math.min(spread, bookView.spread);
  bookView.spread = spread;
  layoutBook(turning);
  setTimeout(() => {
    if (bookView.active && bookView.spread === spread) layoutBook(null);
  }, 800);
}

document.addEventListener('keydown', (event) => {
  if (!bookView.active || document.querySelector('dialog[open]')) return;
  if (event.target.matches('select, input, textarea')) return;
  if (event.key === 'ArrowRight') flipTo(bookView.spread + 1);
  if (event.key === 'ArrowLeft') flipTo(bookView.spread - 1);
});
