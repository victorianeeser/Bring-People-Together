// Open book view: the current spread, page-edge stacks, page turns, and the spread overview.

import { getBook, commit, subscribe, addSpread, isMine } from './state.js';
import { openJoinBooks } from './join.js';
import { spreadsOf, spreadPagesHtml, ppLabel, spreadTitle, spreadBg, hydratePhotos, textFontSize } from './pages.js';
import { PAGE_BACKGROUNDS } from './model.js';
import { storeMedia, addToRoll, rollOf, tileHtml, MAX_VIDEO_MB } from './media.js';
const ROLL_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="M8.5 6l1.5-2.5h4L15.5 6"/><circle cx="12" cy="12.5" r="3.4"/></svg>';
import { setBucketBackground } from './state.js';
import { ANIMATION, isAnimating, reducedMotion } from './animation.js';
import { ICONS, esc, announce, isTyping, dialogOpen, toast, inkFor, brandColor } from './ui.js';
import { createIdeaPopover, openAddIdea } from './toc.js';
import { panelHtml, createEditor } from './editor.js';
import { ME, ME_NAME, MY_COLOR } from './identity.js';
import { inviteText } from './join.js';
import { setPresence, setCursor, onCursors, onPresence, isSynced } from './sync.js';
import { track, EVENTS } from './analytics.js';

const MAX_EDGES = 8;
const CHEVRON_LEFT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const CHEVRON_RIGHT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';


export function mountBook(root, bookId) {
  const book = getBook(bookId);
  if (book) track(EVENTS.openedBook, { book: bookId === 'book-ixd415' ? 'IxD 415 class book' : 'other book' });
  if (!book) {
    root.innerHTML = `
      <div class="book-view missing">
        <p>This book doesn't exist anymore.</p>
        <a class="pill-btn" href="#/">Back to library</a>
      </div>`;
    return { missing: true, cleanup() {}, spreadRect: () => new DOMRect(), spreadEl: null, index: () => 0, focus() {} };
  }
  // Books are invite only: a link to a book you're not in doesn't open it. You need the book's code.
  if (!isMine(book)) {
    document.title = 'keepsake';
    root.innerHTML = `
      <div class="book-view missing locked">
        <img class="locked-mark" src="./brand/mark.svg" alt="">
        <h1>This book is invite only</h1>
        <p>Ask a friend in the book for its invite code, then join with it.</p>
        <div class="locked-actions">
          <a class="pill-btn" href="#/">Back to library</a>
          <button type="button" class="pill-btn solid" data-action="join-locked">Join with a code</button>
        </div>
      </div>`;
    const onJoin = (event) => {
      if (!event.target.closest('[data-action="join-locked"]')) return;
      openJoinBooks({ onJoined: () => window.dispatchEvent(new HashChangeEvent('hashchange')) });
    };
    root.addEventListener('click', onJoin);
    return { locked: true, cleanup() { root.removeEventListener('click', onJoin); }, spreadRect: () => new DOMRect(), spreadEl: null, index: () => 0, focus() { root.querySelector('[data-action="join-locked"]')?.focus(); } };
  }
  document.title = book.title;
  let index = 0; // a book always opens to its first spread (the bucket list, when it has one)
  let turning = false;

  root.innerHTML = `
    <div class="book-view">
      <header class="topbar book-top">
        <button type="button" class="icon-btn glass" data-action="back" aria-label="Back to library">${ICONS.back}</button>
        <div class="book-heading">
          <h1>${esc(book.title)}</h1>
          <p id="page-label" aria-live="polite"></p>
          <div class="book-actions">
            <button type="button" class="pill-btn edit-pill" data-action="toggle-edit" aria-pressed="false">Edit</button>
            <button type="button" class="pill-btn add-pages" data-action="add-spread">${ICONS.plus}Add pages</button>
          </div>
        </div>
        <div class="book-top-right">
          <div class="book-here" aria-label="Who's in this book now"></div>
          <button type="button" class="icon-btn glass" data-action="camera-roll" aria-label="Camera roll: every photo and video in this book" title="Camera roll" aria-haspopup="dialog">${ROLL_ICON}</button>
          <button type="button" class="icon-btn glass" data-action="overview" aria-label="See all spreads" aria-haspopup="dialog">${ICONS.grid}</button>
        </div>
      </header>
      <main class="book-stage">
        <div class="spread-area">
          <button type="button" class="edges left" data-action="prev" aria-label="Previous spread"></button>
          <button type="button" class="edges right" data-action="next" aria-label="Next spread"></button>
          <div class="spread" id="spread" tabindex="-1">
            <div class="page left"><div class="page-inner" id="page-left"></div></div>
            <div class="page right"><div class="page-inner" id="page-right"></div></div>
          </div>
          <div class="live-layer" aria-hidden="true"></div>
          <div class="by-layer"><span class="by-tag" aria-hidden="true" hidden></span><button type="button" class="sel-x" hidden aria-label="Remove">×</button></div>
        </div>
        <div class="turn-controls">
          <button type="button" class="icon-btn glass small" data-action="prev" aria-label="Previous spread">${CHEVRON_LEFT}</button>
          <button type="button" class="icon-btn glass small" data-action="next" aria-label="Next spread">${CHEVRON_RIGHT}</button>
        </div>
      </main>
      ${panelHtml()}
      <dialog class="overview" id="overview" aria-labelledby="overview-title"></dialog>
      <dialog class="overview roll-dialog" id="roll" aria-labelledby="roll-title"></dialog>
    </div>`;

  const spreadEl = root.querySelector('#spread');
  const leftEl = root.querySelector('#page-left');
  const rightEl = root.querySelector('#page-right');
  const overview = root.querySelector('#overview');
  const total = () => spreadsOf(book).length;
  const currentSpread = () => {
    const entry = spreadsOf(book)[index];
    return entry?.kind === 'spread' ? entry.spread : null;
  };
  let editor = null;
  let liveReady = false; // the live cursor code below is set up after the first draw
  let editMode = false; // the Edit / Done pill turns editing on and off
  let tocSeason = null; // season tab on the bucket list page (null = All)

  function edgesHtml(count) {
    return Array.from({ length: count }, (_, i) => `<span class="edge" style="--k:${i + 1}"></span>`).join('');
  }

  function updateChrome() {
    const before = Math.min(MAX_EDGES, index);
    const after = Math.min(MAX_EDGES, total() - 1 - index);
    root.querySelector('.edges.left').innerHTML = edgesHtml(before);
    root.querySelector('.edges.right').innerHTML = edgesHtml(after);
    root.querySelectorAll('[data-action="prev"]').forEach((b) => { b.disabled = index === 0; });
    root.querySelectorAll('[data-action="next"]').forEach((b) => { b.disabled = index >= total() - 1; });
    root.querySelector('#page-label').textContent = ppLabel(index);
    const pill = root.querySelector('.edit-pill');
    const canEdit = Boolean(currentSpread());
    pill.classList.toggle('is-off', !canEdit); // the row keeps its height thanks to Add pages
    pill.textContent = editMode ? 'Done' : 'Edit';
    pill.setAttribute('aria-pressed', editMode);
    pill.setAttribute('aria-label', editMode ? 'Done editing' : 'Edit this spread');
    spreadEl.classList.toggle('is-editing', editMode && Boolean(currentSpread()));
    spreadEl.setAttribute('aria-label', `${spreadTitle(book, index)}, ${ppLabel(index)}`);
  }

  let shownEntry = null; // the spread on screen, to find it again after a live update
  function showSpread() {
    shownEntry = spreadsOf(book)[index] || null;
    const pages = spreadPagesHtml(book, index, { interactive: true, season: tocSeason });
    spreadEl.dataset.bg = spreadBg(book, index);
    leftEl.innerHTML = pages.left;
    rightEl.innerHTML = pages.right;
    hydratePhotos(spreadEl);
    updateChrome();
    editor?.refresh();
    if (liveReady) { sharePlace(); paintLive(); paintHere(); }
  }

  function pageFace(html, side) {
    return `<div class="leaf-face ${side} page"><div class="page-inner">${html}</div><span class="shade" aria-hidden="true"></span></div>`;
  }

  async function turnTo(target) {
    if (turning || isAnimating() || target === index || target < 0 || target >= total()) return;
    turning = true;
    popover?.close({ refocus: false });
    editor?.deselect();
    const from = spreadPagesHtml(book, index);
    const to = spreadPagesHtml(book, target);
    const forward = target > index;

    if (reducedMotion()) {
      await spreadEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ANIMATION.reduced / 2 }).finished;
      index = target;
      showSpread();
      await spreadEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ANIMATION.reduced / 2 }).finished;
    } else {
      // The turning leaf sits over one page. Its front is the page you're leaving,
      // its back is the page it lands on. The page underneath already shows the new spread.
      const leaf = document.createElement('div');
      leaf.className = `turn-leaf ${forward ? 'from-right' : 'from-left'}`;
      leaf.innerHTML = forward ? pageFace(from.right, 'front') + pageFace(to.left, 'back') : pageFace(from.left, 'front') + pageFace(to.right, 'back');
      if (forward) rightEl.innerHTML = to.right;
      else leftEl.innerHTML = to.left;
      spreadEl.append(leaf);
      hydratePhotos(spreadEl);

      const sign = forward ? -1 : 1;
      const duration = ANIMATION.pageTurn;
      const easing = ANIMATION.pageTurnEase;
      const turn = leaf.animate([
        { transform: 'rotateY(0deg) skewY(0deg)' },
        { transform: `rotateY(${sign * 90}deg) skewY(${sign * 3}deg)`, offset: 0.5 },
        { transform: `rotateY(${sign * 180}deg) skewY(0deg)` },
      ], { duration, easing, fill: 'forwards' });
      leaf.querySelectorAll('.shade').forEach((shade) => shade.animate(
        [{ opacity: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], { duration, easing, fill: 'forwards' },
      ));
      await turn.finished;
      index = target;
      showSpread();
      leaf.remove();
    }
    announce(`${spreadTitle(book, index)}, ${ppLabel(index)}`);
    turning = false;
  }

  function jumpTo(target) {
    index = target;
    showSpread();
    if (!reducedMotion()) spreadEl.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
    announce(`${spreadTitle(book, index)}, ${ppLabel(index)}`);
  }

  // Overview: all spreads as thumbnails. Click to jump, drag (or use the arrows) to reorder.
  function renderOverview() {
    const entries = spreadsOf(book);
    const offset = book.hasBucketList ? 1 : 0;
    overview.innerHTML = `
      <div class="overview-head">
        <h2 id="overview-title">All spreads</h2>
        <button type="button" class="icon-btn glass" data-action="close-overview" aria-label="Close">${ICONS.close}</button>
      </div>
      <p class="overview-note">Click a spread to go there. Drag spreads to change their order.</p>
      <ol class="overview-grid">
        ${entries.map((entry, i) => {
          const pages = spreadPagesHtml(book, i);
          const movable = entry.kind === 'spread';
          return `
            <li class="thumb" data-index="${i}" ${movable ? 'draggable="true"' : ''}>
              <button type="button" class="thumb-btn" data-action="jump" data-index="${i}" aria-current="${i === index}">
                <span class="thumb-spread" data-bg="${spreadBg(book, i)}" aria-hidden="true">
                  <span class="page left"><span class="page-inner">${pages.left}</span></span>
                  <span class="page right"><span class="page-inner">${pages.right}</span></span>
                </span>
                <span class="thumb-label"><strong>${ppLabel(i)}</strong> ${esc(spreadTitle(book, i))}</span>
              </button>
              ${hereOnThumb(entry)}
              ${movable ? `
                <span class="thumb-move">
                  <button type="button" class="mini-btn" data-action="move" data-index="${i}" data-dir="-1" aria-label="Move ${esc(spreadTitle(book, i))} earlier" ${i - 1 < offset ? 'disabled' : ''}>${CHEVRON_LEFT}</button>
                  <button type="button" class="mini-btn" data-action="move" data-index="${i}" data-dir="1" aria-label="Move ${esc(spreadTitle(book, i))} later" ${i + 1 >= entries.length ? 'disabled' : ''}>${CHEVRON_RIGHT}</button>
                </span>` : ''}
            </li>`;
        }).join('')}
      </ol>`;
    hydratePhotos(overview);
  }

  // Camera roll (11/18 crit): every photo and video in this book in one place. Upload straight to it,
  // or click one to put it on the page you're on.
  const rollEl = root.querySelector('#roll');
  function renderRoll() {
    const all = rollOf(book);
    const onPage = Boolean(currentSpread());
    rollEl.innerHTML = `
      <div class="overview-head">
        <h2 id="roll-title">Camera roll</h2>
        <button type="button" class="icon-btn glass" data-roll="close" aria-label="Close">${ICONS.close}</button>
      </div>
      <p class="overview-note">${all.length ? `${all.length} photo${all.length === 1 ? '' : 's'} and videos from everyone in this book. ` : ''}${onPage ? 'Click one to add it to this page.' : 'Go to a page (not the bucket list) to add one to it.'}</p>
      <div class="roll-actions">
        <button type="button" class="pill-btn solid" data-roll="upload">Add photos or videos</button>
        <span class="muted">Videos up to ${MAX_VIDEO_MB} MB</span>
        <input type="file" accept="image/*,video/*" multiple hidden data-roll-input>
      </div>
      ${all.length ? `<div class="roll-grid">${all.map((e) => tileHtml(e, `data-roll="pick" aria-label="${e.video ? 'Video' : 'Photo'}${onPage ? ', add to this page' : ''}"`)).join('')}</div>`
        : '<p class="roll-empty">Nothing here yet. Photos and videos anyone adds to this book show up here.</p>'}`;
    hydratePhotos(rollEl);
    rollEl.querySelector('[data-roll-input]').addEventListener('change', async (event) => {
      const files = event.target.files;
      if (!files.length) return;
      toast('Adding to the camera roll…');
      const stored = await storeMedia(files);
      if (!stored.length) return;
      addToRoll(book, stored);
      commit();
      renderRoll();
      toast(`Added ${stored.length} to the camera roll`);
    });
  }
  function openRoll() {
    renderRoll();
    rollEl.showModal();
  }
  rollEl.addEventListener('click', (event) => {
    if (event.target === rollEl) { rollEl.close(); return; }
    const btn = event.target.closest('[data-roll]');
    if (!btn) return;
    if (btn.dataset.roll === 'close') rollEl.close();
    if (btn.dataset.roll === 'upload') rollEl.querySelector('[data-roll-input]').click();
    if (btn.dataset.roll === 'pick') {
      if (!currentSpread()) { toast('Go to a page first, then add it from here'); return; }
      if (!isSynced()) { toast('Still connecting… try again in a second'); return; }
      if (!editMode) setEditMode(true);
      if (editor.addFromRoll(btn.dataset.rollKey)) rollEl.close();
    }
  });

  // Change the bucket list page's background (from the 11/18 crit).
  function pickBucketBackground() {
    const dialog = document.getElementById('confirm');
    if (dialog.open) return;
    const current = spreadBg(book, 0);
    dialog.innerHTML = `
      <div class="confirm-box">
        <h2 id="confirm-title">Bucket list background</h2>
        <p>Pick a paper for the bucket list. Everyone in the book sees it.</p>
        <div class="bg-picker" role="group" aria-label="Backgrounds">
          ${Object.entries(PAGE_BACKGROUNDS).map(([id, label]) => `<button type="button" class="bg-choice" data-bg-choice="${id}" aria-pressed="${id === current}"><span class="bg-swatch" data-bg="${id}"></span>${label}</button>`).join('')}
        </div>
        <div class="confirm-actions"><button type="button" class="pill-btn solid" data-close>Done</button></div>
      </div>`;
    dialog.setAttribute('aria-labelledby', 'confirm-title');
    dialog.onclick = (event) => {
      const choice = event.target.closest('[data-bg-choice]');
      if (choice) {
        setBucketBackground(book.id, choice.dataset.bgChoice);
        dialog.querySelectorAll('[data-bg-choice]').forEach((b) => b.setAttribute('aria-pressed', String(b === choice)));
        showSpread();
      }
      if (event.target.closest('[data-close]')) dialog.close();
    };
    dialog.addEventListener('close', () => { dialog.onclick = null; }, { once: true });
    dialog.showModal();
    dialog.querySelector('[aria-pressed="true"]')?.focus();
  }

  // Who's on which page (multiplayer state 5): faces over each spread in "See all spreads".
  function hereOnThumb(entry) {
    const key = entry.kind === 'spread' ? entry.spread.id : 'contents';
    const on = Object.entries(people).filter(([, p]) => p.book === bookId && p.spread === key);
    if (!on.length) return '';
    const others = on.filter(([id]) => id !== ME);
    const label = !others.length ? "you're here" : on.length === 1 ? `${String(on[0][1].name || 'someone').toLowerCase()} is here` : `${on.length} people`;
    return `<span class="thumb-here" aria-label="${esc(on.map(([, p]) => p.name).join(', '))} on these pages">
      <span class="here-pill${others.length ? ' is-live' : ''}">${label}</span>
      ${on.map(([, p]) => { const c = brandColor(p.color || '#9B9090'); return `<span class="presence-face" style="background:${esc(c)};color:${inkFor(c)}">${esc(String(p.name || '?').trim().charAt(0).toUpperCase())}</span>`; }).join('')}
    </span>`;
  }

  function moveSpread(fromEntry, toEntry) {
    const offset = book.hasBucketList ? 1 : 0;
    const from = fromEntry - offset;
    const to = toEntry - offset;
    if (from < 0 || to < 0 || from >= book.spreads.length || to >= book.spreads.length || from === to) return false;
    const viewing = spreadsOf(book)[index];
    const [moved] = book.spreads.splice(from, 1);
    book.spreads.splice(to, 0, moved);
    commit();
    if (viewing.kind === 'spread') index = spreadsOf(book).findIndex((e) => e.kind === 'spread' && e.spread === viewing.spread);
    showSpread();
    renderOverview();
    announce(`Moved ${moved.title || 'spread'} to ${ppLabel(toEntry)}`);
    return true;
  }

  function openOverview() {
    renderOverview();
    overview.showModal();
    overview.querySelector('.thumb-btn[aria-current="true"]')?.focus();
  }

  let dragFrom = null;
  overview.addEventListener('dragstart', (event) => {
    const li = event.target.closest('.thumb[draggable="true"]');
    if (!li) return;
    dragFrom = Number(li.dataset.index);
    li.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(dragFrom));
  });
  overview.addEventListener('dragover', (event) => {
    const li = event.target.closest('.thumb[draggable="true"]');
    if (dragFrom === null || !li) return;
    event.preventDefault();
    overview.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
    if (Number(li.dataset.index) !== dragFrom) li.classList.add('drop-target');
  });
  overview.addEventListener('drop', (event) => {
    const li = event.target.closest('.thumb[draggable="true"]');
    if (dragFrom === null || !li) return;
    event.preventDefault();
    moveSpread(dragFrom, Number(li.dataset.index));
    dragFrom = null;
  });
  overview.addEventListener('dragend', () => {
    dragFrom = null;
    overview.querySelectorAll('.dragging, .drop-target').forEach((el) => el.classList.remove('dragging', 'drop-target'));
  });

  // Table of contents: idea popover, page links, and the "Add an idea" form.
  const findAnchor = (itemId) => spreadEl.querySelector(`.toc-open[data-id="${CSS.escape(itemId)}"]`);
  const popover = createIdeaPopover(root.querySelector('.book-view'), { book, turnTo, rerender: showSpread, findAnchor });

  function setEditMode(on) {
    // Edits made before the shared books load would be replaced when they arrive, so wait.
    if (on && !isSynced()) { toast('Still connecting… try Edit again in a second'); return; }
    editMode = on;
    if (liveReady) sharePlace();
    if (!on) editor.deselect();
    updateChrome();
    editor.refresh();
    announce(on ? 'Editing. The edit panel is open on the right.' : 'Done editing');
    if (!on) root.querySelector('.edit-pill')?.focus({ preventScroll: true });
  }

  const actions = {
    back: () => window.dispatchEvent(new CustomEvent('book:close', { detail: { id: bookId } })),
    'toggle-edit': () => setEditMode(!editMode),
    'toc-item': (btn) => popover.open(btn.dataset.id, btn),
    'toc-link': (btn) => turnTo(Number(btn.dataset.index)),
    'toc-season': (btn) => {
      tocSeason = btn.dataset.season || null;
      showSpread();
      spreadEl.querySelector(`.season-tab[data-season="${btn.dataset.season}"]`)?.focus({ preventScroll: true });
      announce(tocSeason ? `Showing ${tocSeason} ideas` : 'Showing all ideas');
    },
    'back-to-contents': () => turnTo(0),
    'add-idea': () => openAddIdea(book, { rerender: showSpread, findAnchor }),
    'toc-background': () => pickBucketBackground(),
    'camera-roll': () => openRoll(),
    prev: () => turnTo(index - 1),
    next: () => turnTo(index + 1),
    overview: openOverview,
    'close-overview': () => overview.close(),
    jump: (btn) => {
      overview.close();
      const target = Number(btn.dataset.index);
      if (target !== index) jumpTo(target);
      spreadEl.focus();
    },
    // Two blank pages right after the ones you're on, then straight into editing them.
    'add-spread': async () => {
      const entry = spreadsOf(book)[index];
      const at = entry?.kind === 'spread' ? book.spreads.indexOf(entry.spread) + 1 : 0;
      const spread = addSpread(bookId, at);
      updateChrome();
      const target = spreadsOf(book).findIndex((e) => e.kind === 'spread' && e.spread === spread);
      await turnTo(target);
      if (!editMode) setEditMode(true);
      toast(`Added ${ppLabel(target)}`);
    },
    'copy-invite': async () => {
      const text = `${inviteText(book)}: ${location.origin}${location.pathname}${location.search}`;
      try {
        await navigator.clipboard.writeText(text);
        toast(`Invite to "${book.title}" copied`);
      } catch {
        toast(`Invite code: ${book.code}`);
      }
    },
    'go-to-person': (btn) => {
      const key = btn.dataset.spread;
      const target = key === 'contents' ? 0 : spreadsOf(book).findIndex((e) => e.kind === 'spread' && e.spread.id === key);
      if (target >= 0 && target !== index) turnTo(target);
    },
    move: (btn) => {
      const from = Number(btn.dataset.index);
      const to = from + Number(btn.dataset.dir);
      if (moveSpread(from, to)) overview.querySelector(`[data-action="move"][data-index="${to}"][data-dir="${btn.dataset.dir}"]`)?.focus();
    },
  };

  function onClick(event) {
    if (isAnimating()) return;
    const btn = event.target.closest('[data-action]');
    if (btn && !btn.disabled && actions[btn.dataset.action]) actions[btn.dataset.action](btn);
  }

  function onKeydown(event) {
    if (isAnimating() || dialogOpen()) return;
    if (editor.isEditingText()) return; // typing in a note
    if (popover.isOpen()) {
      if (event.key === 'Escape') { event.preventDefault(); popover.close(); }
      return;
    }
    if (editor.handleKey(event)) return;
    if (isTyping(event.target)) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); turnTo(index + 1); }
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); turnTo(index - 1); }
    if (event.key === 'Escape') { event.preventDefault(); actions.back(); }
  }

  editor = createEditor({
    root, book, spreadEl, currentSpread, rerender: showSpread, isEnabled: () => editMode, onDone: () => setEditMode(false),
    onSelect: (id) => { if (liveReady) { mySel = id; sendCursor(); } },
    onCameraRoll: () => openRoll(),
    // While you drag, resize or rotate something, its position goes out with your cursor.
    onLive: (found) => {
      if (!liveReady) return;
      const it = found?.item;
      myDrag = it ? { id: it.id, side: found.side, x: round(it.x), y: round(it.y), width: round(it.width), rotation: it.rotation || 0, size: it.size ?? null } : null;
      sendCursor();
    },
  });
  root.addEventListener('click', onClick);
  // Double-click any photo or video to edit it, even when Edit is off (it turns Edit on first).
  spreadEl.addEventListener('dblclick', (event) => {
    if (editMode) return; // in Edit mode the editor handles it
    const el = event.target.closest('.page-inner .pi-photo');
    if (!el || !currentSpread()) return;
    setEditMode(true);
    if (editMode) editor.editPhoto(el.dataset.id);
  });
  document.addEventListener('keydown', onKeydown);
  showSpread();

  // Live: someone else changed the book. Redraw, but never in the middle of a page turn,
  // a drag, or while you're typing; those wait until you're done.
  let pressing = false;
  let pendingRemote = false;
  const onDown = () => { pressing = true; };
  const onUp = () => { pressing = false; };
  root.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  function applyRemoteChange() {
    if (turning || isAnimating() || pressing || editor.isEditingText() || overview.open) { pendingRemote = true; return; }
    pendingRemote = false;
    // Stay on the spread you were looking at, even if someone added or moved spreads.
    const viewing = shownEntry;
    const entries = spreadsOf(book);
    const found = viewing?.kind === 'spread' ? entries.findIndex((e) => e.kind === 'spread' && e.spread === viewing.spread) : -1;
    if (found >= 0) index = found;
    index = Math.min(index, Math.max(0, entries.length - 1));
    const sameSpread = found >= 0;
    const before = new Set([...spreadEl.querySelectorAll('.page-inner .pi[data-id]')].map((el) => el.dataset.id));
    showSpread();
    if (sameSpread) markNew(before);
  }

  // Heads up, not a surprise (multiplayer state 6): things someone else just added fade in with a glow,
  // a little "new" tag, and a note saying who added them.
  function markNew(before) {
    const spread = currentSpread();
    if (!spread) return;
    const items = [...spread.leftPage.items, ...spread.rightPage.items];
    const fresh = items.filter((it) => !before.has(it.id) && it.addedBy && it.addedBy !== ME);
    if (!fresh.length) return;
    for (const it of fresh) {
      const el = spreadEl.querySelector(`.page-inner .pi[data-id="${CSS.escape(it.id)}"]`);
      if (!el) continue;
      el.classList.add('is-new');
      el.insertAdjacentHTML('beforeend', '<span class="new-tag" aria-hidden="true">new</span>');
      setTimeout(() => { el.classList.remove('is-new'); el.querySelector('.new-tag')?.remove(); }, 4600);
    }
    const who = book.members.find((m) => m.id === fresh[0].addedBy)?.name || people[fresh[0].addedBy]?.name || 'Someone';
    const kinds = { photo: ['photo', 'photos'], text: ['note', 'notes'], sticker: ['sticker', 'stickers'] };
    const sameType = fresh.every((it) => it.type === fresh[0].type);
    const [one, many] = sameType ? kinds[fresh[0].type] || ['thing', 'things'] : ['thing', 'things'];
    toast(`${who.toLowerCase()} added ${fresh.length === 1 ? `a ${one}` : `${fresh.length} ${many}`} to this page`);
  }
  const unsubscribe = subscribe((info) => { if (info?.remote) applyRemoteChange(); });

  // ---------- live: other people's cursors and selections on this spread ----------
  const liveLayer = root.querySelector('.live-layer');

  // "Who added this" tag (threats.md: nothing is anonymous). It floats above the whole spread so it's never
  // cut off by the page edge or hidden under other photos, and flips above the item near the bottom.
  const byLayer = root.querySelector('.by-layer');
  const byTag = byLayer.querySelector('.by-tag');
  let byHover = null;
  function placeBy(el) {
    if (!el || !el.isConnected || !el.dataset.by) { byTag.hidden = true; return; }
    const area = byLayer.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    byTag.textContent = el.dataset.by;
    const cs = getComputedStyle(el);
    byTag.style.setProperty('--by', cs.getPropertyValue('--by') || '#9B9090');
    byTag.style.setProperty('--by-ink', cs.getPropertyValue('--by-ink') || '#FFFFFF');
    byTag.hidden = false;
    const w = byTag.offsetWidth, h = byTag.offsetHeight;
    let top = r.bottom - area.top + 6;
    if (top + h > area.height - 4) top = r.top - area.top - h - 6; // near the bottom: show it above instead
    const left = Math.min(Math.max(r.left - area.left, 4), area.width - w - 4);
    byTag.style.transform = `translate(${Math.round(left)}px, ${Math.round(Math.max(4, top))}px)`;
  }
  // The × to remove what's selected. It sits on the item's top-left corner, above everything, and is kept
  // inside the book so it's never cut off by the page edge or hidden under tape.
  const selX = byLayer.querySelector('.sel-x');
  function placeX() {
    const sel = editMode ? editor.selection() : null;
    const el = sel && spreadEl.querySelector(`.page-inner .pi[data-id="${CSS.escape(sel.id)}"]`);
    if (!el) { selX.hidden = true; return; }
    const area = byLayer.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    selX.hidden = false;
    selX.classList.toggle('is-locked', !sel.canRemove);
    selX.title = sel.canRemove ? 'Remove' : "Only the person who added it can remove it";
    const size = selX.offsetWidth || 26;
    const left = Math.min(Math.max(r.left - area.left - size / 2, 2), area.width - size - 2);
    const top = Math.min(Math.max(r.top - area.top - size / 2, 2), area.height - size - 2);
    selX.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }
  selX.addEventListener('pointerdown', (event) => event.stopPropagation());
  selX.addEventListener('click', (event) => { event.stopPropagation(); editor.removeSelected(); requestAnimationFrame(placeX); });
  // Show the tag for what you're hovering, or else for what's selected.
  const showBy = () => { placeBy(byHover || spreadEl.querySelector('.page-inner .pi.selected[data-by]')); placeX(); };
  spreadEl.addEventListener('pointerover', (event) => { byHover = event.target.closest('.page-inner .pi[data-by]'); showBy(); });
  spreadEl.addEventListener('pointerleave', () => { byHover = null; showBy(); });
  spreadEl.addEventListener('pointermove', () => { if (byHover || !byTag.hidden) showBy(); });
  spreadEl.addEventListener('focusin', (event) => { const el = event.target.closest('.page-inner .pi[data-by]'); if (el) placeBy(el); });
  new MutationObserver(() => requestAnimationFrame(showBy)).observe(spreadEl, { subtree: true, attributes: true, attributeFilter: ['class', 'style'], childList: true }); // style: follow items while they're dragged
  const hereEl = root.querySelector('.book-here');
  const stage = root.querySelector('.book-stage');
  const spreadKey = () => currentSpread()?.id || 'contents';
  let myPoint = null; // where your pointer is, as fractions of the spread
  let mySel = null;
  let myDrag = null; // what you're dragging right now
  const round = (n) => Math.round(n * 100) / 100;
  let others = {};
  let people = {};

  function sharePlace() {
    setPresence({ book: bookId, spread: spreadKey(), page: ppLabel(index), editing: editMode && Boolean(currentSpread()) });
    sendCursor();
  }

  function sendCursor() {
    if (!myPoint && !mySel && !myDrag) { setCursor(null); return; }
    setCursor({ book: bookId, spread: spreadKey(), x: myPoint?.x ?? null, y: myPoint?.y ?? null, sel: mySel || null, drag: myDrag, typing: Boolean(mySel && editor.isEditingText()) });
  }

  function onMove(event) {
    if (turning) return;
    const r = spreadEl.getBoundingClientRect();
    const x = (event.clientX - r.left) / r.width;
    const y = (event.clientY - r.top) / r.height;
    // Share only while near the book, rounded so tiny jitters don't send anything.
    myPoint = x > -0.08 && x < 1.08 && y > -0.08 && y < 1.08 ? { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 } : null;
    sendCursor();
  }
  const onLeave = () => { myPoint = null; sendCursor(); };
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerleave', onLeave);
  // Tell others when you start or stop typing in a text box.
  let wasTyping = false;
  const onTypingChange = () => { const now = editor.isEditingText(); if (now !== wasTyping) { wasTyping = now; sendCursor(); } };
  spreadEl.addEventListener('focusin', () => setTimeout(onTypingChange));
  spreadEl.addEventListener('focusout', () => setTimeout(onTypingChange));
  spreadEl.addEventListener('input', onTypingChange);

  // Keepsake cursor: the rounded triangle from the board's Elements row (Polygon 4).
  const CURSOR = '<svg class="live-arrow" viewBox="0 0 27 30"><path d="M11.6832 1.05247C12.3238 -0.350821 14.3174 -0.350827 14.958 1.05247L26.3843 26.0813C27.5096 28.5462 24.7084 30.9474 22.4446 29.4585L20.7385 28.3365C16.2364 25.3757 10.4047 25.3757 5.90263 28.3366L4.19668 29.4585C1.93282 30.9473 -0.868337 28.5462 0.256929 26.0813L11.6832 1.05247Z"/></svg>';

  // Draws each other person's cursor (an arrow with their name) and outlines what they've selected.
  function paintLive() {
    spreadEl.querySelectorAll('.pi.live-sel').forEach((el) => { el.classList.remove('live-sel', 'live-typing'); el.style.removeProperty('--live'); });
    applyDrags();
    const here = Object.entries(others)
      .filter(([id, c]) => id !== ME && c && c.book === bookId && c.spread === spreadKey() && people[id]);
    const area = liveLayer.getBoundingClientRect();
    const r = spreadEl.getBoundingClientRect();
    let html = '';
    for (const [id, c] of here) {
      const { name = 'Someone' } = people[id];
      const color = brandColor(people[id].color || '#9B9090');
      const style = `--live:${esc(color)}`;
      const el = c.sel ? spreadEl.querySelector(`.page-inner .pi[data-id="${CSS.escape(c.sel)}"]`) : null;
      if (el) {
        el.classList.add('live-sel');
        el.classList.toggle('live-typing', Boolean(c.typing));
        el.style.setProperty('--live', color);
        // The name tag sits on the bottom-right corner of what they selected (placed by placeTags).
        html += c.typing
          ? `<span class="live-tag is-sel is-typing" data-for="${esc(c.sel)}" style="${style}">${esc(String(name).toLowerCase())} is typing<img src="./brand/elements/typing-dots.svg" alt=""></span>`
          : `<span class="live-tag is-sel" data-for="${esc(c.sel)}" style="${style}">${esc(name)}</span>`;
      }
      if (c.x != null && c.y != null) {
        const left = r.left - area.left + c.x * r.width;
        const top = r.top - area.top + c.y * r.height;
        // With something selected, their name sits on the selection (like the mockup), so the arrow goes without it.
        html += `<span class="live-cursor${el ? ' no-tag' : ''}" data-id="${esc(id)}" style="${style};transform:translate(${left}px,${top}px)">${CURSOR}<span class="live-tag">${esc(name)}</span></span>`;
      }
    }
    // Reuse cursor elements so they glide instead of jumping.
    const prev = new Map([...liveLayer.querySelectorAll('.live-cursor')].map((el) => [el.dataset.id, el]));
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    for (const fresh of tmp.querySelectorAll('.live-cursor')) {
      const old = prev.get(fresh.dataset.id);
      if (old) {
        old.style.cssText = fresh.style.cssText;
        old.className = fresh.className;
        old.querySelector('.live-tag').textContent = fresh.textContent;
        fresh.replaceWith(old);
        prev.delete(fresh.dataset.id);
      }
    }
    liveLayer.replaceChildren(...tmp.childNodes);
    placeTags();
  }

  // Name tags follow the corner of the selected thing, even while it glides to a new spot.
  let tagLoopUntil = 0;
  function placeTags() {
    const area = liveLayer.getBoundingClientRect();
    liveLayer.querySelectorAll('.live-tag.is-sel').forEach((tag) => {
      const el = spreadEl.querySelector(`.page-inner .pi[data-id="${CSS.escape(tag.dataset.for)}"]`);
      if (!el) { tag.hidden = true; return; }
      const b = el.getBoundingClientRect();
      tag.style.left = `${b.right - area.left}px`;
      tag.style.top = `${b.bottom - area.top}px`;
    });
    if (performance.now() < tagLoopUntil) requestAnimationFrame(placeTags);
  }

  // Someone else is dragging, resizing or rotating: glide their item to where they have it.
  const gliding = new Set();
  function applyDrags() {
    const now = new Set();
    for (const [id, c] of Object.entries(others)) {
      const d = c?.drag;
      if (id === ME || !d || c.book !== bookId || c.spread !== spreadKey()) continue;
      const el = spreadEl.querySelector(`.page-inner .pi[data-id="${CSS.escape(d.id)}"]`);
      if (!el || !el.closest(`.page.${d.side}`)) continue; // moved to the other page: wait for the drop
      el.classList.add('live-moving');
      el.style.left = `${d.x}%`;
      el.style.top = `${d.y}%`;
      el.style.width = `${d.width}%`;
      el.style.transform = `rotate(${d.rotation}deg)`;
      if (d.size != null && el.classList.contains('pi-text')) el.style.fontSize = textFontSize({ size: d.size });
      now.add(el);
    }
    // Stop gliding once they let go (the dropped position arrives with the saved book).
    gliding.forEach((el) => { if (!now.has(el)) el.classList.remove('live-moving'); });
    gliding.clear();
    now.forEach((el) => gliding.add(el));
    if (now.size) tagLoopUntil = performance.now() + 250;
  }

  const offCursors = onCursors((next) => { others = next; paintLive(); });
  const offPeople = onPresence((next) => { people = next; paintLive(); paintHere(); });

  // Top right: everyone in this book right now. Click someone to go to the pages they're on.
  function paintHere() {
    const inBook = Object.entries(people).filter(([id, p]) => id !== ME && p.book === bookId)
      .sort(([, a], [, b]) => String(a.name).localeCompare(String(b.name)));
    // Keepsake multiplayer states: "who's here now" (faces + "N here now") and "just you here" (invite).
    const MY_COLOR_B = brandColor(people[ME]?.color || MY_COLOR);
    const meFace = `<span class="here-face is-me" style="--live:${esc(MY_COLOR_B)};color:${inkFor(MY_COLOR_B)}" title="You" aria-hidden="true">${esc(String(ME_NAME || 'you').trim().charAt(0).toUpperCase())}</span>`;
    hereEl.innerHTML = !inBook.length ? `
      ${meFace}<span class="here-pill">just you</span>
      <button type="button" class="here-invite" data-action="copy-invite">invite friends</button>` : `
      ${meFace}${inBook.map(([id, p]) => {
        const where = `${p.page || ''}${p.editing ? ' · editing' : ''}`;
        const same = p.spread === spreadKey();
        return `<button type="button" class="here-face${same ? ' is-same' : ''}" data-action="go-to-person" data-spread="${esc(p.spread || '')}"
          style="--live:${esc(brandColor(p.color || '#9B9090'))};color:${inkFor(p.color || '#3D6FE0')}" title="${esc(`${p.name}${where ? ` · ${where}` : ''}`)}"
          aria-label="${esc(`${p.name}${where ? `, ${where}` : ''}. Go to their pages`)}">${esc(String(p.name || '?').trim().charAt(0).toUpperCase())}</button>`;
      }).join('')}
      <span class="here-pill is-live"><span class="here-dot" aria-hidden="true"></span>${inBook.length + 1} here now</span>`;
  }
  const onResizeLive = () => { paintLive(); showBy(); };
  window.addEventListener('resize', onResizeLive);
  liveReady = true;
  sharePlace();
  const retry = setInterval(() => { if (pendingRemote) applyRemoteChange(); }, 600);

  return {
    cleanup() {
      document.removeEventListener('keydown', onKeydown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      unsubscribe();
      clearInterval(retry);
      offCursors();
      offPeople();
      window.removeEventListener('resize', onResizeLive);
      setCursor(null);
      popover.close({ refocus: false });
      editor.destroy();
    },
    spreadRect: () => spreadEl.getBoundingClientRect(),
    spreadEl,
    index: () => index,
    focus: () => spreadEl.focus({ preventScroll: true }),
  };
}
