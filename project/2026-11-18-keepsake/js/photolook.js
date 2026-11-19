// How a photo or video looks on the page (11/18 crit): its crop, frame (polaroid, plain, or a cut-out
// sticker shape) and filter. Used by the page and by the photo editor's preview, so they always match.

export const FILTERS = {
  none: { label: 'Original', css: 'none' },
  warm: { label: 'Warm', css: 'sepia(.22) saturate(1.2) hue-rotate(-8deg) brightness(1.03)' },
  vintage: { label: 'Vintage', css: 'sepia(.45) contrast(.9) brightness(1.06) saturate(.9)' },
  bw: { label: 'B&W', css: 'grayscale(1) contrast(1.1)' },
  faded: { label: 'Faded', css: 'saturate(.65) contrast(.82) brightness(1.12)' },
  rosy: { label: 'Rosy', css: 'sepia(.18) saturate(1.3) hue-rotate(-22deg) brightness(1.04)' },
  film: { label: 'Film', css: 'contrast(1.18) saturate(1.2) brightness(.98)' },
  cool: { label: 'Cool', css: 'saturate(.9) hue-rotate(14deg) brightness(1.04)' },
};

export const FRAMES = {
  polaroid: 'Polaroid',
  plain: 'Plain',
  cutout: 'Cut-out sticker',
};

// Cut-out sticker shapes, drawn in a 100 x 100 box and used as masks.
const SHAPE_SVG = {
  circle: '<circle cx="50" cy="50" r="50"/>',
  rounded: '<rect width="100" height="100" rx="20"/>',
  heart: '<path d="M50 96C34 82 2 62 2 32 2 14 15 3 29 3c10 0 17 5 21 13 4-8 11-13 21-13 14 0 27 11 27 29 0 30-32 50-48 64Z"/>',
  star: '<path d="M50 2l13.6 29.8 32.4 3.6-24.2 22 6.8 32L50 73.2 21.4 89.4l6.8-32L4 35.4l32.4-3.6Z"/>',
  scallop: `<path d="${scallopPath()}"/>`,
};
export const SHAPES = { circle: 'Circle', heart: 'Heart', star: 'Star', scallop: 'Scallop', rounded: 'Rounded' };

function scallopPath() {
  const n = 14, R = 44, r = 7.2;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = 50 + R * Math.cos(a), y = 50 + R * Math.sin(a);
    d += `M${(x + r).toFixed(2)} ${y.toFixed(2)}a${r} ${r} 0 1 0 ${-2 * r} 0a${r} ${r} 0 1 0 ${2 * r} 0`;
  }
  return `${d}M50 8a42 42 0 1 0 0.01 0Z`;
}
// Single quotes: this goes inside a style="..." attribute. encodeURIComponent leaves ' alone, and the SVG has none.
const maskUrl = (shape) => `url('data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">${SHAPE_SVG[shape] || SHAPE_SVG.circle}</svg>`)}')`;

export const cropOf = (item) => {
  const c = item.crop;
  return c && c.w > 0 && c.h > 0 ? c : { x: 0, y: 0, w: 1, h: 1 };
};
// The photo's own shape (height / width) before any crop.
export const srcAspectOf = (item) => item.srcAspect || (item.crop ? (item.aspect * item.crop.w) / item.crop.h : item.aspect) || 0.78;
// How tall the photo is on the page (height / width), after the crop.
export const shownAspect = (srcAspect, crop) => (srcAspect * crop.h) / crop.w;

// The inner HTML for a photo or video (inside .pi-photo), given its media element HTML (an <img> or <video>).
export function photoLookHtml(item, mediaHtml) {
  const crop = cropOf(item);
  const frame = FRAMES[item.frame] ? item.frame : 'polaroid';
  const filter = FILTERS[item.filter]?.css || 'none';
  const ar = shownAspect(srcAspectOf(item), crop);
  // The media is scaled up so only the cropped part shows in the box.
  const media = `<span class="crop-box" style="aspect-ratio:1 / ${ar.toFixed(4)}"><span class="crop-media" style="width:${(100 / crop.w).toFixed(3)}%;left:${(-crop.x / crop.w * 100).toFixed(3)}%;top:${(-crop.y / crop.h * 100).toFixed(3)}%;filter:${filter}">${mediaHtml}</span></span>`;
  if (frame === 'cutout') {
    const m = maskUrl(item.shape);
    return `<span class="photo-frame frame-cutout"><span class="cut-edge" style="-webkit-mask-image:${m};mask-image:${m}"><span class="cut-inner" style="-webkit-mask-image:${m};mask-image:${m}">${media}</span></span></span>`;
  }
  return `<span class="photo-frame frame-${frame}">${media}</span>`;
}
