// ============================================================
// SAINTALIA -- SESSION RESTORE (Phase 11b part 1)
// Author: Maridizzle
//
// Snapshot collection, debounced sending, message hold/release during
// restore, and the restore entry point. Loaded after game.js, before
// the scene files, so scene snapshot() methods exist by the time this
// runs but nothing here is called at load time.
//
// The snapshot travels as a relay-snapshot message to the server, which
// stores the latest per seat (in memory, capped at 256 KB) and hands it
// back in the welcome on a reconnect. PeerJS mode has no server to
// store it, so snapshots only work on the relay.
// ============================================================

// ---- DEBOUNCED SNAPSHOT ----
let _snapshotTimer = null;
const SNAPSHOT_DEBOUNCE_MS = 100;

function scheduleSnapshot() {
  if (_snapshotTimer) clearTimeout(_snapshotTimer);
  _snapshotTimer = setTimeout(() => { _snapshotTimer = null; sendSnapshot(); }, SNAPSHOT_DEBOUNCE_MS);
}

function sendSnapshot() {
  if (!S.relay || !S.relay.ws || S.relay.ws.readyState !== 1) return;
  const data = collectSnapshot();
  if (!data) return;
  S.relay.ws.send(JSON.stringify({ type: 'relay-snapshot', data: data }));
}

function collectSnapshot() {
  const snap = {
    role: S.role,
    isHost: S.isHost,
    myCharacter: S.myCharacter || null,
    otherCharacter: S.otherCharacter || null,
    groqKey: S.groqKey || '',
    G: {
      turn: G.turn,
      veilStrength: G.veilStrength,
      muralLayer: G.muralLayer,
      energy: G.energy,
      notes: G.notes,
      fantasyHistory: G.fantasyHistory,
      realityHistory: G.realityHistory,
      openingDone: G.openingDone,
      fantasyChoices: G.fantasyChoices,
      realityChoices: G.realityChoices,
      pendingChoices: G.pendingChoices
    },
    sceneOrder: SCENE_ORDER.slice(),
    currentScene: currentSceneId(),
    advanceReady: { me: ADVANCE_READY.me, other: ADVANCE_READY.other }
  };

  if (CURRENT_SCENE && typeof CURRENT_SCENE.snapshot === 'function') {
    try { snap.sceneState = CURRENT_SCENE.snapshot(); }
    catch (e) { console.warn('[saintalia] scene snapshot() threw', e); }
  }

  return snap;
}

// ---- MESSAGE HOLD / RELEASE ----
let _held = null;

function holdIncoming() {
  _held = [];
}

function releaseIncoming() {
  const q = _held;
  _held = null;
  if (q) q.forEach(msg => dispatchMessage(msg));
}

function maybeHoldMessage(data) {
  if (!_held) return false;
  _held.push(data);
  return true;
}

// ---- RESTORE ENTRY POINT ----

function sessionRestore(snapshot, phase) {
  dbg('state', 'restoring from snapshot (phase: ' + phase + ')');
  holdIncoming();

  try {
    S.role = snapshot.role;
    S.isHost = snapshot.isHost;
    S.myCharacter = snapshot.myCharacter;
    S.otherCharacter = snapshot.otherCharacter;
    S.groqKey = snapshot.groqKey || '';

    document.body.classList.remove('theme-fantasy', 'theme-artist');
    document.body.classList.add(S.role === 'fantasy' ? 'theme-fantasy' : 'theme-artist');

    if (phase === 'char') {
      restoreCharPhase(snapshot);
    } else if (phase === 'game') {
      restoreGamePhase(snapshot);
    }
  } catch (e) {
    console.error('[saintalia] restore failed', e);
    setLinkLost('Reconnected, but the scene could not be restored. ' + e.message, 'error');
  }

  releaseIncoming();
}

function restoreCharPhase(snapshot) {
  setScreen('char');
  document.body.innerHTML = buildCharScreen();
  initCharScreen();

  if (snapshot.myCharacter) {
    S.myCharacter = snapshot.myCharacter;
    document.querySelector('.tabs').style.display = 'none';
    document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
    const waiting = document.getElementById('waitScreen');
    if (waiting) waiting.classList.add('on');
    const accentCol = S.role === 'fantasy' ? '#ff7ddd' : '#9fc0da';
    const sumCard = document.getElementById('sumCard');
    if (sumCard && S.myCharacter) {
      sumCard.innerHTML =
        '<div class="sum-name" style="color:' + accentCol + '">' + S.myCharacter.name + '</div>' +
        '<p class="sum-line">' + (S.myCharacter.race ? S.myCharacter.race.name : '') + (S.myCharacter.job ? ' · ' + S.myCharacter.job.name : '') + '</p>';
    }
    checkBothReady();
  }
}

function restoreGamePhase(snapshot) {
  var sg = snapshot.G || {};
  G.turn = sg.turn || 1;
  G.veilStrength = sg.veilStrength || 5;
  G.muralLayer = sg.muralLayer || 0;
  G.energy = sg.energy || 100;
  G.notes = sg.notes || [];
  G.fantasyHistory = sg.fantasyHistory || [];
  G.realityHistory = sg.realityHistory || [];
  G.openingDone = sg.openingDone || false;
  G.fantasyChoices = sg.fantasyChoices || [];
  G.realityChoices = sg.realityChoices || [];
  G.pendingChoices = sg.pendingChoices || { fantasy: null, reality: null };

  if (snapshot.sceneOrder && snapshot.sceneOrder.length) {
    setSceneOrder(snapshot.sceneOrder);
  }

  var sceneId = snapshot.currentScene;
  if (!sceneId || !SCENES[sceneId]) {
    setLinkLost('Reconnected, but the scene "' + sceneId + '" is not registered.', 'error');
    return;
  }

  var opts = { restore: snapshot.sceneState || {} };
  if (snapshot.advanceReady) opts.advanceReady = snapshot.advanceReady;
  document.body.innerHTML = '';
  mountScene(sceneId, opts);
}
