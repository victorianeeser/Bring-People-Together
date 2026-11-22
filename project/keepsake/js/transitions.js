// Opening a book: the cover pulls up out of the library to where the right-hand page will be,
// then flips open on its spine. The back of the cover lands as the left page of the first spread.
// Closing plays it in reverse. Timings live in ANIMATION (animation.js).

import { ANIMATION as A, reducedMotion } from './animation.js';

const finished = (animations) => Promise.all(animations.map((a) => a.finished));

function bookParts(bookRoot) {
  return {
    area: bookRoot.querySelector('.spread-area'),
    leftPage: bookRoot.querySelector('.page.left'),
    rightPage: bookRoot.querySelector('.page.right'),
    chrome: [...bookRoot.querySelectorAll('.book-top, .turn-controls')],
  };
}

// Same values as --book-edges and --drop-shadow in styles.css, divided by `scale`, so a
// shadow on an element shrunk by `scale` looks exactly like the shadow on the shelf.
function shelfShadow(scale) {
  const edges = ['#EFEBE2', '#DCD6C9', '#EFEBE2', '#D6CFC0', '#EFEBE2', '#C9C1B1']
    .map((c, i) => `${(i + 1) / scale}px ${(i + 1) / scale}px 0 ${c}`);
  return [...edges, `0 ${28 / scale}px ${46 / scale}px ${-14 / scale}px rgba(20, 24, 40, 0.38)`].join(', ');
}

// The flipping cover: front is the cover art, back is the left page of the spread.
// Shadows are separate layers so they never rotate with the cover:
//   card-shadow.start / .end  the closed book's shadow (shelf-sized, then full-sized)
//   flip-shadow               the left page's shadow, which fades in as the cover lands
function buildCard(coverEl, leftPage, rightRect, leftRect, startScale) {
  const layer = document.createElement('div');
  layer.className = 'flip-layer';
  const leftShadow = document.createElement('div');
  leftShadow.className = 'flip-shadow';
  leftShadow.style.cssText = `left:${leftRect.left}px;top:${leftRect.top}px;width:${leftRect.width}px;height:${leftRect.height}px;opacity:0`;
  const card = document.createElement('div');
  card.className = 'flip-card';
  card.style.cssText = `left:${rightRect.left}px;top:${rightRect.top}px;width:${rightRect.width}px;height:${rightRect.height}px`;
  const cover = coverEl.querySelector('.cover').cloneNode(true);
  card.innerHTML = `
    <span class="card-shadow start" style="box-shadow:${shelfShadow(startScale)};transform:translateZ(-1px)"></span>
    <span class="card-shadow end" style="opacity:0;transform:translateZ(-1px)"></span>
    <div class="flip-face front"><span class="shade" aria-hidden="true"></span></div>
    <div class="flip-face back page"><div class="page-inner">${leftPage.querySelector('.page-inner').innerHTML}</div><span class="shade" aria-hidden="true"></span></div>`;
  card.querySelector('.flip-face.front').prepend(cover);
  layer.append(leftShadow, card);
  return {
    layer,
    card,
    leftShadow,
    startShadow: card.querySelector('.card-shadow.start'),
    endShadow: card.querySelector('.card-shadow.end'),
  };
}

// Where the card starts: shrunk onto the cover in the library, pivoting on its spine (left edge).
const shelfScale = (coverEl, rightRect) => coverEl.getBoundingClientRect().height / rightRect.height;
function onCover(coverEl, rightRect) {
  const cover = coverEl.getBoundingClientRect();
  const scale = shelfScale(coverEl, rightRect);
  const dx = cover.left - rightRect.left;
  const dy = cover.top + cover.height / 2 - (rightRect.top + rightRect.height / 2);
  return `translate(${dx}px, ${dy}px) scale(${scale})`;
}

const fade = (el, from, to, opts) => el.animate([{ opacity: from }, { opacity: to }], opts);
function settle(el, opacity) {
  el.getAnimations().forEach((a) => a.cancel());
  el.style.opacity = String(opacity);
}

const shadeFrames = (front) => (front
  ? [{ opacity: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 0.51 }, { opacity: 0 }]
  : [{ opacity: 0 }, { opacity: 0, offset: 0.49 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }]);

// Play keyframes backwards (offsets have to be mirrored too).
const reversed = (frames) => [...frames].reverse().map((f) => ('offset' in f ? { ...f, offset: 1 - f.offset } : f));

export async function openTransition({ coverEl, libraryRoot, bookRoot, backdrop }) {
  const { area, leftPage, rightPage, chrome } = bookParts(bookRoot);
  bookRoot.style.visibility = 'visible';

  if (reducedMotion() || !coverEl || !area) {
    const opts = { duration: A.reduced, easing: 'ease-out', fill: 'both' };
    const anims = [
      backdrop.animate([{ opacity: 0 }, { opacity: 1 }], opts),
      libraryRoot.animate([{ opacity: 1 }, { opacity: 0 }], opts),
      bookRoot.animate([{ opacity: 0 }, { opacity: 1 }], opts),
    ];
    await finished(anims);
    anims.forEach((a) => a.cancel());
    backdrop.style.opacity = '1';
    return;
  }

  const rightRect = rightPage.getBoundingClientRect();
  const { layer, card, leftShadow, startShadow, endShadow } = buildCard(coverEl, leftPage, rightRect, leftPage.getBoundingClientRect(), shelfScale(coverEl, rightRect));
  document.body.append(layer);
  coverEl.style.visibility = 'hidden';
  // Keep the book view out of sight until the cover is in place.
  area.style.opacity = '0';
  chrome.forEach((el) => { el.style.opacity = '0'; });

  // 1. Pull up: the cover rises from the shelf to the right-hand page.
  const pull = { duration: A.pullUp, easing: A.pullEase, fill: 'both' };
  await finished([
    card.animate([{ transform: onCover(coverEl, rightRect) }, { transform: 'none' }], pull),
    fade(startShadow, 1, 0, pull),
    fade(endShadow, 0, 1, pull),
    backdrop.animate([{ opacity: 0 }, { opacity: 1 }], pull),
    libraryRoot.animate([{ opacity: 1 }, { opacity: 0 }], { ...pull, duration: A.pullUp * 0.7, easing: 'ease-out' }),
  ]);

  // 2. Flip: the cover swings open on its spine to reveal the first spread.
  // The right page underneath has the same shadow, so the cover's own shadow hands off to it.
  area.style.opacity = '';
  leftPage.style.opacity = '0';
  leftPage.parentElement.classList.add('left-hidden');
  settle(startShadow, 0);
  settle(endShadow, 0);
  const flip = { duration: A.coverFlip, easing: A.flipEase, fill: 'both' };
  await finished([
    card.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }], flip),
    fade(leftShadow, 0, 1, { ...flip, delay: A.coverFlip * 0.45, duration: A.coverFlip * 0.55, easing: 'ease-in-out' }),
    card.querySelector('.front .shade').animate(shadeFrames(true), flip),
    card.querySelector('.back .shade').animate(shadeFrames(false), flip),
    ...chrome.map((el) => el.animate([{ opacity: 0 }, { opacity: 1 }], { ...flip, delay: A.coverFlip * 0.5, duration: A.coverFlip * 0.5, easing: 'ease-out' })),
  ]);

  leftPage.style.opacity = '';
  leftPage.parentElement.classList.remove('left-hidden');
  chrome.forEach((el) => { el.style.opacity = ''; el.getAnimations().forEach((a) => a.cancel()); });
  layer.remove();
  backdrop.getAnimations().forEach((a) => a.cancel());
  backdrop.style.opacity = '1';
}

export async function closeTransition({ coverEl, libraryRoot, bookRoot, backdrop }) {
  const { area, leftPage, rightPage, chrome } = bookParts(bookRoot);
  libraryRoot.style.visibility = 'visible';
  bookRoot.style.zIndex = '2';

  if (reducedMotion() || !coverEl || !area) {
    const opts = { duration: A.reduced, easing: 'ease-out', fill: 'both' };
    const anims = [
      backdrop.animate([{ opacity: 1 }, { opacity: 0 }], opts),
      bookRoot.animate([{ opacity: 1 }, { opacity: 0 }], opts),
      libraryRoot.animate([{ opacity: 0 }, { opacity: 1 }], opts),
    ];
    await finished(anims);
    anims.forEach((a) => a.cancel());
    backdrop.style.opacity = '0';
    return;
  }

  const rightRect = rightPage.getBoundingClientRect();
  const { layer, card, leftShadow, startShadow, endShadow } = buildCard(coverEl, leftPage, rightRect, leftPage.getBoundingClientRect(), shelfScale(coverEl, rightRect));
  card.style.transform = 'rotateY(-180deg)';
  startShadow.style.opacity = '0';
  leftShadow.style.opacity = '1';
  document.body.append(layer);
  coverEl.style.visibility = 'hidden';
  libraryRoot.style.opacity = '0';
  leftPage.style.opacity = '0';
  leftPage.parentElement.classList.add('left-hidden');

  // 1. Flip shut: the left page swings back over and becomes the cover again.
  const flip = { duration: A.coverFlip * A.closeScale, easing: A.flipEase, fill: 'both' };
  await finished([
    card.animate([{ transform: 'rotateY(-180deg)' }, { transform: 'rotateY(0deg)' }], flip),
    fade(leftShadow, 1, 0, { ...flip, duration: flip.duration * 0.55, easing: 'ease-in-out' }),
    card.querySelector('.front .shade').animate(reversed(shadeFrames(true)), flip),
    card.querySelector('.back .shade').animate(reversed(shadeFrames(false)), flip),
    ...chrome.map((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { ...flip, duration: flip.duration * 0.5, easing: 'ease-out' })),
  ]);
  // The right page's shadow hands back to the closed book's shadow.
  area.style.opacity = '0';
  endShadow.style.opacity = '1';

  // 2. Drop: the closed book settles back onto the shelf.
  const drop = { duration: A.pullUp * A.closeScale, easing: A.dropEase, fill: 'both' };
  libraryRoot.style.opacity = '';
  await finished([
    card.animate([{ transform: 'none' }, { transform: onCover(coverEl, rightRect) }], drop),
    fade(endShadow, 1, 0, drop),
    fade(startShadow, 0, 1, drop),
    backdrop.animate([{ opacity: 1 }, { opacity: 0 }], drop),
    libraryRoot.animate([{ opacity: 0 }, { opacity: 1 }], { ...drop, delay: drop.duration * 0.3, duration: drop.duration * 0.7 }),
  ]);

  coverEl.style.visibility = '';
  layer.remove();
  libraryRoot.getAnimations().forEach((a) => a.cancel());
  backdrop.getAnimations().forEach((a) => a.cancel());
  backdrop.style.opacity = '0';
}
