// ============================================================
// SAINTALIA -- SCENE: THE COMING SOON GATE
// Author: Maridizzle
//
// The end of the run, for now. Same shape as a bridge, with no continue
// button, because there is nothing after it yet.
//
// Its copy is Maridizzle's and is null in data/scenes/bridges.js, so this
// renders COMING_SOON_TBD until she writes it. Claude does not draft the
// closing words of a playthrough.
//
// It also prints a short, factual summary of the run so a playtest ends with
// something concrete rather than a shrug: which scenes were played, how many
// notes crossed the veil, where the veil meter finished. That is telemetry,
// not story.
// ============================================================

const SceneComingSoon = {
  id: COMING_SOON_DEF.id,
  title: COMING_SOON_DEF.title,

  mount(root) {
    setScreen('game');
    root.className = 'bridge-wrap';

    // Facts about this playthrough. Nothing invented, nothing narrated.
    const stats = [
      ['Turns played', G.turn - 1],
      ['Notes through the veil', G.notes.length],
      ['Veil integrity', G.veilStrength + '% broken'],
      ['Mural layers revealed', G.muralLayer + ' of 5']
    ];
    if (typeof G.lockdownFound !== 'undefined') stats.push(['Lockdown objects found', G.lockdownFound + ' of 5']);
    if (typeof G.dreamPlaced !== 'undefined') stats.push(['Dream objects placed', G.dreamPlaced + ' of 5']);
    if (S.role === 'fantasy') stats.push(['Energy remaining', G.energy]);

    root.innerHTML = `
      <div class="bridge">
        <div class="bridge-layer">${COMING_SOON_DEF.layer}</div>
        <h2 class="bridge-title">${COMING_SOON_DEF.title}</h2>
        ${bridgeBodyHtml(COMING_SOON_DEF)}
        <div class="run-summary">
          <div class="run-summary-label">This run</div>
          ${stats.map(([k, v]) => `<div class="run-stat"><span>${k}</span><span>${v}</span></div>`).join('')}
        </div>
      </div>`;
  },

  unmount() {},
  isComplete() { return true; },
  exportState() {
    return { turns: G.turn - 1, notes: G.notes.length, veil: G.veilStrength };
  },
  snapshot() {
    return { id: COMING_SOON_DEF.id };
  }
};

registerScene(SceneComingSoon);
