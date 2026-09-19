// ============================================================
// SAINTALIA -- load and structure test
// Author: Maridizzle
//
//   node game/test/loadtest.js
//
// No install, no dependencies, no browser. Runs every script the game loads,
// in the order index.html actually declares them, inside one shared context
// against a minimal DOM stub.
//
// WHAT IT CATCHES that node --check on a single file cannot:
//   - a script calling something a later script defines (load-order bugs)
//   - two files declaring the same const (the collision hazard that made
//     merging the three original HTML files dangerous)
//   - a scene that fails to register, mount, or reset between mounts
//   - a broken room graph: unreachable rooms, one-way exits, an object
//     pinned to no room, a room missing from P2's grid
//   - a flash or tangent whose text went missing
//
// The load order is READ FROM index.html rather than hardcoded, so this file
// cannot quietly drift out of sync with the real app.
// ============================================================

const fs = require('fs');
const vm = require('vm');

let failures = 0;
function check(label, actual, expected) {
  const ok = expected === undefined ? !!actual : actual === expected;
  if (!ok) failures++;
  const detail = expected === undefined ? String(actual)
    : (ok ? String(actual) : String(actual) + '  (expected ' + expected + ')');
  console.log((ok ? '  ok   ' : '  FAIL ') + label.padEnd(30) + detail);
}

// ---- DOM STUB ----
function el() {
  return {
    style: {},
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    children: [], textContent: '', innerHTML: '', value: '', disabled: false, className: '',
    appendChild(c){ this.children.push(c); return c; },
    insertBefore(c){ this.children.unshift(c); return c; },
    removeChild(){}, remove(){}, querySelector(){ return null; },
    querySelectorAll(){ return []; }, addEventListener(){},
    closest(){ return el(); }, setAttribute(){}, focus(){},
    scrollTop: 0, scrollHeight: 0, firstChild: null
  };
}

const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  Math, JSON, Object, Array, String, Number, Boolean, Error, Promise, RegExp, Date,
  addEventListener(){},
  fetch: async () => ({ json: async () => ({}) }),
  Peer: function(){ return { on(){}, connect(){ return { on(){} }; }, destroy(){}, reconnect(){} }; },
  document: {
    body: el(), documentElement: el(), head: el(),
    getElementById(){ return el(); }, querySelector(){ return el(); },
    querySelectorAll(){ return []; }, createElement(){ return el(); },
    createTextNode(){ return el(); }, addEventListener(){}
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const run = (code) => vm.runInContext(code, sandbox);

// ---- LOAD ----
console.log('\nLOAD ORDER (from game/index.html)');
const html = fs.readFileSync('game/index.html', 'utf8');
const order = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]
  .map(m => m[1]).filter(u => !/^https?:/.test(u)).map(u => 'game/' + u);

for (const f of order) {
  try {
    vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f });
    console.log('  ok   ' + f);
  } catch (e) {
    console.log('  FAIL ' + f + '\n       ' + e.message);
    process.exit(1);
  }
}

// ---- ENGINE ----
console.log('\nSCENE ENGINE');
run(`
  S.role = 'reality'; S.isHost = true;
  S.myCharacter  = { name:'TEST_ME',    race:{name:'r',lore:'l'}, job:{name:'j',desc:'d'}, stats:{}, appearance:{}, personality:{} };
  S.otherCharacter = { name:'TEST_THEM', race:{name:'r',lore:'l'}, job:{name:'j',desc:'d'}, stats:{}, appearance:{}, personality:{} };
`);
const registered = run('Object.keys(SCENES)');
check('scenes registered', registered.join(', '));
run('setSceneOrder(' + JSON.stringify(registered) + ')');

let remountOk = true;
for (let i = 0; i < 5; i++) if (run("mountScene('" + registered[0] + "')") !== true) remountOk = false;
check('mount/unmount x5', remountOk, true);
check('unknown scene rejected', run("mountScene('nope')"), false);
run(`registerScene({ id:'__boom', mount(){ throw new Error('deliberate'); } });`);
check('throwing mount contained', run("mountScene('__boom')"), false);
check('recovers after throw', run("mountScene('" + registered[0] + "')"), true);
check('no scene globals on window',
  run("['SCENES','S','G','SceneOpening','SceneLockdown','SceneQuestions'].filter(n => Object.prototype.hasOwnProperty.call(globalThis, n)).join(',') || 'none'"),
  'none');

// ---- MESSAGE ROUTING ----
console.log('\nMESSAGE ROUTING');
const handlers = run('Object.keys(MESSAGE_HANDLERS).sort()');
check('handlers registered', handlers.length + ': ' + handlers.join(', '));

// ---- RELAY CLIENT (PHASE 11a) ----
// No network. A fake socket stands in for the server, and the client's own
// relay-message handling is driven directly. What this proves: host identity
// is latched from the server's welcome, the handshake goes out the moment
// the pair is complete, sends go through the socket once joined, sends made
// before the join wait in the outbox and flush on welcome, and a refusal
// tears the session down.
console.log('\nRELAY CLIENT');
run(`
  var fakeWs = { readyState: 1, sent: [], send(raw) { this.sent.push(JSON.parse(raw)); }, close() {} };
  S.role = 'reality'; S.peer = null; S.transportUsed = null;
  S.relay = { code:'test-code', mode:'join', seat:null, ws:fakeWs, joined:false, outbox:[], attempts:0, closing:false, timer:null };
  S.conn = relayMakeConn();
  S.conn.send({ type:'early', n:1 });
`);
check('send before join is queued', run('S.relay.outbox.length'), 1);
run(`relayHandleMessage({ type:'relay-welcome', room:'test-code', seat:'abcdef0123456789', isHost:false, peerPresent:true, reconnect:false });`);
check('isHost latched from server', run('S.isHost'), false);
check('conn open once paired', run('S.conn.open'), true);
check('queued send flushed', run("fakeWs.sent.some(m => m.type === 'early')"), true);
check('handshake sent on pair', run("fakeWs.sent.some(m => m.type === 'handshake' && m.role === 'reality')"), true);
run("S.conn.send({ type:'note', text:'x' })");
check('send goes through socket', run("fakeWs.sent[fakeWs.sent.length - 1].type"), 'note');
run("relayHandleMessage({ type:'relay-welcome', room:'test-code', seat:'ffff', isHost:true, peerPresent:false, reconnect:false })");
check('host welcome latches host', run('S.isHost'), true);
// A joiner refused before any welcome has S.isHost at its default of true.
// The refusal must still land in the JOIN panel, not the hidden create one.
run(`
  S.isHost = true;
  var statusHits = { create: 0, join: 0 };
  var realGet = document.getElementById;
  document.getElementById = function(id) {
    var e = realGet(id);
    if (id === 'create-status-area') Object.defineProperty(e, 'innerHTML', { set(v) { statusHits.create++; } });
    if (id === 'join-status-area')   Object.defineProperty(e, 'innerHTML', { set(v) { statusHits.join++; } });
    return e;
  };
  relayHandleMessage({ type:'relay-refused', reason:'no-room' });
  document.getElementById = realGet;
`);
check('refusal tears down', run('S.relay === null && S.conn === null'), true);
check('joiner refusal hits join panel', run('statusHits.join + "/" + statusHits.create'), '1/0');
check('peer path still present', run("typeof peerInitWithCode === 'function' && typeof peerJoin === 'function'"), true);
run("S.conn = null; S.relay = null;");

// Step 3: the session survives a reload. A fake sessionStorage stands in;
// the sandbox has none, and the code must also cope with that.
run(`
  var store = {};
  globalThis.sessionStorage = { getItem(k){ return k in store ? store[k] : null; }, setItem(k,v){ store[k] = String(v); }, removeItem(k){ delete store[k]; } };
  S.role = 'fantasy'; S.isHost = true;
  S.relay = { code:'ashveil-seven', mode:'host', seat:'0123456789abcdef01234567', ws:null, joined:true, outbox:[], attempts:0, closing:false, timer:null, resumedPhase:null };
  relayRemember({ room:'ashveil-seven', mode:'host', seat:'0123456789abcdef01234567', role:'fantasy', isHost:true, phase:'lobby' });
  relayRemember({ phase:'game' });
  S.relay = null; S.conn = null; S.role = null; S.isHost = true;
`);
check('session written', run("(relayReadSession() || {}).phase"), 'game');
run('relayResumeFromStorage()');
check('resume restores role', run('S.role'), 'fantasy');
check('resume reuses the seat', run('S.relay && S.relay.seat'), '0123456789abcdef01234567');
check('resume keeps host flag', run('S.isHost'), true);
check('resume remembers the phase', run('S.relay && S.relay.resumedPhase'), 'game');
run('relayClose(); relayForgetSession();');
check('forget clears it', run('relayReadSession()'), null);
run('delete globalThis.sessionStorage; relayResumeFromStorage();');
check('no storage, no crash', run('S.relay'), null);

// ---- THE LOCKDOWN ----
if (registered.includes('lockdown')) {
  console.log('\nTHE LOCKDOWN');
  run("S.role='reality'");
  check('mounts as artist', run("mountScene('lockdown')"), true);
  check('starts at entrance', run('LK.roomId'), 'entrance');
  check('rooms', run('Object.keys(LOCKDOWN_ROOMS).length'), 9);
  check('objects', run('Object.keys(LOCKDOWN_OBJECTS).length'), 5);
  check('all rooms reachable', run(`
    (() => { const seen={entrance:1}, q=['entrance'];
      while(q.length){ const r=q.pop();
        for (const t of Object.values(LOCKDOWN_ROOMS[r].exits)) if(!seen[t]){seen[t]=1;q.push(t);} }
      return Object.keys(seen).length; })()`), 9);
  check('every exit two-way', run(`
    (() => { const opp={N:'S',S:'N',E:'W',W:'E'}, bad=[];
      for (const [id,r] of Object.entries(LOCKDOWN_ROOMS))
        for (const [d,t] of Object.entries(r.exits))
          if (LOCKDOWN_ROOMS[t].exits[opp[d]] !== id) bad.push(id+d);
      return bad.length ? bad.join(',') : 'yes'; })()`), 'yes');
  check('objects pinned to rooms', run(`
    Object.values(LOCKDOWN_OBJECTS).every(o => Object.values(LOCKDOWN_ROOMS).some(r => r.object === o.id)) ? 'all 5' : 'MISSING'`), 'all 5');
  check('rooms on P2 grid', run(`
    Object.keys(LOCKDOWN_ROOMS).every(id => LOCKDOWN_ROOM_POSITIONS[id]) ? 'all 9' : 'MISSING'`), 'all 9');
  check('flash prose present', run(`
    Object.values(LOCKDOWN_OBJECTS).every(o => (LOCKDOWN_FLASHES[o.flashName]||'').length > 200) ? 'all 5' : 'MISSING'`), 'all 5');
  check('movement detected', run("lkDetectMovement('go north')"), 'N');
  check('search detected', run("lkDetectSearch('search the room')"), true);
  check('decor detected', run("(lkDetectDecorContact('look at the pillars')||{}).name"), 'the pillars');
  check('object contact detected', run("(lkDetectObjectContact('touch the clock')||{}).id"), 'clock');
  run("LK.ctx = { send(){} }; Object.values(LOCKDOWN_OBJECTS).forEach(o => lkFireFlash(o));");
  check('all five findable', run('LK.foundCount'), 5);
  run("S.role='fantasy'");
  run("mountScene('lockdown')");
  check('state resets on remount', run('LK.foundCount'), 0);
  run("S.role='reality'; mountScene('lockdown')");
  run("LK.ctx={send(){}}; lkFireFlash(LOCKDOWN_OBJECTS['key'])");
  check('lk snapshot roomId', run("CURRENT_SCENE.snapshot().roomId"), 'entrance');
  check('lk snapshot found', run("CURRENT_SCENE.snapshot().foundCount"), 1);
  check('lk snapshot has log', run("CURRENT_SCENE.snapshot().log.length > 0"), true);
}

// ---- THE 15 QUESTIONS ----
if (registered.includes('questions')) {
  console.log('\nTHE 15 QUESTIONS');
  check('questions', run('QUESTIONS_POOL.length'), 15);
  check('tangents', run('Object.keys(QUESTIONS_TANGENTS).length'), 10);
  check('every question has A and B', run(`
    QUESTIONS_POOL.every(q => q.a && q.b && q.a.seed && q.b.seed) ? 'yes' : 'NO'`), 'yes');
  check('every tangent target exists', run(`
    (() => { const bad = [];
      QUESTIONS_POOL.forEach(q => ['a','b'].forEach(k => {
        if (!QUESTIONS_TANGENTS[q[k].tangent]) bad.push(q.id + '.' + k + ' -> ' + q[k].tangent); }));
      return bad.length ? bad.join(', ') : 'yes'; })()`), 'yes');
  check('every tangent has both sides', run(`
    Object.values(QUESTIONS_TANGENTS).every(t => t.reality && t.fantasy) ? 'yes' : 'NO'`), 'yes');
  check('neutral seeds for each question', run(`
    QUESTIONS_POOL.every(q => (QUESTIONS_NEUTRAL[q.id]||[]).length >= 2) ? 'yes' : 'MISSING'`), 'yes');
  run("S.role='reality'");
  check('mounts', run("mountScene('questions')"), true);
  check('turn cap counts main only', run('Q.totalTurns'), 10);
  check('pool starts full', run('Q.usedIds.length'), 0);
  check('q snapshot started (host)', run("CURRENT_SCENE.snapshot().started"), true);
  check('q snapshot has log', run("Array.isArray(CURRENT_SCENE.snapshot().log)"), true);
}

// ---- SNAPSHOT COLLECT ----
console.log('\nSNAPSHOT COLLECT');
run("S.role='reality'; mountScene('lockdown')");
check('collectSnapshot exists', run("typeof collectSnapshot"), 'function');
check('collect scene id', run("collectSnapshot().currentScene"), 'lockdown');
check('collect has sceneState', run("collectSnapshot().sceneState !== undefined"), true);
check('collect has G data', run("collectSnapshot().G.turn !== undefined"), true);
check('collect has role', run("collectSnapshot().role"), 'reality');

// ---- SAVE DATA SPLIT (Phase 11b part 2) ----
console.log('\nSAVE DATA SPLIT');
check('splitSaveData exists', run("typeof splitSaveData"), 'function');
const splitResult = run("JSON.stringify(splitSaveData())");
check('split returns object', splitResult !== 'null', true);
check('shared has currentScene', run("splitSaveData().shared.currentScene"), 'lockdown');
check('shared has turn', run("splitSaveData().shared.turn !== undefined"), true);
check('shared has notes', run("Array.isArray(splitSaveData().shared.notes)"), true);
check('private has role', run("splitSaveData().private.role"), 'reality');
check('private has sceneState', run("splitSaveData().private.sceneState !== undefined"), true);
check('shared lacks groqKey', run("splitSaveData().shared.groqKey === undefined"), true);
check('private lacks groqKey', run("splitSaveData().private.groqKey === undefined"), true);
check('rebuildSnapshot exists', run("typeof rebuildSnapshot"), 'function');
check('rebuild round trip', run(`
  (function() {
    var d = splitSaveData();
    var s = rebuildSnapshot(d.shared, d.private);
    return s.currentScene === 'lockdown' && s.role === 'reality' && s.G.turn !== undefined;
  })()`), true);

// ---- THE FULL RUN ----
console.log('\nTHE FULL RUN');
const declaredOrder = (fs.readFileSync('game/js/game.js','utf8')
  .match(/setSceneOrder\(\[([\s\S]*?)\]\)/) || [,''])[1]
  .match(/'[a-z-]+'/g) || [];
const runOrder = declaredOrder.map(s => s.replace(/'/g,''));
check('order in launchActualGame', runOrder.join(' -> '));
check('every scene in order exists',
  runOrder.filter(id => !registered.includes(id)).join(',') || 'yes', 'yes');
check('every registered scene used',
  registered.filter(id => id !== '__boom' && !runOrder.includes(id)).join(',') || 'yes', 'yes');

// Walk the whole run, mounting each scene in turn as both roles.
['reality','fantasy'].forEach(role => {
  run("S.role='" + role + "'");
  run('setSceneOrder(' + JSON.stringify(runOrder) + ')');
  let ok = true;
  runOrder.forEach(id => { if (run("mountScene('" + id + "')") !== true) ok = false; });
  check('full run mounts as ' + role, ok, true);
});

// Unwritten bridges must be obvious.
check('bridges unwritten show token', run(`
  BRIDGE_DEFS.every(d => d.text === null && d.token && d.vaultBeat) ? 'yes, ' + BRIDGE_DEFS.length + ' TBD' : 'some written'`));
check('gate copy still TBD', run("COMING_SOON_DEF.text === null ? 'yes' : 'written'"), 'yes');

console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'all checks passed') + '\n');
process.exit(failures ? 1 : 0);
