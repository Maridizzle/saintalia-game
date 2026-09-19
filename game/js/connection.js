// ============================================================
// SAINTALIA -- CONNECTION LAYER
// Author: Maridizzle
//
// Moved verbatim from saintalia-v2.html (Phase 1):
//   lines  707 to 1024  the connection chunk
//   lines 2606 to 2621  the lobby UI helpers
//   lines 2623 to 2634  the goToStep override
//
// Two additions, both required to make the split load and both approved
// before they were written:
//   DEBUG      gates the debug panel (PLAN.md Phase 1 step 5)
//   setScreen  swaps the screen-* class that scopes the merged stylesheet
//
// KNOWN BUGS DELIBERATELY LEFT IN PLACE.
// Phase 1 is a zero behavior change split. If these were fixed here, neither
// Maridizzle nor Claude could tell whether the split was clean or whether
// something else broke. All four are written up in PLAN.md Phase 2.
//   1. Double peer init. goToStep() calls initPeer(), then the override at
//      the bottom of this file destroys that peer 300ms later and calls
//      initPeerWithCode() with a DIFFERENT room code. Two codes get shown.
//      This is the likely root cause of the silent join failure.
//   2. beginGame() sends S.groqKey over the wire. The receiver never reads
//      it and never calls Groq, so it leaks for nothing.
//   3. skipGroq() never sends `begin`, so choosing offline narration leaves
//      the joiner stuck on Step III forever.
//   4. Error handlers null S.peer without calling destroy(), leaking a live
//      peer on the broker.
// ============================================================

// Set to false at the very END of Phase 1, after the side-by-side gate has
// passed. Leaving it true for now so the split build and saintalia-v2.html
// render identically during comparison.
const DEBUG = true;

// PHASE 11a. Which transport carries messages between the two players.
//   'auto'   try the Railway relay first. If /api/ws-token is not there,
//            which is the case on GitHub Pages or when the server is down,
//            fall back to PeerJS for this session. Same files on both hosts.
//   'relay'  the Railway relay only.
//   'peer'   PeerJS only. The pre-Phase-11 path, kept for comparison.
// Nothing below the transport changes: S.conn.send and the dispatcher look
// the same to every scene whichever one is live.
const TRANSPORT = 'auto';

const VEIL_WORDS_A = [
  'ashveil','duskbone','mirethall','crestfall','thornmire',
  'gallowhush','embervane','sablewick','grimfallow','wolvenmere'
];

const VEIL_WORDS_B = [
  'seven','hollow','sigil','remnant','fracture',
  'threshold','splinter','marrow','cipher','wither'
];

// State
const S = {
  role: null,
  peer: null,
  conn: null,
  roomCode: null,
  groqKey: '',
  action: 'create',
  connected: false,

  // PHASE 3f. The one source of truth for who narrates. Latched in
  // setupConnection from which side opened the connection, never re-read from
  // the lobby tab. Defaults true so a client that somehow reaches the game
  // screen without a connection still narrates rather than waiting forever.
  isHost: true,

  // PHASE 11a. Relay session, or null. Only one of S.peer and S.relay is
  // ever live. transportUsed is set to 'peer' when auto mode falls back, so
  // the fallback sticks for the session instead of retrying the relay on
  // every step.
  relay: null,
  transportUsed: null
};

// ---- SCREEN CLASS ----
// The three <style> blocks in the original each redefined `body` and won by
// being injected last. Merged into one stylesheet they collide, so the
// conflicting rules are scoped by this class. It rides on both <html> and
// <body> because the game screen needs `html, body { height: 100% }`.
// Theme classes are left alone.
const SCREEN_CLASSES = ['screen-lobby', 'screen-char', 'screen-game'];

function setScreen(name) {
  const cls = 'screen-' + name;
  [document.documentElement, document.body].forEach(el => {
    el.classList.remove(...SCREEN_CLASSES);
    el.classList.add(cls);
  });
}

// ---- ROLE SELECTION ----

function selectRole(role) {
  S.role = role;
  document.body.classList.remove('theme-fantasy', 'theme-artist');
  document.body.classList.add(role === 'fantasy' ? 'theme-fantasy' : 'theme-artist');
  document.getElementById('card-fantasy').classList.toggle('selected', role === 'fantasy');
  document.getElementById('card-reality').classList.toggle('selected', role === 'reality');
  document.getElementById('btn-role-next').disabled = false;
  dbg('role', role);
}

// ---- NAVIGATION ----

function goToStep(stepId) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(stepId).classList.add('active');

  // PHASE 3b. This used to call initPeer(), and then a window.goToStep
  // override at the bottom of the file destroyed that peer 300ms later and
  // called initPeerWithCode() with a DIFFERENT code. Two room codes appeared
  // in #room-code-display, 300ms apart, and only the second one was joinable.
  // That was the silent join failure.
  //
  // Now there is one path. initPeerWithCode registers the peer ID the joiner
  // actually targets, so it is the correct one to keep.
  //
  // The !S.peer guard matters too: going back to Change Sides and forward
  // again used to destroy the live peer and mint a new code, stranding
  // anyone who already had the old one.
  if (stepId === 'step-connect' && !S.peer && !S.relay) {
    initPeerWithCode(generateRoomCode());
  }
}

// PHASE 11a. True when this session should use the relay.
function useRelay() {
  if (TRANSPORT === 'relay') return true;
  if (TRANSPORT === 'peer') return false;
  return S.transportUsed !== 'peer';
}

// ---- ACTION TABS ----

function switchAction(action) {
  S.action = action;
  document.getElementById('tab-create').classList.toggle('active', action === 'create');
  document.getElementById('tab-join').classList.toggle('active', action === 'join');
  document.getElementById('panel-create').classList.toggle('active', action === 'create');
  document.getElementById('panel-join').classList.toggle('active', action === 'join');
}

// ---- PEER INITIALIZATION ----

function generateRoomCode() {
  const a = VEIL_WORDS_A[Math.floor(Math.random() * VEIL_WORDS_A.length)];
  const b = VEIL_WORDS_B[Math.floor(Math.random() * VEIL_WORDS_B.length)];
  return a + '-' + b;
}

function initPeer() {
  if (S.peer) return; // already initialized

  setCreateStatus('Weaving your thread into the veil...', 'waiting');
  dbg('state', 'initializing peer');

  try {
    S.peer = new Peer({
      host: '0.peerjs.com',
      port: 443,
      secure: true,
      path: '/',
      debug: 0,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    S.peer.on('open', (id) => {
      S.roomCode = generateRoomCode();
      dbg('peer', id.substring(0, 12) + '...');
      dbg('room', S.roomCode);
      dbg('state', 'open, waiting');

      document.getElementById('room-code-display').textContent = S.roomCode;
      document.getElementById('code-display').style.display = 'block';
      setCreateStatus('The veil is open. Waiting for the other side...', 'waiting');

      // Store mapping: roomCode -> peerId in localStorage briefly
      // so the joiner can look it up
      // We broadcast peerId as part of the roomCode join flow
      // Joiner connects directly to peerId derived from roomCode
      // Solution: peerId IS the room code formatted peer
      // Actually: we set peerId = roomCode so joiner connects to it directly
    });

    S.peer.on('connection', (conn) => {
      S.conn = conn;
      setupConnection(conn, 'host');
    });

    S.peer.on('error', (err) => {
      setCreateStatus('The veil resists: ' + err.message, 'error');
      dbg('state', 'error: ' + err.type);
      // Reset peer so they can retry
      S.peer = null;
    });

    S.peer.on('disconnected', () => {
      dbg('state', 'disconnected');
      if (S.connected) {
        setCreateStatus('The veil tore. Connection lost.', 'error');
      }
    });

  } catch(e) {
    setCreateStatus('Could not reach the veil: ' + e.message, 'error');
  }
}

// PHASE 11a. The host's entry point, called by goToStep. Picks the transport;
// the PeerJS body below is unchanged and now lives in peerInitWithCode.
function initPeerWithCode(code) {
  if (useRelay()) return relayStart(code, 'host');
  peerInitWithCode(code);
}

// Re-initialize with roomCode as peerId so joiner can connect by code
function peerInitWithCode(code) {
  if (S.peer) { S.peer.destroy(); S.peer = null; }

  setCreateStatus('Binding your code to the veil...', 'waiting');

  // Sanitize code to valid PeerJS ID (alphanumeric + hyphens only)
  const peerId = 'saintalia-' + code.replace(/[^a-z0-9-]/g, '');

  S.peer = new Peer(peerId, {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    path: '/',
    debug: 0,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }
  });

  S.peer.on('open', (id) => {
    S.roomCode = code;
    dbg('peer', id.substring(0, 20) + '...');
    dbg('room', code);
    dbg('state', 'open with code, waiting for joiner');

    document.getElementById('room-code-display').textContent = code;
    document.getElementById('code-display').style.display = 'block';
    setCreateStatus('The veil is open. Waiting for the other side...', 'waiting');
  });

  S.peer.on('connection', (conn) => {
    S.conn = conn;
    setupConnection(conn, 'host');
  });

  // PHASE 3b. Reconnect. The broker drops idle connections and phones drop
  // wifi. Without this the game just silently stopped working.
  S.peer.on('disconnected', () => {
    dbg('state', 'broker disconnected, reconnecting');
    setCreateStatus('The veil is fraying. Reaching back through...', 'waiting');
    try { S.peer.reconnect(); } catch(e) { /* peer already destroyed */ }
  });

  S.peer.on('error', (err) => {
    if (err.type === 'unavailable-id') {
      // Code already taken -- generate new one
      const newCode = generateRoomCode();
      setTimeout(() => initPeerWithCode(newCode), 500);
      return;
    }
    setCreateStatus('The veil resists: ' + err.message, 'error');
    dbg('state', 'error: ' + err.type);
    destroyPeer();
  });
}

// PHASE 3b. Every error path used to do S.peer = null without destroy(),
// which leaks a live peer holding its ID on the broker. The next attempt to
// register the same ID then fails with unavailable-id against your own ghost.
function destroyPeer() {
  relayClose();   // PHASE 11a. Whichever transport is live, this resets it.
  if (!S.peer) return;
  try { S.peer.destroy(); } catch(e) { /* already gone */ }
  S.peer = null;
}

// ---- JOIN ROOM ----

function joinRoom() {
  const raw = document.getElementById('join-code-input').value.trim().toLowerCase();
  if (!raw) {
    setJoinStatus('Enter the code your companion gave you.', 'error');
    return;
  }

  const code = raw.replace(/[^a-z0-9-]/g, '');

  setJoinStatus('Reaching through the veil...', 'waiting');
  document.getElementById('btn-join').disabled = true;

  // PHASE 11a. Transport split. The PeerJS body is unchanged in peerJoin.
  if (useRelay()) return relayStart(code, 'join');
  peerJoin(code);
}

function peerJoin(code) {
  const targetId = 'saintalia-' + code;
  dbg('state', 'joining ' + targetId);

  destroyPeer();

  S.peer = new Peer({
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    path: '/',
    debug: 0,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }
  });

  S.peer.on('open', () => {
    const conn = S.peer.connect(targetId, { reliable: true });
    S.conn = conn;
    setupConnection(conn, 'joiner');
  });

  // PHASE 3b. Same reconnect treatment as the host side, and a readable
  // message instead of a hang when the code simply does not exist.
  S.peer.on('disconnected', () => {
    dbg('state', 'broker disconnected, reconnecting');
    setJoinStatus('The veil is fraying. Reaching back through...', 'waiting');
    try { S.peer.reconnect(); } catch(e) { /* peer already destroyed */ }
  });

  S.peer.on('error', (err) => {
    const msg = err.type === 'peer-unavailable'
      ? 'No veil is open on that code. Check it with your companion, letter for letter.'
      : 'Could not find the veil: ' + err.message;
    setJoinStatus(msg, 'error');
    document.getElementById('btn-join').disabled = false;
    dbg('state', 'join error: ' + err.type);
    destroyPeer();
  });
}

// ---- CONNECTION SETUP ----

function setupConnection(conn, role) {
  dbg('conn', role + ' - opening...');

  // PHASE 3f. Host identity used to be read off S.action, which comes from a
  // lobby tab that stays clickable after you are connected. Click the wrong
  // tab mid-game and a client decided it was the host. Latch it here instead,
  // from which side actually opened the connection, and never read the tab
  // again.
  S.isHost = (role === 'host');
  dbg('role', S.role + (S.isHost ? ' (host)' : ' (joiner)'));

  conn.on('open', () => {
    S.connected = true;
    dbg('conn', role + ' - OPEN');
    dbg('state', 'connected');

    // Send a handshake
    conn.send({ type: 'handshake', role: S.role, msg: 'The veil holds.' });
  });

  // PHASE 1 STEP 4 / PHASE 3. ONE data listener for the whole session.
  // There used to be three, registered in connection.js, character.js and
  // game.js, and all three stayed live forever. After the game screen was
  // built the first two were still listening against a DOM that no longer
  // existed. Now every file registers its own message types into the
  // dispatcher below instead of adding another listener.
  conn.on('data', dispatchMessage);

  conn.on('close', () => {
    S.connected = false;
    dbg('conn', 'closed');
    setLinkLost('The veil tore. The connection dropped.');
  });

  conn.on('error', (err) => {
    dbg('conn', 'error: ' + err);
    setLinkLost('Something went wrong in the veil: ' + (err && err.message ? err.message : err));
  });
}

// ---- MESSAGE DISPATCHER ----
// PHASE 1 STEP 4. Replaces the three separate conn.on('data') registrations.
// Every message type is routed by name. A type nobody claimed is logged
// rather than silently swallowed, which is how the dead veil-update branch
// hid for so long.

const MESSAGE_HANDLERS = {};

function onMessage(type, fn) {
  if (!MESSAGE_HANDLERS[type]) MESSAGE_HANDLERS[type] = [];
  MESSAGE_HANDLERS[type].push(fn);
}

function dispatchMessage(data) {
  if (!data || !data.type) {
    console.warn('[saintalia] message with no type:', data);
    return;
  }
  dbg('state', 'msg: ' + data.type);

  const handlers = MESSAGE_HANDLERS[data.type];
  if (!handlers || !handlers.length) {
    console.warn('[saintalia] no handler registered for message type:', data.type);
    return;
  }

  // One throwing handler must not stop the others, or a render error in one
  // panel silently kills the turn loop.
  handlers.forEach(fn => {
    try { fn(data); }
    catch (e) { console.error('[saintalia] handler failed for "' + data.type + '"', e); }
  });
}

// Shown on whichever lobby panel is live, or as a banner once the game has
// started and the lobby DOM is gone. PHASE 11a added the type, so a reconnect
// in progress reads as waiting rather than as an error.
function setLinkLost(msg, type, asHost) {
  type = type || 'error';
  // S.isHost defaults to true until a connection latches it, so a joiner
  // refused before that point would be routed to the hidden create panel.
  // Callers that know which side they are say so; otherwise S.isHost stands.
  if (asHost === undefined) asHost = S.relay ? S.relay.mode === 'host' : S.isHost;
  const create = document.getElementById('create-status-area');
  const join = document.getElementById('join-status-area');
  if (create || join) {
    if (asHost && create) setCreateStatus(msg, type);
    else if (join) setJoinStatus(msg, type);
    return;
  }
  let banner = document.getElementById('link-lost');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'link-lost';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9998;padding:0.5rem;text-align:center;font-family:Cinzel,serif;font-size:0.8rem;letter-spacing:0.15em;color:#f5efe0;';
    document.body.appendChild(banner);
  }
  banner.style.background = type === 'error' ? 'rgba(139,26,26,0.92)' : 'rgba(45,27,78,0.92)';
  banner.textContent = msg;
}

// PHASE 11a. The link came back. Only the in-game banner needs removing; a
// lobby status area is overwritten by whatever status comes next.
function clearLinkLost() {
  const banner = document.getElementById('link-lost');
  if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
}

// ---- RELAY TRANSPORT (PHASE 11a) ----
// The Railway server forwards messages between the two seats of a room. See
// server/index.js for the protocol. Everything here is about getting a
// socket, keeping it, and turning its messages into dispatchMessage calls.
//
// S.conn for the relay is a two-property object, because that is all the
// sixteen call sites use: `open` and `send`. `open` means we have a room and
// a partner. It stays true through a socket blip, so callers keep sending
// and the message waits in the outbox instead of vanishing.

const RELAY_OUTBOX_CAP = 100;
const RELAY_RETRY_MAX_MS = 15000;

function relayMakeConn() {
  return {
    open: false,
    send(obj) {
      const R = S.relay;
      if (!R) return;
      const raw = JSON.stringify(obj);
      if (R.joined && R.ws && R.ws.readyState === 1) {
        R.ws.send(raw);
      } else {
        R.outbox.push(raw);
        if (R.outbox.length > RELAY_OUTBOX_CAP) R.outbox.shift();
      }
    }
  };
}

function relayUrl(token) {
  const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
  return proto + location.host + '/ws?token=' + encodeURIComponent(token);
}

async function relayToken() {
  const r = await fetch('/api/ws-token', { cache: 'no-store' });
  if (!r.ok) throw new Error('no relay (' + r.status + ')');
  return (await r.json()).token;
}

// Entry point for both sides. mode is 'host' or 'join'.
function relayStart(code, mode) {
  relayClose();
  S.relay = { code, mode, seat: null, ws: null, joined: false, outbox: [], attempts: 0, closing: false, timer: null };
  S.conn = relayMakeConn();
  S.roomCode = code;
  if (mode === 'host') setCreateStatus('Binding your code to the veil...', 'waiting');
  dbg('state', mode === 'host' ? 'relay: opening room' : 'relay: joining ' + code);
  relayConnect();
}

async function relayConnect() {
  const R = S.relay;
  if (!R || R.closing) return;

  let token;
  try {
    token = await relayToken();
  } catch (e) {
    if (S.relay !== R || R.closing) return;
    // No token endpoint on a first attempt means there is no server here
    // (GitHub Pages) or it is down. In auto mode, use PeerJS for this session.
    if (TRANSPORT === 'auto' && R.attempts === 0 && !R.seat) { relayFallbackToPeer(e); return; }
    relayScheduleReconnect();
    return;
  }
  if (S.relay !== R || R.closing) return;   // closed while the token was in flight

  const ws = new WebSocket(relayUrl(token));
  R.ws = ws;
  R.joined = false;

  ws.onopen = () => {
    // wasHost matters only on a reconnect after the server restarted and
    // forgot the room. It rebuilds the room around this seat and keeps the
    // host where it was. See handleRelayJoin in server/index.js.
    ws.send(JSON.stringify({ type: 'relay-join', room: R.code, mode: R.mode, seat: R.seat || '', wasHost: !!(R.seat && S.isHost) }));
  };
  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (S.relay === R) relayHandleMessage(msg);
  };
  ws.onclose = () => {
    if (S.relay !== R || R.ws !== ws) return;   // stale socket
    R.ws = null;
    R.joined = false;
    if (R.closing) return;
    relayOnDrop();
    relayScheduleReconnect();
  };
  ws.onerror = () => { /* close follows */ };
}

function relayScheduleReconnect() {
  const R = S.relay;
  if (!R || R.closing || R.timer) return;
  R.attempts += 1;
  const delay = Math.min(1000 * Math.pow(2, R.attempts - 1), RELAY_RETRY_MAX_MS);
  dbg('state', 'relay: retry in ' + Math.round(delay / 1000) + 's');
  R.timer = setTimeout(() => { R.timer = null; relayConnect(); }, delay);
}

function relayHandleMessage(msg) {
  const R = S.relay;
  if (!R || !msg || typeof msg.type !== 'string') return;

  switch (msg.type) {
    case 'relay-welcome': {
      R.seat = msg.seat;
      R.joined = true;
      R.attempts = 0;
      // PHASE 3f, finished. Host identity comes from the server, which knows
      // who opened the room, never from the lobby tab.
      S.isHost = !!msg.isHost;
      dbg('peer', 'relay seat ' + String(msg.seat).slice(0, 8));
      dbg('room', R.code);
      dbg('role', S.role + (S.isHost ? ' (host)' : ' (joiner)'));

      const backlog = R.outbox.splice(0);
      if (R.ws) backlog.forEach(raw => R.ws.send(raw));

      if (msg.reconnect) { relayOnRestored(); return; }

      if (S.isHost) {
        const display = document.getElementById('room-code-display');
        const box = document.getElementById('code-display');
        if (display) display.textContent = R.code;
        if (box) box.style.display = 'block';
        setCreateStatus('The veil is open. Waiting for the other side...', 'waiting');
        dbg('state', 'open with code, waiting for joiner');
      }
      if (msg.peerPresent) relayPairComplete();
      return;
    }
    case 'relay-peer-joined':
      relayPairComplete();
      return;
    case 'relay-peer-dropped':
      dbg('conn', 'peer dropped, holding');
      setLinkLost('The other side is fraying. Holding the veil open...', 'waiting');
      return;
    case 'relay-peer-reconnected':
      dbg('conn', 'peer back');
      clearLinkLost();
      return;
    case 'relay-refused':
      relayRefused(msg.reason);
      return;
    default:
      dispatchMessage(msg);
  }
}

// Both seats are present. Same moment PeerJS's conn.on('open') marked:
// mark the connection open and send the handshake the lobby waits for.
function relayPairComplete() {
  if (!S.conn) return;
  S.conn.open = true;
  S.connected = true;
  dbg('conn', (S.isHost ? 'host' : 'joiner') + ' - OPEN');
  dbg('state', 'connected');
  S.conn.send({ type: 'handshake', role: S.role, msg: 'The veil holds.' });
}

function relayRefused(reason) {
  const R = S.relay;
  dbg('state', 'relay refused: ' + reason);
  if (reason === 'room-taken' && R && R.mode === 'host') {
    // Same word pair as someone else's open room. Mint another, as the
    // PeerJS path did on unavailable-id.
    const code = R.code;
    relayClose();
    setTimeout(() => { if (!S.relay && !S.peer) relayStart(generateRoomCode(), 'host'); }, 500);
    dbg('state', 'code ' + code + ' taken, minting another');
    return;
  }
  const msg = reason === 'no-room'
    ? 'No veil is open on that code. Check it with your companion, letter for letter.'
    : reason === 'room-full'
      ? 'That code already has two players on it.'
      : 'The veil refused: ' + reason;
  const asHost = !!(R && R.mode === 'host');
  relayClose();
  const btn = document.getElementById('btn-join');
  if (btn) btn.disabled = false;
  setLinkLost(msg, 'error', asHost);
}

function relayOnDrop() {
  dbg('state', 'relay dropped, reconnecting');
  setLinkLost('The veil is fraying. Reaching back through...', 'waiting');
}

function relayOnRestored() {
  dbg('state', S.connected ? 'connected' : 'open with code, waiting for joiner');
  clearLinkLost();
  if (!S.connected && S.isHost) setCreateStatus('The veil is open. Waiting for the other side...', 'waiting');
}

// Auto mode found no relay on the first try. Use PeerJS for this session.
function relayFallbackToPeer(err) {
  const R = S.relay;
  const code = R ? R.code : null;
  const mode = R ? R.mode : null;
  relayClose();
  S.transportUsed = 'peer';
  dbg('state', 'no relay here, using peer (' + (err && err.message ? err.message : err) + ')');
  if (mode === 'host') peerInitWithCode(code);
  else if (mode === 'join') peerJoin(code);
}

function relayClose() {
  const R = S.relay;
  if (!R) return;
  R.closing = true;
  if (R.timer) { clearTimeout(R.timer); R.timer = null; }
  if (R.ws) { try { R.ws.close(); } catch (e) { /* already gone */ } R.ws = null; }
  S.relay = null;
  if (S.conn && typeof S.conn.send === 'function' && !S.peer) { S.conn.open = false; S.conn = null; }
  S.connected = false;
}

// ---- LOBBY MESSAGE HANDLERS ----

onMessage('handshake', () => {
  S.connected = true;

  // PHASE 11a. A handshake can arrive again mid-game, after both sides
  // re-pair through a server restart. The lobby DOM is gone by then and
  // there is nothing to do; the scene carries on.
  if (!document.getElementById('step-ready')) return;

  if (S.isHost) {
    setCreateStatus('Connected. Both sides of the veil are present.', 'connected');
    const btn = document.getElementById('btn-waiting');
    if (btn) { btn.textContent = 'Connected, proceeding...'; btn.disabled = true; }
  } else {
    setJoinStatus('The veil holds. You are through.', 'connected');
  }

  setTimeout(() => goToStep('step-ready'), 1200);
});

onMessage('begin', (data) => {
  // Host told us to begin -- navigate to game.
  // PHASE 3a: this payload no longer carries a Groq key. See beginGame.
  window.GAME_STATE = data.gameState;
  launchGame();
});

// ---- STEP 3: GROQ KEY ----

// PHASE 3c. This used to launch the host into character creation without
// ever sending `begin`, so choosing "Continue without AI narration" left the
// other player sitting on Step III forever. Both paths send it now.
function skipGroq() {
  S.groqKey = '';
  sendBegin();
  launchGame();
}

function beginGame() {
  const key = document.getElementById('groq-key-input').value.trim();
  if (key && !key.startsWith('gsk_')) {
    document.getElementById('key-status').textContent = 'That does not look like a Groq key. It should start with gsk_';
    return;
  }
  S.groqKey = key;
  sendBegin();
  launchGame();
}

// PHASE 3a. The Groq key used to ride along in this payload. The receiver
// parked it in window.GAME_STATE and never read it into S.groqKey, and every
// Groq call site is gated on the host, so the joiner never called Groq at
// all. The key crossed the wire in plaintext and did nothing. Removing it
// changes no behavior.
function sendBegin() {
  if (S.conn && S.conn.open) {
    S.conn.send({ type: 'begin', gameState: { role_host: S.role } });
  }
}

function launchGame() {
  document.getElementById('debug').style.display = 'none';
  setScreen('char');
  document.body.innerHTML = buildCharScreen();
  initCharScreen();
}

// ---- LOBBY UI HELPERS ----

// PHASE 11a. Both guard for a missing area. The relay can report status
// after the lobby DOM is gone, and a null here used to throw inside the
// socket's message handler.
function setCreateStatus(msg, type) {
  const area = document.getElementById('create-status-area');
  if (!area) return;
  area.innerHTML = `<div class="status-msg ${type}">${msg}</div>`;
}

function setJoinStatus(msg, type) {
  const area = document.getElementById('join-status-area');
  if (!area) return;
  area.innerHTML = `<div class="status-msg ${type}">${msg}</div>`;
}

function dbg(key, val) {
  const el = document.getElementById('dbg-' + key);
  if (el) el.textContent = val;
}

// ---- INIT ----
// PHASE 3b. The goToStep override that used to live here is disabled, not
// deleted. It was the second half of the double peer init: goToStep() created
// one peer, then this destroyed it 300ms later and minted a different room
// code. Both codes rendered into #room-code-display and only the second one
// was joinable.
//
// goToStep now calls initPeerWithCode() directly, once, guarded on !S.peer.
// Kept here as the record of what the bug actually was.
//
// const origGoToStep = goToStep;
// window.goToStep = function(stepId) {
//   origGoToStep(stepId);
//   if (stepId === 'step-connect') {
//     setTimeout(() => {
//       const code = generateRoomCode();
//       initPeerWithCode(code);
//     }, 300);
//   }
// };

// Debug panel visibility. All the dbg() calls above stay live either way;
// this only controls whether the panel is on screen.
if (!DEBUG) {
  const panel = document.getElementById('debug');
  if (panel) panel.style.display = 'none';
}
