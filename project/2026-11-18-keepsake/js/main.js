// Entry point: a small hash router between the library and an open book,
// with a subtle open/close transition (transitions.js).
// The full 3D version is in opening.js, turned off for now.

import { mountLibrary, showInLibrary } from './library.js';
import { mountBook } from './book.js';
import { openTransition, closeTransition } from './transitions.js';
import { isAnimating, setAnimating, initDevPanel } from './animation.js';
import { startLive, ensureMe, getBook, subscribe, setMyColor } from './state.js';
import { ME, ME_NAME, MY_COLOR, LIVE_COLORS, hasName, setMyName } from './identity.js';
import { ROOM, liveEnabled, onStatus, onPresence, startPresence, setPresenceBook, onSaveError } from './sync.js';
import { esc, inkFor, brandColor, toast } from './ui.js';
import { track, EVENTS } from './analytics.js';

// A change the shared database wouldn't take: say so, instead of it quietly vanishing.
onSaveError(() => toast("Couldn't save your last change. Check your connection, then try it again."));

const app = document.getElementById('app');
const backdrop = document.getElementById('backdrop');
let current = null; // { type, id, root, cleanup, api }
let skipHash = null;

const bookIdFromHash = () => {
  const match = location.hash.match(/^#\/book\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
};

function newRoot(hidden = false) {
  const root = document.createElement('div');
  root.className = 'view';
  if (hidden) root.style.visibility = 'hidden';
  app.append(root);
  return root;
}

function setHash(hash) {
  if (location.hash === hash || (hash === '#/' && !location.hash)) return;
  skipHash = hash;
  location.hash = hash;
}

function teardown() {
  current?.cleanup?.();
  current?.root.remove();
  current = null;
}

// Plain mount: first load, and browser back/forward.
function mountFromHash() {
  teardown();
  const id = bookIdFromHash();
  const root = newRoot();
  if (id) {
    const api = mountBook(root, id);
    current = { type: 'book', id, root, api, cleanup: api.cleanup };
    backdrop.style.opacity = '1';
    api.focus();
  } else {
    current = { type: 'library', root, cleanup: mountLibrary(root) };
    backdrop.style.opacity = '0';
  }
}

async function openBook({ id, el }) {
  if (isAnimating() || current?.type !== 'library') return;
  setAnimating(true);
  try {
    const root = newRoot(true);
    const api = mountBook(root, id);
    await openTransition({ coverEl: el, libraryRoot: current.root, bookRoot: root, backdrop });
    teardown();
    current = { type: 'book', id, root, api, cleanup: api.cleanup };
    setHash(`#/book/${encodeURIComponent(id)}`);
    api.focus();
  } catch (error) {
    recover(`#/book/${encodeURIComponent(id)}`, error);
  } finally {
    setAnimating(false);
  }
}

// If a transition fails, skip it and just show the destination.
function recover(hash, error) {
  console.warn('Transition skipped:', error);
  document.querySelectorAll('.flip-layer, .anim-layer').forEach((el) => el.remove());
  app.querySelectorAll('.view').forEach((el) => { if (el !== current?.root) el.remove(); });
  backdrop.getAnimations().forEach((a) => a.cancel());
  if (location.hash === hash) mountFromHash();
  else { skipHash = null; location.hash = hash; mountFromHash(); skipHash = hash; }
}

async function closeBook({ id }) {
  if (isAnimating() || current?.type !== 'book') return;
  setAnimating(true);
  try {
    showInLibrary(id);
    const root = newRoot(true);
    const cleanup = mountLibrary(root, { focus: false });
    const coverEl = root.querySelector('.slot.is-center .book') || root.querySelector('.grid-book[aria-current="true"] .book');
    await closeTransition({ coverEl, libraryRoot: root, bookRoot: current.root, backdrop });
    teardown();
    current = { type: 'library', root, cleanup };
    setHash('#/');
    (root.querySelector('.slot.is-center') || root.querySelector('.grid-book[aria-current="true"]'))?.focus({ preventScroll: true });
  } catch (error) {
    recover('#/', error);
  } finally {
    setAnimating(false);
  }
}

window.addEventListener('book:open', (event) => openBook(event.detail));
window.addEventListener('book:close', (event) => closeBook(event.detail));
window.addEventListener('hashchange', () => {
  if (skipHash && location.hash === skipHash) { skipHash = null; return; }
  skipHash = null;
  if (!isAnimating()) mountFromHash();
});

// Show focus rings only for keyboard users: keys turn them on, a click or tap turns them off.
const NAV_KEYS = new Set(['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' ', 'Escape', 'Home', 'End', 'PageUp', 'PageDown']);
document.addEventListener('keydown', (event) => { if (NAV_KEYS.has(event.key)) document.documentElement.classList.add('kbd'); }, true);
document.addEventListener('pointerdown', () => document.documentElement.classList.remove('kbd'), true);

initDevPanel();
mountFromHash();

// ---------- live: your name, the shared room, and who's here ----------

function askName() {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'join-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="join-form">
        <img class="join-logo" src="./brand/logo.svg" alt="keepsake">
        <p class="join-tag">every page, together</p>
        <p>Everyone with this link shares the same books${liveEnabled ? ` (room <strong>${esc(ROOM)}</strong>)` : ''}. What should your friends call you?</p>
        <label for="join-name" class="visually-hidden">Your name</label>
        <input id="join-name" name="name" maxlength="24" required autocomplete="given-name" placeholder="Your name">
        <button type="submit" class="pill-btn">Join</button>
      </form>`;
    document.body.append(dialog);
    dialog.addEventListener('cancel', (event) => event.preventDefault()); // a name is needed to join
    dialog.querySelector('form').addEventListener('submit', (event) => {
      const name = dialog.querySelector('#join-name').value.trim().slice(0, 24);
      if (!name) { event.preventDefault(); return; }
      setMyName(name);
      track(EVENTS.joinedScrapbook);
      dialog.close();
      dialog.remove();
      resolve(name);
    });
    dialog.showModal();
  });
}

const STATUS_TEXT = {
  off: 'Not live: only you see your changes',
  connecting: 'Connecting…',
  live: 'Live',
  error: "Can't reach the shared books. Changes are only saved on this computer.",
};

// Bottom-left bar: Live status, who's here, and Copy link. Click it to see who's here and where.
function whereText(p) {
  const book = p.book ? getBook(p.book) : null;
  if (!book) return 'In the library';
  const parts = [`In ${book.title}`];
  if (p.page) parts.push(p.page);
  if (p.editing) parts.push('editing');
  return parts.join(' · ');
}

function mountPresenceBar() {
  const bar = document.createElement('div');
  bar.className = 'presence-bar';
  bar.innerHTML = `
    <button type="button" class="presence-toggle" aria-expanded="false" aria-controls="presence-list"></button>
    <div class="presence-list" id="presence-list" role="region" aria-label="Who's here" hidden></div>`;
  document.body.append(bar);
  const toggle = bar.querySelector('.presence-toggle');
  const list = bar.querySelector('.presence-list');
  let status = 'off';
  let people = {};

  const face = (p) => `<span class="presence-face" style="background:${esc(brandColor(p.color || '#9AA0AE'))};color:${inkFor(p.color || '#9AA0AE')}" aria-hidden="true">${esc(String(p.name || '?').trim().slice(0, 1).toUpperCase())}</span>`;

  function render() {
    const live = status === 'live';
    const here = live ? Object.entries(people).map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => (b.id === ME) - (a.id === ME) || String(a.name).localeCompare(String(b.name))) : [];
    toggle.disabled = !live;
    toggle.innerHTML = `
      <span class="presence-dot is-${status}" aria-hidden="true"></span>
      <span class="presence-text">${esc(STATUS_TEXT[status] || '')}${live ? ` · ${here.length} here` : ''}</span>
      ${live ? `<span class="presence-faces">${here.slice(0, 6).map(face).join('')}</span>` : ''}
      ${live ? '<svg class="presence-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>' : ''}`;
    toggle.setAttribute('aria-label', live ? `Live, ${here.length} here. Show who's here` : STATUS_TEXT[status] || '');
    list.innerHTML = `
      <h2>Here now <span>${here.length}</span></h2>
      <ul>
        ${here.map((p) => `
          <li>
            ${face(p)}
            <span class="presence-who">
              <strong>${esc(p.name || 'Someone')}${p.id === ME ? ' <em>(you)</em>' : ''}</strong>
              <span>${esc(whereText(p))}</span>
            </span>
          </li>`).join('')}
      </ul>`;
    if (!live) setOpen(false);
  }

  function setOpen(open) {
    list.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    bar.classList.toggle('is-open', open);
  }

  bar.addEventListener('click', (event) => {
    if (event.target.closest('.presence-toggle')) setOpen(list.hidden);
  });
  document.addEventListener('pointerdown', (event) => { if (!bar.contains(event.target)) setOpen(false); });
  bar.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !list.hidden) { event.stopPropagation(); setOpen(false); toggle.focus(); }
  });
  onStatus((next) => { status = next; render(); });
  onPresence((next) => {
    people = next;
    render();
    // Your circle in each book uses your live color, so you look the same everywhere.
    if (next[ME]?.color) setMyColor(next[ME].color);
  });
  subscribe(() => { if (!list.hidden) render(); }); // book titles can change
}

async function startLiveMode() {
  mountPresenceBar();
  if (!hasName()) await askName();
  ensureMe();
  if (!liveEnabled) return;
  startLive();
  startPresence({ id: ME, name: ME_NAME, color: MY_COLOR, palette: LIVE_COLORS });
  setPresenceBook(bookIdFromHash());
  window.addEventListener('hashchange', () => setPresenceBook(bookIdFromHash()));
  // setHash() changes the hash without always firing our router, so check after transitions too.
  window.addEventListener('book:open', () => setTimeout(() => setPresenceBook(bookIdFromHash()), 1500));
  window.addEventListener('book:close', () => setTimeout(() => setPresenceBook(bookIdFromHash()), 1500));
}

startLiveMode();
