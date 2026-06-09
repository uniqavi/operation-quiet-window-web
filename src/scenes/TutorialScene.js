import Phaser from 'phaser';
import { PLAYER, CAMERA, SCAN } from '../config.js';
import { initAudio, beep, noise } from '../game/audio.js';
import { crossfadeTo } from '../game/music.js';
import { drawHandRect } from '../game/draw.js';
import { markScanCoverage } from '../game/scan.js';

const W = 960;
const H = 1720;

const TUT = {
  header:  { x: 0,   y: 0,   w: W,   h: 66 },
  logo:    { x: 22,  y: 20,  w: 130, h: 26 },
  nav:     [ { x: 320, y: 28, w: 64, h: 10 }, { x: 400, y: 28, w: 64, h: 10 }, { x: 480, y: 28, w: 64, h: 10 } ],
  search:  { x: 570, y: 18,  w: 250, h: 30 },
  account: { x: 894, y: 18,  w: 44,  h: 30 },
  hero:    { x: 40,  y: 96,  w: W - 80, h: 250 },   
  row1:    [ { x: 40, y: 390, w: 270, h: 200 }, { x: 345, y: 390, w: 270, h: 200 }, { x: 650, y: 390, w: 270, h: 200 } ],
  doc:     { x: 480, y: 490, r: 16, taken: false, takeT: 0 },
  row2:    [ { x: 40, y: 640, w: 270, h: 200 }, { x: 345, y: 640, w: 270, h: 200 }, { x: 650, y: 640, w: 270, h: 200 } ],
  gunAvatar: { x: W / 2, y: 1020, r: 30 },
  footer:  { x: 0, y: H - 70, w: W, h: 70 },
  infiltrate: { x: W / 2 - 160, y: H - 250, w: 320, h: 86 },
};

const STEP = { MOVE: 0, SCAN: 1, COLLECT: 2, CHASER: 3, GUN: 4, DONE: 5 };

export default class TutorialScene extends Phaser.Scene {
  constructor() { super('TutorialScene'); }

  create(data) {
    this.difficulty = data?.difficulty || localStorage.getItem('oqw-difficulty') || 'easy';

    this.canvas = document.getElementById('oqw');
    this.ctx = this.canvas.getContext('2d');
    this.handleResize = this.handleResize.bind(this);

    document.body.classList.remove('menu-mode');
    const urlBar = document.getElementById('browser-url');
    if (urlBar) urlBar.textContent = 'about:blank — totallynormaltube.gov.??/_dev/sandbox';

    crossfadeTo('level1', { fadeMs: 1200 });

    this.player = { x: W / 2, y: 130, size: PLAYER.startSize, invuln: 0, hitFlash: 0 };
    this.cam = { x: 0, y: 0, zoom: 1, baseZoom: 1 };
    this.time = 0;
    this.finished = false;
    this.step = STEP.MOVE;
    this.movedDistance = 0;

    const scanRect = { x: TUT.hero.x + 24, y: TUT.hero.y + 150, w: TUT.hero.w - 48, h: 56 };
    this.scanTarget = {
      rect: scanRect,
      hidden: 'HUSH TRAINING ENV — INFILTRATION KEY ACQUIRED',
      font: 'bold 16px ui-monospace, monospace',
      tx: scanRect.x + 12,
      progress: 0,
      scanned: false,
    };

    this.chaser = { ...TUT.row2[0], state: 'idle', vx: 0, vy: 0, taught: false, wakeT: 0 };
    this.gun = { x: TUT.gunAvatar.x, y: TUT.gunAvatar.y, r: TUT.gunAvatar.r,
                 state: 'idle', armLen: 0, angle: Math.PI / 2, aimT: 0, taught: false, wakeT: 0, firedT: -99 };
    this.bullets = [];
    this.sparks = [];
    this.spot = { active: false, x: 0, y: 0, enemy: null };
    this.atExit = false;
    this.doc = { ...TUT.doc };

    this._lastStep = -1;
    this.stepT = 0;
    this._escalated = false;
    this.introFade = 1;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W, left: Phaser.Input.Keyboard.KeyCodes.A,
      down: Phaser.Input.Keyboard.KeyCodes.S, right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    this.dlg = {
      wrap: document.getElementById('tutorial-dialog'),
      speaker: document.getElementById('tutorial-speaker'),
      line: document.getElementById('tutorial-line'),
      hint: document.getElementById('tutorial-hint'),
      skip: document.getElementById('tutorial-skip'),
    };
    this.typeTimer = null;

    this.onSkip = () => this.finishTutorial(true);
    this.dlg.skip?.addEventListener('click', this.onSkip);

    this.onPointer = () => {
      if (this.spot.active) this.endSpotlight();
      else if (this.atExit) this.finishTutorial(false);
    };
    this.input.on('pointerdown', this.onPointer);
    this.onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); this.finishTutorial(true); return; }
      if (this.spot.active && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); this.endSpotlight(); return; }
      if (this.atExit && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); this.finishTutorial(false); }
    };
    document.addEventListener('keydown', this.onKey);

    this.handleResize();
    window.addEventListener('resize', this.handleResize);

    initAudio();
    
    // 改为系统守护进程的测试初始化日志
    this.say('DAEMON', "[CALIBRATION INITIALIZED]: Environment isolated. Sandbox deployment complete. Execute movement matrix to test proxy container latency.", 'WASD to move');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('resize', this.handleResize);
      document.removeEventListener('keydown', this.onKey);
      this.input.off('pointerdown', this.onPointer);
      this.dlg.skip?.removeEventListener('click', this.onSkip);
      if (this.typeTimer) clearTimeout(this.typeTimer);
      this.dlg.wrap?.classList.add('hidden');
    });
  }

  say(speaker, text, hint = '') {
    if (!this.dlg.wrap) return;
    const name = (localStorage.getItem('oqw-node-id') || 'NODE-0x7F3A9');
    const resolved = text.replace(/\{name\}/g, name);
    this.dlg.wrap.classList.remove('hidden');
    if (this.dlg.speaker) this.dlg.speaker.textContent = speaker;
    if (this.dlg.line) this.dlg.line.textContent = '';
    if (this.dlg.hint) this.dlg.hint.textContent = '▸ ' + hint;
    if (this.typeTimer) clearTimeout(this.typeTimer);
    let i = 0;
    const tick = () => {
      if (i < resolved.length) {
        i++;
        if (this.dlg.line) this.dlg.line.textContent = resolved.slice(0, i);
        if (resolved[i - 1] !== ' ' && Math.random() < 0.2) beep(1800 + Math.random() * 400, 0.004, 'square', 0.008);
        this.typeTimer = setTimeout(tick, 20);
      }
    };
    tick();
  }

  handleResize() {
    const dpr = window.devicePixelRatio || 1;
    const wrap = this.canvas.parentElement;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.VW = w; this.VH = h;
    this.cam.baseZoom = w / W;
    if (!this.spot.active) this.cam.zoom = this.cam.baseZoom;
  }

  update(_time, deltaMs) {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.time += dt;
    if (this.introFade > 0) this.introFade = Math.max(0, this.introFade - dt * 1.4);
    if (this.player.invuln > 0) this.player.invuln -= dt;
    if (this.player.hitFlash > 0) this.player.hitFlash -= dt;

    if (this.spot.active) this.updateSpotlight(dt);
    else if (!this.finished) this.runLogic(dt);

    this.updateProjectiles(dt);
    this.render();
  }

  startSpotlight(x, y, speaker, text, enemy) {
    this.spot.active = true;
    this.spot.x = x; this.spot.y = y; this.spot.enemy = enemy;
    noise(0.2, 0.08);
    beep(140, 0.4, 'sawtooth', 0.06);
    this.say(speaker, text, 'click or SPACE to continue');
  }
  
  updateSpotlight(dt) {
    const c = this.cam;
    const zoom = c.baseZoom * 1.7;
    const viewW = this.VW / zoom, viewH = this.VH / zoom;
    const tx = Phaser.Math.Clamp(this.spot.x - viewW / 2, 0, Math.max(0, W - viewW));
    const ty = Phaser.Math.Clamp(this.spot.y - viewH / 2, 0, Math.max(0, H - viewH));
    c.zoom += (zoom - c.zoom) * Math.min(1, dt * 7);
    c.x += (tx - c.x) * Math.min(1, dt * 7);
    c.y += (ty - c.y) * Math.min(1, dt * 7);
  }
  
  endSpotlight() {
    this.spot.active = false;
    beep(660, 0.06, 'sine', 0.05);
    if (this.spot.enemy === 'chaser') {
      this.chaser.state = 'chase';
      this.say('DAEMON', "[EVASION REQUIRED]: Maintain negative vector. Anti-virus process speed limit restricted for calibration. Move away.", 'move away');
    } else if (this.spot.enemy === 'gun') {
      this.gun.state = 'aim'; this.gun.aimT = 0;
      this.say('DAEMON', "[THREAT ENGAGED]: Intercept active tracing laser. Advance directly into the firewall node core to break its angular tracking.", 'get past it');
    }
    this.spot.enemy = null;
  }

  runLogic(dt) {
    const p = this.player;
    const speed = PLAYER.baseSpeed * (1.5 - (p.size / 200) * 0.7);
    let vx = 0, vy = 0;
    if (this.wasd.left.isDown || this.cursors.left.isDown) vx -= 1;
    if (this.wasd.right.isDown || this.cursors.right.isDown) vx += 1;
    if (this.wasd.up.isDown || this.cursors.up.isDown) vy -= 1;
    if (this.wasd.down.isDown || this.cursors.down.isDown) vy += 1;
    if (vx || vy) { const l = Math.hypot(vx, vy); vx /= l; vy /= l; this.movedDistance += speed * dt; }
    p.x += vx * speed * dt; p.y += vy * speed * dt;
    p.x = Phaser.Math.Clamp(p.x, p.size / 2, W - p.size / 2);
    p.y = Phaser.Math.Clamp(p.y, p.size * 0.4, H - p.size * 0.4);

    const c = this.cam;
    c.zoom += (c.baseZoom - c.zoom) * Math.min(1, dt * 4);
    const viewW = this.VW / c.zoom, viewH = this.VH / c.zoom;
    c.x += ((W - viewW) / 2 - c.x) * Math.min(1, dt * 4);
    const ty = H > viewH ? Phaser.Math.Clamp(p.y - viewH / 2, 0, H - viewH) : (H - viewH) / 2;
    c.y += (ty - c.y) * Math.min(1, dt * 4);

    this.updateSteps(dt);
    this.updateEnemies(dt);
  }

  updateSteps(dt) {
    const p = this.player;
    const st = this.scanTarget;

    if (this.step !== this._lastStep) { this._lastStep = this.step; this.stepT = 0; this._escalated = false; }
    else { this.stepT += dt; }
    this.checkStuck();

    if (this.step === STEP.MOVE) {
      if (this.movedDistance > 160) {
        this.step = STEP.SCAN;
        this.say('DAEMON', "[DECRYPTION TEST]: The viewport acts as an X-ray filter. Position container bounds over the unstyled header placeholder to decode hidden metadata.", 'scan the banner');
      }
    } else if (this.step === STEP.SCAN) {
      if (!st.scanned && this.windowOverlaps(st.rect)) {
        const s = p.size, px = p.x - s / 2;
        const { frac, gained } = markScanCoverage(st, px, s, this.ctx);
        st.progress = frac;
        if (gained > 0 && Math.random() < 0.5) beep(1500 + Math.random() * 600, 0.004, 'square', 0.012);
        if (frac >= SCAN.coverThreshold) {
          st.scanned = true;
          beep(880, 0.08, 'sine', 0.1);
          this.say('DAEMON', "[DATA DECODED]: Hidden pipeline layers exposed. Proceed to sector 2 and collect the raw metadata hash file.", 'now grab the file');
          this.step = STEP.COLLECT;
        }
      }
    } else if (this.step === STEP.COLLECT) {
      const d = this.doc;
      if (!d.taken && Math.hypot(p.x - d.x, p.y - d.y) < d.r + p.size * 0.32) {
        d.taken = true; d.takeT = this.time;
        beep(880, 0.08, 'sine', 0.13); beep(1320, 0.12, 'sine', 0.1);
        this.say('DAEMON', "[PACKET CAPTURED]: Core telemetry evidence safely buffered inside the container. Proceed with downward progression matrix.", 'keep going down');
        this.step = STEP.CHASER;
      }
    } else if (this.step === STEP.CHASER) {
      const cx = this.chaser.x + this.chaser.w / 2, cy = this.chaser.y + this.chaser.h / 2;
      if (!this.chaser.taught && Math.hypot(p.x - cx, p.y - cy) < 360) {
        this.chaser.taught = true;
        this.chaser.state = 'waking';
        this.chaser.wakeT = this.time;
        this.say('SYSTEM', "[ALERT]: Hostile background recommendation daemon triggered. Intercept imminent.", '');
        beep(120, 0.3, 'sawtooth', 0.06);
      }
      if (this.chaser.state === 'chase' && p.y > 940) this.step = STEP.GUN;
    } else if (this.step === STEP.GUN) {
      if (!this.gun.taught && Math.hypot(p.x - this.gun.x, p.y - this.gun.y) < 400) {
        this.gun.taught = true;
        this.gun.state = 'waking';
        this.gun.wakeT = this.time;
        this.say('SYSTEM', "[ALERT]: Active security tracing protocol initiated by sponsored avatar node.", '');
        beep(120, 0.3, 'sawtooth', 0.06);
      }
      if ((this.gun.state === 'aim' || this.gun.state === 'spent') && p.y > 1320) {
        this.step = STEP.DONE;
        this.say('DAEMON', "[CALIBRATION PHASE COMPLETED]: All units verified. Secure local connection link by navigating proxy container into the INFILTRATE terminal gate.", 'walk into INFILTRATE');
      }
    }

    const b = TUT.infiltrate;
    if (this.step === STEP.DONE && !this.atExit &&
        p.x > b.x - 10 && p.x < b.x + b.w + 10 && p.y > b.y - 10 && p.y < b.y + b.h + 10) {
      this.atExit = true;
      this.say('DAEMON',
        "[SYSTEM WARNING]: Real-world nodes do not feature explicit terminal gateways. You must discover and map live pipeline exit vectors manually before HUSH network tracking triggers. Stay anonymous.",
        'press SPACE or click to go in');
      beep(440, 0.12, 'sine', 0.08);
    }
  }

  checkStuck() {
    if (this.spot.active) return;            
    const st = this.scanTarget;
    if (!this._escalated && this.stepT > 10) {
      this._escalated = true;
      if (this.step === STEP.MOVE)      this.say('DAEMON', "[INPUT REQUIRED]: Execute WASD or directional arrow parameters to transition container space.", 'WASD to move');
      else if (this.step === STEP.SCAN) this.say('DAEMON', "[SCAN TIMEOUT]: Overlay proxy window directly above the headline module bounds to process raw bits.", 'hold over the banner');
      else if (this.step === STEP.COLLECT) this.say('DAEMON', "[METADATA FLOATING]: Collision matrix needed. Intersect container with the yellow data hash file.", 'touch the yellow file');
    }
    if (this.stepT > 20) {
      if (this.step === STEP.SCAN && !st.scanned) {
        st.progress = 1; st.scanned = true; this.step = STEP.COLLECT;
        this.say('DAEMON', "[CORRUPTION RESOLVED]: Auto-bypassing scan matrix. Proceed immediately to capture the data file.", 'grab the file');
      } else if (this.step === STEP.COLLECT && !this.doc.taken) {
        this.doc.taken = true; this.step = STEP.CHASER;
        this.say('DAEMON', "[RECOVERY OVERRIDE]: File forced into proxy buffer. Resume downward deployment.", 'keep going down');
      }
    }
  }

  updateEnemies(dt) {
    const p = this.player;
    const WAKE_DELAY = 0.55; 

    if (this.chaser.state === 'waking' && this.time - this.chaser.wakeT > WAKE_DELAY) {
      this.chaser.state = 'spotlight';
      this.startSpotlight(this.chaser.x + this.chaser.w / 2, this.chaser.y + this.chaser.h / 2,
        'DAEMON', "[THREAT MANIFESTED]: Recommendation chaser engine activated. Homing algorithm engaged. Avoid physical collision grid.", 'chaser');
    }
    if (this.gun.state === 'waking' && this.time - this.gun.wakeT > WAKE_DELAY) {
      this.gun.state = 'spotlight';
      this.startSpotlight(this.gun.x, this.gun.y,
        'DAEMON', "[HARDWARE DEFENSE]: Target node firearm proxy loaded. High-frequency laser scan will execute instant containment burn.", 'gun');
    }

    if (this.chaser.state === 'chase') {
      const cx = this.chaser.x + this.chaser.w / 2, cy = this.chaser.y + this.chaser.h / 2;
      const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1;
      const sp = 70; 
      this.chaser.x += (dx / d) * sp * dt;
      this.chaser.y += (dy / d) * sp * dt;
      if (d < p.size * 0.5 && p.invuln <= 0) {
        p.invuln = 1.2; p.hitFlash = 0.3;
        p.x += (dx / d) * 26; p.y += (dy / d) * 26;
        noise(0.1, 0.1); beep(160, 0.12, 'sawtooth', 0.06);
      }
    }

    if (this.gun.state === 'aim') {
      this.gun.armLen = Math.min(48, this.gun.armLen + 90 * dt);
      const target = Math.atan2(p.y - this.gun.y, p.x - this.gun.x);
      let delta = target - this.gun.angle;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      this.gun.angle += Math.sign(delta) * Math.min(Math.abs(delta), 2.4 * dt);
      this.gun.aimT += dt;
      if (this.gun.aimT > 1.8 && this.gun.armLen >= 47) {
        const a = this.gun.angle;
        const mx = this.gun.x + Math.cos(a) * (this.gun.armLen + 12);
        const my = this.gun.y + Math.sin(a) * (this.gun.armLen + 12);
        this.bullets.push({ x: mx, y: my, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430, life: 3 });
        beep(220, 0.16, 'square', 0.12); noise(0.12, 0.12);
        this.gun.state = 'spent'; this.gun.firedT = this.time;
      }
    } else if (this.gun.state === 'spent') {
      this.gun.armLen = Math.max(0, this.gun.armLen - 60 * dt);
    }
  }

  updateProjectiles(dt) {
    const p = this.player;
    for (const b of this.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (p.invuln <= 0 && Math.abs(b.x - p.x) < p.size / 2 && Math.abs(b.y - p.y) < p.size * 0.375) {
        b.life = 0; p.invuln = 1.2; p.hitFlash = 0.3;
        noise(0.15, 0.12); beep(140, 0.18, 'sawtooth', 0.08);
      }
      if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) b.life = 0;
    }
    this.bullets = this.bullets.filter(b => b.life > 0);
    for (const s of this.sparks) { s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; }
    this.sparks = this.sparks.filter(s => s.life > 0);
  }

  finishTutorial(skipped) {
    if (this.finished) return;
    this.finished = true;
    localStorage.setItem('oqw-tutorial-done', 'yes');
    beep(523, 0.1, 'sine', 0.1);
    setTimeout(() => beep(784, 0.18, 'sine', 0.12), 110);
    this.dlg.wrap?.classList.add('hidden');
    this.scene.start('GameScene', { difficulty: this.difficulty });
    this.scene.launch('HUDScene');
  }

  render() {
    const ctx = this.ctx;
    const { VW, VH } = this;
    if (!VW || !VH) return;
    const c = this.cam;

    ctx.fillStyle = '#181818';
    ctx.fillRect(0, 0, VW, VH);

    ctx.save();
    ctx.scale(c.zoom, c.zoom);
    ctx.translate(-c.x, -c.y);

    ctx.fillStyle = '#e8e6e1';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,0,0,0.03)';
    ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i <= W; i += 40) { ctx.moveTo(i, 0); ctx.lineTo(i, H); }
    for (let i = 0; i <= H; i += 40) { ctx.moveTo(0, i); ctx.lineTo(W, i); }
    ctx.stroke();

    this.drawHeader(ctx);
    this.drawHero(ctx);
    this.drawContentRow(ctx, TUT.row1);
    this.drawContentRow(ctx, TUT.row2, this.chaser);
    this.drawDoc(ctx);
    this.drawGun(ctx);
    this.drawFooter(ctx);
    this.drawInfiltrate(ctx);
    this.drawBullets(ctx);
    this.drawPlayer(ctx);

    ctx.restore();

    if (this.spot.active) {
      const cx = VW / 2, cy = VH / 2;
      const g = ctx.createRadialGradient(cx, cy, VH * 0.12, cx, cy, VH * 0.65);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.82)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VW, VH);
    }

    if (this.introFade > 0) {
      ctx.fillStyle = 'rgba(8, 8, 10, ' + this.introFade + ')';
      ctx.fillRect(0, 0, VW, VH);
    }
  }

  bars(ctx, x, y, widths, gap = 16, h = 8, color = '#b0b0b0') {
    ctx.fillStyle = color;
    let yy = y;
    for (const w of widths) { ctx.fillRect(x, yy, w, h); yy += gap; }
  }

  drawHeader(ctx) {
    drawHandRect(ctx, TUT.header.x, TUT.header.y, TUT.header.w, TUT.header.h, '#ffffff', '#1a1a1f', 7, 2);
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(TUT.logo.x, TUT.logo.y, 26, 22);
    ctx.fillStyle = '#f0f0f0';
    const lx = TUT.logo.x + 13, ly = TUT.logo.y + 11;
    ctx.beginPath();
    ctx.moveTo(lx, ly - 6); ctx.lineTo(lx + 6, ly); ctx.lineTo(lx, ly + 6); ctx.lineTo(lx - 6, ly);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a8a8a'; ctx.fillRect(TUT.logo.x + 34, TUT.logo.y + 6, 90, 12);
    for (const n of TUT.nav) { ctx.fillStyle = '#b0b0b0'; ctx.fillRect(n.x, n.y, n.w, n.h); }
    drawHandRect(ctx, TUT.search.x, TUT.search.y, TUT.search.w, TUT.search.h, '#f4f4f4', '#cfcfcf', 33, 1.5);
    ctx.fillStyle = '#cfcfcf'; ctx.fillRect(TUT.search.x + 12, TUT.search.y + 12, 120, 6);
    ctx.fillStyle = '#8a8a8a'; ctx.beginPath();
    ctx.arc(TUT.account.x + 22, TUT.account.y + 15, 15, 0, Math.PI * 2); ctx.fill();
  }

  drawHero(ctx) {
    const hero = TUT.hero;
    drawHandRect(ctx, hero.x, hero.y, hero.w, hero.h, '#ffffff', '#1a1a1f', 99, 2);
    ctx.fillStyle = '#8a8a8a'; ctx.fillRect(hero.x + 18, hero.y + 18, hero.w - 36, 110);
    const st = this.scanTarget, r = st.rect;
    if (st.scanned) {
      ctx.fillStyle = '#0c0c0e'; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#E63946'; ctx.font = 'bold 16px ui-monospace, monospace';
      ctx.textBaseline = 'middle'; ctx.fillText(st.hidden, r.x + 12, r.y + r.h / 2);
    } else {
      this.bars(ctx, r.x, r.y + 8, [r.w - 40, r.w - 160], 20, 12, '#c4c4c4');
      if (this.windowOverlaps(r)) {
        ctx.strokeStyle = 'rgba(70,135,158,0.8)'; ctx.lineWidth = 2;
        ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
      }
    }
  }

  drawContentRow(ctx, cards, enemy = null) {
    for (const card of cards) {
      const isEnemy = enemy && card === TUT.row2[0] && this.chaser.taught;
      const x = isEnemy ? this.chaser.x : card.x;
      const y = isEnemy ? this.chaser.y : card.y;
      const active = isEnemy && this.chaser.state !== 'idle';
      drawHandRect(ctx, x, y, card.w, card.h, active ? '#ffe5e5' : '#ffffff', active ? '#E63946' : '#1a1a1f', (x + y) | 0, active ? 3 : 2);
      ctx.fillStyle = active ? '#E63946' : '#8a8a8a';
      ctx.fillRect(x + 12, y + 12, card.w - 24, card.h * 0.55);
      this.bars(ctx, x + 14, y + card.h * 0.55 + 20, [card.w - 28, card.w - 70, card.w - 110]);
      if (active) this.activationOutline(ctx, x, y, card.w, card.h);
      if (active) {
        const waking = this.chaser.state === 'waking' || this.chaser.state === 'spotlight';
        ctx.fillStyle = '#E63946'; ctx.font = 'bold 13px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(waking ? '⚠ DEPLOYING ⚠' : '◣ PURSUING ◢', x + card.w / 2, y + card.h * 0.28);
        ctx.textAlign = 'left';
      }
    }
  }

  drawDoc(ctx) {
    const d = this.doc;
    if (d.taken) return;
    const pulse = 1 + Math.sin(this.time * 4) * 0.12;
    ctx.save(); ctx.translate(d.x, d.y); ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(244,211,94,0.45)'; ctx.beginPath(); ctx.arc(0, 0, d.r + 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#F4D35E'; ctx.strokeStyle = '#1a1a1f'; ctx.lineWidth = 1.4;
    ctx.fillRect(-d.r, -d.r * 0.7, d.r * 2, d.r * 1.5); ctx.strokeRect(-d.r, -d.r * 0.7, d.r * 2, d.r * 1.5);
    ctx.fillStyle = '#1a1a1f'; ctx.font = 'bold 8px ui-monospace, monospace';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText('HASH', 0, 2); // DOC 改为 HASH
    ctx.textAlign = 'left'; ctx.restore();
  }

  drawGun(ctx) {
    const g = this.gun;
    const active = g.state === 'aim' || g.state === 'waking' || g.state === 'spotlight';
    const spent = g.state === 'spent';
    ctx.fillStyle = active ? '#E63946' : (spent ? '#888' : '#8a8a8a');
    ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = active ? '#fff' : '#1a1a1f'; ctx.lineWidth = active ? 2 : 1.4; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(spent ? '✕' : '⚙', g.x, g.y + 1); // 移除 U（人脸形），改为 ⚙
    ctx.textAlign = 'left';
    if (g.armLen > 0) {
      const mx = g.x + Math.cos(g.angle) * g.armLen, my = g.y + Math.sin(g.angle) * g.armLen;
      ctx.strokeStyle = '#1a1a1f'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(mx, my); ctx.stroke();
      ctx.save(); ctx.translate(mx, my); ctx.rotate(g.angle);
      ctx.fillStyle = '#0c0c0e'; ctx.fillRect(2, -3, 18, 6); ctx.restore();
      if (active) {
        ctx.strokeStyle = 'rgba(230,57,70,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(g.angle) * 1400, my + Math.sin(g.angle) * 1400); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (active) this.activationOutline(ctx, g.x - g.r - 6, g.y - g.r - 6, g.r * 2 + 12, g.r * 2 + 12);
    ctx.fillStyle = '#9a9a9a'; ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.fillText('security · node', g.x, g.y + g.r + 18); ctx.textAlign = 'left'; // account 改为 node
  }

  drawFooter(ctx) {
    drawHandRect(ctx, TUT.footer.x, TUT.footer.y, TUT.footer.w, TUT.footer.h, '#ffffff', '#1a1a1f', 222, 2);
    this.bars(ctx, 40, TUT.footer.y + 22, [180, 140], 16, 8, '#c4c4c4');
    this.bars(ctx, W - 240, TUT.footer.y + 22, [200, 160], 16, 8, '#c4c4c4');
  }

  drawInfiltrate(ctx) {
    const b = TUT.infiltrate, p = this.player;
    const near = p.y > b.y - 260 || this.atExit;
    const pulse = near ? 1 + Math.sin(this.time * 5) * 0.04 : 1;
    ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.scale(pulse, pulse);
    ctx.fillStyle = this.atExit ? '#1a0608' : '#0c0c0e'; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.strokeStyle = '#E63946'; ctx.lineWidth = near ? 3 : 2; ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px "Saira Condensed", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.atExit ? 'CONNECT  →' : 'ESTABLISH LINK  →', 0, -4); // 更改文案，更偏向硬件/连接风
    ctx.font = '10px ui-monospace, monospace'; ctx.fillStyle = '#E63946';
    ctx.fillText(this.atExit ? 'PRESS SPACE OR CLICK TO INITIALIZE PIPELINE' : 'ENTER TERMINAL GATE TO BEGIN LIVE OPERATIONS', 0, b.h / 2 - 12);
    ctx.textAlign = 'left'; ctx.restore();
  }

  drawBullets(ctx) {
    for (const b of this.bullets) {
      ctx.fillStyle = '#1a1a1f'; ctx.strokeStyle = '#E63946'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  drawPlayer(ctx) {
    const p = this.player, s = p.size, ph = s * 0.75;
    const px = p.x - s / 2, py = p.y - ph / 2;
    const st = this.scanTarget;
    const xraying = st && !st.scanned && this.windowOverlaps(st.rect);
    ctx.save();
    if (p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0) ctx.globalAlpha = 0.45;
    const body = p.hitFlash > 0 ? '#fff' : (xraying ? SCAN.xrayBg : '#E63946');
    drawHandRect(ctx, px, py, s, ph, body, '#1a1a1f', 50);
    if (xraying) {
      const r = st.rect;
      ctx.save();
      ctx.beginPath(); ctx.rect(px, py, s, ph); ctx.clip();
      ctx.fillStyle = SCAN.xrayColor;
      ctx.font = st.font; ctx.textBaseline = 'middle';
      ctx.fillText(st.hidden, r.x + 12, r.y + r.h / 2);
      ctx.restore();
    }
    ctx.fillStyle = '#1a1a1f'; ctx.fillRect(px + 1, py + 1, s - 2, 14);
    ctx.save();
    ctx.beginPath(); ctx.rect(px + 4, py + 1, s - 8, 13); ctx.clip();
    ctx.fillStyle = '#fff'; ctx.font = '8px ui-monospace, monospace'; ctx.textBaseline = 'middle';
    ctx.fillText(s > 70 ? 'NormalBrowser/1.0' : 'NB/1.0', px + 5, py + 8);
    ctx.restore();
    ctx.restore();
  }

  windowOverlaps(r) {
    const p = this.player, s = p.size, ph = s * 0.75;
    const px = p.x - s / 2, py = p.y - ph / 2;
    return px < r.x + r.w && px + s > r.x && py < r.y + r.h && py + ph > r.y;
  }

  activationOutline(ctx, x, y, w, h) {
    const pulse = 0.5 + Math.sin(this.time * 8) * 0.5;
    ctx.save();
    ctx.strokeStyle = 'rgba(230,57,70,' + (0.5 + pulse * 0.4) + ')';
    ctx.lineWidth = 3; ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
    ctx.restore();
  }
}