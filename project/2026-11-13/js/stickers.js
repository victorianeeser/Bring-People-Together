// Inline SVG stickers, carried over from the 11/10 rough draft. Each one is drawn in three layers:
// a white cut-out edge, a color fill printed a little off, and a wobbly ink line. Most have a little face.
// Pass a color to recolor the fill (used by the color swatches in the edit panel).

const INK = '#1B1A17';
const BLUE = '#BFD4FD';
const TEAL = '#A8E2DC';
const PEACH = '#FFC7B8';
const PINK = '#FBD5F8';
const LILAC = '#D9D4F7';
const MIST = '#D3F1EE';
const CHEEK = '#FF9BA8';

export const STICKER_COLORS = { Blue: BLUE, Teal: TEAL, Peach: PEACH, Pink: PINK, Lilac: LILAC, White: '#FFFFFF' };

const doodle = (path, fill, extra = '', viewBox = '0 0 100 100') => `<svg viewBox="${viewBox}" aria-hidden="true" focusable="false">
    <path d="${path}" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="${path}" fill="${fill}" transform="translate(1.6 2.2)"/>
    <path d="${path}" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    ${extra}
  </svg>`;

const face = (x, y, size = 1) => `<g transform="translate(${x} ${y}) scale(${size})">
    <ellipse cx="-16" cy="4" rx="4.6" ry="3" fill="${CHEEK}" opacity=".7"/>
    <ellipse cx="16" cy="4" rx="4.6" ry="3" fill="${CHEEK}" opacity=".7"/>
    <circle cx="-9" cy="-2" r="3.4" fill="${INK}"/>
    <circle cx="9" cy="-2" r="3.4" fill="${INK}"/>
    <circle cx="-8" cy="-3.2" r="1.1" fill="#fff"/>
    <circle cx="10" cy="-3.2" r="1.1" fill="#fff"/>
    <path d="M-4.5 3.5C-3 8 3 8 4.5 3.5" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
  </g>`;

// Word labels use plain bold sans for now; branding will bring back a handwriting font.
function word(label, text, fill, w) {
  const path = `M16 9C${w * 0.35} 6 ${w * 0.65} 11 ${w - 16} 8C${w - 8} 8 ${w - 6} 15 ${w - 6} 24C${w - 4} 36 ${w - 7} 47 ${w - 8} 52C${w - 9} 60 ${w - 14} 60 ${w - 20} 60C${w * 0.65} 63 ${w * 0.35} 58 18 60C10 60 7 56 7 48C5 36 8 23 7 18C7 12 10 9 16 9Z`;
  const t = `<text x="${w / 2}" y="44" text-anchor="middle" transform="rotate(-2 ${w / 2} 34)" font-family="Inter, sans-serif" font-weight="800" font-size="28" fill="${INK}">${text}</text>`;
  return { label, svg: (c = fill) => doodle(path, c, t, `0 0 ${w} 68`) };
}

function washi(label, fill) {
  return {
    label,
    svg: (c = fill) => `<svg viewBox="0 0 200 48" aria-hidden="true" focusable="false">
      <path d="M4 6l6-4 6 4 6-4 6 4h140l6-4 6 4 6-4 6 4v36l-6 4-6-4-6 4-6-4H28l-6 4-6-4-6 4-6-4z" fill="${c}" opacity=".82"/>
      <path d="M30 8v32M62 8v32M94 8v32M126 8v32M158 8v32" stroke="#FFFFFF" stroke-width="7" opacity=".45"/></svg>`,
  };
}

const shape = (label, fill, path, extra = '', viewBox) => ({ label, svg: (c = fill) => doodle(path, c, extra, viewBox) });

export const STICKERS = {
  star: shape('Star', PINK, 'M50 11C53 12 57 27 61 34C66 37 86 36 89 41C90 46 75 57 71 63C71 70 78 86 74 89C69 91 56 80 50 78C43 80 30 91 26 88C22 85 29 69 29 62C25 56 10 46 11 40C14 35 33 37 39 34C43 27 46 12 50 11Z', face(50, 54, 0.9)),
  heart: shape('Heart', PEACH, 'M50 86C37 76 11 59 10 36C10 21 22 12 33 14C41 15 47 21 50 29C54 20 61 13 70 13C82 13 91 24 90 38C88 60 62 77 50 86Z', face(50, 46, 1)),
  sun: shape('Sun', PEACH, 'M50 27C63 26 74 37 73 50C73 63 62 74 50 73C37 74 26 63 27 50C27 37 38 27 50 27Z M50 8L51 19 M80 20L73 27 M92 50L81 51 M79 80L72 72 M50 92L50 81 M21 80L28 73 M8 50L19 49 M20 21L28 28', face(50, 50, 0.85)),
  sparkle: shape('Sparkle', BLUE, 'M50 9C53 30 62 44 90 50C63 56 54 68 50 91C46 68 37 56 10 50C38 44 47 31 50 9Z M82 16L82 28 M76 22L88 22 M18 74L18 84 M13 79L23 79'),
  yay: word('YAY! label', 'YAY!', PEACH, 136),
  flower: shape('Flower', PINK, 'M40.6 37.1C30 3 70 3 59.4 37.1C88.5 16.5 100.9 54.5 65.2 54.9C93.8 76.2 61.4 99.8 50 66C38.6 99.8 6.2 76.2 34.8 54.9C-.9 54.5 11.5 16.5 40.6 37.1Z', `<circle cx="50" cy="49" r="15" fill="#fff" stroke="${INK}" stroke-width="3"/>${face(50, 49, 0.55)}`),
  smiley: shape('Smiley', TEAL, 'M50 11C72 10 90 28 89 50C90 72 71 90 50 89C28 90 10 71 11 50C10 28 28 12 50 11Z', face(50, 50, 1.5)),
  moon: shape('Moon', BLUE, 'M60 10C38 8 14 26 13 52C12 76 33 92 56 90C70 89 83 81 88 70C66 76 44 62 44 41C44 28 50 17 60 10Z M76 22L76 32 M71 27L81 27', `<path d="M20 50c2 3 6 3 8 0M36 56c2 3 6 3 8 0M28 66c2 4 6 4 8 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="20" cy="60" rx="4" ry="2.6" fill="${CHEEK}" opacity=".85"/><ellipse cx="45" cy="66" rx="4" ry="2.6" fill="${CHEEK}" opacity=".85"/>`),
  bolt: shape('Lightning bolt', PEACH, 'M60 9C47 24 33 41 21 56C30 56 38 55 46 55C43 67 39 79 36 91C51 74 66 57 80 40C71 40 63 41 55 41C57 30 58 20 60 9Z', face(49, 48, 0.42)),
  crown: shape('Crown', TEAL, 'M14 78C12 60 10 42 9 28C17 36 26 44 32 47C38 38 44 26 50 15C56 26 62 38 68 47C74 44 84 35 91 27C90 42 88 61 86 78C62 82 38 82 14 78Z', `<circle cx="50" cy="14" r="5" fill="${PINK}" stroke="${INK}" stroke-width="2.6"/><circle cx="9" cy="27" r="4.4" fill="${PEACH}" stroke="${INK}" stroke-width="2.6"/><circle cx="91" cy="26" r="4.4" fill="${PEACH}" stroke="${INK}" stroke-width="2.6"/>${face(50, 63, 0.9)}`),
  balloon: shape('Balloon', PEACH, 'M50 9C69 8 83 23 82 42C82 60 65 73 50 75C35 73 18 60 18 42C17 23 31 9 50 9Z M50 75L44 82L56 82Z M50 82L45 88 M45 88L52 94', `<path d="M30 30C32 23 37 19 43 18" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>${face(50, 44, 0.95)}`),
  cloud: shape('Cloud', MIST, 'M27 76C14 76 7 67 8 57C9 47 18 41 27 43C29 28 41 20 54 23C65 25 72 33 73 42C84 41 93 49 92 60C91 70 83 77 72 76C58 78 41 78 27 76Z', face(50, 54, 1)),
  music: shape('Music notes', BLUE, 'M36 72C36 82 16 86 14 76C12 66 34 60 36 72Z M82 62C82 72 62 76 60 66C58 56 80 50 82 62Z M35 26L82 14L82 28L35 40Z M36 72L35 26 M82 62L82 14'),
  bestday: word('BEST DAY label', 'BEST DAY', TEAL, 190),
  omg: word('OMG label', 'OMG', PINK, 112),
  us: word('US! label', 'US!', PEACH, 96),
  // Washi tape (used on a seed page)
  'washi-pink': washi('Pink washi tape', '#F4B6C2'),
  'washi-blue': washi('Blue washi tape', '#AFC8EE'),
  'washi-mint': washi('Mint washi tape', TEAL),
};

// The 16 stickers shown in the edit panel, in order.
export const TRAY = ['star', 'heart', 'sun', 'sparkle', 'yay', 'flower', 'smiley', 'moon', 'bolt', 'crown', 'balloon', 'cloud', 'music', 'bestday', 'omg', 'us'];

export const stickerSvg = (kind, color) => (STICKERS[kind] || STICKERS.star).svg(color || undefined);
