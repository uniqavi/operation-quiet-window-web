import GameScene from './src/scenes/GameScene.js';
import { createState, resetState } from './src/game/state.js';
import { PH, PW } from './src/config.js';

try {
  const scene = new GameScene();
  scene.diffMod = { triggerRange: 1, gunGrace: 6 };
  scene.state = createState();
  resetState(scene.state);
  scene.state.status = 'playing';
  
  scene.ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 0, globalAlpha: 1,
    fillRect: () => {}, strokeRect: () => {}, save: () => {}, restore: () => {},
    scale: () => {}, translate: () => {}, rotate: () => {},
    beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {},
    arc: () => {}, fillText: () => {}, measureText: () => ({ width: 10 }),
    setLineDash: () => {},
  };
  scene.canvas = { width: 960, height: 600, parentElement: { clientWidth: 960, clientHeight: 600 } };
  scene.VW = 960; scene.VH = 600;
  
  console.log("Running update...");
  scene.runGameLogic(0.016);
  console.log("Update success!");
  
  console.log("Running render...");
  scene.render();
  console.log("Render success!");

} catch (e) {
  console.error("ERROR:", e);
}
