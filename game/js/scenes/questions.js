// ============================================================
// SAINTALIA -- SCENE: THE 15 QUESTIONS (Beat 2-B, Layer 2)
// Author: Maridizzle
//
// Ported from saintalia-15questions-v2.html. Content untouched and living in
// data/scenes/questions.js.
//
// WHAT WAS STRIPPED OUT
//   Its own PeerJS layer and word-pair lobby. One connection now.
//   Its own G object. It declared `const G` at top level, which collides
//     head-on with the shared game state. Scene state is Q, local to here.
//   Its own CHAR_DATA, a stripped subset with names and lore only. The scene
//     reads the real character instead, so the prompts finally get stats,
//     appearance and personality they never saw before.
//   Its own addEntry(text, type, tag), a THIRD argument order. Local qEntry.
//   Its own callGroq(prompt), single argument, user message only. Narration
//     goes through requestNarration so only the host needs a key.
//
// WHAT WAS KEPT EXACTLY
//   Entries PREPEND, newest at the top. That is the sandbox's behavior and
//   it is deliberate: the newest thing said should not require scrolling.
//   The 10 turn cap, which counts MAIN questions only and never tangents.
//   Four answers per question, two seeded and two neutral, shuffled so the
//   seeded ones are not obvious.
//   The ASKER, not the answerer, decides whether to pull a tangent.
//
// KNOWN HOLE WHILE THE DREAM IS UNBUILT
//   This scene asks both players about a veil that The Dream was supposed to
//   have shown them. Deliberate and temporary. See PLAN.md.
// ============================================================

let Q = null;

function qReset() {
  Q = {
    usedIds: [],
    questionsAsked: 0,
    totalTurns: 10,     // MAIN questions only. Tangents are free. Not a bug.
    currentAsker: null,
    currentQuestion: null,
    started: false,
    ended: false,
    ctx: null
  };
}

// ---- LOCAL HELPERS ----

function qShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function qDrawBank(size) {
  const available = QUESTIONS_POOL.filter(q => !Q.usedIds.includes(q.id));
  return qShuffle(available).slice(0, Math.min(size, available.length));
}

function qNameOf(side) {
  const c = (side === S.role) ? S.myCharacter : S.otherCharacter;
  if (c && c.name) return c.name;
  return side === 'fantasy' ? 'Saintalia' : 'The Artist';
}

// The whole point of dropping the stripped CHAR_DATA: the narrator can now
// see who this person actually is.
function qCharDescriptor(side) {
  const c = (side === S.role) ? S.myCharacter : S.otherCharacter;
  if (!c) return 'an unknown figure';

  const world = side === 'fantasy'
    ? 'in the dying fantasy realm of Saintalia, a world of monsters and old powers'
    : 'an artist in the modern waking world';

  const stats = Object.entries(c.stats || {}).map(([k, v]) => k + ' ' + v).join(', ');
  const appearance = Object.values(c.appearance || {}).join('. ');
  const personality = Object.values(c.personality || {}).join('. ');

  return [
    `${c.name || qNameOf(side)}, ${world}.`,
    c.race ? `Background: ${c.race.name}. ${c.race.lore || ''}` : '',
    c.job ? `Role: ${c.job.name}. ${c.job.abilityDesc || c.job.desc || ''}` : '',
    stats ? `Attributes: ${stats}.` : '',
    appearance ? `Appearance: ${appearance}` : '',
    personality ? `Temperament: ${personality}` : '',
    c.carry ? `Carries: ${c.carry}` : '',
    c.fear ? `Fears: ${c.fear}` : ''
  ].filter(Boolean).join('\n');
}

// Newest first, exactly as the sandbox does it.
function qEntry(text, type, tag) {
  const scroll = document.getElementById('qFeed');
  if (!scroll) return;
  const el = document.createElement('div');
  el.className = 'entry ' + type;
  if (tag) {
    const t = document.createElement('span');
    t.className = 'entry-tag';
    t.textContent = tag;
    el.appendChild(t);
  }
  const p = document.createElement('p');
  p.textContent = text;
  el.appendChild(p);
  scroll.insertBefore(el, scroll.firstChild);
  scroll.scrollTop = 0;
}

function qSetThinking(on) {
  const el = document.getElementById('qThinking');
  if (el) el.classList.toggle('on', on);
}

function qDeck() { return document.getElementById('qDeck'); }

function qWaiting(msg) {
  const d = qDeck();
  if (d) d.innerHTML = '<div class="empty-state">' + (msg || 'Waiting for the other side...') + '</div>';
}

function qUpdateStatus() {
  const pool = QUESTIONS_POOL.filter(q => !Q.usedIds.includes(q.id)).length;
  const badge = document.getElementById('qPool');
  if (badge) badge.textContent = 'Pool: ' + pool;
}

function qUpdateTurnText(t) {
  ['qTurn', 'qTurnHeader'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = t;
  });
}

// ---- TURN FLOW ----

function qRenderMyTurn() {
  if (Q.ended) return;
  const mine = Q.currentAsker === S.role;
  if (mine) {
    qRenderAsk();
    qUpdateTurnText(`Turn ${Q.questionsAsked + 1} of ${Q.totalTurns} -- you ask`);
  } else {
    qWaiting('Waiting for ' + qNameOf(Q.currentAsker) + ' to choose a question...');
    qUpdateTurnText(`Turn ${Q.questionsAsked + 1} of ${Q.totalTurns} -- ${qNameOf(Q.currentAsker)} asks`);
  }
}

function qRenderAsk() {
  const body = qDeck();
  if (!body) return;
  body.innerHTML = '';

  const lbl = document.createElement('div');
  lbl.className = 'deck-section-label';
  lbl.textContent = 'Choose a question to ask ' + qNameOf(S.role === 'reality' ? 'fantasy' : 'reality');
  body.appendChild(lbl);

  qDrawBank(4).forEach(q => {
    const btn = document.createElement('button');
    btn.className = 'q-btn';
    const lab = document.createElement('span');
    lab.className = 'q-label';
    lab.textContent = q.label;
    btn.appendChild(lab);
    btn.appendChild(document.createTextNode(q.text));
    btn.onclick = () => qBroadcastQuestion(q);
    body.appendChild(btn);
  });
}

function qBroadcastQuestion(question) {
  Q.usedIds.push(question.id);
  Q.questionsAsked++;          // MAIN questions only
  Q.currentQuestion = question;

  const answerer = S.role === 'reality' ? 'fantasy' : 'reality';
  Q.ctx.send({ kind: 'question-asked', question, asker: S.role, answerer });

  qEntry(`"${question.text}"`, 'asked-' + S.role, qNameOf(S.role) + ' asks ' + qNameOf(answerer));
  qUpdateStatus();
  qWaiting('Waiting for ' + qNameOf(answerer) + ' to answer...');
  qUpdateTurnText(`Turn ${Q.questionsAsked} of ${Q.totalTurns} -- ${qNameOf(answerer)} answers`);
}

function qRenderAnswerOptions(question) {
  const body = qDeck();
  if (!body) return;
  body.innerHTML = '';

  const lbl = document.createElement('div');
  lbl.className = 'deck-section-label';
  lbl.textContent = 'Choose your answer';
  body.appendChild(lbl);

  const neutrals = QUESTIONS_NEUTRAL[question.id] || [
    'They are still working out how to answer that.',
    'Not a question they have let themselves think about directly.'
  ];

  // Two seeded, two neutral, shuffled so the seeded ones do not stand out.
  const opts = qShuffle([
    { seed: question.a.seed, isTangent: true, tangentKey: question.a.tangent },
    { seed: question.b.seed, isTangent: true, tangentKey: question.b.tangent },
    { seed: neutrals[0], isTangent: false },
    { seed: neutrals[1], isTangent: false }
  ]);

  opts.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'a-btn';
    btn.textContent = opt.seed;
    btn.onclick = () => qSelectAnswer(opt, question);
    body.appendChild(btn);
  });
}

async function qSelectAnswer(option, question) {
  qWaiting('...');
  await qSpeakAnswer(S.role, question, option.seed);

  if (option.isTangent && QUESTIONS_TANGENTS[option.tangentKey]) {
    const tangent = QUESTIONS_TANGENTS[option.tangentKey];
    qEntry('A thread opens: ' + tangent.name, 'tangent-fired', 'The veil catches something');

    // The ASKER decides whether to pull it. That is the design.
    Q.ctx.send({
      kind: 'tangent-fired',
      tangentKey: option.tangentKey,
      tangentName: tangent.name,
      question,
      asker: S.role === 'reality' ? 'fantasy' : 'reality'
    });
    qWaiting('The thread is theirs to pull or let pass...');
    return;
  }

  Q.ctx.send({ kind: 'advance-turn' });
  qAdvanceTurn();
}

async function qSpeakAnswer(answerer, question, seed) {
  const prompt = `You are voicing a character in Saintalia, a dark horror-fantasy two-player story game. Two strangers are asking each other deep questions across a tearing veil between worlds.

The character answering:
${qCharDescriptor(answerer)}

They were just asked: "${question.text}"

The emotional direction of their answer (a seed -- do NOT repeat it verbatim, expand it into their own voice): "${seed}"

Write their spoken answer in FIRST PERSON, as the character speaking aloud. 2 to 4 sentences. Let their background and role color the voice, imagery, and reference points, but never state the race or role name outright -- let it show. Dark, literary, grounded, no melodrama. Spoken words only. No quotation marks, no narration tags, no stage directions.`;

  qSetThinking(true);
  const out = await requestNarration(null, prompt, 400);
  qSetThinking(false);

  const text = out || seed;   // no key, no host, or a failure: the seed stands
  qEntry(text, 'spoken-' + answerer, qNameOf(answerer) + ' speaks');
  Q.ctx.send({ kind: 'answer-spoken', text, answerer });
  return text;
}

function qRenderTangentChoice(tangentKey, question) {
  const body = qDeck();
  const tangent = QUESTIONS_TANGENTS[tangentKey];
  if (!body) return;
  if (!tangent) { qAdvanceTurn(); return; }

  body.innerHTML = '';
  const area = document.createElement('div');
  area.className = 'tangent-area';

  const label = document.createElement('div');
  label.className = 'tangent-label';
  label.textContent = tangent.name + ' -- pull the thread?';

  const desc = document.createElement('div');
  desc.className = 'tangent-desc';
  desc.textContent = S.role === 'reality' ? tangent.reality : tangent.fantasy;

  const pull = document.createElement('button');
  pull.className = 'tangent-btn';
  pull.textContent = 'Pull the thread';
  pull.onclick = async () => {
    area.remove();
    qWaiting('...');
    await qSpeakTangent(S.role, tangent);
    Q.ctx.send({ kind: 'advance-turn' });
    qAdvanceTurn();
  };

  const skip = document.createElement('button');
  skip.className = 'tangent-btn';
  skip.textContent = 'Let it pass';
  skip.onclick = () => {
    area.remove();
    qEntry('The thread surfaces and is left alone. The questions continue.', 'system');
    Q.ctx.send({ kind: 'tangent-skipped' });
    qAdvanceTurn();
  };

  area.appendChild(label);
  area.appendChild(desc);
  area.appendChild(pull);
  area.appendChild(skip);
  body.appendChild(area);
}

async function qSpeakTangent(speaker, tangent) {
  const guardrail = speaker === 'reality' ? tangent.reality : tangent.fantasy;
  const prompt = `You are voicing a character in Saintalia, a dark horror-fantasy two-player story game. A deep question across the veil has cracked something open, and this character is now telling the other player something they don't usually say.

The character speaking:
${qCharDescriptor(speaker)}

The buried thread they are now giving voice to (a guardrail -- expand it into their own words, do NOT quote it): "${guardrail}"

Write a short FIRST-PERSON monologue, 4 to 6 sentences, as the character speaking aloud to the other person across the veil. This is the tangent -- a confession, a memory surfacing, something that veers off the original question. Let their background and role shape the imagery and how they talk, but never state the race or role name outright. Dark, literary, raw, no melodrama. Spoken words only. No quotation marks, no narration tags, no stage directions.`;

  qSetThinking(true);
  const out = await requestNarration(null, prompt, 400);
  qSetThinking(false);

  const text = out || guardrail;
  qEntry(text, 'tangent-monologue', qNameOf(speaker) + ' -- the thread');
  Q.ctx.send({ kind: 'tangent-spoken', text, speaker });
}

function qAdvanceTurn() {
  if (Q.questionsAsked >= Q.totalTurns) { qEnd(); return; }
  Q.currentAsker = Q.currentAsker === 'reality' ? 'fantasy' : 'reality';
  qEntry('--', 'system');
  qRenderMyTurn();
}

function qEnd() {
  Q.ended = true;
  qUpdateTurnText('The exchange is complete.');
  qEntry('Ten questions. The veil has heard enough. What comes next is up to them.', 'system');
  const body = qDeck();
  if (body) body.innerHTML = '<div class="empty-state">The exchange is complete.</div>';
  const cont = document.getElementById('qContinue');
  if (cont) cont.style.display = 'block';
}

// ---- THE SCENE ----

const SceneQuestions = {
  id: 'questions',
  title: 'The 15 Questions',

  mount(root, ctx) {
    qReset();
    Q.ctx = ctx;
    setScreen('game');

    root.className = 'q-wrap ' + (ctx.role === 'fantasy' ? 'fantasy-side' : 'reality-side');
    root.innerHTML = `
      <div class="q-header">
        <div class="q-title">The 15 Questions</div>
        <div class="pool-badge" id="qPool">Pool: ${QUESTIONS_POOL.length}</div>
        <div class="q-turn" id="qTurnHeader">Turn 1</div>
      </div>
      <div class="q-body">
        <div class="my-deck" id="qDeckWrap">
          <div class="deck-header">
            <div class="deck-name-label">${qNameOf(ctx.role)}</div>
            <div class="deck-char-label">${ctx.me && ctx.me.race ? ctx.me.race.name : ''} ${ctx.me && ctx.me.job ? ctx.me.job.name : ''}</div>
          </div>
          <div class="deck-body" id="qDeck"></div>
        </div>
        <div class="q-center">
          <div class="center-header"><div class="center-label">The Exchange</div></div>
          <div class="center-scroll" id="qFeed"></div>
          <div class="thinking-center" id="qThinking">the veil considers...</div>
          <div class="center-footer">
            <div class="turn-text" id="qTurn">--</div>
          </div>
        </div>
      </div>
      <button class="btn-primary" id="qContinue" style="display:none" onclick="requestAdvance()">The veil has heard enough</button>
    `;

    qEntry('The questions begin. The veil is listening.', 'system');

    // The host picks who asks first and tells the other side, so both cannot
    // decide differently and deadlock.
    if (ctx.isHost) {
      Q.currentAsker = Math.random() < 0.5 ? 'reality' : 'fantasy';
      Q.started = true;
      ctx.send({ kind: 'start', firstAsker: Q.currentAsker });
      qRenderMyTurn();
    } else {
      qWaiting('The veil is deciding who speaks first...');
    }
  },

  unmount() {
    Q = null;
  },

  onMessage(p) {
    if (!Q) return;

    if (p.kind === 'start') {
      Q.currentAsker = p.firstAsker;
      Q.started = true;
      qRenderMyTurn();
    }

    if (p.kind === 'question-asked') {
      Q.currentQuestion = p.question;
      Q.usedIds.push(p.question.id);
      Q.questionsAsked++;
      qEntry(`"${p.question.text}"`, 'asked-' + p.asker, qNameOf(p.asker) + ' asks ' + qNameOf(p.answerer));
      qUpdateStatus();
      if (p.answerer === S.role) {
        qRenderAnswerOptions(p.question);
        qUpdateTurnText(`Turn ${Q.questionsAsked} of ${Q.totalTurns} -- you answer`);
      } else {
        qWaiting('Waiting for ' + qNameOf(p.answerer) + ' to answer...');
        qUpdateTurnText(`Turn ${Q.questionsAsked} of ${Q.totalTurns} -- ${qNameOf(p.answerer)} answers`);
      }
    }

    if (p.kind === 'answer-spoken') {
      qEntry(p.text, 'spoken-' + p.answerer, qNameOf(p.answerer) + ' speaks');
    }

    if (p.kind === 'tangent-fired') {
      qEntry('A thread opens: ' + p.tangentName, 'tangent-fired', 'The veil catches something');
      if (p.asker === S.role) qRenderTangentChoice(p.tangentKey, p.question);
      else qWaiting('The thread is theirs to pull or let pass...');
    }

    if (p.kind === 'tangent-spoken') {
      qEntry(p.text, 'tangent-monologue', qNameOf(p.speaker) + ' -- the thread');
    }

    if (p.kind === 'tangent-skipped') {
      qEntry('The thread surfaces and is left alone. The questions continue.', 'system');
      qAdvanceTurn();
    }

    if (p.kind === 'advance-turn') qAdvanceTurn();
  },

  isComplete() {
    return !!(Q && Q.ended);
  },

  exportState() {
    return Q ? { asked: Q.questionsAsked, used: Q.usedIds.slice(), ended: Q.ended } : null;
  }
};

registerScene(SceneQuestions);
