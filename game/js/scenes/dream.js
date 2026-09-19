// ============================================================
// SAINTALIA -- SCENE: THE DREAM (Layer 2, beat 2-A)
// Author: Maridizzle
//
// Both players sleep after The Sky Tears. The veil reaches through
// unconscious minds. The artist wakes in a white room with five
// objects and a wall of symbols. The fantasy player wakes on a
// translucent tower with a hologram showing the symbols.
//
// MECHANIC
//   The artist picks an object, describes it through notes, then
//   places it on a wall slot. The fantasy player sees symbols and
//   guides the artist to match each object to its symbol. A correct
//   placement fires the next flash in sequence (always 1-5). A wrong
//   placement drains energy on both sides and the object bounces back.
//
// OBJECTS
//   The same five from the Lockdown. Names and IDs come from
//   data/scenes/lockdown.js. The mapping between objects and symbols
//   lives in data/scenes/dream.js (DREAM_SYMBOLS).
//
// NARRATION
//   Flashes go through requestNarration with the guardrail as context.
//   The narrator expands the guardrail; the raw guardrail is the
//   offline fallback.
// ============================================================

let DM = null;

function dmReset() {
  DM = {
    placed: {},        // objectId -> slotIndex (correct placements only)
    placedCount: 0,
    holding: null,     // objectId currently selected by the artist
    slotMap: null,     // shuffled mapping: slotIndex -> objectId (correct answer)
    thinking: false,
    ctx: null,
    complete: false,
    introPlayed: false,
    log: []
  };
}

// ---- SLOT ASSIGNMENT ----
// Shuffle which symbol sits in which slot. The fantasy player sees the
// symbols in these positions and describes them. The correct placement
// is: object X goes into the slot that holds X's symbol.

function dmBuildSlotMap() {
  const ids = Object.keys(DREAM_SYMBOLS);
  // Fisher-Yates shuffle
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = ids[i]; ids[i] = ids[j]; ids[j] = t;
  }
  const map = {};
  ids.forEach(function(id, i) { map[i + 1] = id; });
  return map;
}

// Reverse map: objectId -> slotIndex
function dmCorrectSlot(objectId) {
  if (!DM || !DM.slotMap) return -1;
  for (var s in DM.slotMap) {
    if (DM.slotMap[s] === objectId) return parseInt(s, 10);
  }
  return -1;
}

// ---- LOCAL HELPERS ----

function dmEntry(tag, text, type) {
  if (DM) DM.log.push({ tag: tag, text: text, type: type });
  var feed = document.getElementById('dmFeed');
  if (!feed) return;
  var entry = document.createElement('div');
  entry.className = 'story-entry ' + type;
  var t = document.createElement('span');
  t.className = 'entry-tag';
  t.textContent = tag;
  var b = document.createElement('div');
  b.className = 'entry-body';
  b.textContent = text;
  entry.appendChild(t);
  entry.appendChild(b);
  feed.appendChild(entry);
  feed.scrollTop = feed.scrollHeight;
}

function dmSetThinking(on) {
  DM.thinking = on;
  var el = document.getElementById('dmThinking');
  if (el) el.classList.toggle('on', on);
}

function dmNoteBlockHtml(placeholder) {
  return '<div class="note-center">' +
    '<div class="note-center-label">Notes Through the Veil</div>' +
    '<div class="note-thread" id="noteThread"></div>' +
    '<div class="note-compose-row">' +
      '<input class="note-input-center" id="noteInput" placeholder="' + placeholder + '" maxlength="200" />' +
      '<button class="note-send-center" id="noteSendBtn" onclick="sendNote(S.role)">Send</button>' +
    '</div>' +
  '</div>';
}

function dmReplayNotes() {
  var thread = document.getElementById('noteThread');
  if (!thread) return;
  thread.innerHTML = '';
  G.notes.forEach(function(n) { addNoteToThread(n.from, n.text); });
}

// ---- OBJECT SELECTION (ARTIST) ----

function dmSelectObject(objectId) {
  if (!DM || DM.thinking || DM.complete) return;
  if (DM.placed[objectId]) return;
  DM.holding = objectId;
  var obj = LOCKDOWN_OBJECTS[objectId];
  if (!obj) return;

  // Highlight the selected object
  document.querySelectorAll('.dm-obj-btn').forEach(function(btn) {
    btn.classList.toggle('selected', btn.dataset.objId === objectId);
  });

  dmEntry('You pick up', obj.name + '.', 'action');
  DM.ctx.send({ kind: 'object-selected', objectId: objectId });

  // Show slot chooser
  var chooser = document.getElementById('dmSlotChooser');
  if (chooser) chooser.style.display = 'flex';
}

function dmPlaceOnSlot(slotIndex) {
  if (!DM || !DM.holding || DM.thinking || DM.complete) return;
  var objectId = DM.holding;
  var correctSlot = dmCorrectSlot(objectId);

  DM.ctx.send({ kind: 'attempt', objectId: objectId, slotIndex: slotIndex });

  if (slotIndex === correctSlot) {
    dmCorrectPlacement(objectId, slotIndex);
  } else {
    dmWrongPlacement(objectId, slotIndex);
  }
}

function dmCorrectPlacement(objectId, slotIndex) {
  DM.placed[objectId] = slotIndex;
  DM.placedCount++;
  DM.holding = null;

  dmEntry('The wall accepts', DREAM_CORRECT_FEEDBACK, 'flash');

  // Update object button
  var btn = document.querySelector('.dm-obj-btn[data-obj-id="' + objectId + '"]');
  if (btn) { btn.classList.add('placed'); btn.classList.remove('selected'); }

  // Update slot
  var slot = document.getElementById('dmSlot-' + slotIndex);
  if (slot) slot.classList.add('filled');

  // Hide chooser
  var chooser = document.getElementById('dmSlotChooser');
  if (chooser) chooser.style.display = 'none';

  // Fire the flash
  var flashIndex = DM.placedCount - 1;
  var flash = DREAM_FLASHES[flashIndex];
  if (flash) {
    setTimeout(function() { dmFireFlash(flash, objectId); }, 600);
  }

  if (DM.placedCount === DREAM_SLOT_COUNT) {
    setTimeout(function() { dmSceneComplete(); }, 1200);
  }
}

function dmWrongPlacement(objectId, slotIndex) {
  DM.holding = null;

  dmEntry('The wall rejects', DREAM_WRONG_FEEDBACK, 'system');

  // Energy drain on both sides
  G.energy = Math.max(0, G.energy - DREAM_ENERGY_DRAIN);
  updateEnergyDisplay();
  if (S.conn && S.conn.open) {
    S.conn.send({ type: 'energy-update', energy: G.energy });
  }

  // Deselect object button
  document.querySelectorAll('.dm-obj-btn').forEach(function(btn) {
    btn.classList.remove('selected');
  });

  // Hide chooser
  var chooser = document.getElementById('dmSlotChooser');
  if (chooser) chooser.style.display = 'none';
}

async function dmFireFlash(flash, objectId) {
  dmSetThinking(true);

  var system = 'You are narrating a flash vision in The Dream scene of Saintalia. ' +
    'Both players are inside a shared dream. The artist just placed an object on the wall. ' +
    'Expand this vision into vivid, literary horror-fantasy prose, 200 to 350 words. ' +
    'Do not break character. Do not explain mechanics. The vision is overwhelming and involuntary.';
  var userMsg = 'VISION GUARDRAIL: ' + flash.guardrail +
    '\n\nExpand this into full prose. Stay faithful to the guardrail but make it vivid and specific.';

  var narration = await requestNarration(system, userMsg, 900);
  if (!narration) narration = flash.guardrail;

  dmEntry('Flash -- ' + flash.name, narration, 'flash');
  dmSetThinking(false);

  DM.ctx.send({
    kind: 'flash',
    flashId: flash.id,
    flashName: flash.name,
    flashText: narration,
    objectId: objectId
  });

  if (typeof scheduleSnapshot === 'function') scheduleSnapshot();
}

function dmSceneComplete() {
  DM.complete = true;
  dmEntry('The Dream',
    'The wall goes dark. Every symbol is filled. Every object is where it belongs, and where it belongs is inside a pattern that is now, irreversibly, inside both of you. You understand the veil. You understand what is poisoning it. You cannot unknow it. Neither of you chose this. Neither of you can put it back.',
    'system');

  var cont = document.getElementById('dmContinue');
  if (cont) cont.style.display = 'block';
}

// ---- FANTASY SIDE ----

function dmBuildSymbolPanel() {
  var container = document.getElementById('dmSymbols');
  if (!container || !DM || !DM.slotMap) return;
  container.innerHTML = '';

  for (var s = 1; s <= DREAM_SLOT_COUNT; s++) {
    var objId = DM.slotMap[s];
    var sym = DREAM_SYMBOLS[objId];
    if (!sym) continue;
    var card = document.createElement('div');
    card.className = 'dm-symbol-card';
    card.id = 'dmSymCard-' + s;

    var label = document.createElement('div');
    label.className = 'dm-symbol-label';
    label.textContent = 'Slot ' + s + ' -- ' + sym.name;

    var desc = document.createElement('div');
    desc.className = 'dm-symbol-desc';
    desc.textContent = sym.desc;

    card.appendChild(label);
    card.appendChild(desc);
    container.appendChild(card);
  }
}

function dmReceiveFlash(data) {
  if (!DM) return;
  DM.placed[data.objectId] = true;
  DM.placedCount = Object.keys(DM.placed).length;

  var flashLog = document.getElementById('dmFlashLog');
  var empty = document.getElementById('dmFlashEmpty');
  if (empty) empty.remove();
  if (flashLog) {
    var item = document.createElement('div');
    item.className = 'flash-item';
    var name = document.createElement('span');
    name.className = 'flash-item-name';
    name.textContent = data.flashName;
    item.appendChild(name);
    item.appendChild(document.createTextNode(data.flashText));
    flashLog.appendChild(item);
    flashLog.scrollTop = flashLog.scrollHeight;
  }
}

function dmReceiveAttempt(data) {
  if (!DM) return;
  var correctSlot = dmCorrectSlot(data.objectId);
  if (data.slotIndex === correctSlot) {
    // Mark the symbol card
    var card = document.getElementById('dmSymCard-' + data.slotIndex);
    if (card) card.classList.add('filled');
  } else {
    // Energy drain on this side too
    G.energy = Math.max(0, G.energy - DREAM_ENERGY_DRAIN);
    updateEnergyDisplay();

    dmEntry('The wall', 'A wrong placement. Something pushed back. You feel the drain.', 'system');
  }
}

function dmReceiveObjectSelected(data) {
  if (!DM) return;
  var obj = LOCKDOWN_OBJECTS[data.objectId];
  if (!obj) return;
  dmEntry('The artist', 'The artist has picked up ' + obj.name + '.', 'narrator');
}

// ---- INTRO SEQUENCE ----

function dmPlayIntro(root, ctx, callback) {
  var overlay = document.createElement('div');
  overlay.className = 'dm-intro-overlay';
  overlay.id = 'dmIntro';
  root.appendChild(overlay);

  var lines = DREAM_INTRO.slice();
  var i = 0;
  function showLine() {
    if (i >= lines.length) {
      overlay.classList.add('fade-out');
      setTimeout(function() {
        overlay.remove();
        DM.introPlayed = true;
        callback();
      }, 1200);
      return;
    }
    var line = document.createElement('div');
    line.className = 'dm-intro-line';
    line.textContent = lines[i];
    overlay.appendChild(line);
    i++;
    setTimeout(showLine, 2200);
  }
  setTimeout(showLine, 800);
}

// ---- THE SCENE ----

var SceneDream = {
  id: 'dream',
  title: 'The Dream',

  mount: function(root, ctx) {
    dmReset();
    DM.ctx = ctx;
    setScreen('game');

    if (ctx.restoring && ctx.restore) {
      this._restore(root, ctx);
      return;
    }

    // Build the slot map (host generates, sends to other side)
    if (ctx.isHost) {
      DM.slotMap = dmBuildSlotMap();
      ctx.send({ kind: 'slot-map', map: DM.slotMap });
    }

    var isArtist = (ctx.role === 'reality');
    root.className = 'dm-wrap ' + (isArtist ? 'dm-artist-side' : 'dm-fantasy-side');

    var self = this;
    dmPlayIntro(root, ctx, function() {
      self._buildUI(root, ctx, isArtist);
    });
  },

  _buildUI: function(root, ctx, isArtist) {
    // Keep the intro overlay removal clean
    var intro = document.getElementById('dmIntro');
    if (intro) intro.remove();

    root.innerHTML = isArtist ? this._artistHtml(ctx) : this._fantasyHtml(ctx);

    if (isArtist && DM.slotMap) {
      dmEntry('The Dream', DREAM_ROOM_ARTIST, 'narrator');
    } else if (isArtist) {
      dmEntry('The Dream', DREAM_ROOM_ARTIST, 'narrator');
      dmEntry('Waiting', 'The wall shimmers. The symbols have not settled yet.', 'system');
    }

    if (!isArtist) {
      if (DM.slotMap) {
        dmBuildSymbolPanel();
      }
      dmEntry('The Dream', DREAM_ROOM_FANTASY, 'narrator');
    }

    dmReplayNotes();
    var noteInput = document.getElementById('noteInput');
    if (noteInput) noteInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') sendNote(S.role); });
  },

  unmount: function() {
    DM = null;
  },

  onMessage: function(p) {
    if (!DM) return;

    if (p.kind === 'slot-map') {
      DM.slotMap = p.map;
      if (S.role !== 'reality') {
        dmBuildSymbolPanel();
      }
    }

    if (p.kind === 'object-selected') {
      dmReceiveObjectSelected(p);
    }

    if (p.kind === 'attempt') {
      dmReceiveAttempt(p);
    }

    if (p.kind === 'flash') {
      dmReceiveFlash(p);
    }

    if (p.kind === 'complete') {
      DM.complete = true;
      var cont = document.getElementById('dmContinue');
      if (cont) cont.style.display = 'block';
    }

    if (p.kind === 'energy-drain') {
      G.energy = Math.max(0, G.energy - DREAM_ENERGY_DRAIN);
      updateEnergyDisplay();
    }
  },

  isComplete: function() {
    return !!(DM && DM.complete);
  },

  exportState: function() {
    return DM ? { placed: DM.placed, placedCount: DM.placedCount, complete: DM.complete } : null;
  },

  snapshot: function() {
    if (!DM) return null;
    return {
      placed: DM.placed,
      placedCount: DM.placedCount,
      holding: DM.holding,
      slotMap: DM.slotMap,
      complete: DM.complete,
      introPlayed: DM.introPlayed,
      log: DM.log
    };
  },

  _restore: function(root, ctx) {
    var r = ctx.restore;
    DM.placed = r.placed || {};
    DM.placedCount = r.placedCount || 0;
    DM.holding = r.holding || null;
    DM.slotMap = r.slotMap || null;
    DM.complete = r.complete || false;
    DM.introPlayed = true;
    DM.log = r.log || [];
    DM.ctx = ctx;

    var isArtist = (ctx.role === 'reality');
    root.className = 'dm-wrap ' + (isArtist ? 'dm-artist-side' : 'dm-fantasy-side');
    root.innerHTML = isArtist ? this._artistHtml(ctx) : this._fantasyHtml(ctx);

    if (isArtist) {
      // Replay log
      var feed = document.getElementById('dmFeed');
      DM.log.forEach(function(entry) {
        if (!feed) return;
        var el = document.createElement('div');
        el.className = 'story-entry ' + entry.type;
        var t = document.createElement('span');
        t.className = 'entry-tag';
        t.textContent = entry.tag;
        var b = document.createElement('div');
        b.className = 'entry-body';
        b.textContent = entry.text;
        el.appendChild(t);
        el.appendChild(b);
        feed.appendChild(el);
      });
      if (feed) feed.scrollTop = feed.scrollHeight;

      // Mark placed objects
      Object.keys(DM.placed).forEach(function(objId) {
        var btn = document.querySelector('.dm-obj-btn[data-obj-id="' + objId + '"]');
        if (btn) btn.classList.add('placed');
        var slot = document.getElementById('dmSlot-' + DM.placed[objId]);
        if (slot) slot.classList.add('filled');
      });
    } else {
      if (DM.slotMap) dmBuildSymbolPanel();
      // Mark filled symbol cards
      Object.keys(DM.placed).forEach(function(objId) {
        var slotIdx = DM.placed[objId];
        if (slotIdx === true) return;
        var card = document.getElementById('dmSymCard-' + slotIdx);
        if (card) card.classList.add('filled');
      });
      // Replay flashes
      if (DM.placedCount > 0) {
        var empty = document.getElementById('dmFlashEmpty');
        if (empty) empty.remove();
        var flashLog = document.getElementById('dmFlashLog');
        if (flashLog) {
          for (var fi = 0; fi < Math.min(DM.placedCount, DREAM_FLASHES.length); fi++) {
            var flash = DREAM_FLASHES[fi];
            var item = document.createElement('div');
            item.className = 'flash-item';
            var fname = document.createElement('span');
            fname.className = 'flash-item-name';
            fname.textContent = flash.name;
            item.appendChild(fname);
            item.appendChild(document.createTextNode(flash.guardrail));
            flashLog.appendChild(item);
          }
        }
      }
    }

    if (DM.complete) {
      var cont = document.getElementById('dmContinue');
      if (cont) cont.style.display = 'block';
    }

    dmReplayNotes();
    var noteInput = document.getElementById('noteInput');
    if (noteInput) noteInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') sendNote(S.role); });
  },

  _artistHtml: function(ctx) {
    var objBtns = '';
    var objectIds = Object.keys(LOCKDOWN_OBJECTS);
    objectIds.forEach(function(id) {
      var obj = LOCKDOWN_OBJECTS[id];
      objBtns += '<button class="dm-obj-btn" data-obj-id="' + id + '" onclick="dmSelectObject(\'' + id + '\')">' + obj.name + '</button>';
    });

    var slotBtns = '';
    for (var s = 1; s <= DREAM_SLOT_COUNT; s++) {
      slotBtns += '<button class="dm-slot-btn" id="dmSlot-' + s + '" onclick="dmPlaceOnSlot(' + s + ')">Slot ' + s + '</button>';
    }

    return '<div class="dm-artist">' +
      '<div class="dm-header">' +
        '<span class="dm-title">The Dream</span>' +
        '<span class="dm-placed-count" id="dmCount">Placed: 0 / ' + DREAM_SLOT_COUNT + '</span>' +
      '</div>' +
      '<div class="story-feed" id="dmFeed"></div>' +
      '<div class="thinking-row" id="dmThinking">The wall breathes...</div>' +
      '<div class="dm-objects-label">Objects</div>' +
      '<div class="dm-objects">' + objBtns + '</div>' +
      '<div class="dm-slot-chooser" id="dmSlotChooser" style="display:none">' +
        '<div class="dm-slot-label">Place on which slot?</div>' +
        '<div class="dm-slots">' + slotBtns + '</div>' +
      '</div>' +
      dmNoteBlockHtml('Describe what you see...') +
      '<button class="btn-primary" id="dmContinue" style="display:none" onclick="requestAdvance()">You wake up</button>' +
    '</div>';
  },

  _fantasyHtml: function(ctx) {
    return '<div class="dm-fantasy">' +
      '<div class="dm-header">' +
        '<span class="dm-title">The Dream</span>' +
        '<span class="dm-placed-count" id="dmCount">Placed: 0 / ' + DREAM_SLOT_COUNT + '</span>' +
      '</div>' +
      '<div class="story-feed" id="dmFeed"></div>' +
      '<div class="dm-symbols-label">Wall Symbols</div>' +
      '<div class="dm-symbols" id="dmSymbols"></div>' +
      '<div class="flash-log" id="dmFlashLog">' +
        '<div class="flash-log-label">Visions received</div>' +
        '<div class="flash-empty" id="dmFlashEmpty">No visions yet. The wall is waiting.</div>' +
      '</div>' +
      dmNoteBlockHtml('Guide the artist to the right slot...') +
      '<button class="btn-primary" id="dmContinue" style="display:none" onclick="requestAdvance()">You wake up</button>' +
    '</div>';
  }
};

registerScene(SceneDream);
