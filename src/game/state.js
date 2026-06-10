import { PH, PLAYER, CAMERA, AGENTS } from '../config.js';
import {
  createLayout,
  createScanFragments,
} from './layout.js';

function createAgents() {
  return {
    chasingRecs: [], // dynamically populated
    shootingSearch: {
      state: 'idle',
      cooldown: 0,
      charge: 0,
      shotsLeft: 0,
      triggerR: AGENTS.shootingSearch.triggerR,
    },
    fallingComment: {
      state: 'idle',
      x: -1000, y: -1000, w: 580, h: 88,
      vy: 0,
      triggerR: AGENTS.fallingComment.triggerR,
      life: 0,
    },
    explodingLike: {
      state: 'idle',
      triggerR: AGENTS.explodingLike.triggerR,
      charge: 0,
    },
    crushingCookie: {
      state: 'idle',
      triggerR: AGENTS.crushingCookie.triggerR,
      vy: 0,
    },
    gunShooter: {
      state: 'idle',
      baseX: AGENTS.gunShooter.baseX,
      baseY: -1000,
      triggerR: AGENTS.gunShooter.triggerR,
      armLength: 0,
      currentAngle: AGENTS.gunShooter.initialAngle,
      awakenT: 0,
      aimT: 0,
      spentT: 0,
      rotateSpeed: AGENTS.gunShooter.rotateSpeed,
      awakenDuration: AGENTS.gunShooter.awakenDuration,
      aimDuration: AGENTS.gunShooter.aimDuration,
    },
  };
}

export function createState() {
  return {
    player: {
      x: PLAYER.startX, y: PLAYER.startY,
      size: PLAYER.startSize,
      invuln: 0, hitFlash: 0, growT: 0,
    },
    cam: {
      x: 0, y: 0,
      zoom: CAMERA.initialZoom,
      targetZoom: CAMERA.initialZoom,
      baseZoom: CAMERA.initialZoom,
      minZoom: 1.0,
      maxZoom: 4.0,
      initialized: false,
    },
    cursor: null,
    gaze: 0,
    docsCollected: 0,
    cookieCollected: false,
    status: 'menu',
    lostReason: '',
    keys: {},
    mouse: { x: 0, y: 0, sx: 0, sy: 0, down: false },
    time: 0,
    sparks: [],
    crumbs: [],
    projectiles: [],
    bullets: [],
    debris: [],
    stats: {
      damageTaken: 0,
      hitsReceived: 0,
      gazeMaxed: false,
      endedAt: 0,
    },
    intelRevealed: false,
    intelDialog: null,
    truthExposedT: 0,
    gunGraceUntil: 6,
    tipShowing: false,
    
    // Director / Spawner state
    spawner: {
      lastSpawnY: 600,
      docsSpawned: 0,
      exitSpawned: false,
      nextAgentType: 0,
    },
    
    // Dynamic Element Arrays
    dynamicComments: [],
    dynamicRecs: [],
    docs: [],
    propaganda: [],
    truth: [],
    looseCookies: [],
    
    // Static / Single
    cookieJar: { x: -1000, y: -1000, r: 24, taken: false, takeT: 0 }, 
    
    agents: createAgents(),
    layout: createLayout(),
    scanFragments: createScanFragments(),
  };
}

export function resetState(state) {
  const p = state.player;
  p.x = PLAYER.startX; p.y = PLAYER.startY; p.size = PLAYER.startSize;
  p.invuln = 0; p.hitFlash = 0; p.growT = 0;

  state.docsCollected = 0;
  state.cookieCollected = false;

  state.cursor = null;
  state.gaze = 0;
  state.lostReason = '';
  state.time = 0;

  state.cam.y = 0;
  state.cam.x = 0;
  state.cam.zoom = state.cam.baseZoom;
  state.cam.targetZoom = state.cam.baseZoom;

  state.projectiles.length = 0;
  state.bullets.length = 0;
  state.debris.length = 0;
  state.crumbs.length = 0;

  state.stats.damageTaken = 0;
  state.stats.hitsReceived = 0;
  state.stats.gazeMaxed = false;
  state.stats.endedAt = 0;

  state.intelRevealed = false;
  state.intelDialog = null;
  state.truthExposedT = 0;
  state.tipShowing = false;

  // X-ray scan fragments back to un-revealed
  state.scanFragments.forEach(f => {
    f._cov = null; f._covCount = 0; f._covSpan = 0;
    f.coverW = null; f.coverX = null;
    f.progress = 0; f.scanned = false;
  });

  // Dynamic Array Resets
  state.dynamicComments = [];
  state.dynamicRecs = [];
  state.docs = [];
  state.propaganda = [];
  state.truth = [];
  state.looseCookies = [];
  
  state.spawner.lastSpawnY = 600;
  state.spawner.docsSpawned = 0;
  state.spawner.exitSpawned = false;
  state.spawner.nextAgentType = 0;
  
  state.cookieJar = { x: -1000, y: -1000, r: 24, taken: false, takeT: 0 };

  // Agents back to idle
  state.agents.chasingRecs = [];
  
  const ss = state.agents.shootingSearch;
  ss.state = 'idle'; ss.cooldown = 0; ss.charge = 0; ss.shotsLeft = 0;

  const fc = state.agents.fallingComment;
  fc.state = 'idle'; fc.life = 0; fc.vy = 0;

  const el = state.agents.explodingLike;
  el.state = 'idle'; el.charge = 0;

  const cc = state.agents.crushingCookie;
  cc.state = 'idle'; cc.vy = 0;
  state.layout.cookie.y = PH - 40;
  state.layout.cookie.h = 40;

  const gs = state.agents.gunShooter;
  gs.state = 'idle';
  gs.armLength = 0;
  gs.awakenT = 0; gs.aimT = 0; gs.spentT = 0;
  gs.currentAngle = AGENTS.gunShooter.initialAngle;

  state.status = 'playing';
}
