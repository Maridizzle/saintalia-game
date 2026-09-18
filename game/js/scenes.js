// ============================================================
// SAINTALIA -- SCENE MANAGER
// Author: Maridizzle
//
// One scene is mounted at a time. The manager owns the order, the handoff,
// and the routing, so a scene never has to know what came before it or what
// comes next.
//
// WHY THIS EXISTS
// The three original files each built their own connection, their own
// character setup, and their own globals. All three define S, callGroq,
// addEntry, setThinking, launchGame, sendNote and receiveNote, and every one
// of them has a different shape. addEntry alone has three different argument
// orders. Concatenated, the last definition silently wins and things break in
// ways that look like logic bugs rather than load-order bugs.
//
// So: scenes are objects, not files full of globals. They register
// themselves, get mounted into a root element, and talk over a scoped
// channel that drops anything addressed to a scene that is not on screen.
//
// THE SCENE INTERFACE
//   id          string, unique, used in message routing
//   title       string, for logs and transitions
//   mount(root, ctx)   build your DOM into root
//   unmount()          optional. Tear down timers and anything not in the DOM
//   onMessage(payload) optional. Your scoped messages, already unwrapped
//   isComplete()       optional. Have you finished
//   exportState()      optional. What you hand to whatever comes next
//
// ctx carries { role, isHost, me, other, send }. Shared helpers (addEntry,
// setThinking, callGroq, sendNote, the veil) stay global because every file
// here is a plain script tag, and pretending otherwise would add ceremony
// without adding safety.
// ============================================================

const SCENES = {};
let SCENE_ORDER = [];
let CURRENT_SCENE = null;
let SCENE_ROOT_ID = 'scene-root';

// Both sides have to agree before a scene hands off, or one player gets
// stranded in a scene the other has already left.
let ADVANCE_READY = { me: false, other: false };

// ---- REGISTRATION ----

function registerScene(scene) {
  if (!scene || !scene.id) {
    console.error('[saintalia] registerScene needs an object with an id', scene);
    return;
  }
  if (SCENES[scene.id]) {
    console.warn('[saintalia] scene "' + scene.id + '" registered twice. Keeping the first.');
    return;
  }
  if (typeof scene.mount !== 'function') {
    console.error('[saintalia] scene "' + scene.id + '" has no mount()');
    return;
  }
  SCENES[scene.id] = scene;
}

function setSceneOrder(ids) {
  const missing = ids.filter(id => !SCENES[id]);
  if (missing.length) {
    console.error('[saintalia] scene order names scenes that are not registered:', missing.join(', '));
  }
  SCENE_ORDER = ids.filter(id => SCENES[id]);
}

function currentSceneId() {
  return CURRENT_SCENE ? CURRENT_SCENE.id : null;
}

// ---- MOUNTING ----

function sceneRoot() {
  let root = document.getElementById(SCENE_ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = SCENE_ROOT_ID;
    document.body.appendChild(root);
  }
  return root;
}

function mountScene(id) {
  const scene = SCENES[id];
  if (!scene) {
    console.error('[saintalia] no scene registered as "' + id + '". Registered: ' + Object.keys(SCENES).join(', '));
    return false;
  }

  // Tear the old one down first, always, even if it throws. A scene that
  // fails to unmount must not block the next one from mounting.
  if (CURRENT_SCENE) {
    const old = CURRENT_SCENE;
    CURRENT_SCENE = null;
    if (typeof old.unmount === 'function') {
      try { old.unmount(); }
      catch (e) { console.error('[saintalia] scene "' + old.id + '" threw during unmount', e); }
    }
  }

  ADVANCE_READY = { me: false, other: false };

  const root = sceneRoot();
  root.innerHTML = '';

  const ctx = {
    role: S.role,
    isHost: S.isHost,
    me: S.myCharacter,
    other: S.otherCharacter,
    // Scoped send. The scene never touches S.conn directly, so it cannot
    // accidentally collide with another scene's message names.
    send: (payload) => sendSceneMessage(id, payload)
  };

  try {
    scene.mount(root, ctx);
  } catch (e) {
    console.error('[saintalia] scene "' + id + '" threw during mount', e);
    root.innerHTML = '<div style="padding:2rem;text-align:center;font-family:Cinzel,serif;color:#c0392b;">'
      + 'This scene failed to load: ' + id + '. Check the console.</div>';
    return false;
  }

  CURRENT_SCENE = scene;
  dbg('state', 'scene: ' + id);
  return true;
}

function nextSceneId() {
  const i = SCENE_ORDER.indexOf(currentSceneId());
  if (i === -1 || i + 1 >= SCENE_ORDER.length) return null;
  return SCENE_ORDER[i + 1];
}

// ---- SCOPED MESSAGING ----
// Everything a scene sends is wrapped with the scene id. The receiver drops
// anything addressed to a scene that is not currently mounted, which is what
// stops a late message from a finished scene firing into the next one.

function sendSceneMessage(sceneId, payload) {
  if (S.conn && S.conn.open) {
    S.conn.send({ type: 'scene-msg', scene: sceneId, payload });
  }
}

onMessage('scene-msg', (data) => {
  if (data.scene !== currentSceneId()) {
    console.warn('[saintalia] dropping scene-msg for "' + data.scene + '", current scene is "' + currentSceneId() + '"');
    return;
  }
  if (CURRENT_SCENE && typeof CURRENT_SCENE.onMessage === 'function') {
    CURRENT_SCENE.onMessage(data.payload);
  }
});

// Wrap a shared handler so it only fires while its own scene is on screen.
// Used by scenes that register global message types rather than scoped ones.
function forScene(sceneId, fn) {
  return (data) => {
    if (currentSceneId() !== sceneId) {
      console.warn('[saintalia] dropping "' + data.type + '" for scene "' + sceneId + '", current scene is "' + currentSceneId() + '"');
      return;
    }
    fn(data);
  };
}

// ---- ADVANCING ----
// This side says it is done. When both sides have said it, the host picks the
// next scene and tells everyone. Nobody moves on alone.

function requestAdvance() {
  if (ADVANCE_READY.me) return;
  ADVANCE_READY.me = true;

  if (S.conn && S.conn.open) {
    S.conn.send({ type: 'scene-ready', scene: currentSceneId() });
  }

  // Solo, or the other side already said yes.
  if (!S.conn || !S.conn.open) { doAdvance(); return; }
  if (ADVANCE_READY.other) tryAdvance();
}

onMessage('scene-ready', (data) => {
  if (data.scene !== currentSceneId()) return;
  ADVANCE_READY.other = true;
  if (ADVANCE_READY.me) tryAdvance();
});

function tryAdvance() {
  if (!S.isHost) return; // the host decides, so both sides cannot race
  if (!ADVANCE_READY.me || !ADVANCE_READY.other) return;
  doAdvance();
}

function doAdvance() {
  const next = nextSceneId();
  if (!next) {
    console.warn('[saintalia] "' + currentSceneId() + '" is the last scene in the order. Nothing to advance to.');
    return;
  }
  if (S.conn && S.conn.open) {
    S.conn.send({ type: 'scene-advance', to: next });
  }
  mountScene(next);
}

onMessage('scene-advance', (data) => {
  if (data.to === currentSceneId()) return; // already there
  mountScene(data.to);
});

// ---- DEBUG ----
// The Opening has no end condition yet, so without this there is no way to
// exercise mount and unmount. Goes away once real transitions land in
// PLAN.md Phase 8.
function debugAdvance() {
  if (!DEBUG) {
    console.warn('[saintalia] debugAdvance is only available with DEBUG on');
    return;
  }
  doAdvance();
}
