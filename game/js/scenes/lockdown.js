// ============================================================
// SAINTALIA -- SCENE: THE LOCKDOWN (Layer 1)
// Author: Maridizzle
//
// Ported from saintalia-lockdown-2p-v2.html. The content is untouched and
// lives in data/scenes/lockdown.js. What changed is everything around it.
//
// WHAT WAS STRIPPED OUT, and why
//   Its own PeerJS layer, its own 4-digit PIN lobby, its own S object.
//     The merged app has one connection, made once, in connection.js.
//   Its own character setup.
//     Players build one character in character.js and carry it through.
//   Its own note threads (#noteThreadArtist / #noteThreadP2).
//     The vault makes notes the through-line across every scene, so this
//     scene renders the SHARED note IDs and the shared sendNote/receiveNote
//     handle it. G.notes keeps accumulating across the whole run, and the
//     Opening's notes are replayed here on mount.
//   Its own addEntry(tag, text, type).
//     Three files defined addEntry with three different argument orders.
//     This scene uses a local lkEntry() instead, so nothing collides.
//   Its own callGroq.
//     Only the host holds a key. The artist may be the joiner, so narration
//     goes through requestNarration(), which proxies to the host.
//
// ROLE MAPPING
//   artist = reality, p2 = fantasy. The vault's names, our sides.
//
// OBJECT STATE
//   The sandbox tracked `found` on the shared OBJECTS data, which meant a
//   second run in the same page load started with everything already found,
//   and P2's copy was never updated at all (receiveFlash poked the DOM
//   directly). State lives in LK now, per mount, and both sides are told.
// ============================================================

// Per-mount state. Reset by mount(), never stored on the content data.
let LK = null;

function lkReset() {
  LK = {
    roomId: 'entrance',
    found: {},        // objectId -> true
    foundCount: 0,
    thinking: false,
    ctx: null,
    complete: false,
    log: []
  };
}

// ---- LOCAL HELPERS ----
// Named lk* so they cannot collide with the Opening's or the 15 Questions'
// functions of similar purpose and different signature.

function lkEntry(tag, text, type) {
  if (LK) LK.log.push({ tag: tag, text: text, type: type });
  const feed = document.getElementById('lkFeed');
  if (!feed) return;
  const entry = document.createElement('div');
  entry.className = 'story-entry ' + type;
  const t = document.createElement('span');
  t.className = 'entry-tag';
  t.textContent = tag;
  const b = document.createElement('div');
  b.className = 'entry-body';
  b.textContent = text;
  entry.appendChild(t);
  entry.appendChild(b);
  feed.appendChild(entry);
  feed.scrollTop = feed.scrollHeight;
}

function lkSetThinking(on) {
  LK.thinking = on;
  const el = document.getElementById('lkThinking');
  if (el) el.classList.toggle('on', on);
  const btn = document.getElementById('lkActBtn');
  const inp = document.getElementById('lkInput');
  if (btn) btn.disabled = on;
  if (inp) inp.disabled = on;
}

function lkRoom() { return LOCKDOWN_ROOMS[LK.roomId]; }

function lkUpdateRoomIndicator() {
  const room = lkRoom();
  const n = document.getElementById('lkRoomName');
  const e = document.getElementById('lkRoomExits');
  if (n) n.textContent = room.name;
  if (e) e.textContent = 'Exits: ' + Object.keys(room.exits).join(', ');
}

// ---- INPUT CLASSIFIERS (ported verbatim in behavior) ----

const LK_CONTACT_WORDS = ['touch','grab','pick up','take','hold','press','reach for','lift','examine closely','handle','feel','clutch','pick it up','take it'];
const LK_INSPECT_WORDS = [...LK_CONTACT_WORDS, 'examine','inspect','look at','check','poke','open'];
const LK_SEARCH_WORDS = ['search','look around','examine','investigate','explore','scan','check','inspect','look at the room','look around the room'];
const LK_COMPASS_NAMES = { N: 'north', S: 'south', E: 'east', W: 'west' };

function lkDetectMovement(action) {
  const a = action.toLowerCase();
  const dirMap = {
    'north':'N','go north':'N','n':'N','head north':'N','move north':'N','walk north':'N',
    'south':'S','go south':'S','s':'S','head south':'S','move south':'S','walk south':'S',
    'east':'E','go east':'E','e':'E','head east':'E','move east':'E','walk east':'E',
    'west':'W','go west':'W','w':'W','head west':'W','move west':'W','walk west':'W',
  };
  for (const [phrase, dir] of Object.entries(dirMap)) {
    if (a === phrase || a.startsWith(phrase + ' ') || a.endsWith(' ' + phrase)) return dir;
  }
  return null;
}

function lkDetectObjectContact(action) {
  const a = action.toLowerCase();
  if (!LK_CONTACT_WORDS.some(w => a.includes(w))) return null;
  const room = lkRoom();
  if (!room.object) return null;
  const obj = LOCKDOWN_OBJECTS[room.object];
  if (LK.found[obj.id]) return null;
  const mentioned = obj.aliases.some(w => a.includes(w));
  if (mentioned || a.includes(' it') || a.includes('the object') || a.includes('the thing')) return obj;
  return null;
}

function lkDetectDecorContact(action) {
  const a = action.toLowerCase();
  if (!LK_INSPECT_WORDS.some(w => a.includes(w))) return null;
  const decorList = LOCKDOWN_DECOR[lkRoom().id] || [];
  for (const decor of decorList) {
    if (decor.aliases.some(w => a.includes(w))) return decor;
  }
  return null;
}

function lkDetectSearch(action) {
  const a = action.toLowerCase();
  return LK_SEARCH_WORDS.some(w => a.includes(w));
}

// ---- NARRATION ----

function lkBuildSystemPrompt() {
  const room = lkRoom();
  const foundObjects = Object.keys(LK.found).map(id => LOCKDOWN_OBJECTS[id].name).join(', ') || 'none yet';
  const recentNotes = G.notes.slice(-3).map(n => (n.from === 'fantasy' ? 'P2' : 'Artist') + ': ' + n.text).join(' | ') || 'none';
  const roomObject = room.object ? LOCKDOWN_OBJECTS[room.object] : null;
  const objectPresent = roomObject && !LK.found[roomObject.id];
  return `You are narrating the artist's side of a horror puzzle called the Lockdown in Saintalia. The artist is trapped in a sealed building. They must find five wrong objects to escape.

CURRENT ROOM: ${room.name}
ROOM DESCRIPTION: ${room.desc}
AVAILABLE EXITS: ${Object.entries(room.exits).map(([d,r]) => d + ' to ' + LOCKDOWN_ROOMS[r].name).join(', ')}
${objectPresent ? 'WRONG OBJECT IN THIS ROOM: ' + roomObject.name + ' -- present but not yet found unless player searches or examines' : 'NO WRONG OBJECT IN THIS ROOM'}
OBJECTS FOUND SO FAR: ${foundObjects}
RECENT NOTES FROM P2: ${recentNotes}

RULES:
- Write vivid unsettling literary horror prose, between 250 and 350 words
- Always mention available exits naturally, and describe their compass direction clearly (e.g. "a doorway to the north", "an opening to the east")
- If there is a wrong object AND the player is searching or looking around, describe the wrong object vividly and make its wrongness unmistakable -- it should stand out clearly from the rest of the room's decor, even if the prose stays oblique and unsettling
- If the player explicitly makes physical contact with the wrong object, end your response with a new line: OBJECT_TOUCHED
- Do not include OBJECT_TOUCHED unless the action is explicit physical contact
- Do not break character or explain game mechanics`;
}

function lkOfflineNarration(room, objectFound) {
  const exits = Object.entries(room.exits).map(([d,r]) => 'a way ' + LK_COMPASS_NAMES[d] + ' toward the ' + LOCKDOWN_ROOMS[r].name).join(', and ');
  if (objectFound) {
    const obj = LOCKDOWN_OBJECTS[room.object];
    return `${room.desc} Your hand closes around it before you fully decide to reach -- ${obj.name}, here in the ${room.name.toLowerCase()}, exactly where it should not be. It is real. It is solid. It is wrong in a way that the rest of the room is not, and the wrongness does not fade now that you are touching it. If anything it sharpens, becomes more itself, as if your attention has fed it. Somewhere behind your eyes something shifts loose. There is a sound like a held breath, very far away, and then nothing. The room around you does not change, but it feels like it is waiting to see what you do next. To leave, ${exits}.`;
  }
  return `${room.desc} You take a slow breath and let your eyes move over everything -- the ordinary and the not-ordinary, side by side, refusing to announce which is which. Nothing reaches for you. Nothing moves that should not move, not this time. The building holds its shape around you, patient, listening to the sound of your own breathing as if it were unfamiliar. To continue, ${exits}.`;
}

// ---- ARTIST TURN ----

async function lkAct() {
  if (LK.thinking) return;
  const input = document.getElementById('lkInput');
  if (!input || !input.value.trim()) return;
  const action = input.value.trim();
  input.value = '';

  lkEntry('Your action', action, 'action');

  // MOVEMENT
  const dir = lkDetectMovement(action);
  if (dir) {
    const room = lkRoom();
    if (!room.exits[dir]) {
      lkEntry('The building', 'That way is sealed. The door handle turns freely but the door does not open -- not stuck, simply not opening.', 'narrator');
      return;
    }
    LK.roomId = room.exits[dir];
    lkUpdateRoomIndicator();
    LK.ctx.send({ kind: 'position', roomId: LK.roomId });

    lkSetThinking(true);
    const newRoom = lkRoom();
    let narration = await requestNarration(lkBuildSystemPrompt(), 'The artist moves ' + dir + ' into ' + newRoom.name + '. Describe what they find as they enter.', 900);
    if (!narration) narration = newRoom.desc + ' Exits: ' + Object.keys(newRoom.exits).join(', ') + '.';
    lkEntry('The building', narration, 'narrator');
    lkSetThinking(false);
    return;
  }

  const contactObj = lkDetectObjectContact(action);
  const isSearch = lkDetectSearch(action);
  const room = lkRoom();
  const roomObj = room.object ? LOCKDOWN_OBJECTS[room.object] : null;

  // ORDINARY DECOR. A flat canned answer, no AI call at all. This is how the
  // scene teaches you what is not worth your attention.
  if (!contactObj) {
    const decor = lkDetectDecorContact(action);
    if (decor) {
      lkEntry('The building', 'There is nothing special about ' + decor.name + '.', 'narrator');
      return;
    }
  }

  lkSetThinking(true);

  let prompt = action;
  if (isSearch && roomObj && !LK.found[roomObj.id]) prompt = action + ' [NOTE: the wrong object is present and should be described]';
  if (contactObj) prompt = action + ' [NOTE: player making direct physical contact with ' + contactObj.name + ']';

  let narration = await requestNarration(lkBuildSystemPrompt(), prompt, 900);
  let touched = false;

  if (narration) {
    touched = narration.includes('OBJECT_TOUCHED');
    narration = narration.replace(/\nOBJECT_TOUCHED.*$/m, '').trim();
  } else {
    narration = lkOfflineNarration(room, isSearch && roomObj && !LK.found[roomObj.id]);
    if (contactObj) touched = true;
  }

  lkEntry('The building', narration, 'narrator');
  lkSetThinking(false);

  if ((touched || contactObj) && roomObj && !LK.found[roomObj.id]) {
    setTimeout(() => lkFireFlash(roomObj), 400);
  }
}

function lkFireFlash(obj) {
  if (LK.found[obj.id]) return;
  LK.found[obj.id] = true;
  LK.foundCount++;

  const flashText = LOCKDOWN_FLASHES[obj.flashName];
  lkEntry('Flash -- ' + obj.flashName, flashText, 'flash');

  LK.ctx.send({
    kind: 'flash',
    objectId: obj.id,
    pointId: obj.pointId,
    flashName: obj.flashName,
    flashText,
    objName: obj.name
  });

  if (LK.foundCount === 5) {
    setTimeout(() => {
      lkEntry('The building', 'Something shifts deep in the walls. A sound like held breath released after a long time. All three exits unlock simultaneously. The building is letting you go.', 'system');
      LK.ctx.send({ kind: 'complete' });
      lkMarkComplete();
    }, 800);
  }
}

function lkMarkComplete() {
  LK.complete = true;
  if (typeof G !== 'undefined') G.lockdownFound = LK.foundCount;
  const card = document.getElementById('lkComplete');
  if (card) card.classList.add('show');
  const cont = document.getElementById('lkContinue');
  if (cont) cont.style.display = 'block';
}

// ---- P2 GRID ----

function lkBuildGrid() {
  const canvas = document.getElementById('lkGrid');
  if (!canvas) return;
  Object.values(LOCKDOWN_OBJECTS).forEach(obj => {
    const dot = document.createElement('div');
    dot.className = 'pressure-dot';
    dot.id = 'lkDot-' + obj.pointId;
    dot.style.left = obj.gridX + '%';
    dot.style.top = obj.gridY + '%';
    canvas.appendChild(dot);

    const num = document.createElement('div');
    num.className = 'pressure-dot-num';
    num.style.left = obj.gridX + '%';
    num.style.top = (obj.gridY + 5) + '%';
    num.textContent = obj.pointId;
    canvas.appendChild(num);
  });
  lkMoveMarker('entrance');
}

function lkMoveMarker(roomId) {
  const pos = LOCKDOWN_ROOM_POSITIONS[roomId];
  const marker = document.getElementById('lkMarker');
  if (!pos || !marker) return;
  marker.style.left = pos.x + '%';
  marker.style.top = pos.y + '%';
  marker.style.transition = 'left 0.4s ease, top 0.4s ease';
}

function lkUpdatePills() {
  const container = document.getElementById('lkPills');
  if (!container) return;
  container.innerHTML = '';
  Object.values(LOCKDOWN_OBJECTS).forEach(obj => {
    const pill = document.createElement('div');
    pill.className = 'point-pill' + (LK.found[obj.id] ? ' touched' : '');
    pill.id = 'lkPill-' + obj.pointId;
    pill.textContent = obj.pointId + '. ' + obj.shortName + ' -- ' + obj.hint;
    container.appendChild(pill);
  });
}

function lkReceiveFlash(data) {
  // Real state on this side too, not just DOM poking. The sandbox never told
  // P2 anything, so its copy of the world was always wrong.
  LK.found[data.objectId] = true;
  LK.foundCount = Object.keys(LK.found).length;

  const dot = document.getElementById('lkDot-' + data.pointId);
  if (dot) dot.classList.add('touched');
  const pill = document.getElementById('lkPill-' + data.pointId);
  if (pill) pill.classList.add('touched');

  const log = document.getElementById('lkFlashLog');
  const empty = document.getElementById('lkFlashEmpty');
  if (empty) empty.remove();
  if (log) {
    const item = document.createElement('div');
    item.className = 'flash-item';
    const name = document.createElement('span');
    name.className = 'flash-item-name';
    name.textContent = data.flashName + ' -- ' + data.objName;
    item.appendChild(name);
    item.appendChild(document.createTextNode(data.flashText));
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
  }
}

// ---- SHARED NOTE BLOCK ----
// Uses the shared element IDs on purpose, so sendNote, receiveNote and
// addNoteToThread from game.js work here untouched and G.notes keeps
// accumulating across the whole run.

function lkNoteBlockHtml(placeholder) {
  return `
    <div class="note-center">
      <div class="note-center-label">Notes Through the Veil</div>
      <div class="note-thread" id="noteThread"></div>
      <div class="note-compose-row">
        <input class="note-input-center" id="noteInput" placeholder="${placeholder}" maxlength="200" />
        <button class="note-send-center" id="noteSendBtn" onclick="sendNote(S.role)">Send</button>
      </div>
    </div>`;
}

function lkReplayNotes() {
  const thread = document.getElementById('noteThread');
  if (!thread) return;
  thread.innerHTML = '';
  G.notes.forEach(n => addNoteToThread(n.from, n.text));
}

// ---- THE SCENE ----

const SceneLockdown = {
  id: 'lockdown',
  title: 'The Lockdown',

  mount(root, ctx) {
    lkReset();
    LK.ctx = ctx;
    setScreen('game');

    if (ctx.restoring && ctx.restore) {
      this._restore(root, ctx);
      return;
    }

    const isArtist = (ctx.role === 'reality');
    root.className = 'lk-wrap ' + (isArtist ? 'lk-artist-side' : 'lk-p2-side');

    root.innerHTML = isArtist ? this._artistHtml(ctx) : this._p2Html(ctx);

    if (isArtist) {
      lkUpdateRoomIndicator();
      lkEntry(
        'The building seals',
        'The exit sign you passed three minutes ago is dark. You try the nearest door. The handle moves freely but the door does not open -- not stuck, not locked in any mechanical sense, simply not opening. The entrance hall stretches around you, two pillars flanking the center, the scaffolding from your mural project filling the far corner under its restless canvas. Your phone has signal, and on the other side of it, P2 is watching a grid of lights -- one of them is you. Somewhere in this building are five objects that do not belong, each one wrong in a way that should be obvious once you are looking right at it. Searching a room carefully will reveal if one is here. Touching, taking, or examining one closely will trigger something. Everything else in these rooms -- the furniture, the fixtures, the ordinary clutter -- is just that: ordinary. Type what you do. You can move with simple compass directions (go north, head east, west), or search the room, or interact with something specific.',
        'narrator'
      );
      const inp = document.getElementById('lkInput');
      if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !LK.thinking) lkAct(); });
    } else {
      lkBuildGrid();
      lkUpdatePills();
    }

    lkReplayNotes();
    const noteInput = document.getElementById('noteInput');
    if (noteInput) noteInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendNote(S.role); });
  },

  unmount() {
    // All listeners live on elements inside root, so they die with the DOM.
    // LK is dropped so a remount starts clean rather than inheriting a
    // half-finished building.
    LK = null;
  },

  onMessage(p) {
    if (!LK) return;
    if (p.kind === 'position') lkMoveMarker(p.roomId);
    if (p.kind === 'flash') lkReceiveFlash(p);
    if (p.kind === 'complete') lkMarkComplete();
  },

  isComplete() {
    return !!(LK && LK.complete);
  },

  exportState() {
    return LK ? { found: Object.keys(LK.found), roomId: LK.roomId, complete: LK.complete } : null;
  },

  snapshot() {
    if (!LK) return null;
    return {
      roomId: LK.roomId,
      found: LK.found,
      foundCount: LK.foundCount,
      complete: LK.complete,
      log: LK.log
    };
  },

  _restore(root, ctx) {
    const r = ctx.restore;
    LK.roomId = r.roomId || 'entrance';
    LK.found = r.found || {};
    LK.foundCount = r.foundCount || 0;
    LK.complete = r.complete || false;
    LK.log = r.log || [];
    LK.ctx = ctx;

    const isArtist = (ctx.role === 'reality');
    root.className = 'lk-wrap ' + (isArtist ? 'lk-artist-side' : 'lk-p2-side');
    root.innerHTML = isArtist ? this._artistHtml(ctx) : this._p2Html(ctx);

    if (isArtist) {
      lkUpdateRoomIndicator();
      const feed = document.getElementById('lkFeed');
      LK.log.forEach(entry => {
        if (!feed) return;
        const el = document.createElement('div');
        el.className = 'story-entry ' + entry.type;
        const t = document.createElement('span');
        t.className = 'entry-tag';
        t.textContent = entry.tag;
        const b = document.createElement('div');
        b.className = 'entry-body';
        b.textContent = entry.text;
        el.appendChild(t);
        el.appendChild(b);
        feed.appendChild(el);
      });
      if (feed) feed.scrollTop = feed.scrollHeight;

      const inp = document.getElementById('lkInput');
      if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !LK.thinking) lkAct(); });
    } else {
      lkBuildGrid();
      lkMoveMarker(LK.roomId);
      lkUpdatePills();
      Object.keys(LK.found).forEach(objId => {
        const obj = LOCKDOWN_OBJECTS[objId];
        if (!obj) return;
        const dot = document.getElementById('lkDot-' + obj.pointId);
        if (dot) dot.classList.add('touched');
      });
      if (LK.foundCount > 0) {
        const empty = document.getElementById('lkFlashEmpty');
        if (empty) empty.remove();
        const flashLog = document.getElementById('lkFlashLog');
        if (flashLog) {
          Object.keys(LK.found).forEach(objId => {
            const obj = LOCKDOWN_OBJECTS[objId];
            if (!obj) return;
            const flashText = LOCKDOWN_FLASHES[obj.flashName];
            const item = document.createElement('div');
            item.className = 'flash-item';
            const name = document.createElement('span');
            name.className = 'flash-item-name';
            name.textContent = obj.flashName + ' -- ' + obj.name;
            item.appendChild(name);
            item.appendChild(document.createTextNode(flashText));
            flashLog.appendChild(item);
          });
        }
      }
    }

    if (LK.complete) lkMarkComplete();
    lkReplayNotes();
    const noteInput = document.getElementById('noteInput');
    if (noteInput) noteInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendNote(S.role); });
  },

  _artistHtml(ctx) {
    return `
    <div class="lk-artist">
      <div class="room-indicator">
        <span class="room-name" id="lkRoomName">Entrance Hall</span>
        <span class="room-exits" id="lkRoomExits"></span>
      </div>
      <div class="story-feed" id="lkFeed"></div>
      <div class="thinking-row" id="lkThinking">The building listens...</div>
      <div class="action-row">
        <input class="action-input" id="lkInput" placeholder="What do you do... (go north, search the room, touch the clock...)" maxlength="200" />
        <button class="action-btn" id="lkActBtn" onclick="lkAct()">Act</button>
      </div>
      ${lkNoteBlockHtml('Send a note to the other side...')}
      <button class="btn-primary" id="lkContinue" style="display:none" onclick="requestAdvance()">The building releases you</button>
    </div>`;
  },

  _p2Html(ctx) {
    return `
    <div class="lk-p2">
      <div class="grid-card">
        <div class="grid-label">Pressure point grid (oriented N/S/E/W) -- the red marker shows where the Artist is right now. Each green dot is a wrong object; its label tells you roughly where it sits relative to the entrance. Dots go dark when found. Use the compass directions in your notes to guide the Artist.</div>
        <div class="grid-canvas" id="lkGrid">
          <div class="compass-label compass-n">N</div>
          <div class="compass-label compass-s">S</div>
          <div class="compass-label compass-e">E</div>
          <div class="compass-label compass-w">W</div>
          <div class="artist-marker" id="lkMarker">A</div>
        </div>
        <div class="drag-hint">The red marker moves automatically as the Artist navigates. Watch the green dots go dark as objects are found.</div>
      </div>
      <div class="points-status" id="lkPills"></div>
      <div class="flash-log" id="lkFlashLog">
        <div class="flash-log-label">Flash transmissions received</div>
        <div class="flash-empty" id="lkFlashEmpty">Nothing yet. The artist has not touched anything wrong.</div>
      </div>
      ${lkNoteBlockHtml('Guide the artist...')}
      <div class="completion-card" id="lkComplete">
        <p>All five points dark. The building is releasing.</p>
      </div>
      <button class="btn-primary" id="lkContinue" style="display:none" onclick="requestAdvance()">The building releases them</button>
    </div>`;
  }
};

registerScene(SceneLockdown);
