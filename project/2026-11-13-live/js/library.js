// Library (home): carousel and grid of books, search, and book actions.

import { getBooks, getBook, deleteBook, resetDemo, subscribe, addMember } from './state.js';
import { isEmail } from './model.js';
import { bookHtml, hydrateCovers, pagesLabel } from './covers.js';
import { ICONS, esc, toast, announce, confirmDialog, isTyping, dialogOpen, avatarStack } from './ui.js';
import { isAnimating } from './animation.js';
import { openBookForm } from './bookform.js';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// View state survives switching to a book and back.
const ui = {
  view: (() => { try { return sessionStorage.getItem('library.view') || 'carousel'; } catch { return 'carousel'; } })(),
  query: '',
  selectedId: null,
  menuOpen: false,
};

const visibleBooks = () => {
  const q = ui.query.trim().toLowerCase();
  return q ? getBooks().filter((b) => b.title.toLowerCase().includes(q)) : getBooks();
};

export function showInLibrary(bookId) {
  ui.selectedId = bookId;
}

export function mountLibrary(root, { focus = true } = {}) {
  document.title = 'My books';
  root.innerHTML = `
    <div class="library">
      <header class="topbar">
        <h1 class="brand">My books</h1>
        <div class="top-actions">
          <div class="view-toggle" role="group" aria-label="Layout">
            <button type="button" class="icon-btn glass" data-action="view" data-view="carousel" aria-label="Carousel view">${ICONS.carousel}</button>
            <button type="button" class="icon-btn glass" data-action="view" data-view="grid" aria-label="Grid view">${ICONS.grid}</button>
          </div>
          <label class="search">
            ${ICONS.search}
            <span class="visually-hidden">Search books</span>
            <input type="search" id="book-search" placeholder="Search books" autocomplete="off" value="${esc(ui.query)}">
          </label>
        </div>
      </header>
      <main class="library-main" id="library-main"></main>
      <nav class="library-actions" aria-label="Book actions">
        <div class="menu-wrap">
          <button type="button" class="action" data-action="more" aria-haspopup="true" aria-expanded="false" aria-controls="more-menu">
            <span class="circle glass">${ICONS.more}</span><span class="action-label">More</span>
          </button>
          <div class="menu" id="more-menu" hidden>
            <button type="button" class="menu-item" data-action="settings"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 14H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>Book settings</button>
            <button type="button" class="menu-item" data-action="reset">${ICONS.reset}Reset demo data</button>
          </div>
        </div>
        <button type="button" class="action" data-action="share"><span class="circle glass">${ICONS.share}</span><span class="action-label">Share</span></button>
        <button type="button" class="action" data-action="delete"><span class="circle glass">${ICONS.trash}</span><span class="action-label">Delete</span></button>
        <button type="button" class="action" data-action="new"><span class="circle solid">${ICONS.plus}</span><span class="action-label">New book</span></button>
      </nav>
    </div>`;

  const main = root.querySelector('#library-main');
  const search = root.querySelector('#book-search');

  function selectedIndex(books) {
    return Math.max(0, books.findIndex((b) => b.id === ui.selectedId));
  }

  function renderMain() {
    const books = visibleBooks();
    if (!books.some((b) => b.id === ui.selectedId)) ui.selectedId = books[0]?.id ?? null;
    root.querySelectorAll('[data-action="view"]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === ui.view));
    root.querySelectorAll('[data-action="share"], [data-action="delete"], [data-action="settings"]').forEach((b) => { b.disabled = !ui.selectedId; });

    if (!books.length) {
      main.innerHTML = `<p class="empty">${ui.query ? `No books match "${esc(ui.query)}".` : 'No books yet. Make one with New book.'}</p>`;
      return;
    }
    if (ui.view === 'grid') {
      main.innerHTML = `
        <ul class="book-grid" aria-label="Books">
          ${books.map((b) => `
            <li>
              <button type="button" class="grid-book" data-action="grid-pick" data-id="${esc(b.id)}" aria-current="${b.id === ui.selectedId}">
                <span class="grid-cover">${bookHtml(b)}</span>
                <span class="grid-title">${esc(b.title)}</span>
                <span class="grid-members">${avatarStack(b.members)}</span>
              </button>
            </li>`).join('')}
        </ul>
        <p class="hint">Click a book to select it. Click it again to open it.</p>`;
      main.querySelectorAll('.grid-book').forEach(labelGridBook);
    } else {
      main.innerHTML = `
        <section class="carousel" aria-label="Books" aria-roledescription="carousel">
          <div class="selected-info">
            <h2 class="sel-title" id="sel-title"></h2>
            <div class="sel-members" id="sel-members"></div>
          </div>
          <div class="stage" id="stage">
            ${books.map((b, i) => `<button type="button" class="slot" data-index="${i}" data-id="${esc(b.id)}">${bookHtml(b)}</button>`).join('')}
          </div>
        </section>`;
      layoutCarousel(false);
    }
    hydrateCovers(main);
  }

  function labelGridBook(button) {
    const book = getBook(button.dataset.id);
    const selected = book.id === ui.selectedId;
    button.setAttribute('aria-current', selected);
    button.setAttribute('aria-label', `${selected ? 'Open' : 'Select'} ${book.title}, ${pagesLabel(book)}`);
  }

  function layoutCarousel(animate = true) {
    const stage = main.querySelector('#stage');
    if (!stage) return;
    const books = visibleBooks();
    const sel = selectedIndex(books);
    const width = stage.querySelector('.slot')?.offsetWidth || 300;
    const X = [0, 0.86, 1.5, 2.04, 2.5];
    const SCALE = [1, 0.74, 0.6, 0.5, 0.44];
    stage.classList.toggle('instant', !animate || reducedMotion());
    stage.querySelectorAll('.slot').forEach((slot) => {
      const offset = Number(slot.dataset.index) - sel;
      const d = Math.min(Math.abs(offset), 4);
      const dir = Math.sign(offset);
      const book = books[Number(slot.dataset.index)];
      slot.style.transform = `translateX(${dir * X[d] * width}px) scale(${SCALE[d]}) rotateY(${-dir * Math.min(d, 1) * 16}deg)`;
      slot.style.zIndex = String(10 - d);
      slot.classList.toggle('is-center', offset === 0);
      slot.classList.toggle('is-far', d >= 4);
      slot.tabIndex = offset === 0 ? 0 : -1;
      slot.setAttribute('aria-hidden', d >= 4 ? 'true' : 'false');
      slot.setAttribute('aria-label', offset === 0 ? `Open ${book.title}, ${pagesLabel(book)}` : `Show ${book.title}`);
    });
    const current = books[sel];
    main.querySelector('#sel-title').textContent = current.title;
    main.querySelector('#sel-members').innerHTML = `
      <div class="member-row">
        ${avatarStack(current.members)}
        <button type="button" class="add-person" data-action="add-person" aria-label="Add someone to ${esc(current.title)}" title="Add someone">${ICONS.plus}</button>
      </div>`;
  }

  // Add someone to the selected book by name and email.
  function addPerson() {
    const book = getBook(ui.selectedId);
    if (!book) return;
    const dialog = document.getElementById('confirm');
    dialog.innerHTML = `
      <form method="dialog" class="confirm-box" id="person-form" novalidate>
        <h2 id="confirm-title">Add someone to ${esc(book.title)}</h2>
        <p>They'll be able to add ideas and make pages in this book.</p>
        <label class="field"><span>Name <span class="optional">(optional)</span></span>
          <input name="name" maxlength="30" autocomplete="off">
        </label>
        <label class="field"><span>Email</span>
          <input name="email" type="email" maxlength="120" autocomplete="off" aria-describedby="person-error">
        </label>
        <p class="field-error" id="person-error" hidden></p>
        <p class="form-note">In this prototype, no email is actually sent.</p>
        <div class="confirm-actions">
          <button type="button" class="pill-btn" data-close>Cancel</button>
          <button type="submit" class="pill-btn solid">Add person</button>
        </div>
      </form>`;
    dialog.setAttribute('aria-labelledby', 'confirm-title');
    const form = dialog.querySelector('#person-form');
    const nameInput = form.elements.name;
    const emailInput = form.elements.email;
    const error = form.querySelector('#person-error');
    const showError = (message) => {
      error.textContent = message;
      error.hidden = false;
      emailInput.setAttribute('aria-invalid', 'true');
      emailInput.focus();
    };
    const refocus = () => main.querySelector('.add-person')?.focus({ preventScroll: true });

    form.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    emailInput.addEventListener('input', () => { error.hidden = true; emailInput.removeAttribute('aria-invalid'); });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const email = emailInput.value.trim();
      if (!email) return showError('Add their email so they can be invited.');
      if (!isEmail(email)) return showError('That email doesn\'t look right. Check for typos.');
      if (book.members.some((m) => m.email && m.email.toLowerCase() === email.toLowerCase())) return showError('That person is already in this book.');
      const local = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
      const name = nameInput.value.trim() || local.replace(/\b\w/g, (c) => c.toUpperCase());
      dialog.close();
      addMember(book.id, { name, email });
      toast(`Added ${name} to ${book.title}`);
      refocus();
    });
    dialog.addEventListener('close', refocus, { once: true });
    dialog.showModal();
    nameInput.focus();
  }

  function select(index, { focus = true } = {}) {
    const books = visibleBooks();
    if (!books.length) return;
    const clamped = Math.max(0, Math.min(books.length - 1, index));
    if (books[clamped].id === ui.selectedId) return;
    ui.selectedId = books[clamped].id;
    layoutCarousel(true);
    announce(`${books[clamped].title}, ${pagesLabel(books[clamped])}`);
    if (focus) main.querySelector('.slot.is-center')?.focus({ preventScroll: true });
  }

  const step = (delta) => select(selectedIndex(visibleBooks()) + delta);

  // The router plays the open animation from this book's cover.
  function open(id) {
    const el = main.querySelector('.slot.is-center .book') || main.querySelector(`.grid-book[data-id="${CSS.escape(id)}"] .book`);
    window.dispatchEvent(new CustomEvent('book:open', { detail: { id, el } }));
  }

  function setMenu(open) {
    ui.menuOpen = open;
    const menu = root.querySelector('#more-menu');
    const button = root.querySelector('[data-action="more"]');
    menu.hidden = !open;
    button.setAttribute('aria-expanded', open);
    if (open) menu.querySelector('.menu-item')?.focus();
  }

  async function share() {
    const book = getBook(ui.selectedId);
    if (!book) return;
    const url = `${location.origin}${location.pathname}#/book/${encodeURIComponent(book.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(`Link to "${book.title}" copied`);
    } catch {
      toast("Couldn't copy the link");
    }
  }

  async function remove() {
    const books = visibleBooks();
    const index = selectedIndex(books);
    const book = books[index];
    if (!book) return;
    const ok = await confirmDialog({
      title: `Delete "${book.title}"?`,
      body: `This deletes all ${pagesLabel(book)} and their photos. It can't be undone.`,
      confirmLabel: 'Delete book',
      danger: true,
    });
    if (!ok) return;
    const next = books[index + 1] || books[index - 1];
    ui.selectedId = next?.id ?? null;
    deleteBook(book.id);
    toast(`Deleted "${book.title}"`);
  }

  async function reset() {
    setMenu(false);
    const ok = await confirmDialog({
      title: 'Reset the demo?',
      body: 'This removes every book and photo in this room, for everyone using the link, and brings back the starting books.',
      confirmLabel: 'Reset',
      danger: true,
    });
    if (!ok) return;
    ui.selectedId = null;
    await resetDemo();
    toast('Demo data reset');
  }

  const actions = {
    view: (btn) => {
      ui.view = btn.dataset.view;
      try { sessionStorage.setItem('library.view', ui.view); } catch { /* per-tab convenience only */ }
      renderMain();
    },
    more: () => setMenu(!ui.menuOpen),
    reset,
    share,
    delete: remove,
    // New book: after creating it, select it and open it (to the bucket list, or its first blank spread).
    new: () => openBookForm({
      onSaved: (book) => {
        ui.query = '';
        search.value = '';
        ui.selectedId = book.id;
        renderMain();
        toast(`Made "${book.title}"`);
        requestAnimationFrame(() => open(book.id));
      },
    }),
    settings: () => {
      setMenu(false);
      const book = getBook(ui.selectedId);
      if (book) openBookForm({ book, onSaved: (b) => toast(`Saved "${b.title}"`) });
    },
    'add-person': addPerson,
    'grid-pick': (btn) => {
      if (btn.dataset.id === ui.selectedId) return open(btn.dataset.id);
      ui.selectedId = btn.dataset.id;
      main.querySelectorAll('.grid-book').forEach(labelGridBook);
    },
  };

  function onClick(event) {
    if (isAnimating()) return;
    const slot = event.target.closest('.slot');
    if (slot) {
      if (slot.classList.contains('is-center')) open(slot.dataset.id);
      else select(Number(slot.dataset.index));
      return;
    }
    const btn = event.target.closest('[data-action]');
    if (btn && actions[btn.dataset.action]) {
      actions[btn.dataset.action](btn);
      return;
    }
    if (ui.menuOpen && !event.target.closest('.menu-wrap')) setMenu(false);
  }

  function onKeydown(event) {
    if (isAnimating() || dialogOpen()) return;
    if (event.key === 'Escape') {
      if (ui.menuOpen) { setMenu(false); root.querySelector('[data-action="more"]').focus(); return; }
      if (event.target === search && search.value) { search.value = ''; setQuery(''); }
      return;
    }
    if (isTyping(event.target) || ui.view !== 'carousel') return;
    if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
    if (event.key === 'Home') { event.preventDefault(); select(0); }
    if (event.key === 'End') { event.preventDefault(); select(visibleBooks().length - 1); }
  }

  // Trackpad and scroll wheel: one step per gesture, with a short cooldown.
  let wheelTotal = 0;
  let wheelLock = 0;
  function onWheel(event) {
    if (isAnimating()) return;
    if (ui.view !== 'carousel' || !event.target.closest('#stage')) return;
    event.preventDefault();
    const now = performance.now();
    if (now < wheelLock) return;
    wheelTotal += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(wheelTotal) > 40) {
      step(wheelTotal > 0 ? 1 : -1);
      wheelTotal = 0;
      wheelLock = now + 320;
    }
  }

  // Searching can move the selection to a match; clearing the search restores the book you had picked.
  let pickedBeforeSearch = null;
  function setQuery(value) {
    if (!ui.query.trim() && value.trim()) pickedBeforeSearch = ui.selectedId;
    ui.query = value;
    if (!value.trim() && pickedBeforeSearch && getBook(pickedBeforeSearch)) {
      ui.selectedId = pickedBeforeSearch;
      pickedBeforeSearch = null;
    }
    renderMain();
  }
  search.addEventListener('input', () => setQuery(search.value));
  root.addEventListener('click', onClick);
  root.addEventListener('wheel', onWheel, { passive: false });
  document.addEventListener('keydown', onKeydown);
  const onResize = () => layoutCarousel(false);
  window.addEventListener('resize', onResize);
  const unsubscribe = subscribe(renderMain);

  renderMain();
  if (focus && ui.view === 'carousel') main.querySelector('.slot.is-center')?.focus({ preventScroll: true });

  return () => {
    document.removeEventListener('keydown', onKeydown);
    window.removeEventListener('resize', onResize);
    unsubscribe();
  };
}
