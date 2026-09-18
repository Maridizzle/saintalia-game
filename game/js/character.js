// ============================================================
// SAINTALIA -- CHARACTER CREATION
// Author: Maridizzle
//
// Moved from saintalia-v2.html lines 1026 to 1553 (Phase 1).
//
// ONE EDIT, and it is the only real edit in the whole split:
// buildCharScreen() used to return a template string with a 115 line
// <style> block baked into the top of it. That CSS now lives in
// css/game.css, scoped to body.screen-char, so the function returns markup
// only. Everything below the removed block is verbatim.
//
// The dropped block opened with :root{--acc:<value>;--acc-rgb:<value>;}
// built by interpolation. Verified no-op: those interpolated values are
// byte for byte what body.theme-fantasy and body.theme-artist already set,
// and a body rule beats a :root rule for anything inside body.
//
// PHASE 1 STEP 4, DONE. initCharScreen used to register the second of three
// live conn.on('data') handlers. All three are collapsed into the single
// dispatcher in connection.js. This file now registers its one message type,
// `character`, at the bottom via onMessage.
// ============================================================

// Pre-generated names
const FANTASY_NAMES = ['Vesara','Thane Cullowick','Morreth','Solis Vane','Kethara','Draven Null','Ashwick','Corvel','Sable Mourne','Tyvian','Nyx Hallow','Graeven'];
const REALITY_NAMES = ['Mara','Jonah Cole','Pell','Sasha Vorn','Dani Marsh','Ren Calloway','Petra','Ellis Ward','Sam Okafor','Clio','Damien Rue','Vera Stills'];

// Fear options
const FANTASY_FEARS = ['Becoming the monster','Being forgotten by the realm','Losing the last of what I am','That I was always wrong','The dark that moves','Being unmade by the veil','That nothing survives','My own reflection'];
const REALITY_FEARS = ['Losing my mind','That no one will believe me','Being alone with it','What I might paint next','That I invited this','The face in the mural','That it knows my name','Never being able to leave'];

// Motivation options
const FANTASY_MOTIVATIONS = ['Survival at any cost','A debt I must repay','Someone I am trying to find','Duty to what remains','To understand what broke','Vengeance for what was taken','To protect the last thing worth protecting','Curiosity I cannot silence'];
const REALITY_MOTIVATIONS = ['The deadline and the rent','Proving I am not losing it','Someone who needs me home safe','The work itself -- it matters','Finishing what I started','Finding out what is in the mural','Making sure no one else sees this','The truth no matter what it costs'];

// What you carry options
const FANTASY_CARRY = ['A sword that hums wrong','A promise made to someone gone','A map of places that no longer exist','Three coins from a dead city','A name I swore to find','A wound that never fully closed','A letter I cannot deliver','Something I took that was not mine'];
const REALITY_CARRY = ["My grandmother's paintbrush",'The last text from my sister','A scar I cannot explain','A photograph of someone I do not recognize','My first finished piece, always','A key that appeared in my paint tray','A voicemail I cannot delete','A sketchbook full of faces I never drew'];

function buildCharScreen() {
  const isF = S.role === 'fantasy';
  // acc and accRgb fed the removed <style> block's :root override. Kept so
  // this function still matches the original line for line. Now unused.
  const acc = isF ? '#ff7ddd' : '#9fc0da';
  const accRgb = isF ? '255,62,200' : '110,147,184';
  const names = isF ? FANTASY_NAMES : REALITY_NAMES;
  return `
  <div class="cc">
    <div class="cc-top">
      <p class="cc-eye">${isF ? 'Saintalia' : 'The Waking World'} — Character Creation</p>
      <h1 class="cc-ttl">${isF ? 'Who Walks the Ancient Realm?' : 'Who Holds the Brush?'}</h1>
      <div class="cc-div"></div>
    </div>

    <div class="tabs" id="tabBar">
      ${['Identity','Race','Role','Stats','Appearance','Personality'].map((t,i) =>
        `<button class="tab${i===0?' active':''}" id="tab${i}" onclick="swTab(${i})">${t}</button>`
      ).join('')}
    </div>

    <!-- TAB 0: IDENTITY -->
    <div class="panel active" id="p0">
      <div class="sec-label">Your Name</div>
      <p class="sec-hint">Choose one or write your own.</p>
      <div class="btn-grid" id="nameGrid">
        ${names.map(n => `<button class="sel-btn" onclick="pickName('${n}',this)">${n}</button>`).join('')}
      </div>
      <div class="custom-row">
        <input class="custom-field name-input" id="nameCustom" placeholder="Or write your own name..." maxlength="40" oninput="S.charSelections.name=this.value;clearGrid('nameGrid')" />
      </div>
      <div class="cc-nav">
        <button class="btn-next" onclick="nextTab(0)" id="nn0">Next — Choose Your ${isF ? 'Blood' : 'Background'} →</button>
      </div>
    </div>

    <!-- TAB 1: RACE -->
    <div class="panel" id="p1">
      <div class="sec-label">${isF ? 'Your Blood' : 'Your Artist Background'}</div>
      <p class="sec-hint">${isF ? 'What runs in your veins shapes how Saintalia sees you.' : 'How you came to this work shapes what you see in it now.'}</p>
      <div class="card-grid" id="raceGrid">
        ${(isF ? CHAR_DATA.fantasy : CHAR_DATA.reality).races.map(r => `
          <div class="card" id="rc-${r.id}" onclick="pickRace('${r.id}')">
            <span class="card-icon">${r.icon}</span>
            <div class="card-name">${r.name}</div>
            <div class="card-bonus">${r.bonus}</div>
            <div class="card-lore">${r.lore}</div>
          </div>
        `).join('')}
      </div>
      <div class="cc-nav">
        <button class="btn-back" onclick="swTab(0)">← Back</button>
        <button class="btn-next" onclick="nextTab(1)" id="nn1" disabled>Next — Choose Your Role →</button>
      </div>
    </div>

    <!-- TAB 2: JOB -->
    <div class="panel" id="p2">
      <div class="sec-label">Your Role</div>
      <p class="sec-hint">Your role determines your bonus and your unique ability. Each mirrors a role on the other side of the veil.</p>
      <div class="card-grid" id="jobGrid">
        ${(isF ? CHAR_DATA.fantasy : CHAR_DATA.reality).jobs.map(j => `
          <div class="card" id="jb-${j.id}" onclick="pickJob('${j.id}')">
            <div class="card-name">${j.name}</div>
            <div class="card-mirror">Mirrors: ${j.mirror}</div>
            <div class="card-bonus">${j.bonus}</div>
            <div class="card-ability">⚡ ${j.ability}</div>
            <div class="card-ability-desc">${j.abilityDesc}</div>
          </div>
        `).join('')}
      </div>
      <div class="cc-nav">
        <button class="btn-back" onclick="swTab(1)">← Back</button>
        <button class="btn-next" onclick="nextTab(2)" id="nn2" disabled>Next — Distribute Stats →</button>
      </div>
    </div>

    <!-- TAB 3: STATS -->
    <div class="panel" id="p3">
      <div class="sec-label">Your Attributes</div>
      <p class="sec-hint">Distribute 12 points. Race and role bonuses apply automatically in green.</p>
      <div class="pool-display">
        <span class="pool-num" id="poolNum">12</span>
        <span class="pool-lbl">points remaining</span>
      </div>
      <div class="stat-rows" id="statRows">
        ${(isF ? CHAR_DATA.fantasy : CHAR_DATA.reality).stats.map(stat => `
          <div class="stat-row">
            <div>
              <div class="stat-name">${stat}<span class="stat-bonus" id="sb-${stat}"></span></div>
              <span class="stat-desc-sm">${(isF ? CHAR_DATA.fantasy : CHAR_DATA.reality).statDescs[stat]}</span>
            </div>
            <div class="pips" id="pips-${stat}">
              ${[1,2,3,4,5].map(n=>`<div class="pip" id="pip-${stat}-${n}" onclick="setPip('${stat}',${n})"></div>`).join('')}
            </div>
            <div class="stat-val" id="sv-${stat}">0</div>
          </div>
        `).join('')}
      </div>
      <div class="cc-nav">
        <button class="btn-back" onclick="swTab(2)">← Back</button>
        <button class="btn-next" onclick="nextTab(3)" id="nn3">Next — Appearance →</button>
      </div>
    </div>

    <!-- TAB 4: APPEARANCE -->
    <div class="panel" id="p4">
      <div class="sec-label">How You Look</div>
      <p class="sec-hint">Choose what feels true. These details shape how the narrator describes you.</p>
      <div class="appear-grid" id="appearGrid">
        ${Object.entries((isF ? CHAR_DATA.fantasy : CHAR_DATA.reality).appearance).map(([cat, opts]) => `
          <div class="appear-group">
            <span class="appear-lbl">${cat}</span>
            <div class="btn-grid" style="grid-template-columns:1fr;gap:0.35rem;" id="app-${cat.replace(/[^a-zA-Z0-9]/g,'-')}">
              ${opts.map(o => `<button class="sel-btn" onclick="pickAppear('${cat}','${o.replace(/'/g,"\\'")}',this)">${o}</button>`).join('')}
            </div>
            <div class="custom-row" style="margin-top:0.35rem;">
              <input class="custom-field" placeholder="Or describe your own..." maxlength="60"
                oninput="pickAppearCustom('${cat}',this.value,document.getElementById('app-${cat.replace(/[^a-zA-Z0-9]/g,'-')}'))" />
            </div>
          </div>
        `).join('')}
      </div>
      <div class="cc-nav">
        <button class="btn-back" onclick="swTab(3)">← Back</button>
        <button class="btn-next" onclick="nextTab(4)" id="nn4">Next — Personality →</button>
      </div>
    </div>

    <!-- TAB 5: PERSONALITY -->
    <div class="panel" id="p5">
      <div class="sec-label">Your Demeanor</div>
      <p class="sec-hint">The narrator will use these. Choose what is true, not what is heroic.</p>

      <div class="pers-q">
        <span class="pers-q-txt">What drives you forward</span>
        <div class="pers-opts" id="pq-drive">
          ${(isF ? FANTASY_MOTIVATIONS : REALITY_MOTIVATIONS).map(o=>`
            <button class="pers-opt" onclick="pickPers('drive','${o.replace(/'/g,"\\'")}',this)">${o}</button>
          `).join('')}
        </div>
        <div class="custom-row" style="margin-top:0.4rem;">
          <input class="custom-field" placeholder="Or write your own motivation..." maxlength="80"
            oninput="pickPersCustom('drive',this.value,document.getElementById('pq-drive'))" />
        </div>
      </div>

      <div class="pers-q">
        <span class="pers-q-txt">What you carry</span>
        <div class="pers-opts" id="pq-carry">
          ${(isF ? FANTASY_CARRY : REALITY_CARRY).map(o=>`
            <button class="pers-opt" onclick="pickPers('carry','${o.replace(/'/g,"\\'")}',this)">${o}</button>
          `).join('')}
        </div>
        <div class="custom-row" style="margin-top:0.4rem;">
          <input class="custom-field" placeholder="Or describe what you carry..." maxlength="80"
            oninput="pickPersCustom('carry',this.value,document.getElementById('pq-carry'))" />
        </div>
      </div>

      <div class="pers-q">
        <span class="pers-q-txt">Your one true fear</span>
        <div class="pers-opts" id="pq-fear">
          ${(isF ? FANTASY_FEARS : REALITY_FEARS).map(o=>`
            <button class="pers-opt" onclick="pickPers('fear','${o.replace(/'/g,"\\'")}',this)">${o}</button>
          `).join('')}
        </div>
        <div class="custom-row" style="margin-top:0.4rem;">
          <input class="custom-field" placeholder="Or name your own fear..." maxlength="80"
            oninput="pickPersCustom('fear',this.value,document.getElementById('pq-fear'))" />
        </div>
      </div>

      ${Object.entries((isF ? CHAR_DATA.fantasy : CHAR_DATA.reality).personality).map(([q, opts]) => `
        <div class="pers-q">
          <span class="pers-q-txt">${q}</span>
          <div class="pers-opts" id="pq-${q.replace(/\s/g,'-').replace(/[^a-zA-Z0-9-]/g,'')}">
            ${opts.map(o=>`
              <button class="pers-opt" onclick="pickPers('${q.replace(/'/g,"\\'")}','${o.replace(/'/g,"\\'")}',this)">${o}</button>
            `).join('')}
          </div>
        </div>
      `).join('')}

      <div class="cc-nav">
        <button class="btn-back" onclick="swTab(4)">← Back</button>
        <button class="btn-next" onclick="finalizeCharacter()" id="nn5">Cross the Threshold →</button>
      </div>
    </div>

    <!-- WAITING -->
    <div class="waiting" id="waitScreen">
      <span class="wait-glyph">⌖</span>
      <div class="sum-card" id="sumCard"></div>
      <p class="wait-txt">Your soul has taken shape.<br>Waiting for the one across the veil
        <span class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>
      </p>
    </div>
  </div>
  `;
}

// ---- CHAR CREATION LOGIC ----

function swTab(i) {
  document.querySelectorAll('.panel').forEach((p,idx) => p.classList.toggle('active', idx===i));
  document.querySelectorAll('.tab').forEach((t,idx) => t.classList.toggle('active', idx===i));
  S.charTab = i;
  window.scrollTo(0,0);
}

function nextTab(current) {
  if (current === 0 && !S.charSelections.name.trim()) {
    document.getElementById('nameCustom').focus();
    return;
  }
  markDone(current);
  swTab(current + 1);
}

function markDone(i) {
  const t = document.getElementById('tab' + i);
  if (t) t.classList.add('done');
}

function clearGrid(gridId) {
  document.querySelectorAll(`#${gridId} .sel-btn`).forEach(b => b.classList.remove('selected'));
}

function pickName(name, btn) {
  S.charSelections.name = name;
  document.querySelectorAll('#nameGrid .sel-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const custom = document.getElementById('nameCustom');
  if (custom) custom.value = '';
}

function pickRace(id) {
  const data = S.role === 'fantasy' ? CHAR_DATA.fantasy : CHAR_DATA.reality;
  document.querySelectorAll('#raceGrid .card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById('rc-' + id);
  if (card) card.classList.add('selected');
  S.charSelections.race = data.races.find(r => r.id === id);
  const btn = document.getElementById('nn1');
  if (btn) btn.disabled = false;
  applyBonuses();
  markDone(1);
}

function pickJob(id) {
  const data = S.role === 'fantasy' ? CHAR_DATA.fantasy : CHAR_DATA.reality;
  document.querySelectorAll('#jobGrid .card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById('jb-' + id);
  if (card) card.classList.add('selected');
  S.charSelections.job = data.jobs.find(j => j.id === id);
  const btn = document.getElementById('nn2');
  if (btn) btn.disabled = false;
  applyBonuses();
  markDone(2);
}

function pickAppear(cat, val, btn) {
  const gridId = 'app-' + cat.replace(/[^a-zA-Z0-9]/g, '-');
  document.querySelectorAll(`#${gridId} .sel-btn`).forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  S.charSelections.appearance[cat] = val;
}

function pickAppearCustom(cat, val, grid) {
  if (grid) grid.querySelectorAll('.sel-btn').forEach(b => b.classList.remove('selected'));
  S.charSelections.appearance[cat] = val;
}

function pickPers(question, answer, btn) {
  btn.closest('.pers-opts').querySelectorAll('.pers-opt').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  S.charSelections.personality[question] = answer;
}

function pickPersCustom(question, val, grid) {
  if (grid) grid.querySelectorAll('.pers-opt').forEach(b => b.classList.remove('selected'));
  S.charSelections.personality[question] = val;
}

function applyBonuses() {
  const bonuses = {};
  const data = S.role === 'fantasy' ? CHAR_DATA.fantasy : CHAR_DATA.reality;
  [S.charSelections.race, S.charSelections.job].forEach(src => {
    if (!src || !src.bonus) return;
    src.bonus.split(',').forEach(part => {
      const m = part.trim().match(/^(.+?)\s*([+-]\d+)$/);
      if (m) bonuses[m[1].trim()] = (bonuses[m[1].trim()] || 0) + parseInt(m[2]);
    });
  });
  S.charSelections.statBonuses = bonuses;
  data.stats.forEach(stat => {
    const tag = document.getElementById('sb-' + stat);
    if (tag) tag.textContent = bonuses[stat] ? ` +${bonuses[stat]}` : '';
  });
  refreshPips();
}

function initStatPips() {
  const data = S.role === 'fantasy' ? CHAR_DATA.fantasy : CHAR_DATA.reality;
  data.stats.forEach(stat => { if (!S.charSelections.stats[stat]) S.charSelections.stats[stat] = 0; });
  refreshPips();
}

function setPip(stat, val) {
  const current = S.charSelections.stats[stat] || 0;
  const newVal = current === val ? val - 1 : val;
  const diff = newVal - current;
  if (diff > S.charSelections.statPoints) return;
  S.charSelections.stats[stat] = newVal;
  S.charSelections.statPoints -= diff;
  refreshPips();
}

function refreshPips() {
  const data = S.role === 'fantasy' ? CHAR_DATA.fantasy : CHAR_DATA.reality;
  const poolEl = document.getElementById('poolNum');
  if (poolEl) poolEl.textContent = S.charSelections.statPoints;
  data.stats.forEach(stat => {
    const base = S.charSelections.stats[stat] || 0;
    const bonus = (S.charSelections.statBonuses || {})[stat] || 0;
    const total = Math.min(base + bonus, 5);
    const valEl = document.getElementById('sv-' + stat);
    if (valEl) valEl.textContent = total;
    [1,2,3,4,5].forEach(n => {
      const pip = document.getElementById(`pip-${stat}-${n}`);
      if (pip) pip.classList.toggle('on', n <= base);
    });
  });
}

function finalizeCharacter() {
  const sel = S.charSelections;
  const data = S.role === 'fantasy' ? CHAR_DATA.fantasy : CHAR_DATA.reality;
  const finalStats = {};
  data.stats.forEach(stat => {
    finalStats[stat] = Math.min((sel.stats[stat] || 0) + (sel.statBonuses[stat] || 0), 5);
  });
  S.myCharacter = {
    role: S.role,
    name: sel.name || 'Unknown',
    race: sel.race,
    job: sel.job,
    stats: finalStats,
    appearance: sel.appearance,
    personality: sel.personality,
    drive: sel.personality.drive || '',
    carry: sel.personality.carry || '',
    fear: sel.personality.fear || ''
  };
  if (S.conn && S.conn.open) {
    S.conn.send({ type: 'character', character: S.myCharacter });
  }
  document.querySelector('.tabs').style.display = 'none';
  document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
  const waiting = document.getElementById('waitScreen');
  if (waiting) waiting.classList.add('on');
  const accentCol = S.role === 'fantasy' ? '#ff7ddd' : '#9fc0da';
  const sumCard = document.getElementById('sumCard');
  if (sumCard) sumCard.innerHTML = `
    <div class="sum-name" style="color:${accentCol}">${S.myCharacter.name}</div>
    <p class="sum-line">${sel.race ? sel.race.name : ''} ${sel.job ? '· ' + sel.job.name : ''}</p>
    <p class="sum-line">${sel.job ? '⚡ ' + sel.job.ability : ''}</p>
    <div class="sum-stats">${Object.entries(finalStats).map(([k,v])=>`<span class="stat-badge">${k} ${v}</span>`).join('')}</div>
  `;
  checkBothReady();
}

function checkBothReady() {
  if (S.myCharacter && S.otherCharacter) {
    setTimeout(() => launchActualGame(), 1000);
  }
}

function initCharScreen() {
  S.charTab = 0;
  S.charSelections = { name:'', race:null, job:null, stats:{}, appearance:{}, personality:{}, statPoints:12, statBonuses:{} };
  initStatPips();
}

// PHASE 1 STEP 4. This registration used to live inside initCharScreen as a
// second conn.on('data') listener, which meant it stayed live for the whole
// session and also re-registered every time the char screen was built.
// Registered once here at load, routed through the one dispatcher.
//
// Registering before the screen exists is safe: if the other player finishes
// first, S.otherCharacter is set and checkBothReady no-ops because
// S.myCharacter is still null. finalizeCharacter calls it again afterwards.
onMessage('character', (data) => {
  S.otherCharacter = data.character;
  checkBothReady();
});
