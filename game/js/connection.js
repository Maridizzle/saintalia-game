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
  connected: false
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
  if (stepId === 'step-connect') initPeer();
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

  S.peer.on('error', (err) => {
    if (err.type === 'unavailable-id') {
      // Code already taken — generate new one
      const newCode = generateRoomCode();
      setTimeout(() => initPeerWithCode(newCode), 500);
      return;
    }
    setCreateStatus('The veil resists: ' + err.message, 'error');
    dbg('state', 'error: ' + err.type);
    S.peer = null;
  });
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

  if (S.peer) { S.peer.destroy(); S.peer = null; }

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

  S.peer.on('error', (err) => {
    setJoinStatus('Could not find the veil: ' + err.message, 'error');
    document.getElementById('btn-join').disabled = false;
    dbg('state', 'join error: ' + err.type);
    S.peer = null;
  });
}

// ---- CONNECTION SETUP ----

function setupConnection(conn, role) {
  dbg('conn', role + ' - opening...');

  conn.on('open', () => {
    S.connected = true;
    dbg('conn', role + ' - OPEN');
    dbg('state', 'connected');

    // Send a handshake
    conn.send({ type: 'handshake', role: S.role, msg: 'The veil holds.' });
  });

  conn.on('data', (data) => {
    handleMessage(data);
  });

  conn.on('close', () => {
    S.connected = false;
    dbg('conn', 'closed');
    if (document.getElementById('step-ready').classList.contains('active')) {
      // Already in game prep -- show warning
    }
  });

  conn.on('error', (err) => {
    dbg('conn', 'error: ' + err);
  });
}

function handleMessage(data) {
  dbg('state', 'msg: ' + data.type);

  if (data.type === 'handshake') {
    // Both sides connected
    S.connected = true;

    // Update UI
    if (S.action === 'create') {
      setCreateStatus('Connected. Both sides of the veil are present.', 'connected');
      document.getElementById('btn-waiting').textContent = 'Connected — Proceeding...';
      document.getElementById('btn-waiting').disabled = true;
    } else {
      setJoinStatus('The veil holds. You are through.', 'connected');
    }

    // Brief pause then advance to step 3
    setTimeout(() => {
      goToStep('step-ready');
    }, 1200);
  }

  if (data.type === 'begin') {
    // Host told us to begin -- navigate to game
    window.GAME_STATE = data.gameState;
    launchGame();
  }
}

// ---- STEP 3: GROQ KEY ----

function skipGroq() {
  S.groqKey = '';
  launchGame();
}

function beginGame() {
  const key = document.getElementById('groq-key-input').value.trim();
  if (key && !key.startsWith('gsk_')) {
    document.getElementById('key-status').textContent = 'That does not look like a Groq key. It should start with gsk_';
    return;
  }
  S.groqKey = key;

  // Tell the other side to begin
  if (S.conn && S.conn.open) {
    S.conn.send({
      type: 'begin',
      gameState: {
        role_host: S.role,
        groqKey: S.groqKey
      }
    });
  }

  launchGame();
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
// When user reaches connect step, auto-init peer with generated code.
//
// PRESERVED BUG. goToStep() above already called initPeer(), which registered
// a random broker ID and displayed a room code nothing is listening on. This
// override then destroys that peer and shows a second, different code 300ms
// later. Only the second one is joinable. Fixed in Phase 2, not here.
const origGoToStep = goToStep;
window.goToStep = function(stepId) {
  origGoToStep(stepId);
  if (stepId === 'step-connect') {
    setTimeout(() => {
      const code = generateRoomCode();
      initPeerWithCode(code);
    }, 300);
  }
};

// Debug panel visibility. All the dbg() calls above stay live either way;
// this only controls whether the panel is on screen.
if (!DEBUG) {
  const panel = document.getElementById('debug');
  if (panel) panel.style.display = 'none';
}
