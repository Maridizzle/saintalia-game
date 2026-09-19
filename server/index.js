// ============================================================
// SAINTALIA -- game server
// Author: Maridizzle
//
// Phase 11a, step 1: the echo socket. Deployed on its own, before any relay
// code exists, to prove three things on the real Railway service:
//
//   1. the service builds and starts from this repo
//   2. the game is served behind APP_PASSWORD
//   3. a WebSocket to /ws survives Railway's proxy
//
// Patterns copied from Maridizzle/saintalia/server.js: Express, HTTP Basic
// Auth on everything, secrets only in env. No database in this step.
//
// WHY THE SOCKET USES A TOKEN AND NOT BASIC AUTH DIRECTLY
// A browser's WebSocket API cannot set an Authorization header, and whether
// a browser reuses cached Basic Auth credentials on the upgrade request is
// not something to bet a gate on. So the page, which is already behind the
// password, asks /api/ws-token for a short-lived single-use token and opens
// the socket with it. Same result, no browser-specific behavior involved.
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

// ---- HTTP -------------------------------------------------
const app = express();
app.use(requireAuth);

app.get('/api/health', (req, res) => res.json({ ok: true, step: '11a-1 echo' }));
app.get('/api/ws-token', (req, res) => res.json({ token: issueSocketToken() }));

app.use(express.static(path.join(__dirname, '..', 'game')));

// ---- WEBSOCKET: ECHO --------------------------------------
// Step 1 only proves the socket works end to end. The relay replaces the
// echo in step 2; the upgrade and token handling below stay as they are.
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
  ws.send(JSON.stringify({ type: 'hello', echo: true }));
  ws.on('message', (data) => ws.send(data.toString()));
});

// Railway injects PORT and routes to whatever binds 0.0.0.0 on it.
server.listen(PORT, '0.0.0.0', () => console.log('SAINTALIA game server on :' + PORT));
