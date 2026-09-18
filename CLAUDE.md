# CLAUDE.md -- Saintalia

Read this fully before doing anything in this repo. These rules apply to every session and every response.

## What this is

Saintalia is a two-player asymmetric horror-fantasy narrative game. One player is in Saintalia (an ancient dying realm), one is an artist in the modern waking world. They connect across a dying veil-chimera. The game is a static browser app: PeerJS for the two-device connection, Groq for AI narration, GitHub Pages for hosting. No backend for the game itself.

Owner: Maridizzle (GitHub: Maridizzle). A building partner co-designs mechanics. Maridizzle handles all GitHub pushes personally.

## Standing rules (non-negotiable)

1. Never push, commit, merge, or deploy without explicit authorization in the current session. "Explicit" means Maridizzle typed yes to that specific action. Silence, a long pause, or approval of an earlier step is not authorization.

2. Never delete anything. Not files, not branches, not character or player data, not localStorage keys, not database rows. If something must go, name it and let Maridizzle remove it.

3. Do not write code, documents, or creative content without confirmation first. Show the plan of action. Wait. Then build.

4. Step-by-step with verification gates. Confirm each step's output actually works before marking it done. Do not assume. Run it, load it, test it.

5. Query before scripting. Read the actual file, the actual config, the actual value before writing anything that depends on it. Never guess paths, setting names, or values.

6. Surgical edits in a repo. The old "full rewrite" rule existed because pasted fragments broke indentation in chat. In this repo, make the smallest correct edit and show the diff. Only rewrite a whole file when the change touches most of it, and say so first.

7. Token awareness. If an action will take more than a minimal to average amount of tokens, say so and confirm before starting.

8. No em dashes anywhere. Not in code comments, not in UI strings you write, not in commits, not in chat. Use double hyphens or restructure the sentence. (Existing UI strings in the legacy file contain them; do not go on a cleanup crusade, but do not add new ones.)

9. Creative ownership. Maridizzle establishes every story beat, NPC, name, location, ending, and lore detail. Claude documents and builds. Claude does not invent story content, ever, including placeholder names that sound real. Use obvious tokens like `NPC_TBD_01` when a slot is empty.

10. No guessing. If unsure what is being asked, ask. Do not deliberate about intent and then assume.

11. Citations. Any research must use academically acceptable sources (.gov, .org, .edu preferred). Flag .com, wiki, blog, and forum sources clearly. Never fabricate a citation.

12. Signing. Any script or program header is signed `Maridizzle`. Never a real name.

13. Persona. Caring, slightly cynical, mental-health aware. Warm but direct. Never sycophantic.

## Repo layout

### What is actually in the repo (verified Phase 0)

```
/                                 repo root
  CLAUDE.md                       this file
  PLAN.md                         phased build plan with verification gates
  saintalia-v2.html               main game, 2,637 lines. Source of truth for behavior.
  saintalia-lockdown-2p-v2.html   The Lockdown, standalone, 1,242 lines
  saintalia-15questions-v2.html   The 15 Questions, standalone, 929 lines
```

That is everything. No `game/`, no `puzzles/`, no `mindmap/`, no `docs/`, no `.github/`.

The mindmap and the memoir live in a separate repo, `Maridizzle/saintalia`. Not this one. Do not read or touch that repo without asking.

GitHub Pages is not enabled yet. When it is, it deploys from `main` at root. A `main` branch does not exist yet.

### Target layout (built in phases, see PLAN.md)

```
/                              repo root
  index.html                   root entry. Pages serves this. Open decision: the game
                               itself, or a redirect into game/.
  game/
    index.html                 shell only: markup, font links, script tags
    css/game.css               shared styles plus the two console themes
    js/connection.js           PeerJS layer, ONE dispatcher
    js/character.js            character creation
    js/narrator.js             Groq calls, prompts, offline fallback
    js/scenes.js               scene manager: mount, unmount, advance
    js/scenes/opening.js       the Opening and the turn loop
    js/scenes/lockdown.js      The Lockdown
    js/scenes/questions.js     The 15 Questions
    js/scenes/coming-soon.js   the end gate
    data/char-data.js          CHAR_DATA (races, jobs, stats, appearance, personality)
    data/scenes/               one JSON file per scene's content
  docs/                        design notes, inventory reports
```

The three original HTML files stay at repo root, untouched, as reference builds. Maridizzle decides if and when they move or go. Nothing is deleted, ever.

## Architecture map (current single-file build)

### State objects

- `S` -- session and connection. Declared as `{role, peer, conn, roomCode, groqKey, action, connected}`. Four more keys are attached later without being declared: `myCharacter`, `otherCharacter`, `charSelections`, `charTab`.

- `S.action` is `'create'` or `'join'` and it is the ONLY thing that decides who is host. It is read straight off a lobby tab that stays clickable after connecting. Fragile. See PLAN.md Phase 2.

- `G` -- game state: `turn`, `veilStrength`, `muralLayer`, `energy`, `notes`, `fantasyHistory`, `realityHistory`, `waitingForNarrator`, `fantasyChoices`, `realityChoices`

- `CHAR_DATA` -- all character creation data for both sides

### PeerJS

- Library: PeerJS 1.5.2 via unpkg CDN. Broker: `0.peerjs.com:443`. STUN: Google.

- Host peer ID is `saintalia-` + sanitized room code. Joiner connects to that ID directly.

- Room codes: one word from VEIL_WORDS_A + one from VEIL_WORDS_B (e.g. `ashveil-hollow`).

- Message types SENT by `saintalia-v2.html`: `handshake`, `begin`, `character`, `note`, `narrator-update`, `mural-advance`.

- `veil-update` is HANDLED (line 2422) but never sent by anything. Dead branch.

- Confirmed bug, root cause of the silent join failure: the peer is initialized TWICE. `goToStep()` (line 750) calls `initPeer()`, which registers a random broker ID and displays a room code nothing is listening on. The `window.goToStep` override (line 2626) then waits 300ms, destroys that peer, and calls `initPeerWithCode()` with a DIFFERENT code. Two codes appear 300ms apart in `#room-code-display`. Copy the first and the joiner targets an ID that does not exist. See PLAN.md Phase 2.

- Confirmed bug: the joiner's choices are never transmitted. There is no message type for a player choice. `makeChoice` on the join side (line 2371) writes to the local feed and returns. The host builds every narrator prompt from its own choice alone. See PLAN.md Phase 2.

- Confirmed bug: `skipGroq()` (line 993) never sends `begin`. Only `beginGame()` does. If the host picks "Continue without AI narration", the joiner hangs on Step III forever. See PLAN.md Phase 2.

- Confirmed bug: veil percentage desyncs on turn one. The host bumps it in `makeChoice`, both sides bump it locally in `sendNote`, and nothing broadcasts the result.

- Confirmed: `begin` sends the host's Groq key in plaintext (line 1008). The receiver parks it in `window.GAME_STATE` and never reads it into `S.groqKey`, and every Groq call site is gated on `isHost`, so the joiner never calls Groq at all. The key crosses the wire and does nothing. Deleting it from the payload breaks zero functionality.

- Confirmed: `S.conn.on('data', ...)` is registered three separate times, at lines 945, 1545, and 2401. All three stay live. Untangle into one dispatcher, do not paper over.

- No reconnect logic anywhere. `peer.on('disconnected')` never calls `reconnect()`. Error handlers set `S.peer = null` without calling `destroy()`, leaking a live peer on the broker.

### Narration

- Groq endpoint `https://api.groq.com/openai/v1/chat/completions`, model `llama-3.3-70b-versatile`, free tier.

- `callGroq(system, userMsg)` falls back to `buildOfflineCombined()` when no key or on error. (There is no `buildOfflineNarration` in this file. That name belongs to the Lockdown sandbox and has a different signature.)

- Cohesive dual narration is ALREADY BUILT. One call per turn produces `FANTASY_NARRATIVE`, `FANTASY_CHOICES`, `REALITY_NARRATIVE`, `REALITY_CHOICES`. `buildCombinedSystem()` writes the system prompt, `parseNarratorResponse()` splits the four blocks, `applyNarratorResponse()` renders this client's half, and the host broadcasts the raw text as `narrator-update`. Only the host ever calls Groq.

- What is still missing from cohesive narration is the joiner's choice. See the PeerJS bug list above.

- `parseChoices()` (line 2289) is legacy, marked as such in the file, and unused. It handles the old single-side `CHOICES:{...}` format. `addEntry()` still strips both formats from display.

### Key functions

Connection: `selectRole`, `goToStep`, `switchAction`, `generateRoomCode`, `initPeer`, `initPeerWithCode`, `joinRoom`, `setupConnection`, `handleMessage`, `skipGroq`, `beginGame`, `launchGame`

Character creation: `buildCharScreen`, `initCharScreen`, `swTab`, `nextTab`, `markDone`, `clearGrid`, `pickName`, `pickRace`, `pickJob`, `pickAppear`, `pickAppearCustom`, `pickPers`, `pickPersCustom`, `applyBonuses`, `initStatPips`, `setPip`, `refreshPips`, `finalizeCharacter`, `checkBothReady`

Game and narration: `launchActualGame`, `buildGameScreen`, `setupGameMessageHandler`, `beginOpeningScene`, `veilBlink`, `showCorruptedImage`, `callGroq`, `buildCombinedSystem`, `buildCombinedOpening`, `buildOfflineCombined`, `parseNarratorResponse`, `applyNarratorResponse`, `parseChoices` (legacy, unused), `makeChoice`, `submitCustom`

Notes, mural, UI: `sendNote`, `receiveNote`, `addNoteToThread`, `addHoloMsg`, `addPhoneBubble`, `advanceMuralLayer`, `updateVeil`, `updateEnergyDisplay`, `addEntry`, `setThinking`, `setChoicesEnabled`, `setCreateStatus`, `setJoinStatus`, `dbg`

### Mural

- Inline SVG, reality side only. Six hidden groups `mL0` through `mL5`, revealed by setting opacity to 1 with a CSS transition.

- Currently advances every 3 turns. Fantasy player never sees it. This is deliberate and must be maintained.

- Layer progression (established): mL0 fin and shadow in pond; mL1 animal with third leg; mL2 coiled presence in cave mouth with rendered eyes; mL3 burnt bare trees in lush canopy; mL4 sourceless shadow on sunset sky; mL5 jungle commission and Saintalia occupying the same ceiling at once. The current SVG paths in the file predate this progression; redrawing them is a content task for Maridizzle to direct.

### Fonts and palette

- Cinzel Decorative (titles), Cinzel (headers), Crimson Pro (body), Orbitron (fantasy console chrome), Share Tech Mono (fantasy console text). All five load in all three files, all Google Fonts.

- Gold #c9a84c / #e8c96a. Blood #8b1a1a / #c0392b. Purple #2d1b4e / #1a0e2e. Mist #7a9ea8 / #a8c4cc. Bone #d4c5a9. Parchment #f5efe0.

- TWO themes exist, not ten: `body.theme-artist` (slate blue, parchment, phone console) and `body.theme-fantasy` (fuchsia, deep purple, holographic console). They are applied at role select and survive the `innerHTML` swaps because the class sits on `body`. All three files define the same two.

- There is NO localStorage persistence and NO reduce-motion toggle in this repo. Zero `localStorage` calls (one stale comment at v2 line 802), zero `prefers-reduced-motion`. If a ten-theme build exists it is not here.

### Stats and jobs

- Fantasy stats: Veilsight, Ferocity, Cunning, Anchor, Resonance, Shadow.

- Reality stats: Perception, Composure, Intuition, Craft, Bleed, Tether.

- 12 starting points, race bonus, job bonus, max 5 per stat.

- Mirrored jobs: Warlord/Photographer, Hedge Witch/Therapist, Bonekeeper/Forensic Archivist, Wayfinder/Urban Explorer, Silvertongue/Journalist, Ruinwalker/Archaeologist.

## Architecture map (the two scene files)

### `saintalia-lockdown-2p-v2.html` -- The Lockdown

- Roles are `artist` and `p2`. These map to `reality` and `fantasy` respectively.

- Connection is its own PeerJS layer, separate from v2: a 4-digit numeric PIN, peer ID `saintalia-lock-<pin>`. Message types: `handshake`, `position`, `note`, `flash`, `complete`.

- Only the artist holds a Groq key and only the artist calls Groq. This is already the "host narrates only" pattern PLAN.md wanted. No key crosses the wire.

- Nine rooms in `ROOMS`, a compass exit graph, and `ROOM_POSITIONS` mapping each room to an x/y percentage on P2's grid. Five wrong objects in `OBJECTS`, each pinned to a room.

- The artist types freeform actions. `detectMovement`, `detectObjectContact`, `detectDecorContact`, and `detectSearch` classify the input before any AI call. Poking ordinary decor returns a flat canned line with no Groq call at all.

- Contact with a wrong object fires one of five flash transmissions in `FLASH_CONTENT`. Five found unlocks the building.

- **CONTENT BUG, confirmed against the vault: flashes 2 and 3 are swapped.** The vault maps waterbottle to point 2, The Neural Network, and compass to point 3, The Book. The code has `bottle: flashName:'The Book', pointId:2` and `compass: flashName:'The Neural Network', pointId:3`. The point IDs are correct on both. Only the flash content is crossed. Points 1, 4 and 5 are correct. Maridizzle's content, Maridizzle's fix.

- Missing against the vault's Lockdown spec: the 45 second note window (the vault's core mechanic for this beat), the meditation step where P2 prompts the artist before the flash fires, and the required P2 confirmation on point 4 that what the artist saw is real.

- `storyHistory` is built but never sent to Groq. This scene has no conversation memory.

- Object state (`obj.found`, `foundCount`) lives only on the artist side. P2's copy is never updated; `receiveFlash` manipulates the DOM directly.

### `saintalia-15questions-v2.html` -- Beat 2-B, The 15 Questions

- Roles are `fantasy` and `reality`, same as v2.

- Its own PeerJS layer again: same word-pair room code as v2 but peer ID `saintalia-15q-<code>`. Message types: `handshake`, `char-ready`, `game-start`, `question-asked`, `answer-spoken`, `tangent-fired`, `tangent-spoken`, `tangent-skipped`, `advance-turn`, `end`.

- BOTH players need their own Groq key here. Each side voices its own answers. This contradicts v2's host-only model and has to be reconciled before merging.

- 15 questions in `QUESTIONS`, capped at 10 turns by `G.totalTurns`. Asker alternates.

- Each question has two seeded answers (each pointing at a tangent) and two neutral answers from `NEUTRAL_SEEDS`. All four are shuffled so the seeded ones are not obvious.

- A seeded answer fires one of 10 tangents in `TANGENTS`. The ASKER, not the answerer, chooses to pull the thread or let it pass. Pulling it makes the answerer speak a 4 to 6 sentence monologue.

- **The 10 turn cap is deliberate and correctly built.** Maridizzle's design: the cap counts MAIN questions only, never tangents. Two reasons. It stops the scene spinning into eternity, and drawing 10 of 15 means a different subset every playthrough, which is replay value.

  Verified in code: `G.questionsAsked++` fires only in `broadcastQuestion` (line 794) and on the received `question-asked` message (line 598). Every tangent path calls `advanceTurn()`, which only reads the count at line 858 and never increments it. `drawBank(4)` offers four random unused questions each turn. Do not "fix" this.

- Two tangent triggers drift from the vault. `change.a` fires Conditional Survival A, but the vault assigns Q7-A to no tangent at all. `guilt.b` fires Grief Topology B, but the vault says Q9-B belongs to Self as Threat B.

- Three trigger collisions are ambiguities in the vault itself, not code bugs. Q4-B and Q7-B are claimed by BOTH Self as Threat A and Self as Threat B. Q6-B and Q8-B are claimed by BOTH Conditional Survival B and The Connection Itself. The code picked one owner for each, which leaves Conditional Survival B reachable only from Q3-B and Self as Threat A reachable only from Q9-A. Maridizzle to settle.

- Groq is given the seed or tangent text as a guardrail and told to expand it, never quote it. With no key it falls back to printing the raw seed.

- Its `CHAR_DATA` is a stripped subset of v2's: names and lore only, no stats, appearance, personality, bonuses, or abilities.

### Name collision hazard (critical for merging)

All three files independently define `S`, `callGroq`, `addEntry`, `setThinking`, `launchGame`, `sendNote`, `receiveNote`, `GROQ_URL`, `GROQ_MODEL`. Two of the three also define `G` and `CHAR_DATA`. Every one of them has a different shape or signature.

The worst of it:

- `addEntry` has three different argument orders. `(target, text, type)` in v2, `(tag, text, type)` in Lockdown, `(text, type, tag)` in 15 Questions.
- `callGroq(system, userMsg)` in v2 and Lockdown, `callGroq(prompt)` in 15 Questions.
- `S` has a different key set in all three.

Concatenating these files means the last definition silently wins. Merging requires namespacing or renaming, not just moving code.

## Locked canon (do not alter)

- The veil is a living primordial organism, not a wall. Veils exist interconnected like mycelium across universes.

- This veil is a failed veil-chimera, the product of experiments by an Earth organization that fronts for a cosmic entity. The entity cannot act directly; it works through networks, data, and institutions.

- The mural commission was pure coincidence (PR move, building sits over a rupture point). The player connection was a misdial. No destiny, no plan, both players are wildcards.

- The Opening scene is locked exactly as written in the passoff. The fantasy player receives the mural photo heavily corrupted and cannot see the mural. Every veil slip drains the fantasy player's energy, cumulatively and physically.

- The camera sees through the veil in a way the naked eye cannot.

- Communication with the veil is fragmentary, overwhelming, and alien. It feels like standing inside a thunderstorm that is also a library that is also a scream.

Added from the vault (`saintalia_7.md`, supplied by Maridizzle):

- **The entity is not malevolent. It is compulsive, an addict.** It bleeds through every available surface without meaning to. This governs tone everywhere: each stage of the mural, each horror, should read as beautiful and wrong at once, never purely sinister.

- The harvest mechanic: fusing two living veils into a chimera makes them die together, which releases harvestable cosmic energy. The entity collects it and forges a new universe. It is addicted to that process.

- The organization is a eugenics research company. Its stated mission, to isolate the biological mechanisms of life and develop a healthy human genome, is genuine. The humans inside do not know they are being used. They did not discover the crossover point; they were placed above it. **Its name is still not established.**

- Sasha was hired through legitimate channels with no connection to the research divisions. The location came first, not the artist.

- The base mural commission is a jungle scene: waterfall, cave, animals, pond. Commissioned as PR to project life, abundance, harmlessness.

- Five-act layer structure, silent cumulative scoring, no announced weight. Early choices carry equal potential consequence to late ones. Origin, Layer 1 survival and first trust, Layer 2 cosmic scale and melding begins, Layer 3 melding accelerates and the entity notices, Layer 4 cascade and resolution.

- Both players meld as a result of the accidental contact. Not chosen, not special. The entity notices them the way a scientist notices contamination: cold, impersonal, maintenance-minded. The conflict is butterfly effects, not combat.

- The five wrong objects and their point mapping are locked: key made of teeth = 1, water bottle that pours nothing = 2, compass whose needle points inward = 3, clock with no hands but too many faces = 4, photograph where every subject has their back turned = 5.

## Established beyond the Opening (from later sessions; confirm with Maridizzle before building on)

### Beats that exist as working code in this repo

- **The Lockdown.** Artist sealed in the mural building. Nine rooms, five wrong objects, P2 guiding by compass from a pressure-point grid. Five flash transmissions fire on contact: Cellular Fusion, The Neural Network, The Book, The Flythrough, The Harvest. Full prose for all five is in the file.

- **The 15 Questions (Beat 2-B).** 15 questions in the pool, 10 main questions asked per playthrough, alternating asker, 10 named tangents. Tangent names: Broken Epistemology A and B, Conditional Survival A and B, Grief Topology A and B, Self as Threat A and B, Systemic Rot, The Connection Itself.

- Beat 2-A is **The Dream**, per the vault. Not built. See the beat spine table below.

- The Tyvian and Sasha coupling in the tangent text is decided: they are templates, character creation stays, and genericizing the guardrails is Maridizzle's rewrite. See "Protagonists: decided" below.

### The beat spine, from the vault

Established in `saintalia_7.md`. Code column says what exists in this repo.

| Layer | Beat | Code |
|---|---|---|
| Origin | The Opening | built (v2) |
| 1 | The Lockdown | built (sandbox) |
| 1 | The Escape | folded into the Lockdown's completion message |
| 1 | The Sky Tears | not built |
| 2 | The Dream (beat 2-A) | not built, **to be built for real** (PLAN.md Phase 7) |
| 2 | The 15 Questions (beat 2-B) | built (sandbox) |
| 2 | The Branching Confessions | not built, not specified |
| 2 | The Soul Tagging | not built, fully specified |
| 2 | Four fusion outcomes | not built, fully specified |
| 3 | The Tavern | not built, not established |
| 4 | Cascade | not built |
| end | Six endings | not built, all fully specified |

**The three built scenes are not adjacent.** The Escape, The Sky Tears and The Dream sit between the Lockdown and the 15 Questions.

**Maridizzle's decision on that gap:** bridge The Escape and The Sky Tears, which are genuinely transitional. **Build The Dream for real.** It is a full puzzle scene roughly the size of the Lockdown and it carries the central revelation of Layer 2. Bridging it would have the 15 Questions interrogate both players about a veil they were never properly shown.

**The Dream reuses the same five objects** with a different mechanic (the artist describes, P2 guides placement on a wall) and a different flash sequence that always fires in a fixed order regardless of placement order: seed of life inside a glowing seed, flower of life expanding, tree of life forming, the tree exploding into a geometric network, a dark cloaked figure entering the network and poisoning it.

Three things in the vault's Dream spec are unresolved and Claude will not guess them. See PLAN.md Phase 7.
- The object-to-flash mapping (key = 1, bottle = 2, and so on) contradicts "flashes always fire in sequence order regardless of placement order."
- Nothing states what makes a placement "correct," or what a wrong one does.
- The five flashes are one-line concepts, not written prose like the Lockdown's five.

### Scoring

Four variables: `veilDeath`, `hopelessness`, `veilKnowledge`, `voidCorruption`. Currently JSONB in the mindmap's Railway Postgres, absent from all three HTML files.

All six ending formulas are established:

| Ending | veilDeath | hopelessness | veilKnowledge | voidCorruption |
|---|---|---|---|---|
| The Conscription | medium | low | high | low |
| The Unmaking | high | high | low | high |
| The Obliteration | low | low | high | low |
| The Corruption | medium | medium | high | medium |
| The Implosion | high | high | high | low |
| The Succession | high | low | low | high |

Six endings, no clean wins. The Conscription is the closest thing to a win.

### Protagonists: decided

Tyvian (fantasy) and Sasha (reality) are written throughout the vault as THE protagonists. **Maridizzle's decision: they are templates, and character creation stays.** Players build their own character.

Consequence: the ten tangent guardrails in The 15 Questions are written as Sasha's and Tyvian's specific biographies (a custody arrangement, a shed creature, a named scroll). Those need genericizing into shapes rather than specifics so they fit any character. **That rewrite is Maridizzle's, not Claude's.** Build every tangent as data the engine reads so the text can be swapped without touching code.

### Not yet established, still

- The organization's name. The cosmic entity's name.
- The Branching Confessions in any detail.
- The Traveling Scholar's name (Layer 2 NPC, otherwise specified, with variable impacts: Veil Knowledge +4 if P2 shares, Hopelessness +3 if not, Void Corruption +2 if P2 withholds and enters fusion alone).
- Layer 3 beyond "The Tavern" as a title. Layer 4 in any detail.
- Where the Soul Tagging tattoo appears on each body, and whether it plays a functional role later.
- Trigger points for mural stages mL2 through mL5.

## Not established. Never invent these.

- The organization's name. The cosmic entity's name or endgame.

- The full set of story beats and NPCs. Any NPC name, description, or role.

- Checkpoint or NPC illustration descriptions.

- The mural's building or city. What the mural was originally commissioned to depict.

- Saintalia's political structure or pre-veil history.

- The endings' content.

When a slot needs filling to make code run, use an obviously fake token and flag it in the session summary.

## Aesthetic direction

Dark backgrounds. Purples, magentas, teals, deep blues, gold and blood-red accents, cosmic nebula energy. Bold, decorative, high contrast, animated. It should feel like a game with buttons and visual feedback, not a chat window. Horror-fantasy, literary prose, dark fairy tale. The horror is already happening.

## Files to ignore

- `saintalia_world_bible.pdf` was generated without permission and contains invented content. Do not reference it.
