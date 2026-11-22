// Page layouts (11/21): ready-made arrangements of photo slots and notes, so a blank page is easy to start.
// A photo slot is an empty photo ("+ Add photo"); fill it by double-clicking it, choosing a photo from the
// Selected card, or dropping a photo on it. Positions are % of one page (pages are 3:4).

export const LAYOUTS = [
  {
    id: 'big', name: 'Big photo',
    items: [
      { type: 'photo', x: 8, y: 7, width: 84, aspect: 0.92, rotation: 0 },
      { type: 'text', x: 10, y: 72, width: 80, align: 'center' },
    ],
  },
  {
    id: 'two', name: 'Two photos',
    items: [
      { type: 'photo', x: 6, y: 6, width: 58, aspect: 0.8, rotation: -3 },
      { type: 'photo', x: 36, y: 44, width: 58, aspect: 0.8, rotation: 3 },
    ],
  },
  {
    id: 'grid', name: 'Grid of four',
    items: [
      { type: 'photo', x: 7, y: 7, width: 41, aspect: 1, rotation: 0 },
      { type: 'photo', x: 52, y: 7, width: 41, aspect: 1, rotation: 0 },
      { type: 'photo', x: 7, y: 41, width: 41, aspect: 1, rotation: 0 },
      { type: 'photo', x: 52, y: 41, width: 41, aspect: 1, rotation: 0 },
      { type: 'text', x: 10, y: 78, width: 80, align: 'center' },
    ],
  },
  {
    id: 'caption', name: 'Photo + caption',
    items: [
      { type: 'photo', x: 10, y: 8, width: 80, aspect: 0.78, rotation: -1 },
      { type: 'text', x: 12, y: 62, width: 76, label: 'paper', align: 'center', size: 8 },
    ],
  },
  {
    id: 'collage', name: 'Collage',
    items: [
      { type: 'photo', x: 5, y: 6, width: 48, aspect: 0.8, rotation: -5 },
      { type: 'photo', x: 47, y: 22, width: 48, aspect: 0.8, rotation: 4 },
      { type: 'photo', x: 10, y: 50, width: 48, aspect: 0.8, rotation: 2 },
    ],
  },
  {
    id: 'notes', name: 'Photo + notes',
    items: [
      { type: 'photo', x: 18, y: 6, width: 64, aspect: 0.95, rotation: -3 },
      { type: 'text', x: 10, y: 60, width: 70, label: 'tag' },
      { type: 'text', x: 34, y: 76, width: 56, label: 'tape', align: 'right' },
    ],
  },
];

export const layoutById = (id) => LAYOUTS.find((l) => l.id === id) || null;

// A small drawing of the layout for its button (page = 100 × 133).
export function layoutPreview(layout) {
  const shapes = layout.items.map((it) => {
    if (it.type === 'photo') {
      const h = it.width * it.aspect;
      const cx = it.x + it.width / 2;
      const cy = it.y * 1.333 + h / 2;
      return `<rect x="${it.x}" y="${(it.y * 1.333).toFixed(1)}" width="${it.width}" height="${h.toFixed(1)}" rx="2" transform="rotate(${it.rotation || 0} ${cx.toFixed(1)} ${cy.toFixed(1)})" class="lp-photo"/>`;
    }
    const y = it.y * 1.333 + 4;
    const w = it.width * 0.7;
    const x = it.align === 'center' ? it.x + (it.width - w) / 2 : it.align === 'right' ? it.x + it.width - w : it.x;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="5" rx="2.5" class="lp-text"/>`;
  }).join('');
  return `<svg viewBox="0 0 100 133" aria-hidden="true">${shapes}</svg>`;
}

// For a photo put into a slot: crop it from the middle so it fills the slot's shape.
export function cropToSlot(srcAspect, slotAspect) {
  if (srcAspect > slotAspect) {
    const h = slotAspect / srcAspect;
    return { x: 0, y: (1 - h) / 2, w: 1, h };
  }
  const w = srcAspect / slotAspect;
  return { x: (1 - w) / 2, y: 0, w, h: 1 };
}
