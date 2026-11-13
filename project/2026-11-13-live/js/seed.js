// Demo data. Photos in the seed are soft colored placeholder blocks.

// "You" come from identity.js now (each browser is its own person). The demo books use Hannah instead.
export { ME, ME_NAME } from './identity.js';
const HANNAH = 'hannah';

const member = (id, name, color) => ({ id, name, color });
const MEMBERS = {
  hannah: member(HANNAH, 'Hannah', '#F4A988'),
  maya: member('maya', 'Maya', '#9CC5A1'),
  jordan: member('jordan', 'Jordan', '#8FB3E8'),
  priya: member('priya', 'Priya', '#D7A6E0'),
  sam: member('sam', 'Sam', '#F2CF72'),
};

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();

// Page items: x, y, width are percentages of the page.
let z = 0;
const photo = (x, y, width, rotation, placeholder, aspect = 0.78) =>
  ({ id: `pi-${++z}`, type: 'photo', x, y, width, rotation, z, placeholder, aspect });
const text = (x, y, width, content, font = 'caveat', size = 7, color = '#2B2B2B', rotation = 0) =>
  ({ id: `pi-${++z}`, type: 'text', x, y, width, rotation, z, content, font, size, color });
const sticker = (x, y, width, kind, rotation = 0, color = null) =>
  ({ id: `pi-${++z}`, type: 'sticker', x, y, width, rotation, z, kind, color });

const spread = (id, title, linkedItemId, left, right) =>
  ({ id, title, linkedItemId, leftPage: { items: left }, rightPage: { items: right } });

function roomies() {
  const bucketList = [
    {
      id: 'rb-apple', title: 'Apple picking at the orchard', addedBy: 'priya', addedAt: daysAgo(60),
      location: 'Hillside Orchard', when: 'Early October', cost: '$', category: 'Adventure', season: 'Fall',
      notes: 'Bring bags. Lots of bags.', whosIn: ['priya', HANNAH, 'maya', 'sam'], status: 'done', spreadId: 'rs-apple',
    },
    {
      id: 'rb-thrift', title: 'Thrifted outfit challenge', addedBy: 'maya', addedAt: daysAgo(40),
      location: 'Second Street Thrift', when: 'A Saturday', cost: '$', category: 'Creative', season: 'Fall',
      notes: 'Ten dollars each. Pick an outfit for the person on your left.', whosIn: ['maya', HANNAH, 'jordan'], status: 'done', spreadId: 'rs-thrift',
    },
    {
      id: 'rb-hike', title: 'Sunrise hike up Bald Hill', addedBy: 'jordan', addedAt: daysAgo(3),
      location: 'Bald Hill trailhead', when: 'Before finals', cost: 'Free', category: 'Adventure', season: 'Spring',
      notes: 'Leave by 5:30 so we make it to the top.', whosIn: ['jordan', HANNAH, 'priya', 'sam'], status: 'idea', spreadId: null,
    },
    {
      id: 'rb-cabin', title: 'Weekend at the lake cabin', addedBy: 'sam', addedAt: daysAgo(6),
      location: "Sam's family cabin", when: 'Spring break', cost: '$$', category: 'Trip', season: 'Spring',
      notes: 'Split gas four ways.', whosIn: ['sam', 'maya', 'jordan', 'priya', HANNAH], status: 'idea', spreadId: null,
    },
    {
      id: 'rb-tacos', title: 'Try every taco truck downtown', addedBy: HANNAH, addedAt: daysAgo(8),
      location: 'Downtown', when: 'Someday', cost: '$', category: 'Food', season: 'Summer',
      notes: '', whosIn: [HANNAH, 'sam'], status: 'idea', spreadId: null,
    },
    {
      id: 'rb-movies', title: 'Living room movie marathon', addedBy: 'priya', addedAt: daysAgo(10),
      location: 'Our place', when: 'Over break', cost: 'Free', category: 'Chill', season: 'Winter',
      notes: 'Everyone picks one movie. No vetoes.', whosIn: ['priya', 'maya', HANNAH, 'jordan'], status: 'idea', spreadId: null,
    },
  ];
  return {
    id: 'book-roomies',
    title: 'Friends',
    cover: { type: 'preset', presetId: 'terracotta-dots' },
    members: [MEMBERS.hannah, MEMBERS.maya, MEMBERS.jordan, MEMBERS.priya, MEMBERS.sam],
    hasBucketList: true,
    bucketList,
    spreads: [
      spread('rs-apple', 'Apple picking at the orchard', 'rb-apple',
        [photo(10, 9, 46, -4, '#E7C7B4'), photo(44, 44, 44, 5, '#CFE0C3'), text(12, 80, 70, 'Too many apples. Zero regrets.')],
        [photo(14, 12, 60, 3, '#F1D9A7'), sticker(70, 8, 18, 'star', 12), sticker(64, 62, 16, 'heart', -8), text(12, 72, 72, 'Priya climbed the ladder. Twice.', 'reenie', 8)]),
      spread('rs-thrift', 'Thrifted outfit challenge', 'rb-thrift',
        [photo(12, 10, 52, 3, '#D9CFEA'), sticker(62, 14, 26, 'yay', -10), text(12, 66, 74, 'Best dressed: nobody. Most fun: everybody.', 'caveat', 7)],
        [photo(10, 14, 38, -6, '#F3C9C4', 1.3), photo(50, 22, 38, 5, '#C9DCEB', 1.3), sticker(6, 4, 40, 'washi-pink', -6)]),
    ],
    createdAt: daysAgo(70),
  };
}

function summer() {
  return {
    id: 'book-summer',
    title: "Summer '26",
    cover: { type: 'preset', presetId: 'sun-arch' },
    members: [MEMBERS.hannah, MEMBERS.maya, MEMBERS.priya],
    hasBucketList: false,
    bucketList: [],
    spreads: [
      spread('ss-coast', 'Road trip to the coast', null,
        [photo(8, 10, 70, -2, '#BFD9E8', 0.62), text(10, 62, 76, 'Six hours, one playlist, no regrets.', 'caveat', 7)],
        [photo(18, 12, 54, 4, '#F2DDB3'), sticker(68, 64, 20, 'sun', 0), text(12, 74, 56, 'Day one', 'homemade', 5)]),
      spread('ss-fourth', 'Fourth of July rooftop', null,
        [photo(12, 14, 56, 3, '#E9C2C2'), sticker(66, 8, 20, 'sparkle', 0)],
        [photo(10, 10, 40, -5, '#CBD5EE', 1.25), photo(52, 30, 38, 6, '#F4E1B6', 1.25), text(14, 78, 70, 'Fireworks from the roof!', 'reenie', 8)]),
      spread('ss-last', 'Last night of summer', null,
        [photo(10, 12, 78, -1, '#D6CBE3', 0.66), text(12, 66, 70, 'We stayed out until the sky turned blue again.', 'caveat', 6.5)],
        [sticker(30, 30, 40, 'heart', 6), text(18, 70, 66, 'See you in the fall', 'homemade', 4.5)]),
    ],
    createdAt: daysAgo(150),
  };
}

function movieNights() {
  return {
    id: 'book-movies',
    title: 'Movie Nights',
    cover: { type: 'preset', presetId: 'night-stars' },
    members: [MEMBERS.hannah, MEMBERS.jordan, MEMBERS.sam],
    hasBucketList: false,
    bucketList: [],
    spreads: [
      spread('sm-first', 'The first one', null,
        [photo(10, 12, 64, -3, '#C7CDE6'), sticker(70, 60, 20, 'star', 8), text(10, 74, 76, 'Jordan cried. Jordan denies it.', 'caveat', 7)],
        [text(12, 14, 76, 'Ranking:\n1. The snacks\n2. The movie', 'reenie', 9), photo(30, 52, 50, 5, '#EAD8C7')]),
    ],
    createdAt: daysAgo(30),
  };
}

export function createSeed() {
  z = 0;
  return { version: 1, books: [roomies(), summer(), movieNights()] };
}
