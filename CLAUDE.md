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

## Repo layout (target state after Phase 1 of PLAN.md)

```
/                              repo root
  CLAUDE.md                    this file
  PLAN.md                      phased build plan with verification gates
  game/                        the playable game (served by GitHub Pages)
    index.html                 shell only: markup, font links, script tags
    css/game.css               all styles, including the ten-theme system
    js/connection.js           PeerJS layer (Chunk 1)
    js/character.js            character creation (Chunks 2 and 3)
    js/game.js                 game screen, turn loop, narrator (Chunk 4)
    js/narrator.js             Groq calls, prompts, offline fallback
    data/char-data.js          CHAR_DATA object (races, jobs, stats, appearance, personality)
    data/beats/                one JSON file per story beat / checkpoint
  puzzles/                     standalone puzzle sandboxes until merged (Phase 3)
  mindmap/                     radial mind-map tool (deploys from Railway, not Pages)
  docs/                        vault markdown, passoff PDF, design notes
```

Until Phase 1 is complete, the live game is the single file `saintalia-v2.html` (~2,637 lines, ~60 functions). Treat it as the source of truth for behavior.

## Architecture map (current single-file build)

### State objects

- `S` -- session and connection: `role`, `peer`, `conn`, `roomCode`, `groqKey`, `myCharacter`, `otherCharacter`, `charSelections`

- `G` -- game state: `turn`, `veilStrength`, `muralLayer`, `energy`, `notes`, `fantasyHistory`, `realityHistory`, `waitingForNarrator`, `fantasyChoices`, `realityChoices`

- `CHAR_DATA` -- all character creation data for both sides

### PeerJS

- Library: PeerJS 1.5.2 via unpkg CDN. Broker: `0.peerjs.com:443`. STUN: Google.

- Host peer ID is `saintalia-` + sanitized room code. Joiner connects to that ID directly.

- Room codes: one word from VEIL_WORDS_A + one from VEIL_WORDS_B (e.g. `ashveil-hollow`).

- Message types: `handshake`, `begin`, `character`, `note`, `narrator-update`, `mural-advance`, `veil-update`

- Known issue: `begin` currently sends the host's Groq key to the other player in plaintext. See PLAN.md Phase 2.

- Known issue: no reconnect logic. Join side has failed silently in a sandbox build. See PLAN.md Phase 2.

- Note: `S.conn.on('data', ...)` is registered three separate times (lobby, char screen, game screen). All three stay live. Untangle in Phase 1, do not paper over.

### Narration

- Groq endpoint `https://api.groq.com/openai/v1/chat/completions`, model `llama-3.3-70b-versatile`, free tier.

- `callGroq(system, userMsg)` falls back to `buildOfflineNarration(side)` when no key or on error.

- Narrator output ends with `CHOICES:{"choices":[...]}` which `parseChoices()` extracts and `addEntry()` strips from display.

- Known issue: narration generates separately per side. Target design is one call producing `FANTASY_NARRATIVE`, `FANTASY_CHOICES`, `REALITY_NARRATIVE`, `REALITY_CHOICES`, broadcast over PeerJS. See PLAN.md Phase 4.

### Key functions

`selectRole`, `initPeerWithCode`, `joinRoom`, `setupConnection`, `handleMessage`, `launchGame`, `buildCharScreen`, `initCharScreen`, `finalizeCharacter`, `checkBothReady`, `launchActualGame`, `buildGameScreen`, `setupGameMessageHandler`, `beginOpeningScene`, `veilBlink`, `showCorruptedImage`, `callGroq`, `parseChoices`, `makeChoice`, `submitCustom`, `sendNote`, `receiveNote`, `advanceMuralLayer`, `updateVeil`, `addEntry`, `setThinking`, `setChoicesEnabled`

### Mural

- Inline SVG, reality side only. Six hidden groups `mL0` through `mL5`, revealed by setting opacity to 1 with a CSS transition.

- Currently advances every 3 turns. Fantasy player never sees it. This is deliberate and must be maintained.

- Layer progression (established): mL0 fin and shadow in pond; mL1 animal with third leg; mL2 coiled presence in cave mouth with rendered eyes; mL3 burnt bare trees in lush canopy; mL4 sourceless shadow on sunset sky; mL5 jungle commission and Saintalia occupying the same ceiling at once. The current SVG paths in the file predate this progression; redrawing them is a content task for Maridizzle to direct.

### Fonts and palette

- Cinzel Decorative (titles), Cinzel (headers), Crimson Pro (body), all Google Fonts.

- Gold #c9a84c / #e8c96a. Blood #8b1a1a / #c0392b. Purple #2d1b4e / #1a0e2e. Mist #7a9ea8 / #a8c4cc. Bone #d4c5a9. Parchment #f5efe0.

- Ten-theme color system with localStorage persistence and a reduce-motion toggle exists in the latest build.

### Stats and jobs

- Fantasy stats: Veilsight, Ferocity, Cunning, Anchor, Resonance, Shadow.

- Reality stats: Perception, Composure, Intuition, Craft, Bleed, Tether.

- 12 starting points, race bonus, job bonus, max 5 per stat.

- Mirrored jobs: Warlord/Photographer, Hedge Witch/Therapist, Bonekeeper/Forensic Archivist, Wayfinder/Urban Explorer, Silvertongue/Journalist, Ruinwalker/Archaeologist.

## Locked canon (do not alter)

- The veil is a living primordial organism, not a wall. Veils exist interconnected like mycelium across universes.

- This veil is a failed veil-chimera, the product of experiments by an Earth organization that fronts for a cosmic entity. The entity cannot act directly; it works through networks, data, and institutions.

- The mural commission was pure coincidence (PR move, building sits over a rupture point). The player connection was a misdial. No destiny, no plan, both players are wildcards.

- The Opening scene is locked exactly as written in the passoff. The fantasy player receives the mural photo heavily corrupted and cannot see the mural. Every veil slip drains the fantasy player's energy, cumulatively and physically.

- The camera sees through the veil in a way the naked eye cannot.

- Communication with the veil is fragmentary, overwhelming, and alien.

## Established beyond the Opening (from later sessions; confirm with Maridizzle before building on)

- Layer 2 beats: The Branching Confessions (parallel NPC encounters, both NPCs unnamed) and The Soul Tagging (four-question honesty exchange, scored 2/1/0, threshold 5+, knotwork tattoo outcome).

- Six endings, no clean wins.

- Four scoring variables: `veilDeath`, `hopelessness`, `veilKnowledge`, `voidCorruption`, each `{value, type}`. Currently stored as JSONB in the mindmap's Railway Postgres, not in the game.

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
