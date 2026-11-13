// Open book view: the current spread, page-edge stacks, page turns, and the spread overview.

import { getBook, commit } from './state.js';
import { spreadsOf, spreadPagesHtml, ppLabel, spreadTitle, hydratePhotos } from './pages.js';
import { ANIMATION, isAnimating, reducedMotion } from './animation.js';
import { ICONS, esc, announce, isTyping, dialogOpen } from './ui.js';
import { createIdeaPopover, openAddIdea } from './toc.js';
import { panelHtml, createEditor } from './editor.js';

const MAX_EDGES = 8;
const CHEVRON_LEFT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const CHEVRON_RIGHT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';


export function mountBook(root, bookId) {
  const book = getBook(bookId);
  if (!book) {
    root.innerHTML = `
      <div class="book-view missing">
        <p>This book doesn't exist anymore.</p>
        <a class="pill-btn" href="#/">Back to library</a>
      </div>`;
    return { cleanup() {}, spreadRect: () => new DOMRect(), spreadEl: null, index: () => 0, focus() {} };
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
          <button type="button" class="pill-btn edit-pill" data-action="toggle-edit" aria-pressed="false">Edit</button>
        </div>
        <button type="button" class="icon-btn glass" data-action="overview" aria-label="See all spreads" aria-haspopup="dialog">${ICONS.grid}</button>
      </header>
      <main class="book-stage">
        <div class="spread-area">
          <button type="button" class="edges left" data-action="prev" aria-label="Previous spread"></button>
          <button type="button" class="edges right" data-action="next" aria-label="Next spread"></button>
          <div class="spread" id="spread" tabindex="-1">
            <div class="page left"><div class="page-inner" id="page-left"></div></div>
            <div class="page right"><div class="page-inner" id="page-right"></div></div>
          </div>
        </div>
        <div class="turn-controls">
          <button type="button" class="icon-btn glass small" data-action="prev" aria-label="Previous spread">${CHEVRON_LEFT}</button>
          <button type="button" class="icon-btn glass small" data-action="next" aria-label="Next spread">${CHEVRON_RIGHT}</button>
        </div>
      </main>
      ${panelHtml()}
      <dialog class="overview" id="overview" aria-labelledby="overview-title"></dialog>
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
    pill.hidden = !currentSpread();
    pill.textContent = editMode ? 'Done' : 'Edit';
    pill.setAttribute('aria-pressed', editMode);
    pill.setAttribute('aria-label', editMode ? 'Done editing' : 'Edit this spread');
    spreadEl.classList.toggle('is-editing', editMode && Boolean(currentSpread()));
    spreadEl.setAttribute('aria-label', `${spreadTitle(book, index)}, ${ppLabel(index)}`);
  }

  function showSpread() {
    const pages = spreadPagesHtml(book, index, { interactive: true, season: tocSeason });
    leftEl.innerHTML = pages.left;
    rightEl.innerHTML = pages.right;
    hydratePhotos(spreadEl);
    updateChrome();
    editor?.refresh();
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
                <span class="thumb-spread" aria-hidden="true">
                  <span class="page left"><span class="page-inner">${pages.left}</span></span>
                  <span class="page right"><span class="page-inner">${pages.right}</span></span>
                </span>
                <span class="thumb-label"><strong>${ppLabel(i)}</strong> ${esc(spreadTitle(book, i))}</span>
              </button>
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
    editMode = on;
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

  editor = createEditor({ root, book, spreadEl, currentSpread, rerender: showSpread, isEnabled: () => editMode, onDone: () => setEditMode(false) });
  root.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeydown);
  showSpread();

  return {
    cleanup() { document.removeEventListener('keydown', onKeydown); popover.close({ refocus: false }); editor.destroy(); },
    spreadRect: () => spreadEl.getBoundingClientRect(),
    spreadEl,
    index: () => index,
    focus: () => spreadEl.focus({ preventScroll: true }),
  };
}
