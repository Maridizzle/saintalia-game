// ============================================================
// SAINTALIA -- SESSION RESTORE AND PERSISTENCE (Phase 11b)
// Author: Maridizzle
//
// Part 1: snapshot collection, debounced sending, message hold/release
// during restore, and the restore entry point.
//
// Part 2: Postgres persistence. Named save slots so a game survives a
// server restart and players can come back days later. Each role gets a
// random save token at room creation; rows are gated on it.
//
// Loaded after game.js, before the scene files, so scene snapshot()
// methods exist by the time this runs but nothing here is called at
// load time.
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

// ---- PERSISTENCE (PHASE 11b part 2) ----
// Save token: fetched once per session when the room is joined. Stored in
// S.saveToken and used as the X-Save-Token header on every save/load call.

let _saveToken = null;

async function fetchSaveToken() {
  if (_saveToken) return _saveToken;
  if (!S.relay || !S.relay.code || !S.role) return null;
  try {
    var r = await fetch('/api/save-token?room=' + encodeURIComponent(S.relay.code) + '&role=' + encodeURIComponent(S.role), { cache: 'no-store' });
    if (!r.ok) return null;
    var data = await r.json();
    _saveToken = data.token || null;
    return _saveToken;
  } catch (e) { return null; }
}

function splitSaveData() {
  var snap = collectSnapshot();
  if (!snap) return null;

  var shared = {
    currentScene: snap.currentScene,
    sceneOrder: snap.sceneOrder,
    turn: snap.G.turn,
    veilStrength: snap.G.veilStrength,
    muralLayer: snap.G.muralLayer,
    energy: snap.G.energy,
    notes: snap.G.notes,
    myCharacter: snap.myCharacter,
    otherCharacter: snap.otherCharacter,
    advanceReady: snap.advanceReady,
    openingDone: snap.G.openingDone
  };

  var priv = {
    role: snap.role,
    isHost: snap.isHost,
    sceneState: snap.sceneState || {},
    fantasyHistory: snap.G.fantasyHistory,
    realityHistory: snap.G.realityHistory,
    fantasyChoices: snap.G.fantasyChoices,
    realityChoices: snap.G.realityChoices,
    pendingChoices: snap.G.pendingChoices
  };

  return { shared: shared, private: priv };
}

async function saveGame(slot) {
  var token = await fetchSaveToken();
  if (!token) {
    showSaveStatus('Save not available (no token).', true);
    return false;
  }
  var data = splitSaveData();
  if (!data) {
    showSaveStatus('Nothing to save yet.', true);
    return false;
  }
  try {
    var r = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Save-Token': token },
      body: JSON.stringify({
        room: S.relay.code,
        role: S.role,
        slot: slot || 'manual',
        shared: data.shared,
        private: data.private
      })
    });
    if (!r.ok) {
      var err = await r.json().catch(function() { return {}; });
      showSaveStatus('Save failed: ' + (err.error || r.status), true);
      return false;
    }
    showSaveStatus('Saved.');
    return true;
  } catch (e) {
    showSaveStatus('Save failed: ' + e.message, true);
    return false;
  }
}

async function loadSaves() {
  var token = await fetchSaveToken();
  if (!token) return [];
  try {
    var r = await fetch('/api/save?room=' + encodeURIComponent(S.relay.code) + '&role=' + encodeURIComponent(S.role), {
      headers: { 'X-Save-Token': token }
    });
    if (!r.ok) return [];
    var data = await r.json();
    return data.saves || [];
  } catch (e) { return []; }
}

function showSaveStatus(msg, isError) {
  var el = document.getElementById('save-status');
  if (!el) {
    el = document.createElement('div');
    el.id = 'save-status';
    el.style.cssText = 'position:fixed;bottom:3.5rem;right:0.8rem;z-index:9997;font-family:Cinzel,serif;font-size:0.72rem;letter-spacing:0.12em;padding:0.4rem 0.8rem;border-radius:3px;pointer-events:none;transition:opacity 0.6s;';
    document.body.appendChild(el);
  }
  el.style.background = isError ? 'rgba(139,26,26,0.92)' : 'rgba(45,27,78,0.92)';
  el.style.color = '#f5efe0';
  el.style.opacity = '1';
  el.textContent = msg;
  clearTimeout(el._timer);
  el._timer = setTimeout(function() { el.style.opacity = '0'; }, 3000);
}

function autoCheckpoint() {
  saveGame('auto');
}

function downloadSaveKey() {
  var token = _saveToken;
  if (!token || !S.relay || !S.role) return;
  var charName = S.myCharacter ? S.myCharacter.name : 'unknown';
  var date = new Date().toISOString().split('T')[0];
  var text = 'Saintalia Save Key\n' +
    '------------------\n' +
    'Date: ' + date + '\n' +
    'Room: ' + S.relay.code + '\n' +
    'Role: ' + S.role + '\n' +
    'Character: ' + charName + '\n' +
    'Token: ' + token + '\n\n' +
    'Keep this file to resume your game.\n';
  var blob = new Blob([text], { type: 'text/plain' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'saintalia-' + S.relay.code + '-' + S.role + '.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function addSaveButton() {
  if (document.getElementById('save-btn')) return;
  var btn = document.createElement('button');
  btn.id = 'save-btn';
  btn.className = 'save-btn';
  btn.textContent = 'Save';
  btn.title = 'Save your game';
  btn.onclick = function() { saveGame('manual'); };
  document.body.appendChild(btn);

  var dlBtn = document.createElement('button');
  dlBtn.id = 'save-key-btn';
  dlBtn.className = 'save-key-btn';
  dlBtn.textContent = 'Save Key';
  dlBtn.title = 'Download your save key file';
  dlBtn.onclick = downloadSaveKey;
  document.body.appendChild(dlBtn);
}

function removeSaveButton() {
  var btn = document.getElementById('save-btn');
  if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
  var dlBtn = document.getElementById('save-key-btn');
  if (dlBtn && dlBtn.parentNode) dlBtn.parentNode.removeChild(dlBtn);
}

// Show saved slots on the lobby resume panel.
async function showResumeSaves() {
  var section = document.getElementById('resume-section');
  if (!section) return;
  var saves = await loadSaves();
  if (!saves || !saves.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  var container = document.getElementById('resume-slots');
  if (!container) return;
  container.innerHTML = '';
  saves.forEach(function(save) {
    var slot = document.createElement('div');
    slot.className = 'resume-slot';
    var scene = (save.shared && save.shared.currentScene) || '?';
    var turn = (save.shared && save.shared.turn) || '?';
    var date = save.updated_at ? new Date(save.updated_at).toLocaleString() : '';
    slot.innerHTML = '<div><span class="resume-slot-name">' + save.slot + '</span></div>' +
      '<div class="resume-slot-info">' + scene + ' / turn ' + turn + '<br>' + date + '</div>';
    slot.onclick = function() { resumeFromSlot(save); };
    container.appendChild(slot);
  });
}

function resumeFromSlot(save) {
  if (!save.shared || !save.private) return;
  var snapshot = rebuildSnapshot(save.shared, save.private);
  if (typeof relayRemember === 'function') relayRemember({ phase: 'game' });
  if (S.conn && S.conn.open) {
    S.conn.send({ type: 'resume', shared: save.shared, slot: save.slot });
  }
  document.getElementById('debug').style.display = 'none';
  sessionRestore(snapshot, 'game');
}

function rebuildSnapshot(shared, priv) {
  return {
    role: priv.role || S.role,
    isHost: priv.isHost !== undefined ? priv.isHost : S.isHost,
    myCharacter: shared.myCharacter || S.myCharacter,
    otherCharacter: shared.otherCharacter || S.otherCharacter,
    groqKey: S.groqKey || '',
    G: {
      turn: shared.turn || 1,
      veilStrength: shared.veilStrength || 5,
      muralLayer: shared.muralLayer || 0,
      energy: shared.energy || 100,
      notes: shared.notes || [],
      fantasyHistory: priv.fantasyHistory || [],
      realityHistory: priv.realityHistory || [],
      openingDone: shared.openingDone || false,
      fantasyChoices: priv.fantasyChoices || [],
      realityChoices: priv.realityChoices || [],
      pendingChoices: priv.pendingChoices || { fantasy: null, reality: null }
    },
    sceneOrder: shared.sceneOrder || [],
    currentScene: shared.currentScene,
    sceneState: priv.sceneState || {},
    advanceReady: shared.advanceReady || { me: false, other: false }
  };
}

function toggleResumeToken() {
  var m = document.getElementById('resume-manual');
  if (m) m.style.display = m.style.display === 'none' ? 'flex' : 'none';
}

async function resumeWithToken() {
  var input = document.getElementById('resume-token-input');
  if (!input || !input.value.trim()) return;
  _saveToken = input.value.trim();
  await showResumeSaves();
}
