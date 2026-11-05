// Settle It prototype server. No dependencies: run `node server.js`.
// Everyone on the same Wi-Fi opens the printed URL on their phone and lands in one shared group chat.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { mentions, guessCategory } = require('./mentions');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, 'public');
const COLORS = ['#ff6b5a', '#3d8bfd', '#22b07d', '#f5a623', '#a66cff', '#ff5fa2', '#14b8c4', '#8a9a3b'];
const BOT_NAMES = ['Addie', 'Lanie', 'Anthony', 'Jordan', 'Sam', 'Priya'];
const BOT_LINES = ['chipotle?', 'idk anywhere', 'no panda', 'i dont care', 'thai?', 'im down for whatever', 'not pizza again', 'sushi'];
const FILLER = /^(idk|i dont care|i don't care|anywhere|whatever|anything|lol|ok|okay|yes|no|same|wait|hm+|im down.*|i'm down.*|idc|\?+)$/i;
const QUESTION = /^(where|what|when|why|how|who|ok|okay|so|but|guys|not|wait)\b/i;
const SEED_LINES = ['where are we eating', 'chipotle', 'no panda', 'i dont care', 'anywhere', 'ok but WHERE', 'sushi?', 'idk'];
const SUITS = ['♠', '♥', '♦', '♣'];
const FLIP_MS = 12000;

const users = new Map();   // id -> { id, name, color, bot }
const streams = new Map(); // id -> Set(res)
let messages = [];
let game = null;
let timers = [];
const typing = new Set(); // ids of test friends currently "typing"

const now = () => Date.now();
const uid = () => Math.random().toString(36).slice(2, 10);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const nameOf = (id) => (users.get(id) || {}).name || 'Someone';

function later(ms, fn) { timers.push(setTimeout(fn, ms)); }
function clearTimers() { timers.forEach(clearTimeout); timers = []; }

function addMessage(m) {
  m.id = uid();
  m.at = now();
  messages.push(m);
  if (messages.length > 300) messages.shift();
  return m;
}
const system = (text) => addMessage({ type: 'system', text });

const recentTexts = () => messages.filter((m) => m.type === 'chat').slice(-40).map((m) => m.text);

// What's "on the table" per category: only real restaurants / activities / movies people mentioned.
function chatOptions() {
  const texts = recentTexts();
  return { food: mentions('food', texts, 8), plans: mentions('plans', texts, 8), movie: mentions('movie', texts, 8), custom: suggestions() };
}

// Custom category fallback: recent short chat lines.
function suggestions() {
  const seen = new Set();
  const out = [];
  for (const m of [...messages].reverse()) {
    if (m.type !== 'chat') continue;
    const t = m.text.replace(/[.!?,]+$/g, '').trim();
    if (!t || t.length > 24 || t.startsWith('/') || FILLER.test(t) || QUESTION.test(t)) continue;
    const key = t.toLowerCase().replace(/^(no|or|what about|maybe)\s+/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t.replace(/^(no|or|what about|maybe)\s+/i, '').replace(/^./, (c) => c.toUpperCase()));
    if (out.length >= 6) break;
  }
  return out;
}

function publicGame() {
  if (!game) return null;
  const g = { ...game, cards: {} };
  for (const id of Object.keys(game.cards)) {
    if (game.phase !== 'flip' || game.flipped[id]) g.cards[id] = game.cards[id];
  }
  return g;
}

function snapshot() {
  return {
    serverNow: now(),
    users: [...users.values()].map((u) => ({ ...u, online: u.bot || streams.has(u.id) })),
    messages,
    typing: [...typing],
    chatOptions: chatOptions(),
    chatCategory: guessCategory(recentTexts()),
    game: publicGame(),
  };
}

function broadcast() {
  const payload = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const set of streams.values()) for (const res of set) res.write(payload);
}

// ---------- game flow ----------

function startGame(starter, topic, mode, opts = {}) {
  if (game) return;
  clearTimers();
  const lobbyMs = Math.min(30, Math.max(10, Number(opts.joinSecs) || 15)) * 1000;
  const options = (Array.isArray(opts.options) ? opts.options : [])
    .map((o) => String(o).trim().slice(0, 30)).filter(Boolean).slice(0, 8);
  if (mode !== 'quick' && mode !== 'lucky') mode = Math.random() < 0.5 ? 'quick' : 'lucky';
  const msg = addMessage({ type: 'game', from: starter });
  game = {
    id: msg.id, topic: (topic || 'dinner').slice(0, 40), mode, starter,
    phase: 'lobby', lobbyEndsAt: now() + lobbyMs, lobbyMs, options,
    category: ['food', 'movie', 'plans', 'custom'].includes(opts.category) ? opts.category : 'custom',
    players: [starter], active: [], scores: {}, taps: {}, history: [], round: 0,
    cards: {}, flipped: {}, roundWinner: null, tied: null, winner: null, pick: null, suggestions: [],
  };
  later(lobbyMs, beginPlay);
  botsJoin();
}

function joinGame(id) {
  if (!game || game.phase !== 'lobby' || game.players.includes(id)) return;
  game.players.push(id);
}

function beginPlay() {
  if (!game || game.phase !== 'lobby') return;
  clearTimers();
  if (game.players.length < 2) {
    endGame({ cancelled: true, reason: 'Not enough people joined.' });
    return;
  }
  game.players.forEach((id) => { game.scores[id] = 0; });
  game.active = [...game.players];
  if (game.mode === 'quick') startRound(); else startFlip();
}

function endGame(summary) {
  if (!game) return;
  const msg = messages.find((m) => m.id === game.id);
  if (msg) msg.summary = summary;
  clearTimers();
  game = null;
  broadcast();
}

// Quick Draw: wait for green, fastest tap wins the round, first to 2.
function startRound() {
  game.round++;
  game.taps = {};
  game.roundWinner = null;
  game.phase = 'wait';
  game.goAt = null;
  broadcast();
  const gid = game.id;
  const round = game.round;
  botsMaybeEarly(gid, round);
  later(rand(1800, 4500), () => {
    game.phase = 'go';
    game.goAt = now();
    broadcast();
    botsTap(gid, round);
    later(3000, endRound);
  });
}

function tap(id) {
  if (!game || !game.active.includes(id) || id in game.taps) return;
  if (game.phase === 'wait') game.taps[id] = 'early';
  else if (game.phase === 'go') game.taps[id] = now() - game.goAt;
  else return;
  if (game.active.every((p) => p in game.taps)) endRound(); else broadcast();
}

function endRound() {
  if (!game || (game.phase !== 'go' && game.phase !== 'wait')) return;
  clearTimers();
  const valid = Object.entries(game.taps).filter(([, t]) => typeof t === 'number').sort((a, b) => a[1] - b[1]);
  game.roundWinner = valid.length ? valid[0][0] : null;
  if (game.roundWinner) game.scores[game.roundWinner]++;
  game.history.push({ round: game.round, winner: game.roundWinner, ms: valid.length ? valid[0][1] : null });
  game.phase = 'roundEnd';
  broadcast();
  later(2600, () => {
    const top = Math.max(...game.players.map((p) => game.scores[p]));
    const leaders = game.players.filter((p) => game.scores[p] === top);
    if (top >= 2 && leaders.length === 1) return finish(leaders[0]);
    if (game.round >= 3 && top > 0 && leaders.length === 1) return finish(leaders[0]);
    if (game.round >= 7) return finish(pick(leaders));
    if (game.round >= 3 && top > 0) game.active = leaders; // sudden death between whoever is tied
    startRound();
  });
}

// Lucky Draw: everyone flips one card, highest wins, ties redraw.
function startFlip() {
  game.round++;
  game.phase = 'flip';
  game.cards = {};
  game.flipped = {};
  game.roundWinner = null;
  game.tied = null;
  // Deal from one shuffled deck so nobody holds the same card; suit breaks rank ties.
  const deck = [];
  for (let r = 0; r < 13; r++) for (const suit of SUITS) deck.push({ rank: r, suit });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  for (const id of game.active) game.cards[id] = deck.pop();
  game.flipEndsAt = now() + FLIP_MS;
  broadcast();
  botsFlip(game.id, game.round);
  later(FLIP_MS, reveal);
}

function flip(id) {
  if (!game || game.phase !== 'flip' || !game.active.includes(id) || game.flipped[id]) return;
  game.flipped[id] = true;
  if (game.active.every((p) => game.flipped[p])) later(800, reveal);
  broadcast();
}

function reveal() {
  if (!game || game.phase !== 'flip') return;
  clearTimers();
  game.active.forEach((p) => { game.flipped[p] = true; });
  const value = (c) => c.rank * 4 + (3 - SUITS.indexOf(c.suit)); // ♠ > ♥ > ♦ > ♣
  const top = Math.max(...game.active.map((p) => value(game.cards[p])));
  const leaders = game.active.filter((p) => value(game.cards[p]) === top);
  game.phase = 'reveal';
  game.roundWinner = leaders.length === 1 ? leaders[0] : null;
  game.tied = leaders.length > 1 ? leaders : null;
  broadcast();
  later(3000, () => {
    if (leaders.length === 1) return finish(leaders[0]);
    game.active = leaders;
    startFlip();
  });
}

function finish(winner) {
  clearTimers();
  game.phase = 'pick';
  game.winner = winner;
  game.suggestions = game.options.length ? game.options : (chatOptions()[game.category] || suggestions());
  broadcast();
  const w = users.get(winner);
  if (w && w.bot) {
    const gid = game.id;
    setTimeout(() => {
      if (game && game.id === gid) submitPick(winner, pick(game.suggestions.length ? game.suggestions : ['Tacos']));
    }, 2500);
  }
}

function submitPick(id, text) {
  if (!game || game.phase !== 'pick' || id !== game.winner) return;
  text = String(text || '').trim().slice(0, 60);
  if (!text) return;
  game.pick = text;
  game.phase = 'done';
  const summary = { winner: game.winner, topic: game.topic, pick: text, mode: game.mode, players: game.players };
  addMessage({ type: 'settled', ...summary });
  const losers = bots().filter((b) => b.id !== game.winner);
  if (losers.length) botSay(pick(losers), pick(AFTER), 2500);
  broadcast();
  const gid = game.id;
  setTimeout(() => { if (game && game.id === gid) endGame(summary); }, 6000);
}

// ---------- test friends (bots) so one person can try it alone ----------

const bots = () => [...users.values()].filter((u) => u.bot);

function addBot() {
  const taken = new Set([...users.values()].map((u) => u.name));
  const name = BOT_NAMES.find((n) => !taken.has(n)) || `Friend ${users.size + 1}`;
  const u = { id: uid(), name, color: COLORS[users.size % COLORS.length], bot: true };
  users.set(u.id, u);
  system(`${name} (test friend) joined`);
  broadcast();
  botSay(u, pick(BOT_LINES), rand(600, 1500));
}

const GENERIC = ['idk', 'i dont care honestly', 'anywhere is fine', 'what about thai', 'not pizza again', 'sushi?', 'someone just pick', 'lol', 'im so hungry', 'wait where are we going', 'i could do tacos'];
const PUSHBACK = [(x) => `ehh not ${x}`, (x) => `i had ${x} yesterday`, (x) => `${x} is so far tho`, (x) => `${x}?? no`, (x) => `mm idk about ${x}`];
const AFTER = ['ugh fine', 'ok im down', 'rigged', 'lol ok', 'fair', 'whatever lets go'];

// A test friend shows typing dots, then sends a line.
function botSay(bot, text, delay) {
  setTimeout(() => {
    if (!users.has(bot.id) || typing.has(bot.id)) return;
    typing.add(bot.id);
    broadcast();
    setTimeout(() => {
      typing.delete(bot.id);
      if (!users.has(bot.id)) return broadcast();
      addMessage({ type: 'chat', from: bot.id, text });
      broadcast();
    }, rand(1100, 2400) + text.length * 30);
  }, delay);
}

// When a real person texts, one test friend answers (sometimes two).
function botsReply(text) {
  const free = bots().filter((b) => !typing.has(b.id));
  if (!free.length) return;
  const clean = text.replace(/[.!?,]+$/g, '').trim().toLowerCase();
  const isPlace = clean.length <= 18 && clean.split(/\s+/).length <= 3 && !FILLER.test(clean) && !QUESTION.test(clean);
  const shuffled = free.sort(() => Math.random() - 0.5);
  botSay(shuffled[0], isPlace ? pick(PUSHBACK)(clean) : pick(GENERIC), rand(400, 1200));
  if (shuffled[1] && Math.random() < 0.35) botSay(shuffled[1], pick(GENERIC), rand(2600, 4200));
}

function botsJoin() {
  const gid = game.id;
  for (const b of bots()) {
    setTimeout(() => { if (game && game.id === gid) { joinGame(b.id); broadcast(); } }, rand(1500, 6000));
  }
}
function botsTap(gid, round) {
  for (const b of bots()) {
    setTimeout(() => { if (game && game.id === gid && game.round === round && game.phase === 'go') tap(b.id); }, rand(270, 700));
  }
}
function botsMaybeEarly(gid, round) {
  for (const b of bots()) {
    if (Math.random() < 0.1) {
      setTimeout(() => { if (game && game.id === gid && game.round === round && game.phase === 'wait') tap(b.id); }, rand(500, 1500));
    }
  }
}
function botsFlip(gid, round) {
  for (const b of bots()) {
    setTimeout(() => { if (game && game.id === gid && game.round === round) flip(b.id); }, rand(1000, 5000));
  }
}

// ---------- http ----------

function handle(body) {
  const { id, action } = body;
  if (action === 'join') {
    const name = String(body.name || '').trim().slice(0, 20) || 'Guest';
    let u = id && users.get(id);
    if (u) { u.name = name; return { id: u.id }; }
    // Same name coming back (refresh, server restart): reuse that spot instead of duplicating.
    u = [...users.values()].find((x) => !x.bot && !streams.has(x.id) && x.name.toLowerCase() === name.toLowerCase());
    if (u) return { id: u.id };
    u = { id: uid(), name, color: COLORS[users.size % COLORS.length], bot: false };
    users.set(u.id, u);
    system(`${name} joined the chat`);
    return { id: u.id };
  }
  if (!users.has(id)) return { error: 'unknown user' };
  switch (action) {
    case 'chat': {
      const text = String(body.text || '').trim().slice(0, 300);
      if (text) { addMessage({ type: 'chat', from: id, text }); if (!game) botsReply(text); }
      break;
    }
    case 'settle': startGame(id, String(body.topic || '').trim(), body.mode, body); break;
    case 'joinGame': joinGame(id); break;
    case 'startNow': if (game && game.starter === id && game.players.length >= 2) beginPlay(); break;
    case 'cancel': if (game && game.starter === id && game.phase === 'lobby') endGame({ cancelled: true, reason: `${nameOf(id)} cancelled it.` }); break;
    case 'tap': tap(id); break;
    case 'flip': flip(id); break;
    case 'pick': submitPick(id, body.text); break;
    case 'addBot': addBot(); break;
    case 'seed': {
      // Spread a circular "where should we eat" thread across everyone in the chat.
      const people = [...users.values()];
      SEED_LINES.forEach((text, i) => setTimeout(() => {
        addMessage({ type: 'chat', from: people[i % people.length].id, text });
        broadcast();
      }, i * 450));
      break;
    }
    case 'reset':
      clearTimers(); game = null; messages = []; typing.clear();
      for (const u of [...users.values()]) if (u.bot || (!streams.has(u.id) && u.id !== id)) users.delete(u.id);
      system('Chat cleared');
      break;
  }
  return { ok: true };
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/events') {
    const id = url.searchParams.get('id');
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    if (!streams.has(id)) streams.set(id, new Set());
    streams.get(id).add(res);
    res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => {
      clearInterval(ping);
      const set = streams.get(id);
      if (set) { set.delete(res); if (!set.size) streams.delete(id); }
      broadcast();
    });
    broadcast();
    return;
  }
  if (url.pathname === '/api' && req.method === 'POST') {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e5) req.destroy(); });
    req.on('end', () => {
      let out;
      try { out = handle(JSON.parse(data || '{}')); } catch (e) { out = { error: e.message }; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out));
      broadcast();
    });
    return;
  }
  const file = path.join(PUBLIC, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log('\n  Settle It is running\n');
  console.log(`  On this computer:  http://localhost:${PORT}`);
  lan.forEach((ip) => console.log(`  On phones (same Wi-Fi):  http://${ip}:${PORT}`));
  console.log('');
});
