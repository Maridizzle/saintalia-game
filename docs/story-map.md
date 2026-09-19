# Saintalia story map, working record

Signed: Maridizzle

## What this is

The mindmap on Railway is the source of truth for story content. This file is the working record of the 2026-09-19 design session on Layers 3 and 4, kept in the repo so a future session can pick up without the database export.

Provenance: the live mindmap exports of 2026-09-18 (38 story nodes, 6 mechanic nodes) and 2026-09-19 (42 story nodes, 6 mechanic nodes), plus the decisions below. Reconciled to the 2026-09-19 export. The mindmap may have moved since. When they disagree, the mindmap wins.

Legend used throughout:

- **DECIDED** means Maridizzle said it. Canon.
- **PROPOSED** means Claude suggested it and Maridizzle has not contested it. Not canon until she says so.
- **OPEN** means nobody has answered it. Groq will invent it at runtime if it stays open.
- `LIKE_THIS` is a TBD token. Never a real-sounding placeholder.

## Why this file exists at all

The mindmap's Download .md button walks story nodes only. It never prints the mechanics tree or any node's per-beat variable impacts. The vault in this repo (`docs/saintalia-vault.md`) is that export, so it is missing the entire scoring system. This file carries what the export drops.

## The scoring system, as it stands in the mindmap

All four variables run 0 to 100. Starting values: Veil Death 15, Hopelessness 0, Veil Knowledge 0, Void Corruption 0.

Increment tiers: small 3 to 5 (passive choices, observation, notes passed), medium 8 to 12 (active choices with clear consequence, locks cleared), large 18 to 25 (major beat resolutions, sacrifice, direct veil contact).

Veil Death Clock: increments only on beats marked inevitable, regardless of choice. Reckless veil contact may add a small increment on top. High Veil Knowledge slows the inevitable increments but cannot stop them.

Every beat carries four impact lines, each flagged `[inevitable]` or `[variable]`.

### Ending thresholds

| Ending | Veil Death | Hopelessness | Veil Knowledge | Void Corruption |
|---|---|---|---|---|
| Obliteration | 0 to 35 | 0 to 30 | 60 to 100 | 0 to 25 |
| Conscription | 35 to 60 | 0 to 35 | 55 to 100 | 0 to 30 |
| Corruption | 35 to 65 | 30 to 60 | 50 to 100 | 25 to 55 |
| Implosion | 65 to 100 | 60 to 100 | 55 to 100 | 0 to 35 |
| Succession | 65 to 100 | 0 to 40 | 0 to 45 | 60 to 100 |
| Unmaking | 65 to 100 | 60 to 100 | 0 to 45 | 60 to 100 |

Verified: the six one-line Formula nodes (high, medium, low) agree with these numbers on all 24 values.

### Impacts already assigned (8 of 38 nodes)

```
L1  The Lockdown (fantasy)    hopelessness +5 [inevitable]
L1  The Lockdown (reality)    hopelessness +5 [inevitable]
L1  The Escape                hopelessness +3, veilKnowledge +8   [type unset]
L1  Puzzle -- Escape          hopelessness +3 [variable], veilKnowledge +8 [inevitable]
L2  Fusion: Both Share        death +8, hope +2, know +5, corr 0     [inevitable]
L2  Fusion: Neither Shares    death +2, hope +8, know +5, corr +5    [inevitable]
L2  Fusion: Only Artist       death +5, hope +4, know +5, corr +2    [inevitable]
L2  Fusion: Only P2           death +5, hope +4, know +5, corr +2    [type unset]
```

Also assigned in prose on the Traveling Scholar: Veil Knowledge +4 if P2 shares, Hopelessness +3 if not, Void Corruption +2 if P2 withholds and enters fusion alone.

### Findings from checking the math

1. **The Lockdown is scored twice.** The fantasy and reality Lockdown nodes both carry hopelessness +5 inevitable for the same beat. **OPEN:** does the beat add 5 or 10.

2. **The thresholds do not tile the space.** There are score combinations that satisfy no ending (example: death 50, hopelessness 50, knowledge 30, corruption 10 fires nothing). There are also boundary combinations that satisfy two or three, because ranges share endpoints inclusively: Obliteration and Conscription at death 35; Conscription and Corruption at death 35 to 60 with hopelessness 30 to 35; Corruption and Implosion at death 65. Not urgent while nothing can reach those numbers. Needs a nearest-match rule or a default ending before Layer 4 ships.

3. **Ceiling after Layer 2**, taking the best case for each variable: death 23, hopelessness 24, knowledge 21, corruption 5. Every ending needs knowledge 50 or more, or death 65 or more. Layers 3 and 4 carry the rest.

| Variable | Needed by | Gap Layers 3 and 4 must carry |
|---|---|---|
| knowledge | 4 endings at 50 to 60 | +30 to +40 |
| death | 3 endings at 65 | +42, inevitable, slowed by knowledge |
| hopelessness | 2 endings at 60 | +36 |
| corruption | 2 endings at 60 | +55, from almost nothing |

Six large beats (below) put 108 to 150 points across four variables, which covers every gap. Hub visits are texture, not load-bearing.

4. **The Structural Spine node is stale.** It still says variables are "pending step 2" and names a different candidate set, and that routing is "not yet mapped." The mechanics tree settled both. Left alone it will mislead the next reader.

## What Layer 3 inherits (from established canon)

- Both players carry the knotwork mark. The Soul Tagging says it is "what makes both players targets of the entity's agents starting in Layer 3."
- The entity cannot act directly. It works through networks, data, institutions.
- Knowledge is in one of four fusion states. Layer 3 plays under all four.
- The spine's job for Layer 3: melding accelerates, entity notices the anomaly, begins isolating. Named responses: lean in, resist, understand, sever.
- The Sky Tears is ongoing. The Scholar's survival into Layer 3 is open.

## What Layer 4 must be able to deliver (derived from the six endings)

| Ending | Layer 4 must contain |
|---|---|
| Conscription | a rupture moment with both players physically inside the veil |
| Unmaking | the harvest completing with the players present and not enough |
| Obliteration | discovery of a ritual, plus a last bloodline member for each player |
| Corruption | a way to capture the corruption, a capsule, a burial |
| Implosion | "the wrong thing" that the something-above notices |
| Succession | the entity's pivot to life itself, visible before the window closes |

## Decisions, 2026-09-19

### Q1. Agents of the entity. DECIDED

**Reality side.** Org staff doing their real jobs, sincerely. Procedure is the isolation. (PROPOSED wording; the mechanism follows directly from canon.)

**Saintalia side.** An alchemy guild. In the mindmap as `node-z02ym2`, created by Maridizzle 2026-09-19, linked to The Organization, The Entity, and The Obliteration. Text as she entered it:

```
mindmap id: node-z02ym2        layer: 0        side: fantasy        type: pending
label: The Alchemy Guild        sublabel: Name not yet established

An alchemy guild in Saintalia conducting dark rituals, seeking the
philosopher's stone and other forbidden arts. Mirror of The Organization
on the reality side. Agent of the entity, Saintalia side.

The guild does NOT know it serves the entity. A fanatical faction within
it has assigned a persona to an entity of their own invention. It so
happens a real one exists. The real entity never confirms, answers, or
acknowledges them.

The philosopher's stone is a possible avenue for harvest.

The Obliteration ritual (bloodline sacrifice) is a guild ritual. Layer 4
sources it here.

Name: GUILD_NAME_TBD
Fanatics' invented persona: FANATIC_PERSONA_TBD
  (NOT the entity's name; the entity's name stays unestablished)
```

Narrator guardrails: the entity never speaks to the fanatics. The fanatics are wrong about what they worship and right that something is there. The rest of the guild finds the fanatics an embarrassment.

### Q2. The Tavern. DECIDED in chat: a hub with social influence choices

Decided in chat, 2026-09-19: a place P2 returns to across Layer 3, each visit offering social influence choices; the Traveling Scholar shelters here with the records; each visit fewer people sit near P2 and the room empties around the mark, never explained by any character; the tavern never becomes a fight.

What is on the mindmap node as of the 2026-09-19 export (`node-dqge1s`, sublabel "Not yet established"):

```
Host location for The Tavern -- Encounter 1 (fantasy L3). The fanatical
faction of the alchemy guild is present here and sees P2's mark.
```

The hub text, the emptying room, and the Scholar were not on the node. DECIDED (S5): omission, not reversal. The text is to be added to the node by Maridizzle's hand. The chat decision stands.

On this node:
- **2a. ANSWERED 2026-09-19.** The fanatical faction is in the room and sees the mark.
- **2b.** What influence buys. DECIDED that the three stakes below each become a beat. The exact options under each are PROPOSED.
- **2c.** Which fantasy stat gates social influence. Veilsight, Ferocity, Cunning, Anchor, Resonance, or Shadow.

The node has three images with blank prompts. Not examined.

### The beat skeleton for Layers 3 and 4. Structure DECIDED, mapping PROPOSED

DECIDED: three beats per side, mirrored, one big eventful beat opening Layer 3, one near the middle, one in Layer 4. All three large tier.

PROPOSED mapping of the three Tavern stakes to the three slots:

| Slot | Fantasy (P2) | Reality (artist, mirror) | Tier |
|---|---|---|---|
| L3 open | `l3-fa` the fanatics' attention | `l3-ra` the org's attention | large |
| L3 middle | `l3-fb` the Scholar's records | `l3-rb` the artist's evidence, `EVIDENCE_TBD` | large |
| L4 open | `l4-fa` the room itself, isolation completes | `l4-ra` her world empties the same way | large |

PROPOSED rule for all six: every beat pair is defined by what crosses the veil, not by parallel choices. A mirror is two people alone; cooperation needs one player holding what the other one needs.

### Beat pair 1. In the mindmap. Fantasy numbers DECIDED

Maridizzle entered this pair on 2026-09-19. The fantasy beat was entered twice. DECIDED: `node-vu100s` "The Tavern -- Encounter 1" is the beat; it keeps the numbers and takes the links to the Tavern and the guild. `node-gzei1i` is retitled "empty" by Maridizzle's hand and kept. The reality beat is `node-91xdwc` "The Org - First Encounter".

```
mindmap id: node-vu100s
layer: 3        side: fantasy        tier: large
label: BEAT_NAME_TBD        sublabel: The fanatics' attention

Trigger: In the Tavern. The guild's fanatical faction sees the mark.
What they think it means: FANATIC_READING_TBD
Choices (social influence, wording PROPOSED):
  Court it        lean in. Let them believe what they believe.
  Deflect it      resist. Refuse the reading, refuse the room.
  Feed it false   give them a wrong reading of the mark on purpose.
Permanently true after: The guild knows P2 exists and is marked. The
  fanatics have a story about P2. Attention has landed and does not lift,
  whichever choice was made.
Cost: COST_TBD
Opens but does not close: What the fanatics do with their reading.
  Whether the mainstream guild hears of it.
Impacts by choice, DECIDED 2026-09-19 (large tier, each totals 22 or 23):
  Court it        death +2   hope +2    know +2    corruption +16
  Deflect it      death +3   hope +14   know +2    corruption +3
  Feed it false   death +2   hope +2    know +16   corruption +3
  Knowledge on Feed it false is reactive: P2 learns because the fanatics
  expose themselves in their response to the false reading.
```

DECIDED (S6): impacts are per choice, and the numbers stand as written. The mindmap's `mech-variable-impact` format is one line per variable per node, so the numbers live in the notes text. The engine reads impacts per choice. That is a requirement on the scoring build, not a thing to fix in the mindmap.

```
mindmap id: node-91xdwc        layer: 3        side: reality        tier: large
label: BEAT_NAME_TBD        sublabel: The org's attention

Trigger: Procedure engages. ORG_NOTICE_TBD (a person sees the tattoo,
  or a data signal: badge logs, the mural photos, a screening).
Choices (mirror, in the org's language):
  Comply          lean in. Answer every question. Sign.
  Evade           resist. Miss the appointment. Go quiet.
  Feed it false   answer wrong on purpose.
Permanently true after: There is a file on her. Nobody is cruel about it.
  The procedure does not disengage, ever.
Cost: COST_TBD
Opens but does not close: What the file is for. Who reads it.
Impacts by choice, DECIDED 2026-09-19, mirror of the fantasy beat:
  Comply          death +2   hope +2    know +2    corruption +16
  Evade           death +3   hope +14   know +2    corruption +3
  Feed it false   death +2   hope +2    know +16   corruption +3
```

Narrator guardrails, both sides: no character is hostile. The fanatics are sincere. The org staff are sincere. The threat is that sincere people are paying attention.

Maridizzle's reframe of the open question on this pair: the problem is not "what event" but "how do we make an event that puts the two players working together again instead of discussing what happened." The four cooperative shapes her built scenes already use: the mark as a shared channel; relay (Lockdown pattern); one event seen in two frames (Sky Tears pattern); simultaneous hidden choice (Soul Tagging pattern). Claude recommended the first plus the third. Unresolved, because the Channel (below) came first.

### The Channel. Idea DECIDED, three-stage shape PROPOSED

DECIDED: P2 currently reaches the artist through a fixed panel. Before the Tavern can be a hub, the fantasy side has to develop a way to take the artist with them. It is a building series, starting with a piece from the hologram display that lets them communicate telepathically.

What canon fixes about the current channel: a holographic terminal, a holographic display, and "the hologram screen" that P2 has on the tower in the Dream. No cave in the vault text. The cave is staging.

PROPOSED series, in the spine's "melding accelerates" order, external to internal:

```
Stage 1, Layer 3 opens.   A piece from the hologram display.
  P2 can leave the cave. Telepathic, but through veil-tech, so it is
  what canon says veil contact is: fragmentary, overwhelming, alien.
  Cost: energy drain, cumulative and physical (canon, the Opening).
  Artist's end: ARTIST_END_TBD

Stage 2, Layer 3 middle.  The mark takes over.
  The piece is no longer the medium, or is no longer available (the
  records beat can take it). Cleaner signal, higher cost. The tag is
  now the channel: what carries her is what the agents trace.

Stage 3, Layer 4 opens.   No medium.
  Melded enough to simply be together. The room is empty; they are not
  alone. The cost of the channel was everyone else. This is the "hold
  people or let them go" beat.
```

The rising cost curve is a candidate corruption engine (Q7).

Build note: the notes UI stays. What changes is what the fiction says it is. After Stage 2 the fantasy console becomes "what the mark shows," a reframe, not a rewrite.

OPEN on the Channel:
- **4a.** Three stages as above, or a different count or order.
- **4b.** What the artist does at her end to make Stage 1 work. Her mark, her phone, the mural. The telepathy needs two ends or it is not cooperative.
- **4c.** How clean it is and what crosses: words, images, feelings. And what leaks unbidden.

## Open questions, in the order they were being taken

Answered so far: 1, 1a, 1b, 1c, 2 (shape), skeleton structure, Channel (idea).

| # | Question | Status |
|---|---|---|
| 2a | Is the guild in the Tavern | ANSWERED 2026-09-19: the fanatical faction is present and sees the mark |
| 2b | Exact influence options per stake | PROPOSED, unconfirmed |
| 2c | Stat gating social influence | OPEN, can defer |
| 3a | The big eventful thing that opens Layer 3 | OPEN, reframed as a cooperation question |
| 3b | What the fanatics think the mark is | OPEN |
| 3c | How the org notices the artist | OPEN |
| 4a | Channel stage count and order | OPEN |
| 4b | The artist's end of Stage 1 | OPEN |
| 4c | Telepathy clarity, content, leakage | OPEN |
| 5 | Does the Scholar survive into Layer 3; are the records at risk | OPEN |
| 6 | Where the mark sits on each body; what it does in Layer 3 | OPEN (twice in the vault) |
| 7 | What raises Void Corruption | OPEN, candidates: guild rituals (1b), the Channel's cost curve |
| 8 | The Layer 4 rupture: where, and what puts both players inside the veil | OPEN |
| 9 | Bloodline: character creation builds no family | OPEN |
| 10 | The capsule and the capture mechanism | OPEN |
| 11 | Implosion vs Unmaking, player-facing difference | OPEN |
| 12 | Whether the Succession pivot is visible inside Layer 4 | OPEN |
| S1 | Does The Lockdown add hopelessness +5 or +10 | OPEN |
| S2 | Nearest-match rule or default ending for the dead zone | OPEN, not urgent |
| S3 | Do the org beat's numbers mirror the fantasy beat's | DECIDED: yes, same numbers |
| S4 | Two mindmap nodes for one beat | DECIDED: `node-vu100s` is the beat and takes the links; `node-gzei1i` retitled "empty", kept |
| S5 | Hub text missing from the Tavern node | DECIDED: omission; text to be added |
| S6 | Per-choice impacts vs per-node format | DECIDED: numbers stand; engine reads per choice |
| S7 | Does Tyvian get the same scrub as Sasha | DECIDED: yes. Tyvian reads as P2 |

## Genericizing the tangents, started

On 2026-09-19 Maridizzle added the same line to The 15 Questions node and the Tangents node: "SCRUB NOTE: Any reference to player name 'Sasha' in this node should read 'The Artist'." That is the first move on the rewrite CLAUDE.md records as hers.

DECIDED 2026-09-19: the same scrub applies to Tyvian, who reads as P2. So the rule for any node or data file is Sasha to The Artist, Tyvian to P2.

In this repo's `game/data/scenes/questions.js`, as of this writing: 2 occurrences of Sasha, 3 of Tyvian. None in the engine file. Not changed by Claude; that edit waits on a go. A name swap alone leaves the ten tangent biographies specific to two people. The genericizing into shapes is still Maridizzle's rewrite. The Opening's cross-reference to Layer 3 ("The fanatical faction first spots P2 in the Tavern") was also added that day.

## Mindmap hygiene, no action taken

- One beat, two nodes: `node-vu100s` and `node-gzei1i`. Settled under S4; the second is retitled "empty" by Maridizzle, not removed.
- All four fusion outcome nodes link to `l2-ra`, which does not exist. The Soul Tagging positions itself "immediately following The Branching Confessions," so that is probably the missing node.
- The Conscription node's notes have a scrambled first line and a stray sentence pasted mid-text. An AI narrator reading it later will trip on it.
- The Structural Spine node contradicts the mechanics tree (see scoring findings, item 4).

## TBD token index

`GUILD_NAME_TBD`, `FANATIC_PERSONA_TBD`, `FANATIC_READING_TBD`, `BEAT_NAME_TBD` (six beats), `COST_TBD`, `ORG_NOTICE_TBD`, `EVIDENCE_TBD`, `ARTIST_END_TBD`, `STAKES_TBD`, `PARTIES_TBD`, `STAT_TBD`.

Standing tokens from CLAUDE.md, still unfilled: the organization's name, the entity's name, the Traveling Scholar's name, The Branching Confessions in any detail, Layer 4 in any detail.
