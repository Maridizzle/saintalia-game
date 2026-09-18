// ============================================================
// SAINTALIA -- BRIDGES, content
// Author: Maridizzle
//
// A bridge is a short interstitial standing in for a real beat that is not
// built yet. It is NOT a fake beat and must never read like one.
//
// Every `text` below is null on purpose. A null bridge renders its TOKEN,
// large and ugly and obviously unfinished, so nothing unwritten can be
// mistaken for finished content. Fill a text in and the token disappears.
//
// CLAUDE WRITES NO BRIDGE TEXT. Not a draft, not a placeholder that sounds
// real, not "something to replace later." The `vaultBeat` line names which
// beat from the vault this stands in for, so whoever writes it knows what it
// has to carry. That is a signpost, not prose.
//
// Currently two bridges, covering the gap between the Lockdown and the 15
// Questions. The third gap, The Dream, is a full puzzle scene rather than a
// bridge and is built for real in PLAN.md Phase 7.
// ============================================================

const BRIDGE_DEFS = [
  {
    id: 'escape',
    token: 'BRIDGE_TBD_ESCAPE',
    layer: 'Layer 1',
    title: 'The Escape',
    vaultBeat: 'The Escape. All five pressure points touched, the building releases. Both players carry something out of it that they cannot yet read.',
    continueLabel: 'Step outside',
    text: null
  },
  {
    id: 'skytears',
    token: 'BRIDGE_TBD_SKYTEARS',
    layer: 'Layer 1, closing',
    title: 'The Sky Tears',
    vaultBeat: 'The Sky Tears. The first fully shared beat in the game. Both players look up at the same moment and see the same wrongness through different frames.',
    continueLabel: 'Look away',
    text: null
  }
];

// The end of what is built. Same shape, same rule: the copy is Maridizzle's.
const COMING_SOON_DEF = {
  id: 'coming-soon',
  token: 'COMING_SOON_TBD',
  layer: 'The end of what exists',
  title: 'Coming Soon',
  vaultBeat: 'The run stops here for now. Ahead in the vault: The Branching Confessions, The Soul Tagging, the four fusion outcomes, then Layers 3 and 4, then six endings.',
  continueLabel: null,
  text: null
};
