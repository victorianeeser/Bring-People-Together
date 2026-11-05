// Finds what the group has actually suggested in the chat, per category:
// restaurants / foods, activities, and movies. Each entry is [display name, aliases...].
// Aliases are written lowercase, without apostrophes, with "-", "&" and "." turned into spaces.

const FOOD = [
  ['Chipotle', 'chipotle'], ['Panda Express', 'panda express', 'panda'], ['Chick-fil-A', 'chick fil a', 'chickfila', 'chik fil a'],
  ["McDonald's", 'mcdonalds', 'mcds', 'mcd', 'mickey ds'], ['Taco Bell', 'taco bell'], ['In-N-Out', 'in n out', 'innout'],
  ['Five Guys', 'five guys'], ['Shake Shack', 'shake shack'], ['Sweetgreen', 'sweetgreen', 'sweet green'], ['Cava', 'cava'],
  ['Wingstop', 'wingstop', 'wing stop'], ["Raising Cane's", 'raising canes', 'canes'], ['Subway', 'subway'], ['Starbucks', 'starbucks'],
  ['Dunkin', 'dunkin', 'dunkin donuts'], ["Domino's", 'dominos'], ['Pizza Hut', 'pizza hut'], ['Olive Garden', 'olive garden'],
  ['Cheesecake Factory', 'cheesecake factory'], ['Buffalo Wild Wings', 'buffalo wild wings', 'bdubs', 'bww'], ["Applebee's", 'applebees'],
  ["Chili's", 'chilis'], ['IHOP', 'ihop'], ["Denny's", 'dennys'], ['Waffle House', 'waffle house'], ["Jersey Mike's", 'jersey mikes'],
  ['Panera', 'panera'], ['Qdoba', 'qdoba'], ['Popeyes', 'popeyes'], ['KFC', 'kfc'], ["Wendy's", 'wendys'], ['Burger King', 'burger king'],
  ['Sonic', 'sonic'], ['Jack in the Box', 'jack in the box'], ["P.F. Chang's", 'p f changs', 'pf changs'], ['Benihana', 'benihana'],
  ['Cracker Barrel', 'cracker barrel'], ['Texas Roadhouse', 'texas roadhouse'], ['Red Robin', 'red robin'],
  ["Dave's Hot Chicken", 'daves hot chicken', 'daves'], ['Crumbl', 'crumbl'], ['Noodles & Co', 'noodles and company', 'noodles and co'],
  ['Korean BBQ', 'korean bbq', 'kbbq'], ['Hot pot', 'hot pot', 'hotpot'], ['Dim sum', 'dim sum'], ['Ice cream', 'ice cream'],
  ['Sushi', 'sushi'], ['Thai', 'thai'], ['Tacos', 'tacos', 'taco'], ['Pizza', 'pizza'], ['Ramen', 'ramen'], ['Pho', 'pho'],
  ['Indian', 'indian'], ['Mexican', 'mexican'], ['Chinese', 'chinese'], ['Korean', 'korean'], ['Italian', 'italian'],
  ['Burgers', 'burgers', 'burger'], ['Wings', 'wings'], ['BBQ', 'bbq', 'barbecue'], ['Boba', 'boba'], ['Poke', 'poke'],
  ['Mediterranean', 'mediterranean'], ['Greek', 'greek'], ['Vietnamese', 'vietnamese'], ['Japanese', 'japanese'],
  ['Brunch', 'brunch'], ['Pasta', 'pasta'], ['Bagels', 'bagels', 'bagel'], ['Seafood', 'seafood'], ['Steak', 'steak', 'steakhouse'],
  ['Halal', 'halal'], ['Dumplings', 'dumplings'], ['Fried chicken', 'fried chicken'], ['Salad', 'salad'], ['Sandwiches', 'sandwiches'],
];

const PLANS = [
  ['Bowling', 'bowling'], ['Mini golf', 'mini golf', 'minigolf', 'putt putt'], ['Karaoke', 'karaoke'],
  ['Movies', 'movies', 'movie theater', 'the movies', 'see a movie', 'watch a movie'], ['Hike', 'hike', 'hiking'],
  ['Beach', 'beach'], ['Park', 'the park', 'park'], ['Escape room', 'escape room'], ['Arcade', 'arcade'],
  ['Ice skating', 'ice skating', 'ice skate'], ['Roller skating', 'roller skating', 'skating rink'],
  ['Trampoline park', 'trampoline park', 'sky zone', 'skyzone'], ['Laser tag', 'laser tag'], ['Go-karts', 'go karts', 'go kart', 'karting'],
  ["Dave & Buster's", 'dave and busters', 'dave busters'], ['Topgolf', 'topgolf', 'top golf'], ['Thrifting', 'thrifting', 'thrift'],
  ['Mall', 'mall'], ['Shopping', 'shopping'], ['Game night', 'game night', 'board games'], ['Party', 'party', 'a party'],
  ['Bar', 'bar', 'bars', 'drinks'], ['Club', 'club', 'clubbing', 'going out'], ['Concert', 'concert', 'concerts'], ['Museum', 'museum'],
  ['Zoo', 'zoo'], ['Aquarium', 'aquarium'], ['Gym', 'gym', 'work out', 'workout'], ['Pickleball', 'pickleball'],
  ['Basketball', 'basketball', 'hoop', 'hoops'], ['Volleyball', 'volleyball'], ['Study', 'study', 'studying', 'library'],
  ['Coffee', 'coffee', 'cafe'], ['Picnic', 'picnic'], ['Bonfire', 'bonfire'], ['Road trip', 'road trip'], ['Drive', 'drive', 'go for a drive'],
  ['Farmers market', 'farmers market'], ['Paint night', 'paint night', 'painting'], ['Pottery', 'pottery'],
  ['Climbing', 'climbing', 'bouldering', 'rock climbing'], ['Yoga', 'yoga'], ['Pool', 'pool', 'swimming', 'swim'],
  ['Stay in', 'stay in', 'staying in', 'stay home', 'netflix'], ['Walk', 'walk', 'go on a walk'],
];

const MOVIES = [
  ['Barbie', 'barbie'], ['Oppenheimer', 'oppenheimer'], ['Dune', 'dune'], ['Wicked', 'wicked'], ['Inside Out', 'inside out'],
  ['Deadpool', 'deadpool'], ['Spider-Man', 'spider man', 'spiderman'], ['Shrek', 'shrek'], ['Mean Girls', 'mean girls'],
  ['Twilight', 'twilight'], ['Harry Potter', 'harry potter'], ['Star Wars', 'star wars'], ['Frozen', 'frozen'], ['Toy Story', 'toy story'],
  ['The Notebook', 'the notebook'], ['Interstellar', 'interstellar'], ['Moana', 'moana'], ['Avatar', 'avatar'],
  ['A Minecraft Movie', 'minecraft movie', 'minecraft'], ['Superman', 'superman'], ['Batman', 'batman', 'the batman'],
  ['Zootopia', 'zootopia'], ['Mission: Impossible', 'mission impossible'], ['Top Gun', 'top gun'], ['The Lion King', 'lion king'],
  ['Titanic', 'titanic'], ['Lilo & Stitch', 'lilo and stitch', 'stitch'], ['Mamma Mia', 'mamma mia', 'mama mia'],
  ['Pitch Perfect', 'pitch perfect'], ['Clueless', 'clueless'], ['La La Land', 'la la land'], ['Get Out', 'get out'],
  ['Scream', 'scream'], ['The Conjuring', 'conjuring'], ['Hereditary', 'hereditary'], ['Knives Out', 'knives out'],
  ['Avengers', 'avengers', 'endgame'], ['Marvel', 'marvel'], ['Ratatouille', 'ratatouille'], ['Cars', 'cars'], ['Up', 'up'],
  ['Elf', 'elf'], ['Home Alone', 'home alone'], ['The Grinch', 'grinch'], ['Coraline', 'coraline'], ['Tangled', 'tangled'],
  ['Encanto', 'encanto'], ['Despicable Me', 'despicable me', 'minions'], ['Jurassic Park', 'jurassic park', 'jurassic world'],
  ['Fast & Furious', 'fast and furious', 'fast and the furious'], ['John Wick', 'john wick'], ['The Hunger Games', 'hunger games'],
  ['Studio Ghibli', 'ghibli', 'spirited away', 'totoro', 'howls moving castle'], ['Horror movie', 'horror movie', 'horror', 'something scary'],
  ['Rom-com', 'rom com', 'romcom', 'romantic comedy'], ['Comedy', 'comedy', 'something funny'], ['Action movie', 'action movie'],
];
// "Up", "Cars" and "Elf" only count as movies when someone says watch/see them, so "up" in "pick me up" doesn't.
const MOVIE_STRICT = new Set(['Up', 'Cars', 'Elf', 'Scream', 'Frozen', 'Tangled']);

const LEX = { food: FOOD, plans: PLANS, movie: MOVIES };

const norm = (t) => ` ${t.toLowerCase().replace(/[’']/g, '').replace(/[-&./]/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;

// Longest aliases first, so "pizza hut" wins over "pizza" and "panda express" over "panda".
function compile(entries) {
  const list = [];
  for (const [display, ...aliases] of entries) for (const a of aliases) list.push({ display, alias: a });
  list.sort((x, y) => y.alias.length - x.alias.length);
  return list.map((e) => ({ ...e, re: new RegExp(` ${e.alias.replace(/ /g, ' ')} `) }));
}
const COMPILED = Object.fromEntries(Object.entries(LEX).map(([k, v]) => [k, compile(v)]));

const WATCH = /\b(?:watch|see|rewatch|watching|seeing)\s+(?!(?:a|the|some|any)?\s*(?:movie|film|thing|something|anything|it|that|this|smth|what|them|you|u|ya)\b)([a-z0-9 ]{2,40})/;
const STOP = /\b(tonight|today|tmrw|tomorrow|again|or|and|instead|lol|lmao|maybe|pls|please|with|at|then|later|now)\b.*$/;

function findIn(category, text) {
  const out = [];
  let t = norm(text);
  if (category === 'movie') {
    const m = norm(text).match(WATCH);
    if (m) {
      const title = m[1].replace(STOP, '').trim().split(' ').slice(0, 4).join(' ');
      const known = COMPILED.movie.find((e) => ` ${title} `.includes(` ${e.alias} `));
      if (known) out.push({ at: 0, name: known.display });
      else if (title.length >= 2) out.push({ at: 0, name: title.replace(/\b[a-z]/g, (c) => c.toUpperCase()) });
    }
  }
  for (const e of COMPILED[category] || []) {
    const i = t.search(e.re);
    if (i < 0) continue;
    if (category === 'movie' && MOVIE_STRICT.has(e.display)) continue;
    out.push({ at: i, name: e.display });
    t = t.slice(0, i) + ' '.repeat(e.alias.length + 1) + t.slice(i + e.alias.length + 1);
  }
  return out.sort((a, b) => a.at - b.at).map((o) => o.name);
}

// Returns up to `max` of the most recent distinct mentions, oldest first.
function mentions(category, texts, max = 6) {
  const seen = new Map();
  texts.forEach((text, i) => {
    for (const name of findIn(category, text)) {
      const k = name.toLowerCase();
      seen.delete(k);
      seen.set(k, { name, i });
    }
  });
  return [...seen.values()].slice(-max).map((v) => v.name);
}

// Which category is the chat arguing about right now? Whichever was mentioned most recently; food if nothing.
function guessCategory(texts) {
  for (let i = texts.length - 1; i >= 0; i--) {
    for (const c of ['food', 'plans', 'movie']) if (findIn(c, texts[i]).length) return c;
  }
  return 'food';
}

module.exports = { mentions, guessCategory };
