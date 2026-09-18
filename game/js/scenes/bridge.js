// ============================================================
// SAINTALIA -- SCENE TYPE: BRIDGE
// Author: Maridizzle
//
// One scene shape, reused for every interstitial. Content comes from
// data/scenes/bridges.js and nothing here invents a word of it.
//
// A bridge with no text renders its TOKEN in a loud unfinished-looking panel.
// That is the point. An unwritten beat should be impossible to mistake for a
// written one, especially when you are tired and playing through at speed.
//
// Both players must press continue. The engine's requestAdvance handles the
// agreement; this just shows the waiting state so the person who pressed
// first knows the game has not hung.
// ============================================================

function bridgeBodyHtml(def) {
  if (def.text) {
    // Written. Render it as prose and say nothing about tokens.
    return '<div class="bridge-text">' + def.text + '</div>';
  }

  // Unwritten. Loud on purpose.
  return `
    <div class="bridge-tbd">
      <div class="bridge-tbd-token">${def.token}</div>
      <p class="bridge-tbd-note">This beat is not written yet.</p>
      <p class="bridge-tbd-vault">${def.vaultBeat}</p>
    </div>`;
}

// Called by the continue button. Disables itself and shows the waiting line,
// so pressing it twice cannot double-advance and the first player to press
// does not think the game froze.
function bridgeContinue(btn) {
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Waiting for the other side...';
  }
  const wait = document.getElementById('bridgeWait');
  if (wait) wait.style.display = 'block';
  requestAdvance();
}

function makeBridgeScene(def) {
  return {
    id: def.id,
    title: def.title,

    mount(root) {
      setScreen('game');
      root.className = 'bridge-wrap';
      root.innerHTML = `
        <div class="bridge">
          <div class="bridge-layer">${def.layer}</div>
          <h2 class="bridge-title">${def.title}</h2>
          ${bridgeBodyHtml(def)}
          ${def.continueLabel
            ? `<button class="btn-primary bridge-continue" onclick="bridgeContinue(this)">${def.continueLabel}</button>
               <div class="bridge-wait" id="bridgeWait" style="display:none">Both of you have to step through.</div>`
            : ''}
        </div>`;
    },

    // Nothing to tear down. No timers, no listeners outside the DOM.
    unmount() {},

    // A bridge is finished the moment it is on screen. The handoff is the
    // players' to trigger, not the scene's.
    isComplete() { return true; },

    exportState() { return { id: def.id, written: !!def.text }; }
  };
}

BRIDGE_DEFS.forEach(def => registerScene(makeBridgeScene(def)));
