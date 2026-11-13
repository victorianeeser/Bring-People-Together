// The book open and close transition: a temporary 3D book that plays four beats
// (lift, turn to the spine, fan open, settle into page edges), then hands off to the real view.
// Timings come from ANIMATION in animation.js. Only transform and opacity are animated.

import { ANIMATION as A, reducedMotion } from './animation.js';
import { coverHtml, coverColor, hydrateCovers } from './covers.js';
import { spreadsOf, spreadPagesHtml, hydratePhotos } from './pages.js';

const MAX_SIDE = 8; // leaves per side, so at most 16 in the fan

const rootTf = (p, scale, turn, lift = 0) =>
  `translate3d(${p.x}px, ${p.y}px, ${lift}px) scale(${scale}) rotateY(${turn}deg)`;
const leafTf = (dx, angle, z) => `translateX(${dx}px) rotateY(${angle}deg) translateZ(${z}px)`;

const finished = (animations) => Promise.all(animations.map((a) => a.finished));

function buildModel(book, index, pageW, pageH) {
  const total = spreadsOf(book).length;
  const current = spreadPagesHtml(book, index);
  const prev = index > 0 ? spreadPagesHtml(book, index - 1) : null;
  const next = index < total - 1 ? spreadPagesHtml(book, index + 1) : null;

  // Left group: the cover plus pages before the open spread. Right: pages after, plus the back cover.
  const leftCount = 1 + Math.min(MAX_SIDE - 1, 1 + index * 2);
  const rightCount = Math.min(MAX_SIDE - 1, 1 + (total - 1 - index) * 2) + 1;
  const count = leftCount + rightCount;
  const thickness = Math.max(10, Math.min(26, count * 1.5));
  const gap = thickness / (count - 1);

  const layer = document.createElement('div');
  layer.className = 'anim-layer';
  const root = document.createElement('div');
  root.className = 'anim-root';
  layer.append(root);

  const paper = (html, classes) => `<div class="a-face ${classes}"><div class="page-inner">${html}</div></div>`;
  const leaves = [];
  for (let i = 0; i < count; i++) {
    const side = i < leftCount ? 'left' : 'right';
    const j = side === 'left' ? leftCount - 1 - i : i - leftCount; // distance from the open spread
    let front = paper('', 'front');
    let back = paper('', 'back');
    if (i === 0) {
      front = `<div class="a-face front cover-face">${coverHtml(book)}</div>`;
      back = paper('', 'back inside-cover');
    } else if (i === count - 1) {
      front = paper('', 'front inside-cover');
      back = `<div class="a-face back back-cover" style="--cover-bg:${coverColor(book)}"></div>`;
    } else if (side === 'left') {
      const html = j === 0 ? current.left : j === 1 && prev ? prev.right : j === 2 && prev ? prev.left : '';
      front = paper('', 'front');
      back = paper(html, `back ${j > 0 ? 'faint' : ''}`);
    } else {
      const html = j === 0 ? current.right : j === 1 && next ? next.left : j === 2 && next ? next.right : '';
      front = paper(html, `front ${j > 0 ? 'faint' : ''}`);
      back = paper('', 'back');
    }
    const el = document.createElement('div');
    el.className = 'a-leaf';
    el.style.cssText = `width:${pageW}px;height:${pageH}px;top:${-pageH / 2}px`;
    el.innerHTML = front + back;
    root.append(el);
    leaves.push({ el, side, j, z: thickness / 2 - i * gap, sideCount: side === 'left' ? leftCount : rightCount });
  }

  // The spine: a thin block with fine page-edge lines between the two boards.
  const spine = document.createElement('div');
  spine.className = 'a-spine';
  spine.style.cssText = `width:${thickness}px;height:${pageH}px;left:${-thickness / 2}px;top:${-pageH / 2}px;--cover-bg:${coverColor(book)}`;
  root.append(spine);

  hydratePhotos(layer);
  hydrateCovers(layer);
  return { layer, root, leaves };
}

// Leaf poses. Angles are around the spine: 0 points right, 180 points left.
function poses(leaf, pageW) {
  const spread = Math.max(1, leaf.sideCount - 1);
  const fan = A.fanAngle * (leaf.j / spread);
  // Fanned leaves also shift outward along the arc, so they peek past the open pages
  // instead of hiding behind them.
  const fanGap = pageW * 0.16 * leaf.j * (A.fanAngle / 55);
  if (leaf.side === 'left') {
    return {
      closed: leafTf(0, 0, leaf.z),
      fanned: leafTf(-fanGap, 180 - fan, leaf.z),
      settled: leafTf(-leaf.j * 3, 180, leaf.z),
    };
  }
  return {
    closed: leafTf(0, 0, leaf.z),
    fanned: leafTf(fanGap, fan, leaf.z),
    settled: leafTf(leaf.j * 3, 0, leaf.z),
  };
}

function geometry(coverEl, spreadRect) {
  const cover = coverEl.getBoundingClientRect();
  const pageW = spreadRect.width / 2;
  const pageH = spreadRect.height;
  const s0 = cover.width / pageW;
  const start = { x: cover.left, y: cover.top + cover.height / 2 };
  const end = { x: spreadRect.left + pageW, y: spreadRect.top + pageH / 2 };
  const lifted = { x: start.x - cover.width * (A.liftScale - 1) / 2, y: start.y };
  const sMid = (s0 * A.liftScale + 1) / 2;
  return {
    pageW,
    pageH,
    frames: {
      rest: rootTf(start, s0, 0),
      lifted: rootTf(lifted, s0 * A.liftScale, 0, 40),
      spine: rootTf(end, sMid, 90, 40),
      open: rootTf(end, 1, 0, 0),
    },
    cover,
  };
}

function libraryParts(libraryRoot) {
  return {
    others: [...libraryRoot.querySelectorAll('.slot:not(.is-center), .grid-book:not([aria-current="true"])')],
    chrome: [...libraryRoot.querySelectorAll('.topbar, .library-actions, .hint')],
    pinned: libraryRoot.querySelector('.selected-info'),
  };
}

function slideAway(el, coverRect) {
  const rect = el.getBoundingClientRect();
  const dir = rect.left + rect.width / 2 < coverRect.left + coverRect.width / 2 ? -1 : 1;
  const base = getComputedStyle(el).transform;
  const t = base === 'none' ? '' : base;
  return [{ transform: `translateX(0px) ${t}`, opacity: 1 }, { transform: `translateX(${dir * 260}px) ${t}`, opacity: 0 }];
}

export async function playOpen({ book, coverEl, libraryRoot, bookRoot, bookApi, backdrop }) {
  if (reducedMotion() || !coverEl) return reducedOpen({ libraryRoot, bookRoot, bookApi, backdrop });

  bookRoot.style.visibility = 'hidden';
  const g = geometry(coverEl, bookApi.spreadRect());
  const model = buildModel(book, bookApi.index(), g.pageW, g.pageH);
  const leafPoses = model.leaves.map((leaf) => poses(leaf, g.pageW));
  model.root.style.transform = g.frames.rest;
  model.leaves.forEach((leaf, i) => { leaf.el.style.transform = leafPoses[i].closed; });
  document.body.append(model.layer);
  coverEl.style.visibility = 'hidden';
  const lib = libraryParts(libraryRoot);

  // Beat 1: lift
  const opts = (duration, easing) => ({ duration, easing, fill: 'forwards' });
  await finished([
    model.root.animate([{ transform: g.frames.rest }, { transform: g.frames.lifted }], opts(A.lift, A.liftEase)),
    backdrop.animate([{ opacity: 0 }, { opacity: 1 }], opts(A.lift, 'ease-out')),
    ...lib.others.map((el) => el.animate(slideAway(el, g.cover), opts(A.lift, 'ease-in'))),
    ...lib.chrome.map((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], opts(A.lift, 'ease-out'))),
  ]);

  // Beat 2: turn to the spine
  await finished([model.root.animate([{ transform: g.frames.lifted }, { transform: g.frames.spine }], opts(A.turn, A.turnEase))]);

  // Beat 3: fan open while the book turns back to face you
  await finished([
    model.root.animate([{ transform: g.frames.spine }, { transform: g.frames.open }], opts(A.fan, A.fanEase)),
    ...model.leaves.map((leaf, i) => leaf.el.animate(
      [{ transform: leafPoses[i].closed }, { transform: leafPoses[i].fanned }],
      { ...opts(A.fan, A.fanEase), delay: leaf.j * A.stagger },
    )),
  ]);

  // Beat 4: settle. The fan tucks into thin edges and the real, editable spread fades in underneath.
  bookRoot.style.visibility = 'visible';
  const viewIn = bookRoot.animate([{ opacity: 0 }, { opacity: 1 }], opts(A.settle, 'ease-in'));
  await finished([
    viewIn,
    ...model.leaves.map((leaf, i) => leaf.el.animate([{ transform: leafPoses[i].fanned }, { transform: leafPoses[i].settled }], opts(A.settle, A.settleEase))),
    ...(lib.pinned ? [lib.pinned.animate([{ opacity: 1 }, { opacity: 0 }], opts(A.settle, 'ease-out'))] : []),
  ]);
  await model.layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 90, fill: 'forwards' }).finished;
  model.layer.remove();
  viewIn.cancel();
  backdrop.style.opacity = '1';
  backdrop.getAnimations().forEach((a) => a.cancel());
}

export async function playClose({ book, coverEl, libraryRoot, bookRoot, bookApi, backdrop }) {
  if (reducedMotion() || !coverEl) return reducedClose({ libraryRoot, bookRoot, backdrop });

  const f = A.closeTotal / Math.max(1, A.lift + A.turn + A.fan + A.settle);
  const g = geometry(coverEl, bookApi.spreadRect());
  const model = buildModel(book, bookApi.index(), g.pageW, g.pageH);
  const leafPoses = model.leaves.map((leaf) => poses(leaf, g.pageW));
  model.root.style.transform = g.frames.open;
  model.leaves.forEach((leaf, i) => { leaf.el.style.transform = leafPoses[i].settled; });
  document.body.append(model.layer);
  coverEl.style.visibility = 'hidden';
  const opts = (duration, easing) => ({ duration: duration * f, easing, fill: 'forwards' });
  const maxJ = Math.max(...model.leaves.map((l) => l.j));

  // Settle in reverse: the edges fan out, and the real view hands over to the 3D book.
  await finished([
    bookRoot.animate([{ opacity: 1 }, { opacity: 0 }], opts(A.settle, 'ease-out')),
    ...model.leaves.map((leaf, i) => leaf.el.animate([{ transform: leafPoses[i].settled }, { transform: leafPoses[i].fanned }], opts(A.settle, A.settleEase))),
  ]);
  bookRoot.style.visibility = 'hidden';

  // Fan in reverse: pages fold shut into the spine as the book turns.
  await finished([
    model.root.animate([{ transform: g.frames.open }, { transform: g.frames.spine }], opts(A.fan, 'cubic-bezier(0.4, 0, 0.6, 1)')),
    ...model.leaves.map((leaf, i) => leaf.el.animate(
      [{ transform: leafPoses[i].fanned }, { transform: leafPoses[i].closed }],
      { ...opts(A.fan, 'cubic-bezier(0.4, 0, 0.6, 1)'), delay: (maxJ - leaf.j) * A.stagger * f },
    )),
  ]);

  // Turn in reverse: back to the cover.
  await finished([model.root.animate([{ transform: g.frames.spine }, { transform: g.frames.lifted }], opts(A.turn, A.turnEase))]);

  // Lift in reverse: the book drops into place, the other books slide back, the background lightens.
  libraryRoot.style.visibility = 'visible';
  const lib = libraryParts(libraryRoot);
  const back = (frames) => [...frames].reverse();
  const returning = [
    model.root.animate([{ transform: g.frames.lifted }, { transform: g.frames.rest }], opts(A.lift, A.liftEase)),
    backdrop.animate([{ opacity: 1 }, { opacity: 0 }], opts(A.lift, 'ease-in')),
    ...lib.others.map((el) => el.animate(back(slideAway(el, g.cover)), { ...opts(A.lift, 'ease-out'), fill: 'both' })),
    ...lib.chrome.map((el) => el.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts(A.lift, 'ease-out'), fill: 'both' })),
    ...(lib.pinned ? [lib.pinned.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts(A.lift, 'ease-out'), fill: 'both' })] : []),
  ];
  await finished(returning);
  coverEl.style.visibility = '';
  model.layer.remove();
  returning.slice(2).forEach((a) => a.cancel());
  backdrop.style.opacity = '0';
  backdrop.getAnimations().forEach((a) => a.cancel());
}

async function reducedOpen({ libraryRoot, bookRoot, bookApi, backdrop }) {
  const opts = { duration: A.reduced, easing: 'ease-out', fill: 'forwards' };
  bookRoot.style.visibility = 'visible';
  const anims = [
    backdrop.animate([{ opacity: 0 }, { opacity: 1 }], opts),
    libraryRoot.animate([{ opacity: 1 }, { opacity: 0 }], opts),
    bookRoot.animate([{ opacity: 0 }, { opacity: 1 }], opts),
  ];
  if (bookApi.spreadEl) anims.push(bookApi.spreadEl.animate([{ transform: 'scale(0.96)' }, { transform: 'scale(1)' }], opts));
  await finished(anims);
  anims.forEach((a) => a.cancel());
  backdrop.style.opacity = '1';
}

async function reducedClose({ libraryRoot, bookRoot, backdrop }) {
  const opts = { duration: A.reduced, easing: 'ease-out', fill: 'forwards' };
  libraryRoot.style.visibility = 'visible';
  const anims = [
    backdrop.animate([{ opacity: 1 }, { opacity: 0 }], opts),
    bookRoot.animate([{ opacity: 1 }, { opacity: 0 }], opts),
    libraryRoot.animate([{ opacity: 0 }, { opacity: 1 }], opts),
  ];
  await finished(anims);
  anims.forEach((a) => a.cancel());
  backdrop.style.opacity = '0';
}
