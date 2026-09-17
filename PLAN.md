# PLAN.md -- Saintalia build plan

Read CLAUDE.md first.

Rewritten after Phase 0. The old version was written without seeing the files and guessed wrong about several important things. What follows is built on what is actually in the repo.

**The goal:** get the three existing scenes combining into one app that plays through like the real game, end to end, and then hits a "coming soon" gate.

Every phase ends with a verification gate. A phase is not done until Maridizzle has seen the gate pass. No phase starts until Maridizzle says start. Nothing is committed or pushed by Claude at any point. Claude prepares changes, Maridizzle pushes.

Working principle for the whole plan: engine and content are separate. The engine is built to read scene content as data. Story content arrives from Maridizzle whenever it arrives. The engine never waits on it and never fills it in.

## Open questions blocking later phases

These are Maridizzle's to answer. Claude will not assume any of them.

1. **Scene order.** The 15 Questions calls itself Beat 2-B. What is 2-A? Does the play order run Opening, Lockdown, 15 Questions, gate? Or something else? (Blocks Phase 6.)

2. **How the Opening ends.** The Opening currently has no end condition. It loops turns forever. Something has to hand off to the next scene: a turn count, a mural layer, a keyword in the narration, or both players confirming. (Blocks Phase 6.)

3. **What carries between scenes.** Does the veil meter keep climbing through the Lockdown? Does the fantasy player's energy keep draining? Is the note thread one continuous conversation across all three scenes, or does each scene get a fresh one? (Blocks Phase 3's state design. Claude will build the plumbing to carry everything and let Maridizzle switch pieces off.)

4. **The Groq key in the 15 Questions.** That scene currently needs a key from BOTH players, because each side voices its own answers. Everything else in the game is host-only. Three ways to reconcile, Maridizzle picks:
   - **(a) Host proxies.** Non-host sends a `narrate-request`, host calls Groq, host returns a `narrate-response`. One key for the whole game. Recommended: it matches every other scene and only one person has to go get a key.
   - **(b) Per-player keys for that scene only.** Works today, but the second player hits a key prompt mid-game.
   - **(c) Non-host falls back to raw seed text.** Free, but half the game reads noticeably flatter.

5. **Tangent name coupling.** Several 15 Questions tangents hardcode the names **Tyvian** and **Sasha**. Both are entries in v2's default name lists, so the text assumes characters a player may not have picked. Leave as is, genericize, or rewrite? Content call, Maridizzle's.

6. **Root `index.html`.** Pages will serve from `main` at root. Right now root has no `index.html`, so the Pages URL would 404 and the game would only be reachable at `/saintalia-v2.html`. Options: put the game at root, or put a redirect at root pointing into `game/`. (Blocks Phase 7.)

## Phase 0 -- Inventory (read only) -- COMPLETE

All three HTML files read end to end. Findings are folded into CLAUDE.md: the real architecture of all three files, the confirmed bug list with line numbers, the name collision hazard, and four corrections to CLAUDE.md's own description of the code.

Headline corrections:

- Cohesive four-block dual narration is **already built** in v2. The old Phase 4 was mostly done before it started.
- The two sandbox files are **The Lockdown** and **The 15 Questions**, not The Branching Confessions and The Soul Tagging.
- The ten-theme system, localStorage persistence, and reduce-motion toggle are **not in this repo**. Two themes, no persistence.
- The Groq key leak is real but **inert**. The joiner never reads it and never calls Groq.

Gate: passed. Maridizzle read the report.

## Phase 1 -- Split v2 into the folder layout (zero behavior change)

Goal: turn `saintalia-v2.html` into the folder layout in CLAUDE.md so every future change is a small diff instead of a paste. This phase adds no features and fixes no bugs.

### Steps

1. Create `game/` with `index.html`, `css/game.css`, `js/connection.js`, `js/character.js`, `js/narrator.js`, `js/game.js`, `data/char-data.js`. Load order in `index.html`: char-data, connection, character, narrator, game.

2. Move code verbatim. No refactoring, no renaming, no "while I'm in here." The only permitted changes are what is required to make the split load: script tags, removing the inline `<style>` and `<script>` wrappers, and moving the CSS currently injected inside the `buildCharScreen()` and `buildGameScreen()` template strings into `game.css`.

3. Leave `saintalia-v2.html` in place, untouched, as the reference build. Do not delete it. Maridizzle decides when it goes.

4. Collapse the three `S.conn.on('data', ...)` registrations (lines 945, 1545, 2401) into ONE dispatcher in `connection.js` that routes by `data.type`. This is the one structural change allowed in Phase 1, because the split makes the triple registration worse rather than better. Show the diff and explain it before applying.

5. Put the debug panel behind a `DEBUG = false` flag. Do not delete the code.

### Gate (two devices or two browser profiles)

- Host creates a room, joiner enters the code, both reach Step III.
- Both complete character creation, both land on the game screen.
- Opening scene fires on both sides. Offline fallback is fine.
- A note sent from each side appears on the other side, in the centre thread and in the side-specific interface (terminal or phone).
- Three turns played; mural layer 1 reveals on the reality side after turn 3; fantasy side never sees the mural.
- Console shows no errors on either side.
- Side by side: the split build and `saintalia-v2.html` render the same three screens with no visible difference.

Known bugs that MUST still be present at the end of Phase 1, because fixing them here would hide whether the split was clean: the double peer init, the untransmitted joiner choice, the `skipGroq` hang, the veil desync.

Do not touch: narration prompts, PeerJS config, Groq key handling, CHAR_DATA contents, any UI string.

## Phase 2 -- Connection safety and state sync

Goal: fix the five confirmed bugs that make two-player play unreliable. Everything here is a known defect with a known line number. No new features.

### 2a. Remove the Groq key from the wire

One-line deletion. The key is sent at line 1008, parked in `window.GAME_STATE`, and never read. Every Groq call site is gated on `isHost`. Removing it from the `begin` payload changes no behavior. This was written up as a decision in the old plan; it is not one.

### 2b. Fix the double peer init

`goToStep()` calls `initPeer()`. The `window.goToStep` override then destroys that peer 300ms later and calls `initPeerWithCode()` with a different code. Two room codes appear in `#room-code-display`, 300ms apart, and only the second one works.

Fix: one initialization path. `initPeerWithCode()` is the correct one because it registers the peer ID the joiner actually targets. Keep `initPeer()` in the file, unused, behind the DEBUG flag rather than deleting it.

Then, and only then, add reconnect: `S.peer.reconnect()` on `disconnected`, a visible status line on both sides when the data channel drops, and a retry with the same room code on the join side. Call `destroy()` before nulling a peer in every error path.

### 2c. Fix the `skipGroq` hang

`skipGroq()` never sends `begin`, so the joiner sits on Step III forever when the host chooses offline narration. Send `begin` from both paths.

### 2d. Transmit the joiner's choice

Add a `player-choice` message. The joiner sends its choice, the host holds both, and only builds the narrator prompt once both have arrived. Add a wait state and an indicator on whichever side finished first. This is the one piece of cohesive dual narration that was never built.

### 2e. Broadcast veil and energy

`veil-update` is already handled and never sent. Send it. Add an `energy-update` so the reality side's companion panel stops showing a hardcoded 100 percent.

### 2f. Make host identity explicit

`S.action` decides who is host and is read off a lobby tab that stays clickable after connecting. Latch it at handshake and stop reading the tab.

### Gate

- Joiner's console shows no Groq key in any received message.
- Five consecutive fresh create/join cycles succeed. No duplicate room code ever appears.
- A join to a code that does not exist fails with a readable message within ten seconds.
- Host kills wifi for ten seconds and restores it. Both sides show the drop, then recover on the same room code, and game state still matches.
- Host picks "Continue without AI narration". Both sides reach character creation.
- Both players choose. The narrator fires once, after the second choice, and the prose references both actions.
- Ten turns played. Turn number, veil percentage, and mural layer match on both screens the whole way.

Do not touch: game logic, narration prompts, character data, scene content.

## Phase 3 -- The scene engine

Goal: the architecture that lets three scenes live in one app without clobbering each other. This is the heart of the three-into-one work.

### 3a. Namespace everything

The three files independently define `S`, `G`, `CHAR_DATA`, `callGroq`, `addEntry`, `setThinking`, `launchGame`, `sendNote`, `receiveNote`, `GROQ_URL`, `GROQ_MODEL`. `addEntry` alone has three different argument orders. Concatenated, the last definition silently wins.

Each scene becomes an object with a fixed interface. No scene defines a global. Proposed interface, for Maridizzle's approval before anything is written:

```js
const SceneLockdown = {
  id: 'lockdown',
  title: 'The Lockdown',
  mount(root, ctx) {},        // build this scene's DOM into root
  unmount() {},               // tear down listeners and timers
  onMessage(data) {},         // handle this scene's PeerJS message types
  isComplete() {},            // has this scene finished
  exportState() {},           // what this scene hands to the next one
};
```

`ctx` carries the shared things a scene may read: role, both characters, the note thread, veil, energy, and the send function. Scenes never touch `S` or `G` directly.

### 3b. The scene manager

`scenes.js` holds the ordered scene list, mounts one at a time, and routes messages. Message envelope gets a `scene` field so a stale message from a finished scene cannot fire.

Advancing requires BOTH sides to confirm, then broadcasts `scene-advance` so nobody is left behind.

### 3c. Shared services

One `callGroq`. One `addEntry`, with one argument order, and the two odd ones rewritten to match. One note thread, one connection, one character creation. The character creation in the Lockdown and the 15 Questions is dropped from the merged app; v2's full version is the only one. The original files keep theirs and stay untouched.

### Gate

- The Opening runs as a mounted scene with no behavior change from Phase 2's gate.
- A deliberately broken scene file produces a readable console message naming the scene, not a silent blank screen.
- Mounting and unmounting the same scene five times leaves no duplicate listeners and no duplicate DOM.
- `window` has no scene-owned globals on it.

## Phase 4 -- Fold in The Lockdown

Goal: The Lockdown plays inside the merged app, using the shared connection and the shared characters.

### Steps

1. `js/scenes/lockdown.js` implements the scene interface. Room graph, objects, decor, and the five flash transmissions move to `data/scenes/lockdown.json`. Existing text is Maridizzle's and moves verbatim. Nothing new is written.
2. Roles map `artist` to `reality` and `p2` to `fantasy`.
3. Its message types get namespaced: `lockdown:position`, `lockdown:flash`, `lockdown:complete`.
4. Its notes go through the shared note thread instead of its own.
5. Groq calls go through the shared narrator with the scene's own system prompt.
6. Object state gets broadcast so P2's copy is real state, not DOM manipulation.

### Gate

- Both players reach the Lockdown from the Opening with their characters intact.
- The artist navigates all nine rooms. P2's marker tracks every move.
- All five objects found. Each fires the correct flash on both sides, and each dot and pill goes dark.
- Poking ordinary decor still gives the flat canned line with no Groq call.
- Five found unlocks the building on both screens.
- Offline (no key): the scene is still completable start to finish.

Do not touch: the five flash transmissions, the room descriptions, the object names. All of it is Maridizzle's text.

## Phase 5 -- Fold in The 15 Questions

Goal: The 15 Questions plays inside the merged app.

### Steps

1. `js/scenes/questions.js` implements the scene interface. Questions, neutral seeds, and the 11 tangents move to `data/scenes/questions.json` verbatim.
2. Reconcile the Groq key model per open question 4 above. Do not pick for her.
3. Its `CHAR_DATA` subset is dropped. The scene reads the full character from `ctx`, so the prompts get stats, appearance, and personality they currently never see.
4. Message types namespaced: `questions:asked`, `questions:answered`, and so on.
5. Its `addEntry(text, type, tag)` is rewritten to the shared signature. Note it prepends entries rather than appending; decide whether that stays.

### Gate

- Both players reach the scene with characters intact.
- Ten turns complete. The asker alternates correctly every turn.
- A seeded answer fires the right tangent. The ASKER gets the pull-or-pass choice, not the answerer.
- Pulling the thread produces the monologue on both screens. Letting it pass advances cleanly.
- The question pool never repeats a question.
- Offline: every answer falls back to seed text and the scene still completes.

Do not touch: question text, seed text, tangent text.

## Phase 6 -- Transitions and the coming-soon gate

Goal: one continuous playthrough, Opening to gate, with nothing jarring in between.

Blocked on open questions 1, 2, and 3.

### Steps

1. Give the Opening an end condition, per Maridizzle's answer to question 2.
2. Wire the transitions in the order Maridizzle sets in question 1.
3. Carry the state she names in question 3. Build the plumbing for all of it; let her switch pieces off.
4. Write a transition screen between scenes so a scene swap is not an abrupt DOM replacement.
5. Build `js/scenes/coming-soon.js`: the final gate. Content is Maridizzle's. Claude builds the container with a `TBD` token in it and nothing else.

### Gate

- One unbroken playthrough on two devices, Opening to coming-soon, no reload, no console errors.
- Characters, note history, and carried state survive every transition on both sides.
- Refreshing mid-game fails gracefully with a readable message rather than a white screen. (Real save and resume is backlog.)
- The full run works with no Groq key at all.

## Phase 7 -- Ship it

1. Resolve open question 6 (root `index.html`).
2. Maridizzle creates `main` and sets it as the default branch.
3. Maridizzle enables Pages: deploy from a branch, `main`, root.
4. Verify the live URL on a phone and a desktop, on two different networks, not just two tabs.

Gate: two people on two networks play the whole thing through the live URL.

## Phase 8 -- Backlog (order to be set by Maridizzle)

Each gets its own mini-plan and gate when its turn comes. None start without a go.

- Save and resume. Serialize characters, shared state, scene state, and inventory to localStorage. Resume screen on the lobby. Peer reconnection using the saved room code. Never clear a save without a typed confirmation from the player.
- Scoring variables. Bring `veilDeath`, `hopelessness`, `veilKnowledge`, `voidCorruption` into game state proper. Confirm with Maridizzle before changing anything on Railway.
- Inventory system. Role and job specific starting items; four types (Sellable, Breakable, Losable, Key); sliding drawer UI; break checks keyed to stat, roll of 1 always breaks, 20 always holds; items pass through the veil arriving corrupted. Item roster comes from a separate design document. Do not invent items.
- Radial action wheel. Replaces the choice buttons. Floats and pulses when choices are available, disappears after selection. Custom action field stays.
- Note window timing. "The veil is listening" indicator; 45-second window at intervals; a note sent during the window can trigger choice regeneration with a shimmer.
- Collaborative puzzle locks. Choices grayed with a veil-crack symbol until both sides have exchanged enough notes on the current scene.
- Timed events. Countdown on flagged beats. If neither player acts, the narrator takes the worst reasonable option and says so.
- Character avatar upload. Multiple images per character keyed to state (calm, drained, marked). Stored as data URIs in the save.
- Mural redraw. Replace the six SVG layers with the established progression. The current SVG paths and the six captions in `MURAL_LAYERS` both predate it. Art direction from Maridizzle, one layer at a time.
- The ten-theme system and reduce-motion toggle, if that build is ever found. Not in this repo.

## Session hygiene

At the start of every Claude Code session: read CLAUDE.md, read this file, state which phase is active and which gate was last passed, then wait.

At the end of every session: write a short summary of what changed, what was verified, what was not, and any TBD tokens introduced. Do not commit it. Hand it to Maridizzle.

Signed: Maridizzle
