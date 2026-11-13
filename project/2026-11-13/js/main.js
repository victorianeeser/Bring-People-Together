// Entry point: a small hash router between the library and an open book,
// with a subtle open/close transition (transitions.js).
// The full 3D version is in opening.js, turned off for now.

import { mountLibrary, showInLibrary } from './library.js';
import { mountBook } from './book.js';
import { openTransition, closeTransition } from './transitions.js';
import { isAnimating, setAnimating, initDevPanel } from './animation.js';

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
