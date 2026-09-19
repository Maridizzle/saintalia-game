// ============================================================
// SAINTALIA -- GAME SCREEN
// Author: Maridizzle
//
// Game state, the mural, the turn loop, notes, and the veil meter.
// Moved from saintalia-v2.html (Phase 1):
//   lines 1644 to 2138  state, mural layers, screen builder, veil blink
//   lines 2309 to 2604  opening scene, turn loop, notes, UI helpers
//
// TWO EDITS, both required to make the split load:
//   1. buildGameScreen() no longer carries its 186 line <style> block.
//      That CSS is in css/game.css. Its :root declarations moved to
//      body.screen-game, including the --bone circular reference, which is
//      preserved on purpose. See the comment in game.css.
//   2. setScreen('game') added at the top of buildGameScreen so the merged
//      stylesheet knows which set of body rules applies.
//
// GROQ_URL, GROQ_MODEL and every narration function moved to narrator.js.
//
// PHASE 3, DONE. What used to be broken here and is not any more:
//   - 3d. makeChoice returned early on the joiner without sending the choice
//     anywhere, so the host wrote every turn from its own action alone. Both
//     sides now send, and the host resolves once both have arrived.
//   - 3e. Veil strength was bumped locally and never broadcast, so the two
//     percentages drifted apart from turn one. veil-update was HANDLED and
//     sent by nothing. It is sent now, and energy with it.
//   - 3f. Host identity was read off a lobby tab. It is S.isHost, latched at
//     handshake.
//   - Phase 1 step 4. This file's conn.on('data') was the third of three live
//     listeners. All three are one dispatcher in connection.js now.
//
// Still not fixed here, on purpose: the companion panel's Composure meter is
// still hardcoded at 100 percent. Energy is broadcast, Composure has nothing
// behind it yet.
// ============================================================

// Game state
const G = {
  turn: 1,
  veilStrength: 5,
  muralLayer: 0,
  energy: 100,
  notes: [],
  fantasyHistory: [],
  realityHistory: [],
  waitingForNarrator: false,
  openingDone: false,
  fantasyChoices: [],
  realityChoices: [],

  // PHASE 3d. The turn now waits for BOTH players. This holds each side's
  // choice until the pair is complete, then the host resolves the turn once.
  // Previously the joiner's choice was never sent anywhere and the host
  // narrated every turn from its own choice alone.
  pendingChoices: { fantasy: null, reality: null },
};

// The captions below predate the established mural progression in the vault
// (fin in pond, animal with a third leg, coiled presence in the cave mouth,
// burnt trees in lush canopy, sourceless shadow, full bleed). So do the SVG
// paths in buildGameScreen. Both are Maridizzle's content to redraw and
// rewrite. Do not touch either. Logged in PLAN.md Phase 9.
const MURAL_LAYERS = [
  { caption: 'The ceiling stretches bare. The commission called for something luminous. Something else is deciding what goes there instead.' },
  { caption: 'A shape in the lower corner. You do not remember painting it. It has too many joints in its neck.' },
  { caption: 'The gold lines are not paint. When you touch them they are slightly warm and slightly wet.' },
  { caption: 'Three silhouettes along the left margin. One of them has moved since yesterday.' },
  { caption: 'Wings where the angels should be. They belong to nothing holy.' },
  { caption: 'It has a face now. In the center of your ceiling. It has always had a face. You just could not see it before.' },
];

// PHASE 4. This used to build the game screen and kick off the opening
// narration directly. It now hands off to the scene manager, which mounts
// the Opening as a scene. The Opening's implementation is unchanged and
// still lives in this file; js/scenes/opening.js is a thin adapter over it.
function launchActualGame() {
  if (typeof relayRemember === 'function') relayRemember({ phase: 'game' });   // PHASE 11a step 3
  document.body.innerHTML = '';

  // The run, in play order. The Dream slots in between skytears and
  // questions when Phase 7 builds it. See PLAN.md "Current priority".
  setSceneOrder([
    'opening',      // the blink, the photo, the misdial
    'lockdown',     // the building seals, five wrong objects
    'escape',       // bridge, unwritten
    'skytears',     // bridge, unwritten
    'questions',    // beat 2-B
    'coming-soon'   // the end of what exists
  ]);

  mountScene('opening');
}

// PHASE 4. Takes a root element now. Falls back to document.body so nothing
// breaks if it is ever called the old way.
function buildGameScreen(root) {
  const isF = S.role === 'fantasy';
  const myC = S.myCharacter;
  const otherC = S.otherCharacter;

  setScreen('game');

  (root || document.body).innerHTML = `
  <!-- GAME HEADER -->
  <div class="g-header">
    <div class="g-logo">Saintalia</div>
    <div class="veil-wrap">
      <div class="veil-label">The Veil — Integrity</div>
      <div class="veil-track">
        <div class="veil-fill" id="veilFill" style="width:5%"></div>
      </div>
    </div>
    <div class="turn-info">
      Turn <span id="turnNum">1</span><br>
      <span class="energy-tag" id="energyTag">${isF ? 'Energy: 100' : ''}</span>
    </div>
  </div>

  <!-- GAME BODY -->
  <div class="g-body">

    <!-- LEFT PANEL: Fantasy player's action panel OR companion status -->
    ${isF ? `
    <div class="side fantasy-side your-side" id="fantasy-panel">
      <div class="your-banner">Your Side — Saintalia</div>
      <div class="side-head">
        <div class="nameplate">
          <div class="avatar" id="fAvatarG">${myC.name[0].toUpperCase()}</div>
          <div class="char-info">
            <h4 id="fNameG">${myC.name}</h4>
            <span>${myC.race ? myC.race.name : ''} ${myC.job ? myC.job.name : ''}</span>
          </div>
          <span class="side-badge">Saintalia</span>
        </div>
      </div>
      <div class="private-feed-section">
        <div class="private-feed-label">Your Story</div>
        <div class="private-feed" id="privateFeed"></div>
        <div class="thinking on" id="privateThink" style="display:none">The veil stirs...</div>
      </div>
      <div class="holo-terminal" id="holoTerminal">
        <div class="holo-scanline"></div>
        <div class="holo-label">⬡ Veil Terminal — Incoming Signal</div>
        <div class="holo-msg-area" id="holoMsgs">
          <div class="holo-msg" style="opacity:0.4">[ terminal initializing... ]</div>
        </div>
        <div class="holo-input-row">
          <input class="holo-input" id="holoInput" placeholder="transmit through veil..." maxlength="200" />
          <button class="holo-send" id="holoSendBtn" onclick="sendNote('fantasy')" disabled>⬡ Send</button>
        </div>
      </div>
      <div class="choice-area">
        <div class="choice-label">What do you do</div>
        <div id="fantasyChoicesBtns"></div>
        <div class="custom-row">
          <input class="custom-input" id="fantasyCustom" placeholder="Or write your own action..." />
          <button class="custom-btn" id="fantasyCustomBtn" onclick="submitCustom('fantasy')" disabled>Act</button>
        </div>
        <button class="btn-primary opening-exit" id="openingExit" style="display:none" onclick="bridgeContinue(this)">The building seals</button>
        <div class="bridge-wait" id="bridgeWait" style="display:none">Both of you have to step through.</div>
      </div>
    </div>
    ` : `
    <div class="companion-panel" id="fantasy-panel">
      <div class="companion-banner">Companion — Saintalia</div>
      <div class="companion-body">
        <div class="comp-avatar">${otherC.name[0].toUpperCase()}</div>
        <div class="comp-name">${otherC.name}</div>
        <div class="comp-role">${otherC.race ? otherC.race.name : ''} · ${otherC.job ? otherC.job.name : ''}</div>
        <div class="comp-divider"></div>
        <div class="comp-stat-label">Energy</div>
        <div class="comp-meter-track"><div class="comp-meter-fill" id="compEnergyFill" style="width:100%"></div></div>
        <div class="comp-stat-label" style="margin-top:0.8rem;">Last seen</div>
        <div class="comp-status" id="compStatus">Somewhere in Saintalia</div>
        <div class="comp-divider"></div>
        <div class="comp-note-label">They can feel you through the veil.</div>
      </div>
    </div>
    `}

    <!-- CENTER COLUMN: Shared story feed + veil + notes + mural (Reality only) -->
    <div class="center-col">

      <!-- MURAL: Only visible to Reality player -->
      ${!isF ? `
      <div class="mural-section">
        <div class="mural-label">The Living Mural</div>
        <div class="mural-canvas">
          <svg id="muralSvg" viewBox="0 0 280 320" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
            <rect width="280" height="320" fill="#06030e"/>
            <rect x="8" y="8" width="264" height="304" fill="none" stroke="rgba(201,168,76,0.06)" stroke-width="1"/>
            <ellipse cx="140" cy="80" rx="90" ry="50" fill="rgba(20,40,70,0.2)"/>
            <path d="M50 70 Q90 55 130 65 Q155 57 180 63 Q210 55 240 68" fill="none" stroke="rgba(160,180,210,0.1)" stroke-width="1.5"/>
            <path d="M60 82 Q95 68 135 76 Q160 68 190 74 Q215 66 245 78" fill="none" stroke="rgba(160,180,210,0.07)" stroke-width="1"/>
            <ellipse cx="140" cy="120" rx="20" ry="25" fill="rgba(200,180,150,0.06)"/>
            <ellipse cx="140" cy="106" rx="12" ry="13" fill="rgba(200,180,150,0.05)"/>
            <g id="mL0" opacity="0" style="transition:opacity 3s ease">
              <path d="M260 308 Q245 280 228 255 Q210 228 195 205" fill="none" stroke="rgba(139,26,26,0.65)" stroke-width="1.5" stroke-dasharray="3,2"/>
              <circle cx="260" cy="308" r="4" fill="rgba(139,26,26,0.4)"/>
            </g>
            <g id="mL1" opacity="0" style="transition:opacity 3s ease">
              <path d="M25 295 Q48 268 75 242 Q105 215 128 192 Q142 178 145 160" fill="none" stroke="rgba(201,168,76,0.5)" stroke-width="1.2"/>
              <ellipse cx="147" cy="157" rx="7" ry="4" fill="rgba(201,168,76,0.2)" transform="rotate(-18,147,157)"/>
              <path d="M150 160 Q162 148 166 134 Q170 120 162 108" fill="none" stroke="rgba(201,168,76,0.38)" stroke-width="1" stroke-dasharray="2,2"/>
            </g>
            <g id="mL2" opacity="0" style="transition:opacity 3s ease">
              <path d="M8 260 Q28 238 50 218 Q55 208 52 198" fill="none" stroke="rgba(80,50,120,0.55)" stroke-width="1.5"/>
              <circle cx="52" cy="194" r="7" fill="none" stroke="rgba(80,50,120,0.5)" stroke-width="1"/>
              <path d="M50 216 Q41 202 43 190" fill="none" stroke="rgba(80,50,120,0.38)" stroke-width="1" stroke-dasharray="2,2"/>
              <path d="M53 216 Q63 201 61 188" fill="none" stroke="rgba(80,50,120,0.38)" stroke-width="1" stroke-dasharray="2,2"/>
              <circle cx="49" cy="191" r="1.5" fill="rgba(255,50,50,0.4)"/>
              <circle cx="56" cy="191" r="1.5" fill="rgba(255,50,50,0.4)"/>
              <text x="12" y="278" fill="rgba(80,50,120,0.4)" font-size="6" font-family="serif" font-style="italic">it watches</text>
            </g>
            <g id="mL3" opacity="0" style="transition:opacity 3s ease">
              <path d="M140 95 Q185 75 222 84 Q255 90 272 115 Q260 126 240 120 Q212 110 188 114 Q165 118 155 138" fill="rgba(25,12,45,0.55)" stroke="rgba(139,26,26,0.38)" stroke-width="1"/>
              <path d="M188 114 Q194 100 205 93" fill="none" stroke="rgba(139,26,26,0.3)" stroke-width="0.8"/>
            </g>
            <g id="mL4" opacity="0" style="transition:opacity 3s ease">
              <ellipse cx="140" cy="172" rx="14" ry="20" fill="rgba(201,168,76,0.08)" stroke="rgba(201,168,76,0.28)" stroke-width="0.8"/>
              <ellipse cx="140" cy="157" rx="9" ry="10" fill="rgba(201,168,76,0.1)" stroke="rgba(201,168,76,0.22)" stroke-width="0.8"/>
              <circle cx="136" cy="155" r="1.5" fill="rgba(201,168,76,0.7)"/>
              <circle cx="144" cy="155" r="1.5" fill="rgba(201,168,76,0.7)"/>
              <text x="92" y="198" fill="rgba(201,168,76,0.35)" font-size="5.5" font-family="serif" font-style="italic">she painted this herself</text>
              <text x="102" y="207" fill="rgba(201,168,76,0.25)" font-size="5" font-family="serif" font-style="italic">she does not remember</text>
            </g>
            <g id="mL5" opacity="0" style="transition:opacity 4s ease">
              <rect x="8" y="8" width="264" height="304" fill="rgba(8,3,18,0.45)"/>
              <path d="M140 20 Q128 55 110 88 Q92 118 82 148 Q72 178 84 208 Q96 238 125 256 Q140 264 155 256 Q184 238 196 208 Q208 178 198 148 Q188 118 170 88 Q152 55 140 20 Z" fill="rgba(45,27,78,0.22)" stroke="rgba(201,168,76,0.18)" stroke-width="0.8"/>
              <text x="88" y="312" fill="rgba(201,168,76,0.5)" font-size="6" font-family="serif" font-style="italic">the veil has broken completely</text>
            </g>
          </svg>
        </div>
        <div class="mural-cap" id="muralCap">The ceiling stretches bare. The commission called for something luminous. Something else is deciding.</div>
      </div>
      ` : `
      <div class="veil-sense-section">
        <div class="mural-label">The Veil</div>
        <div class="veil-sense-text" id="veilSenseText">Something is being made on the other side. You can feel the weight of it through the crack.</div>
      </div>
      `}

      <!-- SHARED LOG: notes, veil events, turn markers -->
      <div class="shared-feed-section">
        <div class="shared-feed-label">Veil Log</div>
        <div class="story-feed" id="sharedFeed"></div>
      </div>

      <!-- VEIL METER -->
      <div class="veil-section">
        <div class="veil-center-label">Veil Integrity</div>
        <div class="veil-center-track">
          <div class="veil-center-fill" id="veilCenterFill" style="width:5%"></div>
        </div>
        <div class="energy-row">
          <span class="energy-pip-label">Stable</span>
          <span class="energy-val" id="veilPct">5%</span>
          <span class="energy-pip-label">Broken</span>
        </div>
      </div>

      <!-- NOTE PASSING -->
      <div class="note-center">
        <div class="note-center-label">Notes Through the Veil</div>
        <div class="note-thread" id="noteThread">
          <div style="text-align:center;font-size:0.82rem;color:rgba(255,255,255,0.2);font-style:italic;padding:0.5rem;">The veil accepts written words.</div>
        </div>
        <div class="note-compose-row">
          <input class="note-input-center" id="noteInput" placeholder="Pass a note through the crack..." maxlength="200" />
          <button class="note-send-center" id="noteSendBtn" onclick="sendNote(S.role)" disabled>Send</button>
        </div>
      </div>

    </div>

    <!-- RIGHT PANEL: Reality player's action panel OR companion status -->
    ${!isF ? `
    <div class="side reality-side your-side" id="reality-panel">
      <div class="your-banner">Your Side — Reality</div>
      <div class="side-head">
        <div class="nameplate">
          <span class="side-badge">Reality</span>
          <div class="char-info" style="text-align:right;margin-left:auto;">
            <h4 id="rNameG">${myC.name}</h4>
            <span>${myC.race ? myC.race.name : ''} ${myC.job ? myC.job.name : ''}</span>
          </div>
          <div class="avatar" id="rAvatarG">${myC.name[0].toUpperCase()}</div>
        </div>
      </div>
      <div class="private-feed-section">
        <div class="private-feed-label">Your Story</div>
        <div class="private-feed" id="privateFeed"></div>
        <div class="thinking" id="privateThink" style="display:none">Something moves in the brushstrokes...</div>
      </div>
      <div class="phone-wrap" id="phoneWrap">
        <div class="phone-label">📱 Messages — Unknown Number</div>
        <div class="phone-thread" id="phoneMsgs">
          <div style="text-align:center;font-size:0.92rem;color:rgba(255,255,255,0.2);font-style:italic;padding:0.4rem;">No messages yet.</div>
        </div>
        <div class="phone-input-row">
          <input class="phone-input" id="phoneInput" placeholder="type a message..." maxlength="200" />
          <button class="phone-send" id="phoneSendBtn" onclick="sendNote('reality')" disabled>↑</button>
        </div>
      </div>
      <div class="choice-area">
        <div class="choice-label">What do you do</div>
        <div id="realityChoicesBtns"></div>
        <div class="custom-row">
          <input class="custom-input" id="realityCustom" placeholder="Or write your own action..." />
          <button class="custom-btn" id="realityCustomBtn" onclick="submitCustom('reality')" disabled>Act</button>
        </div>
        <button class="btn-primary opening-exit" id="openingExit" style="display:none" onclick="bridgeContinue(this)">The building seals</button>
        <div class="bridge-wait" id="bridgeWait" style="display:none">Both of you have to step through.</div>
      </div>
    </div>
    ` : `
    <div class="companion-panel" id="reality-panel">
      <div class="companion-banner">Companion — The Waking World</div>
      <div class="companion-body">
        <div class="comp-avatar">${otherC.name[0].toUpperCase()}</div>
        <div class="comp-name">${otherC.name}</div>
        <div class="comp-role">${otherC.race ? otherC.race.name : ''} · ${otherC.job ? otherC.job.name : ''}</div>
        <div class="comp-divider"></div>
        <div class="comp-stat-label">Composure</div>
        <div class="comp-meter-track"><div class="comp-meter-fill" id="compComposureFill" style="width:100%"></div></div>
        <div class="comp-stat-label" style="margin-top:0.8rem;">Last seen</div>
        <div class="comp-status" id="compStatusR">Somewhere in the waking world</div>
        <div class="comp-divider"></div>
        <div class="comp-note-label">They sent you something. Through the wrong number.</div>
      </div>
    </div>
    `}

  </div>

  </div>
  `;
}



function veilBlink() {
  // Brief screen flash for the fantasy side veil blink moment
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9999;pointer-events:none;opacity:0;transition:opacity 0.08s ease;';
  document.body.appendChild(overlay);
  setTimeout(() => { overlay.style.opacity = '1'; }, 50);
  setTimeout(() => { overlay.style.opacity = '0'; }, 180);
  setTimeout(() => { document.body.removeChild(overlay); }, 400);

  // Drain energy
  G.energy = Math.max(0, G.energy - 8);
  updateEnergyDisplay();
  broadcastEnergy();
}

// ---- STATE BROADCAST (PHASE 3e) ----
// veil-update was HANDLED by the old code and sent by nothing, so the two
// players' veil percentages drifted apart from turn one. Energy was never
// shared at all, which is why the companion panel's meter sat at a hardcoded
// 100 percent forever.

function broadcastVeil() {
  if (S.conn && S.conn.open) {
    S.conn.send({ type: 'veil-update', strength: G.veilStrength });
  }
}

function broadcastEnergy() {
  if (S.conn && S.conn.open) {
    S.conn.send({ type: 'energy-update', energy: G.energy });
  }
}

function showCorruptedImage() {
  // Show corrupted image attachment in phone thread
  const thread = document.getElementById('phoneMsgs');
  if (!thread) return;
  thread.innerHTML = '';
  const bubble = document.createElement('div');
  bubble.className = 'phone-bubble sent';
  bubble.innerHTML = `
    <div class="bubble-inner">
      <em style="font-size:0.97rem;opacity:0.7">Dr. Voss — are you there? I took a progress photo. Something is in it. I don't know what I'm looking at. Please call me back.</em>
      <span class="corrupt-image"></span>
      <em style="font-size:0.9rem;opacity:0.4;display:block;margin-top:0.3rem">[ image attachment — 1 file ]</em>
    </div>
  `;
  thread.appendChild(bubble);
  thread.scrollTop = thread.scrollHeight;

  // Enable phone input now
  const phoneBtn = document.getElementById('phoneSendBtn');
  if (phoneBtn) phoneBtn.disabled = false;
}

// ---- OPENING SCENE ----
async function beginOpeningScene() {
  // PHASE 3f. Was S.action === 'create', read off a lobby tab that stays
  // clickable after connecting. S.isHost is latched at handshake instead.
  const isHost = S.isHost;

  setThinking(true);

  if (isHost) {
    let raw;
    if (S.groqKey) {
      raw = await callGroq(buildCombinedSystem(), buildCombinedOpening());
    } else {
      raw = buildOfflineCombined();
    }

    if (S.conn && S.conn.open) {
      S.conn.send({ type: 'narrator-update', raw, turn: G.turn });
    }

    applyNarratorResponse(raw);
    G.openingDone = true;

    if (S.role === 'reality') setTimeout(() => showCorruptedImage(), 1200);
    if (S.role === 'fantasy') setTimeout(() => veilBlink(), 800);
    revealOpeningExit();

  } else {
    // Joiner waits -- narrator-update arrives via setupGameMessageHandler
    addEntry('shared', 'Waiting for the veil to speak...', 'system');
  }
}

// ---- MAKE CHOICE (PHASE 3d) ----
// The old version had the joiner write its choice to the local feed and then
// `return`, so the choice was never transmitted and the host wrote every turn
// from its own action alone. Half the game narrated into a void.
//
// Now both sides record their choice, send it over the wire, and the HOST
// resolves the turn once both have arrived.
async function makeChoice(side, choiceText) {
  if (G.waitingForNarrator) return;
  if (G.pendingChoices[side]) return; // already chose this turn

  addEntry('private', choiceText, 'action');
  addEntry('shared', `Turn ${G.turn} -- ${S.myCharacter.name} acts`, 'system');

  G[side + 'History'].push({ role: 'player', text: choiceText });
  G.pendingChoices[side] = choiceText;
  setChoicesEnabled(false);

  if (S.conn && S.conn.open) {
    S.conn.send({ type: 'player-choice', side, text: choiceText, turn: G.turn });
  }

  if (S.isHost) {
    await resolveTurnIfReady();
  } else {
    setThinking(true, 'Your choice is made. Waiting for the other side...');
  }
}

// Host only. Fires when both choices are in, never before.
async function resolveTurnIfReady() {
  if (!S.isHost || G.waitingForNarrator) return;

  const f = G.pendingChoices.fantasy;
  const r = G.pendingChoices.reality;

  if (!f || !r) {
    setThinking(true, 'Your choice is made. Waiting for the other side...');
    return;
  }

  G.waitingForNarrator = true;
  setThinking(true);

  const fC = S.role === 'fantasy' ? S.myCharacter : S.otherCharacter;
  const rC = S.role === 'reality' ? S.myCharacter : S.otherCharacter;

  // Both sides' recent history, so the narrator can see the shape of the turn
  // rather than one player's half of it.
  const recentHistory = G.fantasyHistory
    .concat(G.realityHistory)
    .slice(-6)
    .map(h => h.text)
    .join('\n\n');

  const prompt = `The fantasy player (${fC.name}) chose: "${f}"\nThe reality player (${rC.name}) chose: "${r}"\n\nRecent history:\n${recentHistory}\n\nContinue the scene with consequence for both sides. Nothing is safe. Each player only perceives their own side of what just happened. Produce all four sections.`;

  let raw;
  if (S.groqKey) {
    raw = await callGroq(buildCombinedSystem(), prompt);
  } else {
    raw = buildOfflineCombined();
  }

  if (S.conn && S.conn.open) {
    S.conn.send({ type: 'narrator-update', raw, turn: G.turn });
  }

  applyNarratorResponse(raw);
  G.fantasyHistory.push({ role: 'narrator', text: raw });

  G.pendingChoices = { fantasy: null, reality: null };
  G.waitingForNarrator = false;

  advanceTurn();
}

// Host only. Turn counter, veil drift and mural, all broadcast so the other
// screen actually matches this one.
function advanceTurn() {
  G.turn++;
  const turnEl = document.getElementById('turnNum');
  if (turnEl) turnEl.textContent = G.turn;

  G.veilStrength = Math.min(100, G.veilStrength + Math.floor(Math.random() * 6) + 2);
  updateVeil(G.veilStrength);
  broadcastVeil();

  if (G.turn % 3 === 0 && G.muralLayer < 5) {
    G.muralLayer++;
    const cap = MURAL_LAYERS[G.muralLayer] ? MURAL_LAYERS[G.muralLayer].caption : '';
    advanceMuralLayer(G.muralLayer, cap);
    addEntry('shared', 'The mural shifts.', 'system');
    if (S.conn && S.conn.open) {
      S.conn.send({ type: 'mural-advance', layer: G.muralLayer, caption: cap });
    }
    if (S.role === 'fantasy') veilBlink();
  }
}

// ---- GAME MESSAGE HANDLERS ----
// PHASE 1 STEP 4. This was the third of three live conn.on('data') listeners.
// Registered once at load now, routed through the one dispatcher in
// connection.js. setupGameMessageHandler is kept as a no-op so the call in
// launchActualGame still reads honestly and nothing breaks if it is called
// twice.

function setupGameMessageHandler() {
  // Intentionally empty. Handlers are registered at the bottom of this file.
}

// SHARED, not scene scoped. Notes are the through-line across every scene in
// the vault, so G.notes must keep accumulating no matter what is mounted.
// The DOM writes inside receiveNote no-op when a scene has no note thread.
onMessage('note', (data) => receiveNote(data));

// PHASE 4. Everything below belongs to the Opening specifically, so each is
// wrapped in forScene. A late narrator-update arriving after the Lockdown has
// mounted would otherwise render into whatever DOM happened to be on screen.
onMessage('narrator-update', forScene('opening', (data) => {
  applyNarratorResponse(data.raw);
  G.waitingForNarrator = false;

  // PHASE 3d. Clear the pair so the next turn can accept fresh choices.
  G.pendingChoices = { fantasy: null, reality: null };

  G.turn = data.turn + 1;
  const turnEl = document.getElementById('turnNum');
  if (turnEl) turnEl.textContent = G.turn;

  if (!G.openingDone) {
    if (S.role === 'reality') setTimeout(() => showCorruptedImage(), 1200);
    if (S.role === 'fantasy') setTimeout(() => veilBlink(), 800);
    G.openingDone = true;
    revealOpeningExit();
  }
}));

// PHASE 3d. The other player's choice, which previously went nowhere.
onMessage('player-choice', forScene('opening', (data) => {
  G.pendingChoices[data.side] = data.text;

  const hist = G[data.side + 'History'];
  if (hist) hist.push({ role: 'player', text: data.text });

  addEntry('shared', 'The other side has chosen.', 'system');

  if (S.isHost) resolveTurnIfReady();
}));

onMessage('mural-advance', forScene('opening', (data) => {
  advanceMuralLayer(data.layer, data.caption);
  addEntry('shared', 'The mural shifts.', 'system');

  // The host blinks its own screen when it is the fantasy side. Without this
  // the fantasy JOINER never blinked and never lost the energy, which is a
  // straight desync of a mechanic the vault calls cumulative and physical.
  if (S.role === 'fantasy') veilBlink();
}));

onMessage('veil-update', forScene('opening', (data) => updateVeil(data.strength)));

// PHASE 3e. Feeds the companion panel meter that was hardcoded at 100%.
onMessage('energy-update', forScene('opening', (data) => {
  G.energy = data.energy;
  const fill = document.getElementById('compEnergyFill');
  if (fill) fill.style.width = Math.max(0, Math.min(100, data.energy)) + '%';
  updateEnergyDisplay();
}));

async function submitCustom(side) {
  const inputId = side === 'fantasy' ? 'fantasyCustom' : 'realityCustom';
  const input = document.getElementById(inputId);
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();
  input.value = '';
  await makeChoice(side, text);
}

// ---- NOTES ----
function sendNote(side) {
  const input = document.getElementById('noteInput');
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();
  input.value = '';

  const note = { from: side, text, turn: G.turn };
  G.notes.push(note);

  addNoteToThread(side, text);
  addEntry('shared', `${S.myCharacter.name} passes a note through the veil: "${text}"`, 'note-in');

  if (side === 'fantasy') {
    addHoloMsg(text, false);
  } else {
    addPhoneBubble(text, true);
  }

  if (S.conn && S.conn.open) {
    S.conn.send({ type: 'note', from: side, text, turn: G.turn });
  }

  G.veilStrength = Math.min(100, G.veilStrength + 1);
  updateVeil(G.veilStrength);
  broadcastVeil();
}

function receiveNote(data) {
  const note = { from: data.from, text: data.text, turn: data.turn };
  G.notes.push(note);

  const mySide = S.role === 'fantasy' ? 'fantasy' : 'reality';
  const isFromMe = data.from === mySide;

  if (!isFromMe) {
    addNoteToThread(data.from, data.text);
    addEntry('shared', `A note arrives through the veil: "${data.text}"`, 'note-in');

    if (data.from === 'fantasy') {
      addHoloMsg(data.text, true);
    } else {
      addPhoneBubble(data.text, false);
    }
  }
}

function addNoteToThread(side, text) {
  const thread = document.getElementById('noteThread');
  if (!thread) return;

  const placeholder = thread.querySelector('[style*="text-align:center"]');
  if (placeholder) placeholder.remove();

  const isF = side === 'fantasy';
  const senderName = isF
    ? (S.myCharacter && S.role === 'fantasy' ? S.myCharacter.name : S.otherCharacter ? S.otherCharacter.name : 'Saintalia')
    : (S.myCharacter && S.role === 'reality' ? S.myCharacter.name : S.otherCharacter ? S.otherCharacter.name : 'Reality');

  const bubble = document.createElement('div');
  bubble.className = isF ? 'note-bubble-f' : 'note-bubble-r';
  bubble.innerHTML = `<span class="note-from-tag">${senderName}</span>${text}`;
  thread.appendChild(bubble);
  thread.scrollTop = thread.scrollHeight;
}

function addHoloMsg(text, isIncoming) {
  const area = document.getElementById('holoMsgs');
  if (!area) return;
  // Clear placeholder
  if (area.querySelector('[style*="opacity:0.4"]')) area.innerHTML = '';
  const msg = document.createElement('div');
  msg.className = 'holo-msg' + (isIncoming ? ' incoming' : '');
  msg.textContent = (isIncoming ? '> INCOMING: ' : '> SENT: ') + text;
  area.appendChild(msg);
  area.scrollTop = area.scrollHeight;
}

function addPhoneBubble(text, isSent) {
  const thread = document.getElementById('phoneMsgs');
  if (!thread) return;
  // Clear placeholder
  const placeholder = thread.querySelector('[style*="text-align:center"]');
  if (placeholder) placeholder.remove();

  const bubble = document.createElement('div');
  bubble.className = 'phone-bubble ' + (isSent ? 'sent' : 'recv');
  bubble.innerHTML = `<div class="bubble-inner">${text}</div>`;
  thread.appendChild(bubble);
  thread.scrollTop = thread.scrollHeight;
}

// ---- MURAL ----
function advanceMuralLayer(layer, caption) {
  const el = document.getElementById('mL' + (layer - 1));
  if (el) el.style.opacity = '1';
  const capEl = document.getElementById('muralCap');
  if (capEl && caption) capEl.textContent = caption;
}

// ---- VEIL ----
function updateVeil(strength) {
  G.veilStrength = strength;
  const pct = strength + '%';
  const fill1 = document.getElementById('veilFill');
  const fill2 = document.getElementById('veilCenterFill');
  const pctEl = document.getElementById('veilPct');
  if (fill1) fill1.style.width = pct;
  if (fill2) fill2.style.width = pct;
  if (pctEl) pctEl.textContent = pct;
}

function updateEnergyDisplay() {
  const tag = document.getElementById('energyTag');
  if (tag && S.role === 'fantasy') tag.textContent = 'Energy: ' + G.energy;
}

function addEntry(target, text, type) {
  const feedId = target === 'shared' ? 'sharedFeed' : 'privateFeed';
  const feed = document.getElementById(feedId);
  if (!feed) return;

  const entry = document.createElement('div');
  entry.className = 'entry ' + type;

  // Strip any narrator section markers from display text
  const clean = text
    .replace(/FANTASY_NARRATIVE:/g, '')
    .replace(/FANTASY_CHOICES:\{"choices":\s*\[[^\]]*\]\}/g, '')
    .replace(/REALITY_NARRATIVE:/g, '')
    .replace(/REALITY_CHOICES:\{"choices":\s*\[[^\]]*\]\}/g, '')
    .replace(/CHOICES:\{"choices":\s*\[[^\]]*\]\}/g, '')
    .trim();

  const labels = {
    narrator: 'The Narrator',
    action: 'Your Action',
    'note-in': 'Through the Veil',
    system: 'System'
  };

  const tag = document.createElement('span');
  tag.className = 'entry-tag';
  tag.textContent = labels[type] || type;
  entry.appendChild(tag);

  const p = document.createElement('p');
  p.textContent = clean;
  entry.appendChild(p);

  feed.appendChild(entry);
  feed.scrollTop = feed.scrollHeight;
}

// PHASE 3d. Takes an optional message so the turn can say "waiting for the
// other side" rather than pretending the narrator is thinking. Called with
// one argument everywhere else, same as before.
const THINKING_TEXT = {
  fantasy: 'The veil stirs...',
  reality: 'Something moves in the brushstrokes...'
};

// PHASE 8. The Opening's end condition. The vault says the building seals
// the moment the connection is established, but it names no turn count, so
// Claude does not pick one. The control appears once the opening beat has
// landed and the PLAYERS decide when to step through. Both must press it.
function revealOpeningExit() {
  const b = document.getElementById('openingExit');
  if (b) b.style.display = 'block';
}

function setThinking(on, msg) {
  const el = document.getElementById('privateThink');
  if (!el) return;
  if (on) el.textContent = msg || THINKING_TEXT[S.role] || 'The veil stirs...';
  el.style.display = on ? 'block' : 'none';
}

function setChoicesEnabled(enabled) {
  ['fantasyCustomBtn','realityCustomBtn','holoSendBtn','phoneSendBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !enabled;
  });
  document.querySelectorAll('.choice-btn').forEach(b => b.disabled = !enabled);
  ['fantasyCustom','realityCustom','holoInput','phoneInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !enabled;
  });
}
