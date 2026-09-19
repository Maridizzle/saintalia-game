// ============================================================
// SAINTALIA -- SCENE: THE OPENING
// Author: Maridizzle
//
// This is an ADAPTER, not a rewrite. The Opening's implementation still lives
// in js/game.js exactly as it was split out of saintalia-v2.html: the three
// column layout, the mural, the holo terminal, the phone, the turn loop.
//
// That is deliberate. Wrapping it proves the scene engine against real
// working code without moving 645 lines around first. If the Opening behaves
// differently after this, the engine is wrong, and that is a much easier
// thing to debug than "somewhere in a large file move."
//
// Physically relocating the Opening's guts into this file is optional
// tidying, not a prerequisite for anything.
// ============================================================

const SceneOpening = {
  id: 'opening',
  title: 'The Opening',

  // Held so unmount can cancel it. An opening scene that fires its narration
  // after the player has already moved on is exactly the kind of ghost the
  // scene engine exists to prevent.
  _openingTimer: null,

  mount(root, ctx) {
    setScreen('game');

    if (ctx.restoring) {
      restoreOpening(root);
      return;
    }

    buildGameScreen(root);

    // Same 600ms beat as the original, which gives the layout a moment to
    // settle before the narration lands.
    this._openingTimer = setTimeout(() => {
      this._openingTimer = null;
      beginOpeningScene();
    }, 600);
  },

  unmount() {
    if (this._openingTimer) {
      clearTimeout(this._openingTimer);
      this._openingTimer = null;
    }
    // Everything else the Opening owns is inline onclick handlers inside its
    // own markup, so it dies with the DOM. Nothing else to release.
  },

  // The Opening has no end condition yet. The vault says the building seals
  // the moment the connection is established, so this will eventually return
  // true after the opening beat resolves. Wiring that is PLAN.md Phase 8.
  isComplete() {
    return false;
  },

  snapshot() {
    return { id: 'opening' };
  },

  exportState() {
    return {
      turn: G.turn,
      veilStrength: G.veilStrength,
      energy: G.energy,
      muralLayer: G.muralLayer,
      notes: G.notes
    };
  }
};

registerScene(SceneOpening);
