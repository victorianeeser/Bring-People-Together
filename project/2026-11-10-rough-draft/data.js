// Fixed options, stickers and the demo data the app starts with.

const ME = 'you';
const ME_NAME = 'Hannah';

const CATEGORIES = {
  Adventure: '#A8E2DC',
  Trip: '#BFD4FD',
  Food: '#FFC7B8',
  Chill: '#D9D4F7',
  Creative: '#FBD5F8',
};

const SEASONS = ['Summer', 'Fall', 'Winter', 'Spring', 'Someday'];

const COSTS = ['Free', '$', '$$', '$$$'];

// Stock portraits so the demo people feel real. People invited later show their initial.
const portrait = (path) => `https://randomuser.me/api/portraits/${path}.jpg`;
const unsplash = (id) => `https://images.unsplash.com/photo-${id}?fit=facearea&facepad=2.6&w=120&h=120&q=70`;
const MEMBER_PHOTOS = {
  [ME]: unsplash('1517487313006-d80558d7a5cb'),
  ellie: unsplash('1517256673644-36ad11246d21'),
  priya: unsplash('1624610806209-82a4cbb4339a'),
  chloe: unsplash('1765650113773-0752556dcea0'),
  zoe: unsplash('1649768453000-07c369a51b36'),
  grace: unsplash('1721441932984-93e1bf3a2e9f'),
  lily: unsplash('1610013598025-8e6562cefc4e'),
  mom: portrait('women/14'),
  dad: portrait('men/34'),
  grandma: unsplash('1739932905525-e2cb4ff57b73'),
};

// Stickers are drawn in three layers: a white cut-out edge, a color fill printed a little off, and a wobbly ink line.
const INK = '#1B1A17';
const SPLASH = '#BFD4FD';
const LAGOON = '#A8E2DC';
const SIZZLE = '#FFC7B8';
const SORBET = '#FBD5F8';
const LILAC = '#D9D4F7';
const MIST = '#D3F1EE';
const CHEEK = '#FF9BA8';

const STICKER_COLORS = { Blue: SPLASH, Teal: LAGOON, Peach: SIZZLE, Pink: SORBET, Lilac: LILAC, White: '#FFFFFF' };

function doodle(path, fill, extra = '', viewBox = '0 0 100 100') {
  return `<svg viewBox="${viewBox}" aria-hidden="true">
    <path d="${path}" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="${path}" style="fill:var(--sticker, ${fill})" transform="translate(1.6 2.2)"/>
    <path d="${path}" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    ${extra}
  </svg>`;
}

function face(x, y, size = 1, cheeks = CHEEK) {
  return `<g transform="translate(${x} ${y}) scale(${size})">
    <ellipse cx="-16" cy="4" rx="4.6" ry="3" fill="${cheeks}" opacity=".7"/>
    <ellipse cx="16" cy="4" rx="4.6" ry="3" fill="${cheeks}" opacity=".7"/>
    <circle cx="-9" cy="-2" r="3.4" fill="${INK}"/>
    <circle cx="9" cy="-2" r="3.4" fill="${INK}"/>
    <circle cx="-8" cy="-3.2" r="1.1" fill="#fff"/>
    <circle cx="10" cy="-3.2" r="1.1" fill="#fff"/>
    <path d="M-4.5 3.5C-3 8 3 8 4.5 3.5" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
  </g>`;
}

function wordSticker(label, text, fill, w) {
  const path = `M16 9C${w * 0.35} 6 ${w * 0.65} 11 ${w - 16} 8C${w - 8} 8 ${w - 6} 15 ${w - 6} 24C${w - 4} 36 ${w - 7} 47 ${w - 8} 52C${w - 9} 60 ${w - 14} 60 ${w - 20} 60C${w * 0.65} 63 ${w * 0.35} 58 18 60C10 60 7 56 7 48C5 36 8 23 7 18C7 12 10 9 16 9Z`;
  const word = `<text x="${w / 2}" y="47" text-anchor="middle" transform="rotate(-2 ${w / 2} 34)" font-family="Caveat, cursive" font-weight="700" font-size="42" fill="${INK}">${text}</text>`;
  return { label, w, h: 68, svg: doodle(path, fill, word, `0 0 ${w} 68`) };
}

const STICKERS = {
  star: {
    label: 'Star', w: 100, h: 100,
    svg: doodle('M50 11C53 12 57 27 61 34C66 37 86 36 89 41C90 46 75 57 71 63C71 70 78 86 74 89C69 91 56 80 50 78C43 80 30 91 26 88C22 85 29 69 29 62C25 56 10 46 11 40C14 35 33 37 39 34C43 27 46 12 50 11Z', SORBET, face(50, 54, 0.9)),
  },
  heart: {
    label: 'Heart', w: 100, h: 100,
    svg: doodle('M50 86C37 76 11 59 10 36C10 21 22 12 33 14C41 15 47 21 50 29C54 20 61 13 70 13C82 13 91 24 90 38C88 60 62 77 50 86Z', SIZZLE, face(50, 46, 1)),
  },
  sun: {
    label: 'Sun', w: 108, h: 108,
    svg: doodle('M50 27C63 26 74 37 73 50C73 63 62 74 50 73C37 74 26 63 27 50C27 37 38 27 50 27Z M50 8L51 19 M80 20L73 27 M92 50L81 51 M79 80L72 72 M50 92L50 81 M21 80L28 73 M8 50L19 49 M20 21L28 28', SIZZLE, face(50, 50, 0.85)),
  },
  sparkle: {
    label: 'Sparkle', w: 92, h: 92,
    svg: doodle('M50 9C53 30 62 44 90 50C63 56 54 68 50 91C46 68 37 56 10 50C38 44 47 31 50 9Z M82 16L82 28 M76 22L88 22 M18 74L18 84 M13 79L23 79', SPLASH),
  },
  yay: wordSticker('YAY! label', 'YAY!', SIZZLE, 136),
  flower: {
    label: 'Flower', w: 104, h: 104,
    svg: doodle('M40.6 37.1C30 3 70 3 59.4 37.1C88.5 16.5 100.9 54.5 65.2 54.9C93.8 76.2 61.4 99.8 50 66C38.6 99.8 6.2 76.2 34.8 54.9C-.9 54.5 11.5 16.5 40.6 37.1Z', SORBET, `<circle cx="50" cy="49" r="15" fill="#fff" stroke="${INK}" stroke-width="3"/>${face(50, 49, 0.55)}`),
  },
  smiley: {
    label: 'Smiley', w: 100, h: 100,
    svg: doodle('M50 11C72 10 90 28 89 50C90 72 71 90 50 89C28 90 10 71 11 50C10 28 28 12 50 11Z', LAGOON, face(50, 50, 1.5)),
  },
  moon: {
    label: 'Moon', w: 96, h: 96,
    svg: doodle('M60 10C38 8 14 26 13 52C12 76 33 92 56 90C70 89 83 81 88 70C66 76 44 62 44 41C44 28 50 17 60 10Z M76 22L76 32 M71 27L81 27', SPLASH, `<path d="M20 50c2 3 6 3 8 0M36 56c2 3 6 3 8 0M28 66c2 4 6 4 8 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="20" cy="60" rx="4" ry="2.6" fill="${CHEEK}" opacity=".85"/><ellipse cx="45" cy="66" rx="4" ry="2.6" fill="${CHEEK}" opacity=".85"/>`),
  },
  bolt: {
    label: 'Lightning bolt', w: 92, h: 104,
    svg: doodle('M60 9C47 24 33 41 21 56C30 56 38 55 46 55C43 67 39 79 36 91C51 74 66 57 80 40C71 40 63 41 55 41C57 30 58 20 60 9Z', SIZZLE, face(49, 48, 0.42)),
  },
  crown: {
    label: 'Crown', w: 108, h: 96,
    svg: doodle('M14 78C12 60 10 42 9 28C17 36 26 44 32 47C38 38 44 26 50 15C56 26 62 38 68 47C74 44 84 35 91 27C90 42 88 61 86 78C62 82 38 82 14 78Z', LAGOON, `<circle cx="50" cy="14" r="5" fill="${SORBET}" stroke="${INK}" stroke-width="2.6"/><circle cx="9" cy="27" r="4.4" fill="${SIZZLE}" stroke="${INK}" stroke-width="2.6"/><circle cx="91" cy="26" r="4.4" fill="${SIZZLE}" stroke="${INK}" stroke-width="2.6"/>${face(50, 63, 0.9)}`),
  },
  balloon: {
    label: 'Balloon', w: 88, h: 112,
    svg: doodle('M50 9C69 8 83 23 82 42C82 60 65 73 50 75C35 73 18 60 18 42C17 23 31 9 50 9Z M50 75L44 82L56 82Z M50 82L45 88 M45 88L52 94', SIZZLE, `<path d="M30 30C32 23 37 19 43 18" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>${face(50, 44, 0.95)}`),
  },
  cloud: {
    label: 'Cloud', w: 112, h: 92,
    svg: doodle('M27 76C14 76 7 67 8 57C9 47 18 41 27 43C29 28 41 20 54 23C65 25 72 33 73 42C84 41 93 49 92 60C91 70 83 77 72 76C58 78 41 78 27 76Z', MIST, face(50, 54, 1)),
  },
  music: {
    label: 'Music notes', w: 96, h: 96,
    svg: doodle('M36 72C36 82 16 86 14 76C12 66 34 60 36 72Z M82 62C82 72 62 76 60 66C58 56 80 50 82 62Z M35 26L82 14L82 28L35 40Z M36 72L35 26 M82 62L82 14', SPLASH),
  },
  bestday: wordSticker('BEST DAY label', 'BEST DAY', LAGOON, 190),
  omg: wordSticker('OMG label', 'OMG', SORBET, 112),
  us: wordSticker('US! label', 'US!', SIZZLE, 96),
};

// Unsplash photos for the demo pages: [photo id, width, height].
const DEMO_PHOTOS = {
  p1: ['1628486930972-c1db82d528da', 800, 600],
  p2: ['1727120279660-5c28b8461609', 800, 600],
  p3: ['1504321946642-8f661bf96ff0', 800, 1000],
  p4: ['1597467151996-ec9a3a097e6c', 800, 1000],
  p5: ['1604882767135-b41fac508fff', 800, 700],
  p6: ['1791064543809-5bde33c40e34', 800, 700],
  p7: ['1513519683267-4ee6761728ac', 800, 600],
  p8: ['1554290999-9052c2d5e559', 800, 900],
  p9: ['1543510518-9d8afe002596', 800, 700],
};

function demoPhoto(id) {
  const [photo, width, height] = DEMO_PHOTOS[id];
  return `https://images.unsplash.com/photo-${photo}?auto=format&fit=crop&w=${width}&h=${height}&q=70`;
}

function daysAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function createSeed() {
  const photo = (id, x, y, rot, z) => ({ id, src: demoPhoto(id), x, y, rot, z });
  const sticker = (id, type, x, y, rot, z) => ({ id, type, x, y, rot, z });

  const roomies = {
    id: 'roomies',
    name: 'The Roomies',
    createdBy: 'ellie',
    members: [
      { id: ME, name: ME_NAME },
      { id: 'ellie', name: 'Ellie' },
      { id: 'priya', name: 'Priya' },
      { id: 'chloe', name: 'Chloe' },
      { id: 'zoe', name: 'Zoe' },
      { id: 'grace', name: 'Grace' },
    ],
    activities: [
      {
        id: 'a1', title: 'Sunrise hike up Bald Hill', addedBy: 'ellie', addedAt: daysAgo(1),
        location: 'Bald Hill trailhead', when: 'Before finals', cost: 'Free', category: 'Adventure',
        notes: 'Leave by 5:30 so we make it to the top. Chloe is bringing a thermos of coffee.',
        inIds: ['ellie', 'chloe', ME, 'grace'], done: false, doneAt: null, page: null,
      },
      {
        id: 'a2', title: 'Weekend at the lake cabin', addedBy: 'chloe', addedAt: daysAgo(3),
        location: "Chloe's family cabin", when: 'Spring 2027', cost: '$$', category: 'Trip',
        notes: 'Sleeps six. We just need to split gas and groceries.',
        inIds: ['chloe', 'priya', 'ellie', 'zoe', 'grace'], done: false, doneAt: null, page: null,
      },
      {
        id: 'a3', title: 'Try every taco truck downtown', addedBy: ME, addedAt: daysAgo(5),
        location: 'Downtown', when: 'Someday', cost: '$', category: 'Food',
        notes: 'One truck a week. We keep a ranking and the loser pays next time.',
        inIds: [ME, 'priya'], done: false, doneAt: null, page: null,
      },
      {
        id: 'a4', title: 'Living room movie marathon', addedBy: 'grace', addedAt: daysAgo(6),
        location: 'Our place', when: 'Over break', cost: 'Free', category: 'Chill',
        notes: 'Everyone picks one movie and nobody is allowed to complain.',
        inIds: ['grace', 'priya', ME, 'chloe'], done: false, doneAt: null, page: null,
      },
      {
        id: 'a5', title: 'Paint pottery together', addedBy: 'zoe', addedAt: daysAgo(9),
        location: 'The Clay Room', when: 'This winter', cost: '$$', category: 'Creative',
        notes: 'Make mugs for each other and do a secret swap.',
        inIds: ['zoe', 'priya'], done: false, doneAt: null, page: null,
      },
      {
        id: 'a6', title: 'Cook a five-course dinner', addedBy: ME, addedAt: daysAgo(12),
        location: 'Our kitchen', when: 'Before graduation', cost: '$$$', category: 'Food',
        notes: 'One person per course, plus one person on dishes.',
        inIds: [ME, 'ellie', 'priya', 'chloe'], done: false, doneAt: null, page: null,
      },
      {
        id: 'd1', title: 'Apple picking at the orchard', addedBy: 'priya', addedAt: daysAgo(60),
        location: 'Hillside Orchard', when: 'Fall', cost: '$', category: 'Adventure',
        notes: 'We came home with far too many apples.',
        inIds: ['priya', ME, 'ellie', 'chloe'], done: true, doneAt: daysAgo(34),
        page: {
          photos: [
            photo('p1', 50, 45, -5, 1),
            photo('p2', 300, 90, 4, 2),
          ],
          stickers: [sticker('s1', 'star', 610, 60, 10, 3), sticker('s2', 'heart', 560, 330, -8, 4)],
          caption: 'Too many apples. Zero regrets.',
          captionPos: { x: 170, y: 440 },
        },
      },
      {
        id: 'd2', title: 'First beach day of the year', addedBy: 'chloe', addedAt: daysAgo(150),
        location: 'Crescent Beach', when: 'Summer', cost: 'Free', category: 'Trip',
        notes: 'The water was freezing and Priya went in anyway.',
        inIds: ['chloe', ME, 'priya', 'ellie', 'zoe'], done: true, doneAt: daysAgo(112),
        page: {
          photos: [
            photo('p3', 70, 60, 3, 1),
            photo('p4', 500, 200, -6, 2),
          ],
          stickers: [sticker('s3', 'sun', 610, 45, 0, 3), sticker('s4', 'yay', 330, 300, -7, 4)],
          caption: 'Priya went in. Priya regretted it.',
          captionPos: { x: 60, y: 480 },
        },
      },
      {
        id: 'd3', title: 'Thrifted outfit challenge', addedBy: 'ellie', addedAt: daysAgo(40),
        location: 'Second Street Thrift', when: 'Someday', cost: '$', category: 'Creative',
        notes: 'Ten dollars each. Pick an outfit for the person on your left.',
        inIds: ['ellie', ME, 'chloe'], done: true, doneAt: daysAgo(15),
        page: {
          photos: [
            photo('p5', 90, 70, -3, 1),
            photo('p6', 430, 160, 5, 2),
          ],
          stickers: [sticker('s5', 'sparkle', 330, 40, 8, 3), sticker('s6', 'star', 80, 330, -12, 4)],
          caption: 'Best dressed: nobody. Most fun: everybody.',
          captionPos: { x: 200, y: 470 },
        },
      },
    ],
  };

  const family = {
    id: 'family',
    name: 'Family',
    createdBy: 'mom',
    members: [
      { id: ME, name: ME_NAME },
      { id: 'mom', name: 'Mom' },
      { id: 'dad', name: 'Dad' },
      { id: 'lily', name: 'Lily' },
      { id: 'grandma', name: 'Grandma' },
    ],
    activities: [
      {
        id: 'f1', title: "Learn Grandma's pie recipe", addedBy: 'grandma', addedAt: daysAgo(2),
        location: "Grandma's kitchen", when: 'Over break', cost: '$', category: 'Food',
        notes: 'She says it is not written down anywhere, so someone should take notes.',
        inIds: ['grandma', ME, 'lily'], done: false, doneAt: null, page: null,
      },
      {
        id: 'f2', title: 'Road trip to the Grand Canyon', addedBy: 'dad', addedAt: daysAgo(8),
        location: 'Arizona', when: 'Summer 2027', cost: '$$$', category: 'Trip',
        notes: 'Dad wants to drive the whole way. Everyone else is unsure.',
        inIds: ['dad', 'mom'], done: false, doneAt: null, page: null,
      },
      {
        id: 'f3', title: 'Family photo day', addedBy: 'mom', addedAt: daysAgo(11),
        location: 'The backyard', when: 'This winter', cost: 'Free', category: 'Creative',
        notes: 'No matching outfits this time.',
        inIds: ['mom', 'grandma', ME, 'lily', 'dad'], done: false, doneAt: null, page: null,
      },
      {
        id: 'f4', title: 'Puzzle night, no phones', addedBy: ME, addedAt: daysAgo(15),
        location: 'Living room', when: 'Someday', cost: 'Free', category: 'Chill',
        notes: 'Thousand pieces. We finish it or nobody goes to bed.',
        inIds: [ME, 'lily'], done: false, doneAt: null, page: null,
      },
      {
        id: 'f5', title: 'Bake holiday cookies', addedBy: 'lily', addedAt: daysAgo(330),
        location: 'Home', when: 'December', cost: '$', category: 'Food',
        notes: 'Six batches and one fire alarm.',
        inIds: ['lily', 'mom', ME, 'grandma'], done: true, doneAt: daysAgo(320),
        page: {
          photos: [photo('p7', 80, 70, -4, 1)],
          stickers: [sticker('s7', 'heart', 340, 90, 8, 2), sticker('s8', 'omg', 420, 270, -6, 3)],
          caption: 'Six batches. One fire alarm.',
          captionPos: { x: 340, y: 400 },
        },
      },
      {
        id: 'f6', title: 'Camping at the lake', addedBy: 'dad', addedAt: daysAgo(200),
        location: 'Pine Lake', when: 'Summer', cost: '$', category: 'Adventure',
        notes: 'The tent held up. Dad did not.',
        inIds: ['dad', 'lily', ME], done: true, doneAt: daysAgo(100),
        page: {
          photos: [photo('p8', 500, 60, 5, 1), photo('p9', 120, 150, -3, 2)],
          stickers: [sticker('s9', 'moon', 390, 40, 0, 3), sticker('s10', 'crown', 60, 60, -10, 4)],
          caption: 'The tent held up. Dad did not.',
          captionPos: { x: 180, y: 490 },
        },
      },
    ],
  };

  const makers = { d1: 'priya', d2: 'chloe', d3: 'ellie', f5: 'lily', f6: ME };
  [...roomies.activities, ...family.activities].forEach((a) => {
    if (a.page) a.page.createdBy = makers[a.id];
  });

  return upgradeData({ currentGroup: 'roomies', groups: [roomies, family] });
}

const SEED_SEASONS = {
  a1: 'Winter', a2: 'Spring', a4: 'Winter', a5: 'Winter', a6: 'Spring',
  d1: 'Fall', d2: 'Summer',
  f1: 'Winter', f2: 'Summer', f3: 'Winter', f5: 'Winter', f6: 'Summer',
};

function seasonOfMonth(key) {
  if (!key) return 'Someday';
  const month = Number(key.slice(5));
  if (month === 12 || month <= 2) return 'Winter';
  if (month <= 5) return 'Spring';
  return month <= 8 ? 'Summer' : 'Fall';
}

// Fills in anything added since older saves: seasons, text boxes in place of the single caption, and real demo photos.
function upgradeData(data) {
  data.groups.forEach((group) => group.activities.forEach((a) => {
    if (!a.season) a.season = SEED_SEASONS[a.id] || seasonOfMonth(a.month);
    delete a.month;
    if (a.page) {
      a.page.photos.forEach((p) => {
        if (DEMO_PHOTOS[p.id] && !p.src.startsWith('data:image/jpeg')) p.src = demoPhoto(p.id);
      });
    }
    if (a.page && !a.page.texts) {
      const { caption, captionPos, captionZ } = a.page;
      a.page.texts = caption ? [{ id: 'text1', text: caption, x: captionPos.x, y: captionPos.y, rot: 0, z: captionZ || 15 }] : [];
      delete a.page.caption;
      delete a.page.captionPos;
      delete a.page.captionZ;
    }
  }));
  return data;
}
