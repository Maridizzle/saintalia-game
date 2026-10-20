// ============================================================
// SAINTALIA -- DEV MODE
// Author: Maridizzle
//
// Off for players. Press D three times quickly (not while typing in a box)
// to toggle it in your own browser; it is remembered there.
//
// The dev bar, bottom left:
//   Quick character   fills the character screen from CHAR_DATA and the
//                     existing name, drive, burden and fear lists, then
//                     finishes it. Invents nothing.
//   Skip scene        moves both players to the next scene.
//   Reroll dice       rerolls your pending choice before the turn resolves.
//                     The old cost is refunded first.
//   Rewrite turn      undoes the last turn and asks the narrator again with
//                     the same choices, dice and abilities.
//   Back a turn       both screens return to the start of the last turn.
//   Swap sides        only inside game/dev.html: flips which player fills
//                     the screen.
//
// Reroll, rewrite and back work in the Opening, the one scene with turns.
//
// Checkpoints: the host announces the start of every Opening turn once its
// veil, energy and mural updates have gone out, and both sides save a copy
// of their own state for that turn. Back and rewrite restore those copies
// through the same path a reload uses.
//
// SOLO TESTING (game/dev.html): two copies of the game in one tab, joined by
// a BroadcastChannel instead of PeerJS or the relay. Each frame is opened as
// index.html?solo=fantasy|reality&ch=<id>. Fantasy is the host.
// ============================================================

const DEV_STORAGE_KEY = 'saintalia.dev';
const DEV_QUERY = typeof location !== 'undefined' ? location.search : '';
const DEV_SOLO = (DEV_QUERY.match(/[?&]solo=(fantasy|reality)\b/) || [])[1] || null;
const DEV_CHANNEL = (DEV_QUERY.match(/[?&]ch=([A-Za-z0-9_-]+)/) || [])[1] || 'default';

const DEV = {
  on: false,
  checkpoints: {},     // turn number -> deep copy of collectSnapshot() at that turn's start
  lastResolved: null,  // { turn, choices, rolls, abilities } of the most recent resolved turn
};

// ---- ON / OFF ----

function devReadOn() {
  try { return localStorage.getItem(DEV_STORAGE_KEY) === '1'; } catch (e) { return false; }
}

function devSetOn(on) {
  DEV.on = on;
  // Stored as '1' or '0', never removed
  try { localStorage.setItem(DEV_STORAGE_KEY, on ? '1' : '0'); } catch (e) { /* storage blocked: on for this page only */ }
  devRender();
}

// Three D presses within a second, ignored while typing anywhere
let devPresses = [];
document.addEventListener('keydown', (e) => {
  const t = e.target;
  const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  if (typing || e.ctrlKey || e.metaKey || e.altKey || (e.key !== 'd' && e.key !== 'D')) { devPresses = []; return; }
  const now = Date.now();
  devPresses = devPresses.filter(x => now - x < 1000);
  devPresses.push(now);
  if (devPresses.length >= 3) { devPresses = []; devSetOn(!DEV.on); }
});

// ---- CHECKPOINTS ----

function devCheckpoint() {
  if (typeof collectSnapshot !== 'function') return;
  const snap = collectSnapshot();
  if (snap) DEV.checkpoints[G.turn] = JSON.parse(JSON.stringify(snap));
}

// Host only, called from game.js once a turn has fully started
function devTurnStarted() {
  if (!S.isHost || typeof currentSceneId !== 'function' || currentSceneId() !== 'opening') return;
  devCheckpoint();
  if (S.conn && S.conn.open) S.conn.send({ type: 'dev-turn-start', turn: G.turn });
}

onMessage('dev-turn-start', () => {
  if (typeof currentSceneId === 'function' && currentSceneId() === 'opening') devCheckpoint();
});

// Called from game.js on both sides just before a resolved turn's choices clear
function devRememberTurn() {
  DEV.lastResolved = JSON.parse(JSON.stringify({
    turn: G.turn,
    choices: G.pendingChoices,
    rolls: G.pendingRolls,
    abilities: G.pendingAbilities,
  }));
}

// ---- BACK A TURN / REWRITE ----

function devRewindTo(turn, replay) {
  const cp = DEV.checkpoints[turn];
  if (!cp) {
    addEntry('shared', 'Dev: no saved start of turn ' + turn + ' on this side.', 'system');
    return false;
  }
  const box = document.getElementById('retryBox');
  if (box) box.remove();
  sessionRestore(JSON.parse(JSON.stringify(cp)), 'game');
  // Each side restored its own copy; resend the shared numbers it owns so
  // both screens agree exactly.
  if (S.role === 'fantasy') broadcastEnergy();
  if (S.isHost) broadcastVeil();
  addEntry('shared', 'Dev: back to the start of turn ' + turn + '.', 'system');
  if (replay) devReplayTurn(replay);
  devRender();
  return true;
}

function devBack() {
  const turn = G.turn - 1;
  if (!DEV.checkpoints[turn]) return;
  if (S.conn && S.conn.open) S.conn.send({ type: 'dev-rewind', turn });
  devRewindTo(turn);
}

// Put the last turn's choices back exactly as they were made, without
// rolling again, then the host resolves the turn with the narrator.
function devReplayTurn(last) {
  const side = S.role;
  const text = last.choices[side];
  const roll = last.rolls[side];
  const ability = last.abilities[side];
  if (text) {
    addEntry('private', text, 'action');
    if (ability) {
      addEntry('private', 'You use ' + ability.name + (ability.question ? ': "' + ability.question + '"' : '.'), 'system');
      G.abilityUsed = true;
      if (ability.question) G.veilReadWaiting = true;
    }
    if (roll) {
      addEntry('private', describeRoll(roll), 'roll ' + roll.result);
      if (side === 'fantasy' && CHECK_ENERGY_COST[roll.result]) {
        G.energy = Math.max(0, G.energy - CHECK_ENERGY_COST[roll.result]);
        updateEnergyDisplay();
        broadcastEnergy();
      }
    }
  }
  G.pendingChoices = Object.assign({}, last.choices);
  G.pendingRolls = Object.assign({}, last.rolls);
  G.pendingAbilities = Object.assign({}, last.abilities);
  setChoicesEnabled(false);
  setThinking(true, 'Rewriting the turn...');
  if (S.isHost) resolveTurnIfReady();
}

// The host runs a rewrite so the narrator is asked exactly once
function devRewrite() {
  if (!S.isHost) {
    if (S.conn && S.conn.open) S.conn.send({ type: 'dev-rewrite-request' });
    return;
  }
  const last = DEV.lastResolved;
  if (!last || last.turn !== G.turn - 1 || !DEV.checkpoints[last.turn]) return;
  if (S.conn && S.conn.open) S.conn.send({ type: 'dev-rewind', turn: last.turn, replay: last });
  devRewindTo(last.turn, last);
}

onMessage('dev-rewind', (data) => { devRewindTo(data.turn, data.replay || null); });
onMessage('dev-rewrite-request', () => { if (S.isHost) devRewrite(); });

// ---- REROLL ----

function devCanReroll() {
  const side = S.role;
  const other = side === 'fantasy' ? 'reality' : 'fantasy';
  if (!G.pendingChoices[side] || !G.pendingRolls[side] || G.waitingForNarrator) return false;
  // Only before the turn can resolve: the other side has not chosen yet, or
  // (host) the narrator failed and Try again is waiting.
  return !G.pendingChoices[other] || (S.isHost && !!document.getElementById('retryBox'));
}

function devReroll() {
  if (!devCanReroll()) return;
  const side = S.role;
  const old = G.pendingRolls[side];
  if (side === 'fantasy' && CHECK_ENERGY_COST[old.result]) {
    G.energy = Math.min(100, G.energy + CHECK_ENERGY_COST[old.result]);
  }
  const roll = rollCheck(old.stat);
  if (side === 'fantasy' && CHECK_ENERGY_COST[roll.result]) {
    G.energy = Math.max(0, G.energy - CHECK_ENERGY_COST[roll.result]);
  }
  if (side === 'fantasy') { updateEnergyDisplay(); broadcastEnergy(); }
  G.pendingRolls[side] = roll;
  addEntry('private', 'Dev reroll: ' + describeRoll(roll), 'roll ' + roll.result);
  if (S.conn && S.conn.open) S.conn.send({ type: 'dev-reroll', side, roll });
  devRender();
}

onMessage('dev-reroll', (data) => {
  if (data && data.side) G.pendingRolls[data.side] = data.roll || null;
});

// ---- QUICK CHARACTER ----

function devPick(list) { return list[Math.floor(Math.random() * list.length)]; }

function devQuickCharacter() {
  if (!S.charSelections || S.myCharacter) return;
  const isF = S.role === 'fantasy';
  const data = isF ? CHAR_DATA.fantasy : CHAR_DATA.reality;
  const sel = S.charSelections;
  sel.name = devPick(isF ? FANTASY_NAMES : REALITY_NAMES);
  sel.race = devPick(data.races);
  sel.job = devPick(data.jobs);
  applyBonuses();
  // 12 points, never past 5 with the race and job bonuses
  sel.stats = {};
  data.stats.forEach(s => { sel.stats[s] = 0; });
  for (let pts = 12; pts > 0; pts--) {
    const open = data.stats.filter(s => sel.stats[s] + (sel.statBonuses[s] || 0) < 5);
    if (!open.length) break;
    sel.stats[devPick(open)]++;
  }
  sel.appearance = {};
  Object.entries(data.appearance).forEach(([cat, opts]) => { sel.appearance[cat] = devPick(opts); });
  sel.personality = {};
  Object.entries(data.personality).forEach(([q, opts]) => { sel.personality[q] = devPick(opts); });
  sel.personality.drive = devPick(isF ? FANTASY_MOTIVATIONS : REALITY_MOTIVATIONS);
  sel.personality.carry = devPick(isF ? FANTASY_CARRY : REALITY_CARRY);
  sel.personality.fear = devPick(isF ? FANTASY_FEARS : REALITY_FEARS);
  finalizeCharacter();
  devRender();
}

// ---- THE DEV BAR ----

function devButton(label, fn, title) {
  const b = document.createElement('button');
  b.className = 'dev-btn';
  b.textContent = label;
  if (title) b.title = title;
  b.onclick = fn;
  return b;
}

function devRender() {
  let bar = document.getElementById('devBar');
  const panel = document.getElementById('debug');
  if (!DEV.on) {
    if (bar) bar.style.display = 'none';
    if (panel) panel.style.display = 'none';
    return;
  }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'devBar';
    bar.className = 'dev-bar';
    document.body.appendChild(bar);
  }
  bar.style.display = '';
  if (panel) panel.style.display = '';
  bar.innerHTML = '';

  const label = document.createElement('span');
  label.className = 'dev-label';
  label.textContent = 'DEV' + (DEV_SOLO ? ' -- ' + DEV_SOLO : '');
  bar.appendChild(label);

  const scene = typeof currentSceneId === 'function' ? currentSceneId() : null;
  const opening = scene === 'opening' && G.openingDone;
  const onChar = !!S.charSelections && !S.myCharacter && document.documentElement.classList.contains('screen-char');

  if (onChar) bar.appendChild(devButton('Quick character', devQuickCharacter, 'Random picks from the existing character data'));
  if (scene && typeof nextSceneId === 'function' && nextSceneId()) bar.appendChild(devButton('Skip scene', () => doAdvance(), 'Both players move to the next scene'));
  if (opening && devCanReroll()) bar.appendChild(devButton('Reroll dice', devReroll, 'Reroll your pending choice; the old cost is refunded'));
  if (opening && !G.waitingForNarrator && DEV.lastResolved && DEV.lastResolved.turn === G.turn - 1 && DEV.checkpoints[G.turn - 1]) {
    bar.appendChild(devButton('Rewrite turn', devRewrite, 'Ask the narrator again: same choices, dice and abilities'));
  }
  if (opening && !G.waitingForNarrator && DEV.checkpoints[G.turn - 1]) bar.appendChild(devButton('Back a turn', devBack, 'Both screens return to the start of the last turn'));
  if (DEV_SOLO && window.parent !== window) bar.appendChild(devButton('Swap sides', () => window.parent.postMessage({ devSwap: true }, window.location.origin), 'Show the other player'));

  const hint = document.createElement('span');
  hint.className = 'dev-hint';
  hint.textContent = 'DDD to hide';
  bar.appendChild(hint);
}

// Buttons come and go with game state; a light poll keeps the bar honest
// without wiring a hook into every state change.
setInterval(() => { if (DEV.on) devRender(); }, 500);

// ---- SOLO TESTING ----

function devSoloBoot() {
  S.role = DEV_SOLO;
  S.isHost = DEV_SOLO === 'fantasy';
  S.connected = true;
  document.body.classList.remove('theme-fantasy', 'theme-artist');
  document.body.classList.add(DEV_SOLO === 'fantasy' ? 'theme-fantasy' : 'theme-artist');

  const bc = new BroadcastChannel('saintalia-dev-' + DEV_CHANNEL);
  S.conn = {
    open: true,
    // Plain copies only, the same as a real wire
    send: (d) => bc.postMessage(JSON.parse(JSON.stringify(d))),
    on: () => {},
    close: () => bc.close(),
  };
  bc.onmessage = (e) => dispatchMessage(e.data);

  // A Groq key typed into dev.html, for testing off Railway. Host only uses it.
  window.addEventListener('message', (e) => {
    if (e.origin === window.location.origin && e.data && typeof e.data.devKey === 'string') S.groqKey = e.data.devKey;
  });

  const go = () => launchGame();
  if (typeof probeServerNarration === 'function') probeServerNarration().then(go, go);
  else go();
}

DEV.on = DEV_SOLO ? true : devReadOn();
if (DEV_SOLO) devSoloBoot();
devRender();
