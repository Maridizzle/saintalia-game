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
  isHost: true
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
  if (stepId === 'step-connect' && !S.peer) {
    initPeerWithCode(generateRoomCode());
  }
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

// Re-initialize with roomCode as peerId so joiner can connect by code
function initPeerWithCode(code) {
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

  const targetId = 'saintalia-' + raw.replace(/[^a-z0-9-]/g, '');

  setJoinStatus('Reaching through the veil...', 'waiting');
  document.getElementById('btn-join').disabled = true;
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
// started and the lobby DOM is gone.
function setLinkLost(msg) {
  const create = document.getElementById('create-status-area');
  const join = document.getElementById('join-status-area');
  if (create || join) {
    if (S.isHost && create) setCreateStatus(msg, 'error');
    else if (join) setJoinStatus(msg, 'error');
    return;
  }
  let banner = document.getElementById('link-lost');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'link-lost';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9998;padding:0.5rem;text-align:center;font-family:Cinzel,serif;font-size:0.8rem;letter-spacing:0.15em;background:rgba(139,26,26,0.92);color:#f5efe0;';
    document.body.appendChild(banner);
  }
  banner.textContent = msg;
}

// ---- LOBBY MESSAGE HANDLERS ----

onMessage('handshake', () => {
  S.connected = true;

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

function setCreateStatus(msg, type) {
  const area = document.getElementById('create-status-area');
  area.innerHTML = `<div class="status-msg ${type}">${msg}</div>`;
}

function setJoinStatus(msg, type) {
  const area = document.getElementById('join-status-area');
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
