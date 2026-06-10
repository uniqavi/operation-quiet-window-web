import { createState, resetState } from './src/game/state.js';
import { updateAll as updateChasingRecs } from './src/game/agents/chasingRecs.js';
import { update as updateFallingComment } from './src/game/agents/fallingComment.js';
import { update as updateShootingSearch } from './src/game/agents/shootingSearch.js';
import { update as updateGunShooter } from './src/game/agents/gunShooter.js';

try {
  const state = createState();
  resetState(state);
  console.log("State created and reset successfully.");
  
  // mock player and layout
  state.player = { x: 100, y: 100, size: 75, vx: 0, vy: 0 };
  state.cam = { x: 0, y: 0, zoom: 1 };
  
  console.log("Testing agents...");
  updateChasingRecs(state.agents.chasingRecs, 0.016, state);
  updateFallingComment(state.agents.fallingComment, 0.016, state);
  updateShootingSearch(state.agents.shootingSearch, 0.016, state);
  updateGunShooter(state.agents.gunShooter, 0.016, state);
  console.log("Agents updated successfully.");
  
  console.log("SUCCESS");
} catch (e) {
  console.error("ERROR:", e);
}
