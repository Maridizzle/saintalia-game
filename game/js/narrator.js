// ============================================================
// SAINTALIA -- NARRATOR
// Author: Maridizzle
//
// Groq calls, prompt builders, the offline fallback, and the four-block
// response parser. Moved verbatim from saintalia-v2.html (Phase 1):
//   lines 1658 to 1659  endpoint and model
//   lines 2141 to 2306  everything else
//
// HOW COHESIVE NARRATION ACTUALLY WORKS, since CLAUDE.md described it wrong
// until Phase 0 checked:
//   One Groq call per turn produces all four blocks at once --
//   FANTASY_NARRATIVE, FANTASY_CHOICES, REALITY_NARRATIVE, REALITY_CHOICES.
//   Only the host ever calls Groq. The host broadcasts the raw text as a
//   narrator-update and each side renders its own half. This is already
//   built and working. What is missing is the joiner's choice ever reaching
//   the host, so the host writes every turn from its own choice alone.
//   That gap is PLAN.md Phase 3d.
//
// Functions here call addEntry, makeChoice, setThinking and
// setChoicesEnabled, which live in game.js. game.js loads after this file.
// That is fine: nothing here runs at load time.
// ============================================================

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// ---- GROQ NARRATOR ----

// PHASE 5. The raw call. Returns the text, or null if there is no key, the
// API errors, or the network fails. Every scene needs this shape, because
// the Opening's four-block offline fallback is meaningless to the Lockdown.
async function callGroqRaw(system, userMsg, maxTokens) {
  if (!S.groqKey) return null;
  try {
    const resp = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + S.groqKey
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: maxTokens || 800,
        temperature: 0.88,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMsg }
        ]
      })
    });
    const data = await resp.json();
    if (data.error) { console.warn('[saintalia] Groq error:', data.error.message); return null; }
    return data.choices[0].message.content;
  } catch(e) {
    console.warn('[saintalia] Groq fetch failed:', e);
    return null;
  }
}

// The Opening's call. Unchanged in behavior: falls back to the four-block
// offline text whenever the raw call comes back empty.
async function callGroq(system, userMsg) {
  const out = await callGroqRaw(system, userMsg, 800);
  return out === null ? buildOfflineCombined() : out;
}

// ---- HOST PROXY (PHASE 5, answers PLAN.md open question 5) ----
// Only the host holds a Groq key. When a non-host scene needs narration it
// asks the host, and the host calls Groq and sends the words back. The
// non-host never sees a key box, and the whole game runs on one person's
// free quota.
//
// Every scene should call requestNarration, never callGroqRaw directly,
// unless it has already checked it is the host.

let NARRATE_SEQ = 0;
const NARRATE_PENDING = {};
const NARRATE_TIMEOUT_MS = 25000;

async function requestNarration(system, userMsg, maxTokens) {
  if (S.isHost) return callGroqRaw(system, userMsg, maxTokens);

  // No host to ask. The caller falls back to its own offline text.
  if (!S.conn || !S.conn.open) return null;

  const id = 'n' + (++NARRATE_SEQ);
  return new Promise((resolve) => {
    NARRATE_PENDING[id] = resolve;
    S.conn.send({ type: 'narrate-request', id, system, userMsg, maxTokens });

    // A host that never answers must not freeze the other player's turn.
    setTimeout(() => {
      if (NARRATE_PENDING[id]) {
        delete NARRATE_PENDING[id];
        console.warn('[saintalia] narration request ' + id + ' timed out');
        resolve(null);
      }
    }, NARRATE_TIMEOUT_MS);
  });
}

onMessage('narrate-request', async (data) => {
  if (!S.isHost) return;
  const text = await callGroqRaw(data.system, data.userMsg, data.maxTokens);
  if (S.conn && S.conn.open) {
    S.conn.send({ type: 'narrate-response', id: data.id, text });
  }
});

onMessage('narrate-response', (data) => {
  const resolve = NARRATE_PENDING[data.id];
  if (!resolve) return;
  delete NARRATE_PENDING[data.id];
  resolve(data.text);
});

function buildCombinedSystem() {
  const fC = S.role === 'fantasy' ? S.myCharacter : S.otherCharacter;
  const rC = S.role === 'reality' ? S.myCharacter : S.otherCharacter;
  const notes = G.notes.slice(-4).map(n => `[${n.from}: "${n.text}"]`).join(' | ');
  return `You are the Narrator of Saintalia, a dark horror-fantasy collaborative story game.

WORLD: Saintalia is an ancient dying fantasy realm. The veil between it and the modern human world is cracking. Both players are experiencing the same moment from opposite sides of that crack. They do not know what the other is experiencing. Keep it that way.

FANTASY PLAYER: ${fC.name}, a ${fC.race ? fC.race.name : 'creature'} ${fC.job ? fC.job.name : ''}.
Stats: ${Object.entries(fC.stats || {}).map(([k,v]) => k+':'+v).join(', ')}.
Carries: ${fC.carry || 'an unnamed burden'}.
Fears: ${fC.fear || 'the dark'}.
Personality: ${Object.entries(fC.personality || {}).map(([k,v]) => v).join('. ')}.

REALITY PLAYER: ${rC.name}, an artist (${rC.race ? rC.race.name : ''}, ${rC.job ? rC.job.name : ''}).
Stats: ${Object.entries(rC.stats || {}).map(([k,v]) => k+':'+v).join(', ')}.
Carries: ${rC.carry || 'an unnamed burden'}.
Fears: ${rC.fear || 'the dark'}.
Personality: ${Object.entries(rC.personality || {}).map(([k,v]) => v).join('. ')}.

RECENT NOTES THROUGH VEIL: ${notes || 'None yet.'}
VEIL INTEGRITY: ${G.veilStrength}% broken.
CURRENT TURN: ${G.turn}.

You must produce EXACTLY four labeled sections and nothing else. No preamble. No commentary outside the sections.

FANTASY_NARRATIVE: [vivid unsettling literary prose under 140 words written entirely from the fantasy player's perspective and sensory experience. They do not know what is happening on the reality side. They only feel consequences and disturbances through the veil.]
FANTASY_CHOICES:{"choices":["First specific choice","Second choice with risk or tension","Third choice -- open path"]}
REALITY_NARRATIVE: [vivid unsettling literary horror prose under 140 words written entirely from the reality player's perspective and sensory experience. They do not know what is happening in Saintalia. They only feel the ripple effects.]
REALITY_CHOICES:{"choices":["First specific choice","Second choice with tension or risk","Third choice -- open path"]}`;
}

function buildCombinedOpening() {
  const fC = S.role === 'fantasy' ? S.myCharacter : S.otherCharacter;
  const rC = S.role === 'reality' ? S.myCharacter : S.otherCharacter;
  return `Generate the opening scene for both players simultaneously.

FANTASY SIDE: ${fC.name} is in Saintalia when the world blinks black for an instant. Air whooshes out. Energy drains from their core -- something physically taken. The holographic terminal flickers with wrong-colored light. A message forms character by character from somewhere the terminal was never built to reach. They also receive a corrupted image -- distorted, unrecognizable.

REALITY SIDE: ${rC.name} is alone late at night working on their commissioned mural. They take a progress photo. When they look at the photo they see a creature in the background -- partially obscured, one eye pointed at the camera. They look up -- nothing. They look back -- still there. They panic and try to text their colleague Dr. Voss the monsterologist. They misdial. The text reaches a terminal in Saintalia instead. The misdial is accidental. It was not engineered.

Produce all four sections exactly as specified.`;
}

function buildOfflineCombined() {
  return `FANTASY_NARRATIVE: The world blinks.

Not a long blink. Barely a fraction of a second. But the darkness that fills it is not the darkness of closed eyes. It is the darkness of something vast and deliberate passing very close.

Then the air goes wrong. A whoosh, like the room forgot to exist for a moment, and when it remembered you were slightly less than you were before. Something was taken. You can feel the absence of it like a missing tooth your tongue keeps finding.

The holographic terminal flickers. The light it throws is the wrong color. The signal it is reaching for is coming from somewhere the terminal was never built to touch. A message is forming on the display. Character by character. From somewhere that should not exist.
FANTASY_CHOICES:{"choices":["Approach the terminal and read what it says","Step back and reach for whatever you use as a weapon","Stand very still and wait to see if it sends more"]}
REALITY_NARRATIVE: The photo loads slowly, the way photos do when the file is large and the connection is tired.

You took it twenty minutes ago. A progress shot for the client file, nothing more. The east wall, the scaffolding, the ceiling stretching up toward where the angels are supposed to be.

The thing in the upper left corner was not there when you looked up. You looked up three times while you were shooting. The space was empty. In the photo, something is looking back at you. One shoulder. A neck with too many joints. One eye, open, dark, pointed directly at the camera.

You look up. Nothing. You look at the phone. Still there.
REALITY_CHOICES:{"choices":["Take another photo immediately to see if it is still there","Get your bag and leave right now","Zoom in on the photo to see it more clearly"]}`;
}

// ---- NARRATOR RESPONSE PARSER ----
function parseNarratorResponse(text) {
  const result = {
    fantasyNarrative: '',
    fantasyChoices: [],
    realityNarrative: '',
    realityChoices: []
  };

  const fnMatch = text.match(/FANTASY_NARRATIVE:\s*([\s\S]*?)(?=FANTASY_CHOICES:|$)/);
  if (fnMatch) result.fantasyNarrative = fnMatch[1].trim();

  const fcMatch = text.match(/FANTASY_CHOICES:\s*(\{"choices":\s*\[[^\]]*\]\})/);
  if (fcMatch) {
    try { result.fantasyChoices = JSON.parse(fcMatch[1]).choices; } catch(e) {}
  }

  const rnMatch = text.match(/REALITY_NARRATIVE:\s*([\s\S]*?)(?=REALITY_CHOICES:|$)/);
  if (rnMatch) result.realityNarrative = rnMatch[1].trim();

  const rcMatch = text.match(/REALITY_CHOICES:\s*(\{"choices":\s*\[[^\]]*\]\})/);
  if (rcMatch) {
    try { result.realityChoices = JSON.parse(rcMatch[1]).choices; } catch(e) {}
  }

  return result;
}

// ---- APPLY NARRATOR RESPONSE TO THIS CLIENT ----
function applyNarratorResponse(raw) {
  const parsed = parseNarratorResponse(raw);
  const isF = S.role === 'fantasy';

  setThinking(false);

  const myNarrative = isF ? parsed.fantasyNarrative : parsed.realityNarrative;
  const myChoices = isF ? parsed.fantasyChoices : parsed.realityChoices;

  if (myNarrative) addEntry('private', myNarrative, 'narrator');

  const side = isF ? 'fantasy' : 'reality';
  const container = document.getElementById(side + 'ChoicesBtns');
  if (container && myChoices.length) {
    container.innerHTML = '';
    myChoices.forEach((choice, i) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.innerHTML = `<span class="choice-num">${i + 1}.</span>${choice}`;
      btn.onclick = () => makeChoice(side, choice);
      container.appendChild(btn);
    });
    G[side + 'Choices'] = myChoices;
  }

  setChoicesEnabled(true);
}

// ---- CHOICES ----
function parseChoices(side, text) {
  // Legacy fallback -- not used in cohesive mode but kept for safety
  const container = document.getElementById(side + 'ChoicesBtns');
  if (!container) return;
  container.innerHTML = '';
  const match = text.match(/CHOICES:\{"choices":\s*\[([^\]]+)\]\}/);
  if (!match) return;
  try {
    const parsed = JSON.parse('{"choices":[' + match[1] + ']}');
    G[side + 'Choices'] = parsed.choices;
    parsed.choices.forEach((choice, i) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.innerHTML = `<span class="choice-num">${i + 1}.</span>${choice}`;
      btn.onclick = () => makeChoice(side, choice);
      container.appendChild(btn);
    });
  } catch(e) { console.warn('Choice parse failed', e); }
}
