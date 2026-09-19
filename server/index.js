// ============================================================
// SAINTALIA -- game server
// Author: Maridizzle
//
// Phase 11a. Serves the game behind one shared password and relays messages
// between the two players of a room over a WebSocket. The server does not
// parse game messages; it forwards them verbatim. Step 1 was an echo on the
// same socket, deployed first to prove the socket survives Railway's proxy.
// It did, on 2026-09-19.
//
// Patterns copied from Maridizzle/saintalia/server.js: Express, HTTP Basic
// Auth on everything, secrets only in env. No database in 11a; rooms live in
// memory and are dropped after thirty idle minutes.
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

const PORT = process.env.PORT || 3000;

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
      room = { seats: new Map(), hostSeat: null, touched: Date.now() };
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
    room = { seats: new Map(), hostSeat: null, touched: Date.now() };
    rooms.set(code, room);
    const seatId = newSeatId();
    room.hostSeat = seatId;
    room.seats.set(seatId, { ws: null, pending: [] });
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
    reconnect: isReconnect
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

app.get('/api/health', (req, res) => res.json({ ok: true, step: '11a-2 relay', rooms: rooms.size }));
app.get('/api/ws-token', (req, res) => res.json({ token: issueSocketToken() }));

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
