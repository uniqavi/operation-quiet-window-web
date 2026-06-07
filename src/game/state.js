import { PH, PLAYER, CAMERA, AGENTS } from '../config.js';
import {
  createInitialRecSlots,
  createInitialCommentSlots,
  createLayout,
  createDocs,
  createCookieJar,
  createPropaganda,
  createTruth,
  createLooseCookies,
  createScanFragments,
} from './layout.js';

// Initial agent data. Each agent's update logic will live in src/game/agents/<name>.js
// (Phase 4); the data structures live here so resetState() can return them all to idle.
function createAgents(recSlots, commentSlots) {
  const chasingRecs = AGENTS.chasingRecs.instances.map(({ recIdx }) => {
    const slot = recSlots[recIdx];
    return {
      recIdx,
      state: 'idle',
      x: slot.x, y: slot.y, w: slot.w, h: slot.h,
      vx: 0, vy: 0,
      triggerR: AGENTS.chasingRecs.triggerR,
      life: 0,
    };
  });

  const fallingComment = {
    commentIdx: AGENTS.fallingComment.commentIdx,
    state: 'idle',
    t: 0,
    x: 0,
    y: 0,
  };
  if (commentSlots.length > fallingComment.commentIdx) {
    const fcSlot = commentSlots[fallingComment.commentIdx];
    fallingComment.x = fcSlot.x;
    fallingComment.y = fcSlot.y;
  }

  return {
    chasingRecs,
    shootingSearch: {
      state: 'idle',
      cooldown: 0,
      charge: 0,
      shotsLeft: 0,
      triggerR: AGENTS.shootingSearch.triggerR,
    },
    fallingComment,
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
      baseY: AGENTS.gunShooter.baseY,
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
  const state = {
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
    // First-time intel reveal: when the player drags the propaganda off the
    // CLASSIFIED memo, an in-game dialog plays once and pauses gameplay.
    intelRevealed: false,
    intelDialog: null,   // { idx, charT, typing } when active
    truthExposedT: 0,    // seconds of continuous uncovered truth (debounce trigger)
    gunGraceUntil: 6,    // gun shooter doesn't fire before this game-time (set per difficulty in GameScene)
    tipShowing: false,   // true while an onboarding tip modal is on-screen (pauses game)
    
    // Dynamic slots for infinite scroller
    recSlots: createInitialRecSlots(),
    commentSlots: createInitialCommentSlots(),
    
    // Track how far we've generated
    generatedY: 1100,

    layout: createLayout(),
    docs: createDocs(),
    cookieJar: createCookieJar(),
    propaganda: [], // Spawned at the end
    truth: [],      // Spawned at the end
    looseCookies: createLooseCookies(),
    scanFragments: createScanFragments(),
  };
  state.agents = createAgents(state.recSlots, state.commentSlots);
  return state;
}

// Reset in place — preserves outer references to state.layout, state.agents, etc.
export function resetState(state) {
  const p = state.player;
  p.x = PLAYER.startX; p.y = PLAYER.startY; p.size = PLAYER.startSize;
  p.invuln = 0; p.hitFlash = 0; p.growT = 0;

  state.docs = createDocs();
  state.looseCookies = createLooseCookies();
  state.recSlots = createInitialRecSlots();
  state.commentSlots = createInitialCommentSlots();
  state.generatedY = 1100;
  state.propaganda = [];
  state.truth = [];

  state.cookieJar.taken = false;
  state.cookieJar.takeT = 0;
  state.cookieCollected = false;

  state.cursor = null;
  state.gaze = 0;
  state.docsCollected = 0;
  state.lostReason = '';
  state.time = 0;

  state.cam.zoom = state.cam.baseZoom;
  state.cam.targetZoom = state.cam.baseZoom;

  state.sparks = [];
  state.crumbs = [];
  state.projectiles = [];
  state.bullets = [];
  state.debris = [];

  state.stats.damageTaken = 0;
  state.stats.hitsReceived = 0;
  state.stats.gazeMaxed = false;
  state.stats.endedAt = 0;

  state.intelRevealed = false;
  state.intelDialog = null;
  state.truthExposedT = 0;
  state.tipShowing = false;

  // X-ray scan fragments back to un-revealed (clear coverage bitmaps too)
  state.scanFragments.forEach(f => {
    f._cov = null; f._covCount = 0; f._covSpan = 0;
    f.coverW = null; f.coverX = null;
    f.progress = 0; f.scanned = false;
  });

  // Agents back to idle
  state.agents.chasingRecs.forEach((a) => {
    a.state = 'idle';
    a.t = 0;
    const slot = state.recSlots[a.recIdx];
    if (slot) {
      a.x = slot.x + slot.w / 2;
      a.y = slot.y + slot.h / 2;
    }
  });

  const fc = state.agents.fallingComment;
  fc.state = 'idle';
  fc.t = 0;
  const fcSlot = state.commentSlots[fc.commentIdx];
  if (fcSlot) {
    fc.x = fcSlot.x;
    fc.y = fcSlot.y;
  }

  const ss = state.agents.shootingSearch;
  ss.state = 'idle';
  ss.t = 0;

  const el = state.agents.explodingLike;
  el.state = 'idle';
  el.t = 0;

  const cc = state.agents.crushingCookie;
  cc.state = 'idle';
  cc.t = 0;

  const gs = state.agents.gunShooter;
  gs.state = 'idle';
  gs.t = 0;
  gs.angle = AGENTS.gunShooter.initialAngle;
  gs.armLength = 0;
  gs.awakenT = 0; gs.aimT = 0; gs.spentT = 0;
  gs.currentAngle = AGENTS.gunShooter.initialAngle;

  state.status = 'playing';
}
