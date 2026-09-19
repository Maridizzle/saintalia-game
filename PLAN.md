# PLAN.md -- Saintalia build plan

Read CLAUDE.md first.

Rewritten after Phase 0. The old version was written without seeing the files and guessed wrong about several important things. What follows is built on what is actually in the repo.

**The goal:** one app that plays through like the real game, end to end, and then hits a "coming soon" gate.

The run is the three existing scenes plus The Dream, which is built rather than bridged because it carries the central revelation of Layer 2:

```
The Opening -> The Lockdown -> bridge -> bridge -> The Dream -> The 15 Questions -> coming soon
```

Every phase ends with a verification gate. A phase is not done until Maridizzle has seen the gate pass. No phase starts until Maridizzle says start. Nothing is committed or pushed by Claude at any point. Claude prepares changes, Maridizzle pushes.

Working principle for the whole plan: engine and content are separate. The engine is built to read scene content as data. Story content arrives from Maridizzle whenever it arrives. The engine never waits on it and never fills it in.

## Current priority: make what already exists playable

Maridizzle's call, and it supersedes the phase order below. Before anything new gets built, the pieces that already work should connect into one run with one character:

```
character creation -> the Opening -> the Lockdown -> the 15 Questions -> coming soon
```

Order of attack: **Phase 3, then 4, then 5, then 6, then the bridge and gate from Phase 8.**

**STATUS: all of that is built.** The run mounts end to end:

```
opening -> lockdown -> escape -> skytears -> questions -> coming-soon
```

Verified by `node game/test/loadtest.js`, which mounts every scene in order as both roles. What remains is Maridizzle's: play it on two devices, write the two bridges and the gate copy, and fix the swapped Lockdown flashes.

**Phase 7, The Dream, is DEFERRED** until that run works end to end. It is still going to be built, just not first.

**Added 2026-09-19, Maridizzle's call: Phase 11, migrate the game to Railway, deep.** The PeerJS layer and static hosting are the root of the connection instability and make a private two-sided save awkward. Phase 11 replaces the transport, adds server-side saves, moves narration server-side, and carries the back button. Its order relative to Phase 7 is not yet decided.

Two things that follow from this, both deliberate and both temporary:

- The 15 Questions will interrogate both players about a veil The Dream was supposed to show them. That hole closes when Phase 7 happens.
- Only one bridge is needed for this run, between the Lockdown and the 15 Questions, covering The Escape and The Sky Tears.

Why Phase 3 cannot be skipped even though it is "just bugs": the lobby currently prints **two different room codes 300ms apart and only the second one works.** Two devices cannot reliably connect until that is fixed, and everything above depends on two devices connecting.

## Answered, after the vault arrived

The vault and Maridizzle's decisions settled these. Recorded here so nobody relitigates them.

1. **Scene order.** Five-act spine. Origin (The Opening), Layer 1 (The Lockdown, The Escape, The Sky Tears), Layer 2 (The Dream = beat 2-A, The 15 Questions = beat 2-B, The Branching Confessions, The Soul Tagging, four fusion outcomes), Layer 3, Layer 4, six endings. Full table in CLAUDE.md.

2. **How the Opening ends.** The Lockdown fires the moment the connection between the two players is established. The building seals around it, the way a wound closes around a foreign object.

3. **What carries.** Energy drain is canonical, cumulative, and accelerates while navigating the Lockdown. The note system is the through-line and the vault specifies a 45 second window for it. Build the plumbing to carry everything; let Maridizzle switch pieces off.

4. **Protagonists.** Tyvian and Sasha are **templates, not fixed characters.** Character creation stays. Consequence: the ten tangent guardrails are written as their specific biographies and need genericizing into shapes. **That rewrite is Maridizzle's.** Every tangent ships as data the engine reads, so her rewrite never touches code.

5. **The Groq key. Host proxies.** Only the host ever holds a key. When the non-host needs narration, their device sends a `narrate-request`, the host calls Groq, and the host returns a `narrate-response`. The non-host never sees a key box. This makes the 15 Questions match every other scene and keeps the whole game on one person's free quota. Built in Phase 6.

6. **Mobile matters, and it comes right after the split.** Every scene and bridge built after Phase 2 is built mobile-first. Nothing gets retrofitted.

7. **Root `index.html`. A redirect into `game/`.** Pages is live from `main` at root and 404'd on the bare URL because no `/index.html` existed. Root now carries a small redirect with a link fallback, so the bare URL lands on the game and nothing has to move out of `game/`.

8. **The turn cap is deliberate, and already correct.** It counts main questions only, never tangents. It stops the scene spinning into eternity, and drawing 10 of 15 gives a different subset every playthrough. Verified against the code: tangents call `advanceTurn()` without incrementing the counter, so they cost nothing. No change needed. Do not "fix" it.

## Still open

9. **Trigger collisions in the 15 Questions.** The vault claims Q4-B and Q7-B for BOTH Self as Threat A and B, and Q6-B and Q8-B for BOTH Conditional Survival B and The Connection Itself. The code picked one owner each, which strands Conditional Survival B on Q3-B alone and Self as Threat A on Q9-A alone. Maridizzle to settle. Also unassigned in the vault: Q7-A.

That is the only open question left.

## Content fixes only Maridizzle can make

Claude does not write story content. These are logged, not actioned.

- **Lockdown flashes 2 and 3 are swapped.** The vault maps waterbottle to The Neural Network and compass to The Book. The code has them crossed. Point IDs are correct; only the flash text is wrong.
- Genericizing the ten tangent guardrails (see item 4).
- The bridge text for The Escape and The Sky Tears (see Phase 8).
- The Dream's flash prose, or a decision to let the narrator expand it from a guardrail (see Phase 7).
- Three mechanical answers The Dream needs before it can be built (see Phase 7).
- The coming-soon gate's copy.

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

## Phase 2 -- Make it work on a phone

Goal: the game is genuinely playable on a phone, and every scene built after this inherits the discipline instead of being retrofitted.

This sits here on purpose. Phases 4 through 7 build four more scenes and three bridges. Doing mobile first means all of them are built mobile-first. Doing it last means retrofitting seven things at once.

It cannot go inside Phase 1, because Phase 1's entire value is that nothing changes and the split can be trusted.

### Already fine (audited, not assumed)

The viewport tag is correct and permits pinch-zoom to 5x. `.btn-grid` and `.card-grid` use `auto-fill minmax()` and collapse on their own. `.g-body` already stacks below 800px. `.tabs` scrolls sideways. Most type uses `clamp()`.

### The five real problems

1. **Stat rows overflow.** `.stat-row { grid-template-columns: 150px 1fr 28px; gap: 1rem; }` needs about 350px before the five 24px pips are counted. An iPhone SE offers roughly 282px inside `.cc`'s padding. Stack the row under about 520px.

2. **`height: 100vh` with `overflow: hidden` on the game screen.** On mobile browsers `100vh` includes the strip behind the address bar, so the bottom is clipped and unreachable. Move to `dvh` with a `vh` fallback for older browsers.

3. **Touch targets under 44px.** `.pip` is 24px, `.phone-send` is 30px, `.avatar` is 26px. Character creation is almost entirely pip-tapping, so the pips matter most. Grow the hit area without necessarily growing the drawn pip.

4. **Fixed-height threads.** `.holo-msg-area` and `.phone-thread` cap at 80px, `.note-thread` at 70px. On a phone that is roughly two lines, and notes are the primary interface during the Lockdown. Make them proportional on small screens.

5. **The mural at `max-height: 35%`** of a stacked column may be close to unreadable on a phone. Needs a floor.

### Steps

1. Add breakpoints for phone widths. Keep the existing 800px and 480px queries; add one around 520px for the stat rows.
2. Replace `100vh` with `100dvh` plus a `100vh` fallback.
3. Raise every interactive target to at least 44px of touch area.
4. Make the three threads proportional below the phone breakpoint.
5. Give the mural a minimum height that survives stacking.
6. Re-check the merged stylesheet for anything the three original blocks assumed about a wide screen.

Do not touch: any game logic, any UI string, any narration prompt. This phase is CSS and markup only.

### Gate (a real phone, not a narrow desktop window)

- All three screens usable on a 320px-wide viewport with no horizontal scrolling anywhere.
- Every stat pip tappable without zooming, and the full stat row visible.
- Nothing clipped behind the address bar on the game screen. The bottom of the page is reachable.
- Note threads readable without pinching. At least four lines visible.
- The mural readable on the reality side.
- Two real phones on two networks complete the Phase 1 gate run end to end.
- Landscape does not break anything.

## Phase 3 -- Connection safety and state sync

Goal: fix the five confirmed bugs that make two-player play unreliable. Everything here is a known defect with a known line number. No new features.

### 3a. Remove the Groq key from the wire

One-line deletion. The key is sent at line 1008, parked in `window.GAME_STATE`, and never read. Every Groq call site is gated on `isHost`. Removing it from the `begin` payload changes no behavior. This was written up as a decision in the old plan; it is not one.

### 3b. Fix the double peer init

`goToStep()` calls `initPeer()`. The `window.goToStep` override then destroys that peer 300ms later and calls `initPeerWithCode()` with a different code. Two room codes appear in `#room-code-display`, 300ms apart, and only the second one works.

Fix: one initialization path. `initPeerWithCode()` is the correct one because it registers the peer ID the joiner actually targets. Keep `initPeer()` in the file, unused, behind the DEBUG flag rather than deleting it.

Then, and only then, add reconnect: `S.peer.reconnect()` on `disconnected`, a visible status line on both sides when the data channel drops, and a retry with the same room code on the join side. Call `destroy()` before nulling a peer in every error path.

### 3c. Fix the `skipGroq` hang

`skipGroq()` never sends `begin`, so the joiner sits on Step III forever when the host chooses offline narration. Send `begin` from both paths.

### 3d. Transmit the joiner's choice

Add a `player-choice` message. The joiner sends its choice, the host holds both, and only builds the narrator prompt once both have arrived. Add a wait state and an indicator on whichever side finished first. This is the one piece of cohesive dual narration that was never built.

### 3e. Broadcast veil and energy

`veil-update` is already handled and never sent. Send it. Add an `energy-update` so the reality side's companion panel stops showing a hardcoded 100 percent.

### 3f. Make host identity explicit

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

## Phase 4 -- The scene engine

Goal: the architecture that lets three scenes live in one app without clobbering each other. This is the heart of the three-into-one work.

### 4a. Namespace everything

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

### 4b. The scene manager

`scenes.js` holds the ordered scene list, mounts one at a time, and routes messages. Message envelope gets a `scene` field so a stale message from a finished scene cannot fire.

Advancing requires BOTH sides to confirm, then broadcasts `scene-advance` so nobody is left behind.

### 4c. Shared services

One `callGroq`. One `addEntry`, with one argument order, and the two odd ones rewritten to match. One note thread, one connection, one character creation. The character creation in the Lockdown and the 15 Questions is dropped from the merged app; v2's full version is the only one. The original files keep theirs and stay untouched.

### Gate

- The Opening runs as a mounted scene with no behavior change from Phase 2's gate.
- A deliberately broken scene file produces a readable console message naming the scene, not a silent blank screen.
- Mounting and unmounting the same scene five times leaves no duplicate listeners and no duplicate DOM.
- `window` has no scene-owned globals on it.

## Phase 5 -- Fold in The Lockdown

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

## Phase 6 -- Fold in The 15 Questions

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

## Phase 7 -- Build The Dream (beat 2-A) -- DEFERRED, see Current priority above

Goal: the one missing scene that cannot honestly be bridged.

Maridizzle's decision: bridge The Escape and The Sky Tears, which are genuinely transitional, and **build The Dream for real.** It is a full puzzle scene roughly the size of the Lockdown, and it carries the central revelation of Layer 2. Skipping it would have the 15 Questions interrogate both players about a veil they were never properly shown.

It is built LAST of the scenes, after both existing ones are folded in, so it lands on an engine already hardened by two real scenes rather than on theory.

### What the vault establishes

- Trigger: both players sleep after The Sky Tears. The veil, aware and dying, reaches through the only channel left, unconscious minds.
- Reality: the artist wakes in a room, phone in hand. The same five warped objects. A wall of shifting incomprehensible shapes glowing different colors.
- Fantasy: P2 wakes on a tower in an ocean with the hologram screen. Not Saintalia. Neither world. Neither player chose this. They find each other immediately.
- Mechanic: the artist describes each object. P2 guides placement on the wall. Order is the artist's choice.
- Flash sequence, always in this order: seed of life inside a glowing seed, the flower of life expanding, the tree of life forming, the tree exploding into a vast geometric network of repeating mathematical patterns, a dark cloaked figure entering the network and poisoning it.
- After: both players understand the veil is a living geometric network spanning universes, something is poisoning it, and the tearing sky is that poisoning made visible. Neither chose to know it. Neither can unknow it.

### Three questions that block the build

Claude will not guess any of these.

1. **The sequence contradiction.** The vault says object-to-flash mapping is key = Flash 1, bottle = 2, compass = 3, clock = 4, photograph = 5. It ALSO says flashes always fire in sequence order regardless of placement order. Those conflict. If the artist places the compass first, does that fire Flash 3 because the compass owns it, or Flash 1 because it is the first placement? Two readings: the Nth placement fires the Nth flash and the object mapping is vestigial, or each object owns its flash and they are buffered until their turn in the sequence.

2. **What makes a placement correct?** The vault says "each correct placement fires one flash," which implies a placement can be wrong. Nothing states what correct means, what happens on a wrong one, or whether P2 can see enough to know.

3. **Where does the flash prose come from?** The Lockdown ships five fully written flashes. The Dream has five one-line concepts. Either Maridizzle writes five full flashes, or the narrator expands each concept from a guardrail the way the 15 Questions tangents work.

### Steps, once those are answered

1. `js/scenes/dream.js` implementing the scene interface.
2. `data/scenes/dream.json` for all content. The five objects are the same five as the Lockdown, so that data is shared rather than duplicated.
3. The wall, the placement mechanic, and the describe-and-guide loop, asymmetric like every other scene.
4. Flash firing per Maridizzle's answer to question 1, synced to both sides.
5. Built mobile-first, per Phase 2.

Do not touch: the flash concepts, the object list, the object mapping. All of it is Maridizzle's.

## Phase 8 -- Bridges, transitions, and the coming-soon gate

Goal: one continuous playthrough, Opening to gate.

Two bridges, not three. The Dream is built for real in Phase 7. The run is:

```
The Opening
  -> The Lockdown
    -> bridge: The Escape
    -> bridge: The Sky Tears
  -> The Dream
  -> The 15 Questions
    -> coming soon
```

A bridge is a short narrative interstitial standing in for a real beat that is not built yet. It is not a fake beat and must never pretend to be one. Each gets a scene container, a continue control, and a `BRIDGE_TBD_<name>` token where the text goes.

The Escape is the smaller of the two. It half exists already as the Lockdown's completion message, and the vault treats it as its own beat: P2 has confirmed the other world is real, the artist carries five flashes they cannot yet interpret, and the connection has proven itself necessary.

The Sky Tears is the first fully shared beat in the whole game, the first time both players see the same thing through different frames. It deserves more than a paragraph eventually, but a bridge is honest for now.

### Steps

1. End the Opening on the connection being established, per the vault. The building seals; the Lockdown mounts.
2. Build the bridge scene type: one container, one block of Maridizzle's text, one continue control that both sides must confirm.
3. Stand up two bridges with TBD tokens: `BRIDGE_TBD_ESCAPE`, `BRIDGE_TBD_SKYTEARS`.
4. Carry state across every transition: characters, note thread, veil, energy, scene results.
5. A transition screen so a scene swap is not an abrupt DOM replacement.
6. `js/scenes/coming-soon.js`: the final gate. Container with a `TBD` token. Copy is Maridizzle's.

**Claude writes no bridge text.** The tokens ship visible and ugly on purpose so an unwritten bridge cannot be mistaken for finished content.

### Gate

- One unbroken playthrough on two devices, Opening to coming-soon, no reload, no console errors.
- Characters, note history, and carried state survive every transition on both sides.
- Every unwritten bridge shows its TBD token plainly.
- Refreshing mid-game fails gracefully with a readable message rather than a white screen. Real save and resume is backlog.
- The full run works with no Groq key at all.

## Phase 9 -- Ship it

Most of this already happened out of order, because Maridizzle deployed early to test. Recorded as done rather than pretending it is still ahead.

1. ~~Root `index.html`.~~ Done. A redirect into `game/`.
2. ~~Create `main`.~~ Done by Maridizzle.
3. ~~Enable Pages from `main` at root.~~ Done and live.
4. Verify the live URL on a phone and a desktop, on two different networks, not just two tabs.

Still outstanding: the default branch is `claude/initial-game-import` and should be `main`. Settings, General, Default branch. Only Maridizzle can make that click.

Phase 11 moves the deploy target to Railway. Pages keeps serving the static build until Maridizzle retires it. Nothing here is undone.

Gate: two people on two networks play the whole thing through the live URL.

## Phase 10 -- Backlog (order to be set by Maridizzle)

Each gets its own mini-plan and gate when its turn comes. None start without a go.

- Save and resume. Serialize characters, shared state, scene state, and inventory to localStorage. Resume screen on the lobby. Peer reconnection using the saved room code. Never clear a save without a typed confirmation from the player. **Superseded by Phase 11b**, which puts saves on the server instead of localStorage. Kept here for the record.
- Scoring variables. Bring `veilDeath`, `hopelessness`, `veilKnowledge`, `voidCorruption` into game state proper. Confirm with Maridizzle before changing anything on Railway.
- Inventory system. Role and job specific starting items; four types (Sellable, Breakable, Losable, Key); sliding drawer UI; break checks keyed to stat, roll of 1 always breaks, 20 always holds; items pass through the veil arriving corrupted. Item roster comes from a separate design document. Do not invent items.
- Radial action wheel. Replaces the choice buttons. Floats and pulses when choices are available, disappears after selection. Custom action field stays.
- Note window timing. "The veil is listening" indicator; 45-second window at intervals; a note sent during the window can trigger choice regeneration with a shimmer.
- Collaborative puzzle locks. Choices grayed with a veil-crack symbol until both sides have exchanged enough notes on the current scene.
- Timed events. Countdown on flagged beats. If neither player acts, the narrator takes the worst reasonable option and says so.
- Character avatar upload. Multiple images per character keyed to state (calm, drained, marked). Stored as data URIs in the save.
- Mural redraw. Replace the six SVG layers with the established progression. The current SVG paths and the six captions in `MURAL_LAYERS` both predate it. Art direction from Maridizzle, one layer at a time.
- The ten-theme system and reduce-motion toggle, if that build is ever found. Not in this repo.

## Phase 11 -- Migrate the game to Railway (deep)

Maridizzle's call, 2026-09-19. This supersedes "static browser app, no backend for the game itself" in CLAUDE.md, the PeerJS layer, and the Phase 10 save-and-resume item. CLAUDE.md's "What this is" gets updated when 11a lands, not before.

**Why.** PeerJS depends on a free public broker with no SLA and on WebRTC through phone NAT. It has no reconnect path. It makes one player's browser the authority for every turn, which is where most of the Phase 3 bugs came from. A server relay removes all four. A save that reveals neither side to the other becomes one table instead of two local files.

**What does not get simpler, so nobody expects it to.** The back button's DOM work and its both-sides handshake. Mid-scene restore. Storage does not teach a scene how to re-render itself.

**Shape.** A Node server in this repo (`server/`), deployed as its own Railway service with **its own Postgres, fully separate from the mindmap's** (Maridizzle's call, 2026-09-19: a bad day on one can never reach the other). Pattern copied from `Maridizzle/saintalia/server.js`: Express, `pg`, HTTP Basic Auth on everything, secrets in env only. Postgres is not needed until 11b; the relay in 11a keeps rooms in memory. The server serves `game/` as static. Pages keeps serving the current static build until Maridizzle retires it.

**Ground rules for the whole phase.**

- Claude changes nothing on Railway. Claude writes files. Maridizzle creates the service, sets env vars, and deploys.
- No credentials in chat, in files, or in the repo. `DATABASE_URL`, `APP_PASSWORD`, `GROQ_API_KEY` exist only as Railway env vars.
- The 16 `S.conn.send` call sites and every `onMessage` handler are untouched. The transport swaps underneath them. Verified before this plan was written: zero direct PeerJS references exist outside `connection.js`.
- The PeerJS path stays in the repo behind a flag. Nothing is deleted.
- One shared `APP_PASSWORD` gates the whole game, same as the mindmap. Maridizzle hands it to players. No accounts.

### 11a. The relay (replaces PeerJS)

Server:

- `server/index.js`, `server/package.json`. Express plus `ws`. Static `game/`.
- One WebSocket endpoint, `/ws`, joined with a room code and a role. The server holds up to two sockets per room and forwards every message from one to the other verbatim. It does not parse game messages in this step.
- The first socket in a room is told `isHost: true`, the second `isHost: false`. Host identity comes from the server, never from a lobby tab. Closes Phase 3f for good.
- A socket that reconnects with the same room and role replaces the old one. The other side receives `peer-reconnected`.
- Rooms with no sockets for 30 minutes are dropped from memory. No database in this step.

Client, `connection.js` only:

- A `TRANSPORT` flag at the top: `'relay'` (default) or `'peer'`. The `peer` value keeps the current path alive for comparison.
- Relay equivalents of `initPeer`, `initPeerWithCode`, `joinRoom`, `setupConnection`. `S.conn.send(obj)` becomes a JSON send on the socket. Incoming messages feed `dispatchMessage` unchanged.
- Auto-reconnect with backoff on socket close. The existing status area shows "the veil flickers" while it retries.
- Room codes stay VEIL_WORDS_A plus VEIL_WORDS_B.
- Socket auth: a browser's WebSocket cannot set headers, so the socket is not gated by Basic Auth directly. The page, already behind the password, fetches a single-use two-minute token from `/api/ws-token` and opens `/ws?token=...`. Server side that is a Map in memory. Settled in step 1.

Step 1, the echo socket, deploys before any relay code: `package.json` at the repo root, `server/index.js` with auth, static `game/`, `/api/health`, `/api/ws-token`, and a `/ws` that echoes. Verified locally 2026-09-19: 401 without the password, 401 on a socket with no token, echo works, a reused token is refused, loadtest passes.

Gate 11a, two devices on two networks, one of them a phone on cellular:

0. Step 1 on the live domain. Open the site, enter the password, and in the browser console run:
   `fetch('/api/ws-token').then(r=>r.json()).then(({token})=>{const ws=new WebSocket('wss://'+location.host+'/ws?token='+token);ws.onopen=()=>ws.send('ping');ws.onmessage=e=>console.log('got:',e.data);ws.onerror=()=>console.log('socket failed');});`
   Expected: `got: {"type":"hello","echo":true}` then `got: ping`. Anything else and the relay does not get built until it is understood.
1. Create, join, character creation, Opening turn one on both sides.
2. Kill the phone's browser mid-Lockdown. Reopen. Same room code. It reconnects and both sides continue.
3. `TRANSPORT = 'peer'` still works end to end, proving nothing above the transport changed.
4. `node game/test/loadtest.js` passes.

### 11b. Saves, checkpointed at scene boundaries

Server:

- Table `saintalia_game`: `room`, `role`, `slot`, `shared JSONB`, `private JSONB`, `updated_at`. Primary key `(room, role, slot)`. Created on boot the way the mindmap creates its table.
- `POST /api/save` writes one row for the calling role. `GET /api/save` returns only that role's row. A role can never fetch the other role's private half. The server enforces it; the client is not given the choice.
- A per-player secret. On room creation the server issues one random token per role, shown once beside the room code with "write this down." It is sent as a header on every save and load. A row cannot be read without the token for its role.

Client:

- A Save button in the game chrome on both sides. It sends `save-request` through the relay; both clients write their own row under the same slot (scene id, turn, timestamp). Confirmation on both screens.
- An automatic checkpoint at every `scene-advance`, same mechanism, slot `auto`.
- A Resume panel on the lobby lists this role's slots for the room. Both players pick the same slot. The host sends `resume` with the shared half, each side restores its own private half, and `mountScene` lands at the saved scene.
- Shared half: scene id, turn, veil, mural layer, notes thread, both characters.
- Private half: Lockdown object state and grid, each side's own choices, hidden answers. Scoring variables, once they exist, sit in the host's private half base64 encoded, so the silent design does not leak the moment someone reads the row. That is obfuscation, not encryption, and it is enough for two people who trust each other.
- The Groq key is never in any save.
- Never delete a save. Slots accumulate. Maridizzle decides retention.

Out of scope, stated so it is not assumed: mid-scene restore. Resume always lands at the start of the saved scene. Any-time saves are a later phase and need a `restore()` on every scene.

Gate 11b:

1. Save at the Lockdown boundary. Close both browsers. Resume from the lobby on both. Land on the Lockdown together.
2. Request the reality row with the fantasy token. 403.
3. Read the row in Postgres. The shared half is plain; the private halves are opaque.

### 11c. Server-side narration

Server:

- `POST /api/narrate` proxies Groq with `GROQ_API_KEY` from env. Same shape as the mindmap's `/api/chat`. Rate limited per room in memory.
- Turn resolution moves to the server: it collects both `player-choice` messages for a turn, builds the prompt, calls Groq, and broadcasts `narrator-update` to both sockets. The 25 second timeout and the offline fallback move with it.

Client:

- Lobby Step III, the key box, is hidden, not removed. The `skipGroq` path stays for offline play.
- `requestNarration` calls `/api/narrate`. The `narrate-request` and `narrate-response` handlers stay registered for the `peer` transport.
- Every `isHost` gate in narration code is reviewed one at a time. Some stay (who sends `begin`). Some go (who calls Groq).

Gate 11c:

1. Both players see the same narration for the same turn with no key entered by anyone.
2. Kill the host's browser during a Groq call. The joiner still receives the turn.
3. `TRANSPORT = 'peer'` with a key still narrates, proving the fallback lives.

### 11d. The back button

Not a Railway item, but it is the question that started this phase, and the first-scene back needs the relay's handshake.

- Screens stop being wiped. `connection.js:475` and `game.js:77` render into a container and hide the previous screen under the `screen-*` class instead of replacing `body.innerHTML`.
- Character tab 1 gains "Change Sides" back to the lobby. Local only, nothing has been sent yet.
- The first scene gains "Back to character creation." It sends `char-reopen`; both sides return, both re-finalize, `checkBothReady` fires again, `G` resets.
- No in-scene undo. Undo would let a player replay a choice until the silent score came out right. Recorded as a decision. Maridizzle can reverse it.

Gate 11d, on a phone: lobby to character to Opening, back to character, back to lobby, forward again, and the game starts clean on both sides.

### Order

11a, then 11d, then 11b, then 11c. Each is one PR-sized change, verified on two devices before the next starts. Maridizzle creates the Railway service and its env vars before Gate 11a can run. Nothing is committed or pushed by Claude at any step.

## Session hygiene

At the start of every Claude Code session: read CLAUDE.md, read this file, state which phase is active and which gate was last passed, then wait.

At the end of every session: write a short summary of what changed, what was verified, what was not, and any TBD tokens introduced. Do not commit it. Hand it to Maridizzle.

Signed: Maridizzle
