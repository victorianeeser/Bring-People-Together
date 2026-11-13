// Every animation timing and easing lives here, so it's easy to tune.
// Press ` (backtick) to open the dev panel with sliders for these values.

export const DEFAULTS = {
  // Opening a book (transitions.js): the cover pulls up, then flips open
  pullUp: 420,      // cover rises from the shelf to the right-hand page
  coverFlip: 650,   // cover swings open on its spine
  closeScale: 0.8,  // closing plays both steps in reverse at this speed (0.8 = 20% faster)
  pullEase: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  flipEase: 'cubic-bezier(0.45, 0.05, 0.3, 1)',
  dropEase: 'cubic-bezier(0.5, 0, 0.75, 0.3)',

  // The full 3D open (opening.js, turned off for now; total about 1.1s)
  lift: 250,        // Beat 1: cover lifts, other books slide away, background darkens
  turn: 250,        // Beat 2: book turns to show its spine
  fan: 450,         // Beat 3: leaves fan open around the spine
  settle: 150,      // Beat 4: fanned leaves tuck into thin page edges
  stagger: 15,      // delay between leaves in the fan
  fanAngle: 55,     // how far the outer leaves swing out (degrees)
  liftScale: 1.06,
  closeTotal: 800,  // closing plays the same beats in reverse, scaled to this length
  pageTurn: 450,    // turning a page inside the book
  reduced: 200,     // crossfade length when reduced motion is on

  liftEase: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  turnEase: 'cubic-bezier(0.45, 0, 0.55, 1)',
  fanEase: 'cubic-bezier(0.2, 0.9, 0.25, 1.05)',
  settleEase: 'cubic-bezier(0.3, 0.7, 0.2, 1)',
  pageTurnEase: 'cubic-bezier(0.45, 0.05, 0.55, 0.95)',
};

const STORE_KEY = 'scrapbook.animation';
function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}
export const ANIMATION = { ...DEFAULTS, ...loadOverrides() };

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let busy = false;
export const isAnimating = () => busy;
export function setAnimating(value) {
  busy = value;
  document.documentElement.classList.toggle('is-animating', value);
}

// Dev panel
const SLIDERS = [
  ['pullUp', 'Cover pulls up', 100, 1200, 10, 'ms'],
  ['coverFlip', 'Cover flips open', 150, 1500, 10, 'ms'],
  ['closeScale', 'Close speed', 0.4, 1.5, 0.05, '×'],
  ['pageTurn', 'Page turn', 100, 1500, 10, 'ms'],
];

export function initDevPanel() {
  const panel = document.createElement('aside');
  panel.className = 'dev-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Animation dev panel');
  document.body.append(panel);

  const save = () => {
    const changed = Object.fromEntries(Object.keys(DEFAULTS).filter((k) => ANIMATION[k] !== DEFAULTS[k]).map((k) => [k, ANIMATION[k]]));
    try { localStorage.setItem(STORE_KEY, JSON.stringify(changed)); } catch { /* dev convenience only */ }
  };

  function render() {
    panel.innerHTML = `
      <div class="dev-head">
        <h2>Animation</h2>
        <button type="button" class="dev-close" aria-label="Close dev panel">×</button>
      </div>
      <p class="dev-note">Open a book or turn a page to see changes. Press \` to hide.</p>
      ${SLIDERS.map(([key, label, min, max, step, unit]) => `
        <label class="dev-row">
          <span>${label}</span>
          <input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${ANIMATION[key]}">
          <output>${ANIMATION[key]}${unit}</output>
        </label>`).join('')}
      <button type="button" class="dev-reset">Reset to defaults</button>`;
  }

  panel.addEventListener('input', (event) => {
    const key = event.target.dataset.key;
    if (!key) return;
    ANIMATION[key] = Number(event.target.value);
    save();
    const unit = SLIDERS.find((s) => s[0] === key)[5];
    event.target.nextElementSibling.textContent = `${ANIMATION[key]}${unit}`;
  });
  panel.addEventListener('click', (event) => {
    if (event.target.closest('.dev-reset')) {
      Object.assign(ANIMATION, DEFAULTS);
      save();
      render();
    }
    if (event.target.closest('.dev-close')) panel.hidden = true;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== '`') return;
    const t = event.target;
    if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) && !panel.contains(t)) return;
    event.preventDefault();
    if (panel.hidden) render();
    panel.hidden = !panel.hidden;
  });
}
