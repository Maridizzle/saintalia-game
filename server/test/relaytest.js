// ============================================================
// SAINTALIA -- relay server test
// Author: Maridizzle
//
//   node server/test/relaytest.js
//
// Starts the real server on a spare port with a throwaway password, then
// drives it with two real WebSocket clients through everything a game
// session does to it: host opens a room, joiner arrives, messages cross
// both ways untouched, the joiner drops and the host's messages wait for
// them, the joiner reconnects on the same seat and gets the backlog, and
// every refusal fires for the right reason. No browser, no phone, no
// Railway. Run it before any push that touches server/index.js.
// ============================================================

const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');

const PORT = 3000 + Math.floor(Math.random() * 2000);
const PASS = 'relaytest-' + Date.now();
const BASE = 'http://127.0.0.1:' + PORT;
const AUTH = 'Basic ' + Buffer.from('player:' + PASS).toString('base64');

let failures = 0;
function check(label, actual, expected) {
  const ok = expected === undefined ? !!actual : actual === expected;
  if (!ok) failures++;
  const detail = expected === undefined ? String(actual)
    : (ok ? String(actual) : String(actual) + '  (expected ' + expected + ')');
  console.log((ok ? '  ok   ' : '  FAIL ') + label.padEnd(34) + detail);
}

// A client that collects every message and lets the test wait for one by type.
async function client() {
  const r = await fetch(BASE + '/api/ws-token', { headers: { Authorization: AUTH } });
  const { token } = await r.json();
  const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws?token=' + token);
  const inbox = [];
  const waiters = [];
  ws.on('message', (d) => {
    const msg = JSON.parse(d.toString());
    inbox.push(msg);
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].type === msg.type) { waiters[i].resolve(msg); waiters.splice(i, 1); }
    }
  });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  return {
    ws, inbox,
    send(obj) { ws.send(JSON.stringify(obj)); },
    next(type, ms) {
      const hit = inbox.find(m => m.type === type);
      if (hit) { inbox.splice(inbox.indexOf(hit), 1); return Promise.resolve(hit); }
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout waiting for ' + type)), ms || 2000);
        waiters.push({ type, resolve: (m) => { clearTimeout(t); inbox.splice(inbox.indexOf(m), 1); resolve(m); } });
      });
    },
    close() { ws.close(); }
  };
}

async function main() {
  console.log('\nRELAY SERVER on :' + PORT);

  // ---- host opens a room ----
  const A = await client();
  A.send({ type: 'relay-join', room: 'test-room', mode: 'host', seat: '' });
  const wA = await A.next('relay-welcome');
  check('host welcomed', wA.room, 'test-room');
  check('host is host', wA.isHost, true);
  check('host alone at first', wA.peerPresent, false);
  check('seat issued', typeof wA.seat === 'string' && wA.seat.length === 24, true);

  // ---- message before join is refused ----
  const Z = await client();
  Z.send({ type: 'handshake' });
  check('send before join refused', (await Z.next('relay-refused')).reason, 'not-joined');
  Z.close();

  // ---- joiner arrives ----
  const B = await client();
  B.send({ type: 'relay-join', room: 'test-room', mode: 'join', seat: '' });
  const wB = await B.next('relay-welcome');
  check('joiner welcomed', wB.room, 'test-room');
  check('joiner is not host', wB.isHost, false);
  check('joiner sees host present', wB.peerPresent, true);
  check('host told peer joined', (await A.next('relay-peer-joined')).type, 'relay-peer-joined');

  // ---- forwarding, both ways, verbatim ----
  A.send({ type: 'handshake', role: 'reality', msg: 'The veil holds.' });
  const gotB = await B.next('handshake');
  check('host to joiner verbatim', gotB.msg, 'The veil holds.');
  B.send({ type: 'scene-msg', scene: 'lockdown', payload: { position: 'entrance' } });
  const gotA = await A.next('scene-msg');
  check('joiner to host verbatim', gotA.payload.position, 'entrance');

  // ---- joiner drops, host keeps talking, joiner returns on the same seat ----
  B.close();
  check('host told peer dropped', (await A.next('relay-peer-dropped')).type, 'relay-peer-dropped');
  A.send({ type: 'note', text: 'said while you were gone' });
  A.send({ type: 'note', text: 'and this' });
  const B2 = await client();
  B2.send({ type: 'relay-join', room: 'test-room', mode: 'join', seat: wB.seat });
  const wB2 = await B2.next('relay-welcome');
  check('reconnect recognised', wB2.reconnect, true);
  check('same seat kept', wB2.seat, wB.seat);
  const n1 = await B2.next('note');
  const n2 = await B2.next('note');
  check('backlog delivered in order', n1.text + ' / ' + n2.text, 'said while you were gone / and this');
  check('host told peer back', (await A.next('relay-peer-reconnected')).type, 'relay-peer-reconnected');
  B2.send({ type: 'note', text: 'back' });
  check('forwarding resumes', (await A.next('note')).text, 'back');

  // ---- refusals ----
  const C = await client();
  C.send({ type: 'relay-join', room: 'test-room', mode: 'join', seat: '' });
  check('third seat refused', (await C.next('relay-refused')).reason, 'room-full');
  C.close();

  const D = await client();
  D.send({ type: 'relay-join', room: 'test-room', mode: 'host', seat: '' });
  check('second host refused', (await D.next('relay-refused')).reason, 'room-taken');
  D.close();

  const E = await client();
  E.send({ type: 'relay-join', room: 'nobody-here', mode: 'join', seat: '' });
  check('unknown room refused', (await E.next('relay-refused')).reason, 'no-room');
  E.close();

  const F = await client();
  F.send({ type: 'relay-join', room: 'NOT VALID!!', mode: 'host', seat: '' });
  check('bad code refused', (await F.next('relay-refused')).reason, 'bad-code');
  F.close();

  // ---- server restarted mid-game: seats presented for a room it never saw ----
  // The joiner happens to come back first. It must not be refused, and the
  // host must still be the host when it arrives a moment later.
  const ghostJoiner = 'a'.repeat(24), ghostHost = 'b'.repeat(24);
  const G1 = await client();
  G1.send({ type: 'relay-join', room: 'ghost-room', mode: 'join', seat: ghostJoiner, wasHost: false });
  const wG1 = await G1.next('relay-welcome');
  check('after restart: joiner readmitted', wG1.reconnect, true);
  check('after restart: joiner not host', wG1.isHost, false);
  check('after restart: joiner alone so far', wG1.peerPresent, false);
  const G2 = await client();
  G2.send({ type: 'relay-join', room: 'ghost-room', mode: 'host', seat: ghostHost, wasHost: true });
  const wG2 = await G2.next('relay-welcome');
  check('after restart: host readmitted', wG2.reconnect, true);
  check('after restart: host still host', wG2.isHost, true);
  check('after restart: host sees joiner', wG2.peerPresent, true);
  check('after restart: joiner told host back', (await G1.next('relay-peer-reconnected')).type, 'relay-peer-reconnected');
  G2.send({ type: 'note', text: 'we survived the deploy' });
  check('after restart: game continues', (await G1.next('note')).text, 'we survived the deploy');
  const G3 = await client();
  G3.send({ type: 'relay-join', room: 'ghost-room', mode: 'join', seat: 'not-a-real-seat', wasHost: true });
  check('garbage seat not honored', (await G3.next('relay-refused')).reason, 'room-full');
  G1.close(); G2.close(); G3.close();

  // ---- health reports the rooms ----
  const h = await (await fetch(BASE + '/api/health', { headers: { Authorization: AUTH } })).json();
  check('health counts rooms', h.rooms, 2);

  A.close(); B2.close();
}

const server = spawn(process.execPath, [path.join(__dirname, '..', 'index.js')], {
  env: Object.assign({}, process.env, { APP_PASSWORD: PASS, PORT: String(PORT) }),
  stdio: ['ignore', 'pipe', 'pipe']
});
let started = false;
server.stdout.on('data', (d) => {
  if (!started && d.toString().includes('game server on')) {
    started = true;
    main()
      .catch((e) => { failures++; console.log('  FAIL ' + e.message); })
      .finally(() => {
        server.kill();
        console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'all relay checks passed') + '\n');
        process.exit(failures ? 1 : 0);
      });
  }
});
server.stderr.on('data', (d) => process.stderr.write('[server] ' + d));
setTimeout(() => { if (!started) { console.log('  FAIL server did not start'); server.kill(); process.exit(1); } }, 5000).unref();
