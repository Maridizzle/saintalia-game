# PLAN.md -- Saintalia build plan

Read CLAUDE.md first. Every phase below ends with a verification gate. A phase is not done until Maridizzle has seen the gate pass. No phase starts until Maridizzle says start. Nothing is committed or pushed by Claude at any point; Claude prepares changes, Maridizzle pushes.

Working principle for the whole plan: engine and content are separate. The engine (checkpoints, inventory, narration, wheel, timers) is built to read story beats as data. Story content arrives from Maridizzle whenever it arrives. The engine never waits on it and never fills it in.

## Phase 0 -- Inventory (read only)

Goal: know exactly what exists before touching anything. The plan below was written without seeing the puzzle files, so Phase 0 may revise Phases 1 to 3. That is expected.

### Steps

1. List every file in the repo with size and last commit date.

2. For each HTML/JS file, report: what it does, which state objects and message types it uses, whether it duplicates code from `saintalia-v2.html`, and whether it runs standalone.

3. Confirm the two puzzle sandboxes: which beats they implement (expected: The Branching Confessions and The Soul Tagging), whether the join-side silent failure is still present, and whether they were ever merged into v2.

4. Confirm where the mind-map tool lives (repo folder or separate) and how it deploys.

5. Confirm GitHub Pages source setting (root vs `/docs` vs branch) by reading the repo settings or .github config, not by assumption.

6. Confirm whether the ten-theme color system and reduce-motion toggle are in the repo copy of v2 or only in a local file.

Gate: a short written inventory report. Maridizzle reads it and confirms or corrects Phases 1 to 3 before anything is edited.

Do not touch: anything. This phase makes no edits.

## Phase 1 -- Split the single file (zero behavior change)

Goal: turn `saintalia-v2.html` into the folder layout in CLAUDE.md so every future change is a small diff instead of a paste.

### Steps

1. Create `game/` with `index.html`, `css/game.css`, `js/connection.js`, `js/character.js`, `js/game.js`, `js/narrator.js`, `data/char-data.js`. Load order in `index.html`: char-data, connection, character, narrator, game.

2. Move code verbatim. No refactoring, no renaming, no "while I'm in here." The only permitted change is what is required to make the split load (script tags, removing the inline `<style>` and `<script>` wrappers, and the CSS currently injected inside `buildCharScreen()` and `buildGameScreen()` template strings moving to `game.css`).

3. Leave the original `saintalia-v2.html` in place, untouched, as the reference build. Do not delete it. Maridizzle decides when it goes.

4. Untangle the three separate `S.conn.on('data', ...)` registrations into one dispatcher in `connection.js` that routes by `data.type`. This is the one structural change allowed in Phase 1 because the split makes the triple registration worse, not better. Show the diff and explain it before applying.

5. Remove the debug panel from the shipped build behind a flag (`DEBUG = false`), do not delete the code.

### Gate (run on two devices or two browser profiles)

- Host creates a room, joiner enters the code, both reach Step III.

- Both complete character creation, both land on the game screen.

- Opening scene fires on both sides (offline fallback is fine).

- A note sent from each side appears on the other side in the center thread and in the side-specific interface (terminal or phone).

- Three turns played on each side; veil meter moves; mural layer 1 reveals on the reality side after turn 3; fantasy side never sees the mural.

- Console shows no errors on either side.

- Side-by-side check: the split build and `saintalia-v2.html` render the same three screens with no visible differences.

Do not touch: narration prompts, PeerJS config, Groq key handling, CHAR_DATA contents, any UI string.

## Phase 2 -- Connection safety

Goal: fix the two things that will bite the moment anyone outside the household plays.

### 2a. Stop sending the Groq key over the wire.

- Current behavior: `beginGame()` sends `S.groqKey` inside the `begin` message. Any joiner can read it from the console.

- Options for Maridizzle to pick from (do not decide for her):

  - Host narrates only. Only the host holds a key. Host makes every Groq call and broadcasts narration to the joiner. Simplest, and it lines up with Phase 4 anyway.

  - Each player enters their own key. Both sides can call Groq. Doubles free-tier usage and makes cohesive narration harder.

- Recommended: host narrates only. Implement whichever she chooses.

### 2b. Reconnect and the silent join failure.

1. Reproduce the failure first. Log every PeerJS event (`open`, `connection`, `error`, `disconnected`, `close`) with timestamps on both sides during a join attempt. Report what actually happens before proposing a fix. Do not fix from theory.

2. Likely suspects to check, in order: the joiner's `peer.on('open')` firing before the host's ID is registered with the broker; the `unavailable-id` retry path in `initPeerWithCode` generating a new code after the joiner already has the old one; broker connection dropping and `peer.on('disconnected')` firing with no `reconnect()` call.

3. Add `S.peer.reconnect()` on `disconnected`, a visible status line on both sides when the data channel drops, and a retry with the same room code on the join side.

4. Give both players a plain-language error when the broker is unreachable, instead of a hang.

### Gate

- Joiner's console shows no Groq key in any received message.

- Host kills wifi for ten seconds and restores it; both sides show the drop, then recover with the same room code, and the game state on both sides still matches.

- A join to a code that does not exist fails with a readable message within ten seconds.

- Five consecutive fresh room create/join cycles succeed.

Do not touch: game logic, narration, character data.

## Phase 3 -- Beat schema and checkpoint engine, seeded with the two puzzles

Goal: a data format for story beats, an engine that loads and fires them, and the two existing puzzle sandboxes folded in as the first real checkpoints after the Opening.

### 3a. Beat schema.

Propose a JSON shape for Maridizzle's approval before writing any beat file. Suggested starting fields, to be revised with her:

```json
{
  "id": "opening",
  "title": "The Opening",
  "order": 1,
  "locked": true,
  "trigger": { "type": "turn", "value": 1 },
  "sides": {
    "fantasy": { "prompt": "...", "choices": [], "illustration": null },
    "reality": { "prompt": "...", "choices": [], "illustration": null }
  },
  "requiresBothSides": false,
  "effects": { "veil": 0, "energy": -8, "mural": null, "scoring": {} },
  "npcs": [],
  "keyItems": []
}
```

Fields for scoring use the four established variables (`veilDeath`, `hopelessness`, `veilKnowledge`, `voidCorruption`). Any field whose content is not established stays `null` or an obvious TBD token.

### 3b. Engine.

1. `beats.js` loads every file in `data/beats/`, sorts by `order`, and exposes `nextBeat()`, `fireBeat(id)`, `beatState`.

2. Trigger types to support now: `turn` (fires at turn N), `manual` (fires when both sides confirm), `keyword` (fires when narrator output contains a phrase). Keyword detection is the design from the passoff; keep it simple and log every match so false positives are visible.

3. Firing a beat broadcasts a new PeerJS message type `beat-fire` with the beat id so both sides advance together.

4. Illustration slot: if `illustration` is non-null, display it in the side's panel. If null, show nothing. No placeholder art.

### 3c. Fold in the puzzles.

1. Read both sandbox files (Phase 0 already inventoried them).

2. Extract their logic into `js/puzzles/branching-confessions.js` and `js/puzzles/soul-tagging.js` as modules the engine calls, keeping their UI.

3. Write `data/beats/02-branching-confessions.json` and `data/beats/03-soul-tagging.json` with NPC names as `NPC_TBD_01` / `NPC_TBD_02` and no invented dialogue. Existing text in the sandboxes is Maridizzle's and may be moved; nothing new is written.

4. Soul Tagging scoring (2/1/0, threshold 5+, four outcome variants, tattoo result) wired to `beatState` and the four scoring variables.

5. Keep the standalone sandboxes in `puzzles/` untouched until Maridizzle says otherwise.

### Gate

- Fresh game: Opening fires at turn 1 on both sides.

- Branching Confessions fires at its trigger on both sides simultaneously; each side sees only its own NPC encounter.

- Soul Tagging: all four questions answered on both sides; score computed; the correct one of the four outcome variants displays; tattoo state persists in `G`.

- Scoring variables update and are visible in a debug readout (behind the `DEBUG` flag).

- A beat file with a syntax error produces a readable console message naming the file, not a silent skip.

Do not touch: narration prompts beyond inserting beat text; the Opening's locked content.

## Phase 4 -- Cohesive dual narration

Goal: one story, two perspectives, one Groq call per turn, broadcast to both players.

### Steps

1. Host collects both players' choices for the turn (with a wait state and indicator on the side that finished first).

2. One system prompt with both characters, both choices, recent notes, veil integrity, current beat, and the four scoring variables. Output format uses labeled blocks: `FANTASY_NARRATIVE`, `FANTASY_CHOICES`, `REALITY_NARRATIVE`, `REALITY_CHOICES`.

3. Parse the blocks. Host broadcasts a `narrator-update` carrying all four; each side renders its own narrative and choices and puts the shared summary in the center feed.

4. Offline fallback produces the same four-block shape.

5. Keep the per-side prompt builders in `narrator.js` behind a flag for comparison until Maridizzle is satisfied, then she decides what to remove.

### Gate

- Both players make choices; the narrator responds once; both sides receive coherent, non-contradictory scenes that reference each other's actions where appropriate.

- The fantasy side's narrative never describes the mural.

- If Groq errors, both sides get the offline fallback in the same turn, and the turn counter stays in sync.

- Ten turns played without desync of turn number, veil percentage, or mural layer.

## Phase 5 -- Backlog (order to be set by Maridizzle)

Each of these gets its own mini-plan and gate when its turn comes. None start without a go.

- Inventory system. Role and job specific starting items; four types (Sellable, Breakable, Losable, Key); sliding drawer UI; break checks keyed to stat, roll of 1 always breaks, 20 always holds; items pass through the veil arriving corrupted. Item roster lives in a separate design document from Maridizzle; do not invent items.

- Save and resume. Serialize `S.myCharacter`, `S.otherCharacter`, `G`, `beatState`, and inventory to localStorage. Resume screen on the lobby. Peer reconnection using the saved room code. Never clear a save without a typed confirmation from the player.

- Radial action wheel. Replaces the choice buttons. Floats and pulses when choices are available, disappears after selection. Custom action field stays.

- Note window timing. "The veil is listening" indicator; 45-second window at specific intervals; a note sent during the window can trigger choice regeneration with a shimmer effect.

- Collaborative puzzle locks. Choices grayed with a veil-crack symbol until both sides have exchanged enough notes on the current beat. Threshold configurable per beat in the schema.

- Timed events. Countdown on flagged beats. If neither player acts, the narrator takes the worst reasonable option and says so.

- Character avatar upload. Multiple images per character keyed to state (calm, drained, marked). Stored as data URIs in the save.

- Scoring integration. Move the four scoring variables from the mind-map's Postgres into game state proper, with the mind-map reading from an export rather than being the source of truth. Confirm with Maridizzle before changing anything on Railway.

- Mural redraw. Replace the six SVG layers with the established progression (fin in pond through full overlap). Art direction from Maridizzle, one layer at a time.

## Session hygiene

At the start of every Claude Code session: read CLAUDE.md, read this file, state which phase is active and which gate was last passed, then wait.

At the end of every session: write a short summary of what changed, what was verified, what was not, and any TBD tokens introduced. Do not commit it; hand it to Maridizzle.

Signed: Maridizzle
