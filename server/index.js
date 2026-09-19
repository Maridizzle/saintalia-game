// ============================================================
// SAINTALIA -- game server
// Author: Maridizzle
//
// Phase 11a + 11b + 11c. Serves the game behind one shared password and
// relays messages between the two players of a room over a WebSocket.
//
// Phase 11b part 2 adds Postgres persistence: named save slots so a game
// survives a server restart and players can come back days later. Each
// role gets a random save token at room creation; rows are gated on it.
//
// Phase 11c adds server-side narration: POST /api/narrate proxies Groq
// with GROQ_API_KEY from env. Neither player needs a key.
//
// Patterns copied from Maridizzle/saintalia/server.js: Express, HTTP Basic
// Auth on everything, secrets only in env. Rooms live in memory and are
// dropped after thirty idle minutes; saves live in Postgres.
//
// WHY THE SOCKET USES A TOKEN AND NOT BASIC AUTH DIRECTLY
// A browser's WebSocket API cannot set an Authorization header, and whether
// a browser reuses cached Basic Auth credentials on the upgrade request is
// not something to bet a gate on. So the page, which is already behind the
// password, asks /api/ws-token for a short-lived single-use token and opens
// the socket with it. Same result, no browser-specific behavior involved.
//
// ROOM MODEL
//   room   a code the client generated (two veil words), lowercase
//   seat   a random id the server hands a client on first join. The client
//          keeps it in memory and presents it again to reconnect. The first
//          seat in a room is the host; the server says so in the welcome.
//   Two seats per room, never more. A message from one seat goes to the
//   other. If the other seat's socket is down, the message waits in a
//   bounded queue and is delivered when that seat reconnects.
//
// RELAY PROTOCOL (client to server)
//   { type:'relay-join', room, mode:'host'|'join', seat:'' | known seat }
//   anything else is forwarded to the other seat untouched
// (server to client)
//   { type:'relay-welcome', room, seat, isHost, peerPresent, reconnect }
//   { type:'relay-refused', reason }   bad-code | room-taken | no-room |
//                                      room-full | not-joined
//   { type:'relay-peer-joined' }       the second seat arrived
//   { type:'relay-peer-dropped' }      the other socket closed
//   { type:'relay-peer-reconnected' }  it came back
// ============================================================

const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;

// ---- DATABASE (PHASE 11b part 2) --------------------------
// If DATABASE_URL is set, connect to Postgres and create the tables on boot.
// If not, everything runs fine; saves just do not persist past a restart.
let db = null;

if (process.env.DATABASE_URL) {
  db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 });
  db.query(`
    CREATE TABLE IF NOT EXISTS saintalia_game (
      room       TEXT NOT NULL,
      role       TEXT NOT NULL,
      slot       TEXT NOT NULL,
      shared     JSONB NOT NULL DEFAULT '{}',
      private    JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (room, role, slot)
    );
    CREATE TABLE IF NOT EXISTS saintalia_tokens (
      room  TEXT NOT NULL,
      role  TEXT NOT NULL,
      token TEXT NOT NULL,
      PRIMARY KEY (room, role)
    );
  `).then(() => console.log('database tables ready'))
    .catch(e => { console.error('database init failed:', e.message); db = null; });
}

// ---- AUTH -------------------------------------------------
// One shared password gates everything: the static game, the API, and the
// socket token. Any username is accepted; only the password matters.
function passwordMatches(header) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  const [scheme, encoded] = (header || '').split(' ');
  const provided = scheme === 'Basic' && encoded
    ? Buffer.from(encoded, 'base64').toString('utf8').split(':').slice(1).join(':')
    : '';
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireAuth(req, res, next) {
  if (!process.env.APP_PASSWORD) {
    console.error('APP_PASSWORD env var not set. Refusing all requests.');
    return res.status(503).send('Server misconfigured: APP_PASSWORD is not set.');
  }
  if (!passwordMatches(req.headers.authorization)) {
    res.set('WWW-Authenticate', 'Basic realm="Saintalia", charset="UTF-8"');
    return res.status(401).send('Authentication required.');
  }
  next();
}

// ---- SOCKET TOKENS ----------------------------------------
// Issued only to a request that already passed Basic Auth. Single use,
// two minute life. Held in memory; there is nothing to persist.
const TOKEN_TTL_MS = 2 * 60 * 1000;
const socketTokens = new Map();   // token -> expiry timestamp

function issueSocketToken() {
  const token = crypto.randomBytes(24).toString('hex');
  socketTokens.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

function consumeSocketToken(token) {
  const expiry = socketTokens.get(token);
  if (!expiry) return false;
  socketTokens.delete(token);
  return expiry > Date.now();
}

setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of socketTokens) if (expiry <= now) socketTokens.delete(token);
}, TOKEN_TTL_MS).unref();

// ---- ROOMS ------------------------------------------------
const ROOM_IDLE_MS = 30 * 60 * 1000;
const ROOM_SWEEP_MS = 5 * 60 * 1000;
const PENDING_CAP = 100;

// code -> { seats: Map<seatId, { ws, pending: [] }>, hostSeat, touched }
const rooms = new Map();

function roomCodeOk(code) {
  return typeof code === 'string' && /^[a-z0-9-]{3,40}$/.test(code);
}

function seatOk(seat) {
  return typeof seat === 'string' && /^[a-f0-9]{24}$/.test(seat);
}

function newSeatId() {
  return crypto.randomBytes(12).toString('hex');
}

function sendJson(ws, obj) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function otherSeatId(room, seatId) {
  for (const id of room.seats.keys()) if (id !== seatId) return id;
  return null;
}

function socketLive(ws) {
  return !!ws && ws.readyState === ws.OPEN;
}

function handleRelayJoin(ws, msg) {
  const code = String(msg.room || '').toLowerCase();
  if (!roomCodeOk(code)) return sendJson(ws, { type: 'relay-refused', reason: 'bad-code' });

  let room = rooms.get(code);
  const mode = msg.mode === 'host' ? 'host' : 'join';
  const wantedSeat = typeof msg.seat === 'string' ? msg.seat : '';

  // A known seat in a known room is a reconnect, whichever mode it claims.
  if (room && wantedSeat && room.seats.has(wantedSeat)) {
    return seatSocket(ws, room, code, wantedSeat, true);
  }

  // A seat for a room this server does not have means the server restarted
  // (every deploy does that) while a game was live. Rooms are memory only,
  // so rebuild the room around the seat the client presents and honor the
  // host status it already knows from its first welcome. Seats are 96 bits
  // of randomness behind the password gate; nobody guesses one.
  if (seatOk(wantedSeat) && (!room || room.seats.size < 2)) {
    if (!room) {
      room = { seats: new Map(), hostSeat: null, touched: Date.now(), saveTokens: {} };
      rooms.set(code, room);
    }
    room.seats.set(wantedSeat, { ws: null, pending: [] });
    if (msg.wasHost === true && !room.hostSeat) room.hostSeat = wantedSeat;
    return seatSocket(ws, room, code, wantedSeat, true);
  }

  if (mode === 'host') {
    // Two hosts picked the same word pair. The client mints another code,
    // the same way it did on PeerJS's unavailable-id.
    if (room) return sendJson(ws, { type: 'relay-refused', reason: 'room-taken' });
    room = { seats: new Map(), hostSeat: null, touched: Date.now(), saveTokens: {} };
    rooms.set(code, room);
    const seatId = newSeatId();
    room.hostSeat = seatId;
    room.seats.set(seatId, { ws: null, pending: [] });
    // PHASE 11b. Generate save tokens for both roles. Stored in memory and
    // in Postgres (if available) so they survive a server restart.
    room.saveTokens.reality = crypto.randomBytes(16).toString('hex');
    room.saveTokens.fantasy = crypto.randomBytes(16).toString('hex');
    if (db) {
      db.query('INSERT INTO saintalia_tokens (room, role, token) VALUES ($1, $2, $3), ($4, $5, $6) ON CONFLICT (room, role) DO UPDATE SET token = EXCLUDED.token',
        [code, 'reality', room.saveTokens.reality, code, 'fantasy', room.saveTokens.fantasy])
        .catch(e => console.error('token persist failed:', e.message));
    }
    return seatSocket(ws, room, code, seatId, false);
  }

  if (!room) return sendJson(ws, { type: 'relay-refused', reason: 'no-room' });
  if (room.seats.size >= 2) return sendJson(ws, { type: 'relay-refused', reason: 'room-full' });
  const seatId = newSeatId();
  room.seats.set(seatId, { ws: null, pending: [] });
  return seatSocket(ws, room, code, seatId, false);
}

function seatSocket(ws, room, code, seatId, isReconnect) {
  const seat = room.seats.get(seatId);

  // A reconnect replaces whatever socket the seat had. Closing the old one
  // with our own code means its close handler knows not to mark the seat
  // empty (it checks seat.ws === ws, which is no longer true).
  if (seat.ws && seat.ws !== ws) {
    try { seat.ws.close(4000, 'replaced'); } catch (e) { /* already gone */ }
  }
  seat.ws = ws;
  ws.saintaliaRoom = code;
  ws.saintaliaSeat = seatId;
  room.touched = Date.now();

  const otherId = otherSeatId(room, seatId);
  const other = otherId ? room.seats.get(otherId) : null;

  sendJson(ws, {
    type: 'relay-welcome',
    room: code,
    seat: seatId,
    isHost: room.hostSeat === seatId,
    peerPresent: !!(other && socketLive(other.ws)),
    reconnect: isReconnect,
    snapshot: seat.snapshot || null
  });

  // Whatever the other side said while this seat was away.
  const backlog = seat.pending;
  seat.pending = [];
  for (const raw of backlog) ws.send(raw);

  if (other) sendJson(other.ws, { type: isReconnect ? 'relay-peer-reconnected' : 'relay-peer-joined' });
}

function forward(ws, raw) {
  const room = rooms.get(ws.saintaliaRoom);
  if (!room) return;
  room.touched = Date.now();
  const otherId = otherSeatId(room, ws.saintaliaSeat);
  if (!otherId) return;   // alone in the room; nobody to tell
  const target = room.seats.get(otherId);
  if (socketLive(target.ws)) {
    target.ws.send(raw);
  } else {
    target.pending.push(raw);
    if (target.pending.length > PENDING_CAP) target.pending.shift();
  }
}

// PHASE 11b. A seat's snapshot, stored per seat, returned in the welcome on
// a reconnect. Never forwarded to the other seat. Capped at 256 KB so a
// rogue client cannot eat the server's memory.
function handleSnapshot(ws, msg) {
  const room = rooms.get(ws.saintaliaRoom);
  if (!room) return;
  const seat = room.seats.get(ws.saintaliaSeat);
  if (!seat) return;
  const raw = JSON.stringify(msg.data != null ? msg.data : {});
  if (Buffer.byteLength(raw) > 256 * 1024) return;
  seat.snapshot = msg.data;
  room.touched = Date.now();
}

function handleClose(ws) {
  const room = rooms.get(ws.saintaliaRoom);
  if (!room) return;
  const seat = room.seats.get(ws.saintaliaSeat);
  if (!seat || seat.ws !== ws) return;   // already replaced by a reconnect
  seat.ws = null;
  room.touched = Date.now();
  const otherId = otherSeatId(room, ws.saintaliaSeat);
  if (otherId) sendJson(room.seats.get(otherId).ws, { type: 'relay-peer-dropped' });
}

// Rooms nobody has touched in thirty minutes, with both sockets gone, are
// dropped. A room with one live socket is kept however long it waits.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const anyLive = [...room.seats.values()].some(s => socketLive(s.ws));
    if (!anyLive && now - room.touched > ROOM_IDLE_MS) rooms.delete(code);
  }
}, ROOM_SWEEP_MS).unref();

// ---- HTTP -------------------------------------------------
const app = express();
app.use(requireAuth);

app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, step: '11c narrate', rooms: rooms.size }));
app.get('/api/ws-token', (req, res) => res.json({ token: issueSocketToken() }));

// PHASE 11c. Server-side narration. The server holds GROQ_API_KEY so neither
// player needs to enter one. The client POSTs { system, userMsg, maxTokens }
// and gets back { text } or { text: null } on failure. One in-flight call per
// room prevents a double-fire from both sides choosing at the same instant.
const GROQ_NARRATE_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_NARRATE_MODEL = 'llama-3.3-70b-versatile';
const narrateInFlight = new Map();

app.post('/api/narrate', async (req, res) => {
  const { system, userMsg, maxTokens, room } = req.body || {};
  if (!userMsg) return res.status(400).json({ error: 'missing-userMsg', text: null });

  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(503).json({ error: 'no-groq-key', text: null });

  const roomKey = room || '_global';
  if (narrateInFlight.get(roomKey)) {
    return res.status(429).json({ error: 'narration-in-flight', text: null });
  }
  narrateInFlight.set(roomKey, true);

  try {
    const messages = system
      ? [{ role: 'system', content: system }, { role: 'user', content: userMsg }]
      : [{ role: 'user', content: userMsg }];

    const resp = await fetch(GROQ_NARRATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify({
        model: GROQ_NARRATE_MODEL,
        max_tokens: maxTokens || 800,
        temperature: 0.88,
        messages
      })
    });

    const data = await resp.json();
    if (data.error) {
      console.warn('[narrate] Groq error:', data.error.message);
      return res.json({ text: null });
    }
    return res.json({ text: data.choices[0].message.content });
  } catch (e) {
    console.warn('[narrate] fetch failed:', e.message);
    return res.json({ text: null });
  } finally {
    narrateInFlight.delete(roomKey);
  }
});

// PHASE 11b part 2. Save token retrieval. The client asks after it knows its
// room and role. Returns the token for that role only.
app.get('/api/save-token', async (req, res) => {
  const room = String(req.query.room || '').toLowerCase();
  const role = String(req.query.role || '').toLowerCase();
  if (!roomCodeOk(room) || (role !== 'reality' && role !== 'fantasy')) {
    return res.status(400).json({ error: 'bad-request' });
  }
  // Try memory first
  const r = rooms.get(room);
  if (r && r.saveTokens && r.saveTokens[role]) {
    return res.json({ token: r.saveTokens[role] });
  }
  // Try database
  if (db) {
    try {
      const result = await db.query('SELECT token FROM saintalia_tokens WHERE room = $1 AND role = $2', [room, role]);
      if (result.rows.length) return res.json({ token: result.rows[0].token });
    } catch (e) { console.error('token lookup failed:', e.message); }
  }
  return res.status(404).json({ error: 'no-token' });
});

// PHASE 11b part 2. Save and load game state.
app.post('/api/save', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'no-database' });
  const token = req.headers['x-save-token'] || '';
  const { room, role, slot, shared, private: priv } = req.body || {};
  if (!room || !role || !slot || !shared) {
    return res.status(400).json({ error: 'bad-request' });
  }
  const roomLower = String(room).toLowerCase();
  const roleLower = String(role).toLowerCase();
  if (!roomCodeOk(roomLower) || (roleLower !== 'reality' && roleLower !== 'fantasy')) {
    return res.status(400).json({ error: 'bad-request' });
  }
  // Validate the save token
  const valid = await validateSaveToken(roomLower, roleLower, token);
  if (!valid) return res.status(403).json({ error: 'forbidden' });
  try {
    await db.query(
      `INSERT INTO saintalia_game (room, role, slot, shared, private, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (room, role, slot) DO UPDATE
       SET shared = $4, private = $5, updated_at = now()`,
      [roomLower, roleLower, String(slot), JSON.stringify(shared), JSON.stringify(priv || {})]
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error('save failed:', e.message);
    return res.status(500).json({ error: 'save-failed' });
  }
});

app.get('/api/save', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'no-database' });
  const token = req.headers['x-save-token'] || '';
  const room = String(req.query.room || '').toLowerCase();
  const role = String(req.query.role || '').toLowerCase();
  if (!roomCodeOk(room) || (role !== 'reality' && role !== 'fantasy')) {
    return res.status(400).json({ error: 'bad-request' });
  }
  const valid = await validateSaveToken(room, role, token);
  if (!valid) return res.status(403).json({ error: 'forbidden' });
  try {
    const result = await db.query(
      'SELECT slot, shared, private, updated_at FROM saintalia_game WHERE room = $1 AND role = $2 ORDER BY updated_at DESC',
      [room, role]
    );
    return res.json({ saves: result.rows });
  } catch (e) {
    console.error('load failed:', e.message);
    return res.status(500).json({ error: 'load-failed' });
  }
});

async function validateSaveToken(room, role, token) {
  if (!token) return false;
  // Check memory
  const r = rooms.get(room);
  if (r && r.saveTokens && r.saveTokens[role]) {
    return crypto.timingSafeEqual(Buffer.from(r.saveTokens[role]), Buffer.from(token));
  }
  // Check database
  if (!db) return false;
  try {
    const result = await db.query('SELECT token FROM saintalia_tokens WHERE room = $1 AND role = $2', [room, role]);
    if (!result.rows.length) return false;
    const stored = Buffer.from(result.rows[0].token);
    const given = Buffer.from(token);
    return stored.length === given.length && crypto.timingSafeEqual(stored, given);
  } catch (e) { return false; }
}

app.use(express.static(path.join(__dirname, '..', 'game')));

// ---- WEBSOCKET: RELAY -------------------------------------
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/ws') { socket.destroy(); return; }
  if (!consumeSocketToken(url.searchParams.get('token') || '')) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data) => {
    const raw = data.toString();
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'relay-join') return handleRelayJoin(ws, msg);
    if (!ws.saintaliaRoom) return sendJson(ws, { type: 'relay-refused', reason: 'not-joined' });
    if (msg.type === 'relay-snapshot') return handleSnapshot(ws, msg);
    forward(ws, raw);
  });

  ws.on('close', () => handleClose(ws));
  ws.on('error', () => { /* close follows */ });
});

// Protocol-level ping every thirty seconds. A socket that misses one is
// terminated, which fires its close handler and tells the other seat.
// Railway does not idle out WebSockets, but a phone that lost signal does
// not say goodbye either.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30 * 1000).unref();

// Railway injects PORT and routes to whatever binds 0.0.0.0 on it.
server.listen(PORT, '0.0.0.0', () => console.log('SAINTALIA game server on :' + PORT));
