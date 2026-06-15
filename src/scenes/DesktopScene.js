import Phaser from 'phaser';
import { initAudio, beep, noise } from '../game/audio.js';
import { loadMusic, playMusic } from '../game/music.js';
import { loadSfx, setSfxMuted } from '../game/sfx.js';
import { setVoiceMuted } from '../game/voice.js';

// ============================================================================
// DESKTOP SCENE — MeTube Desktop Parody
//
// Replaces the old MenuScene. Flow:
//   1. XP welcome/login screen (reuses existing DOM overlay from index.html).
//      Player types their name → stored as codename for the rest of the game.
//   2. Phaser-rendered desktop with procedurally generated icons:
//        • Infiltrating  — double-click opens MeTube window → LAUNCH MISSION
//        • Manual         — double-click opens Notepad with lore + instructions
//        • Recycle Bin    — drag icons here to delete them
//        • Log Out        — shutdown animation
//   3. Launching the mission transitions to TutorialScene.
//
// No external assets — all textures generated via Phaser Graphics.
// ============================================================================

// ── Notepad content — game lore, instructions, tutorial summary ──
const NOTEPAD_CONTENT = `OPERATION: QUIET WINDOW
=============================
CLASSIFICATION: LEVEL-IV EYES ONLY
HANDLER: TOTO (status: standby)
=============================

BRIEFING:
---------
HUSH Corp has seized control of the internet's
largest platforms. They bury evidence under
bot-generated content, fake views, and algorithm
manipulation. The truth is disappearing.

You are our last operative.

Your handler — codename TOTO — wrote a stealth
program that disguises you as an ordinary browser
window. Nobody looks twice at a window.

YOUR MISSION:
-------------
1. Infiltrate HUSH's pages
2. Collect buried evidence (yellow DOC files)
3. Avoid hostile page elements
4. Exfiltrate through the boosted video

CONTROLS:
---------
  WASD / Arrow Keys ... Move
  SHIFT ............... Dash (burst speed)
  ESC ................. Pause menu

THREATS:
--------
  • VIDEO CARDS — some tear off the page and
    chase you. Keep moving.
  • SEARCH BAR — fires autocomplete shrapnel
    if you linger near the top.
  • ACCOUNT AVATAR — pulls a gun. One shot is
    lethal at range. Rush it to break the aim.
  • SCROLL — the page auto-scrolls. Don't get
    left behind.

SURVIVAL TIPS:
--------------
  → Standing still = death. The avatar will
    line up a killshot.
  → SHIFT dash through tight gaps.
  → Collect HP pickups (green +) to heal.
  → The exit pulses GREEN once you have
    enough evidence.

GOOD LUCK, OPERATIVE.

// end of file
// toto was here
`;

export default class DesktopScene extends Phaser.Scene {
  constructor() {
    super('DesktopScene');
  }

  preload() {
    // No external assets — all textures generated in create()
  }

  create() {
    // ── Audio setup (same as old MenuScene) ──
    loadMusic();
    loadSfx();
    setSfxMuted(false);
    setVoiceMuted(false);
    localStorage.setItem('oqw-difficulty', 'easy');

    // ── DOM references for the XP welcome/login screen ──
    this.d = {
      welcome: document.getElementById('xp-welcome'),
      desktop: document.getElementById('xp-desktop'),
      admin:   document.getElementById('xpw-admin'),
      pwwrap:  document.getElementById('xpw-pwwrap'),
      pw:      document.getElementById('xpw-pw'),
      go:      document.getElementById('xpw-go'),
      hint:    document.getElementById('xpw-hint'),
      prompt:  document.getElementById('xpw-prompt'),
      turnoff: document.getElementById('xpw-turnoff'),
    };

    // State
    this.desktopReady = false;
    this.activeWindow = null;
    this.notepadTextarea = null;
    this.launching = false;
    this.abort = new AbortController();
    this.timers = [];

    const sig = this.abort.signal;

    // ── Show the XP login screen (DOM overlay) ──
    document.body.classList.add('menu-mode');
    this.showEl(this.d.welcome);
    this.hideEl(this.d.desktop);  // keep old XP desktop hidden — we use Phaser now
    this.hideEl(this.d.pwwrap);

    // Wire up the login
    this.on(this.d.admin, 'click', () => this.selectAdmin(), sig);
    this.on(this.d.admin, 'keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.selectAdmin(); }
    }, sig);
    this.on(this.d.go, 'click', (e) => { e.stopPropagation(); this.tryLogin(); }, sig);
    if (this.d.pw) {
      this.on(this.d.pw, 'keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); this.tryLogin(); }
      }, sig);
      this.on(this.d.pw, 'click', (e) => e.stopPropagation(), sig);
    }
    // Disabled users shake
    document.querySelectorAll('.xpw-user.disabled').forEach((el) =>
      el.addEventListener('click', () => this.denyUser(el), { signal: sig })
    );
    this.on(this.d.turnoff, 'click', () => beep(140, 0.18, 'sawtooth', 0.08), sig);

    // ── Generate Phaser textures (drawn off-screen, used later) ──
    this.generateTextures();

    // ── Create the Phaser desktop background (hidden until login) ──
    // We set everything to alpha 0 initially and fade in after login.
    this.desktopContainer = this.add.container(0, 0);
    this.desktopContainer.setAlpha(0);

    this.createBackground();

    // Play menu music
    playMusic('menu', { fadeMs: 1200 });

    // ── Cleanup on scene shutdown ──
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.abort.abort();
      this.timers.forEach(clearTimeout);
      if (this.notepadTextarea) {
        this.notepadTextarea.remove();
        this.notepadTextarea = null;
      }
      // Hide any lingering XP DOM
      this.hideEl(this.d.welcome);
      this.hideEl(this.d.desktop);
    });
  }

  // ===== Helpers =====
  on(el, ev, fn, sig) { if (el) el.addEventListener(ev, fn, sig ? { signal: sig } : undefined); }
  showEl(el) { el?.classList.remove('hidden'); }
  hideEl(el) { el?.classList.add('hidden'); }
  later(fn, ms) { const t = setTimeout(fn, ms); this.timers.push(t); return t; }

  // ===== XP Login =====
  selectAdmin() {
    initAudio();
    this.d.admin?.classList.add('selected');
    this.showEl(this.d.pwwrap);
    if (this.d.prompt) this.d.prompt.textContent = 'Type your name as the password, then press the green arrow.';
    if (this.d.hint) { this.d.hint.classList.remove('error'); this.d.hint.textContent = 'Hint: type your name'; }
    beep(900, 0.04, 'square', 0.04);
    this.later(() => this.d.pw?.focus(), 60);
  }

  denyUser(el) {
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 400);
    beep(160, 0.16, 'square', 0.05);
    noise(0.06, 0.05);
  }

  tryLogin() {
    const v = (this.d.pw?.value || '').trim();
    if (!v) {
      if (this.d.hint) { this.d.hint.classList.add('error'); this.d.hint.textContent = 'Type your name to log on.'; }
      this.d.admin?.classList.add('shake');
      setTimeout(() => this.d.admin?.classList.remove('shake'), 400);
      beep(160, 0.16, 'square', 0.05);
      return;
    }
    localStorage.setItem('oqw-name', v);
    beep(880, 0.05, 'sine', 0.06);
    this.later(() => beep(1320, 0.12, 'sine', 0.06), 90);
    if (this.d.prompt) this.d.prompt.textContent = 'Loading your personal settings…';
    this.later(() => this.showDesktop(v), 700);
  }

  showDesktop() {
    // Hide the DOM login screen
    this.hideEl(this.d.welcome);

    // XP "ta-da" chord
    [523, 659, 784, 1047].forEach((f, i) =>
      this.later(() => beep(f, 0.16, 'sine', 0.06), i * 110)
    );

    // Build and show Phaser desktop
    this.buildDesktopIcons();
    this.desktopReady = true;

    // Fade in
    this.tweens.add({
      targets: this.desktopContainer,
      alpha: 1,
      duration: 600,
      ease: 'Power2.easeOut',
    });
  }

  // ===== Texture Generation =====
  generateTextures() {
    // 1. Infiltrating (Play Button) Icon
    const logoG = this.make.graphics({ x: 0, y: 0, add: false });
    logoG.fillStyle(0x000000, 1);
    logoG.fillRoundedRect(0, 0, 64, 64, 12);
    logoG.fillStyle(0xffffff, 1);
    logoG.fillTriangle(24, 20, 24, 44, 46, 32);
    logoG.generateTexture('icon_metube', 64, 64);

    // 2. Window Background
    const winBg = this.make.graphics({ x: 0, y: 0, add: false });
    winBg.fillStyle(0xf0f0f0, 1);
    winBg.fillRect(0, 0, 600, 400);
    winBg.lineStyle(2, 0x888888, 1);
    winBg.strokeRect(0, 0, 600, 400);
    winBg.generateTexture('window_bg', 600, 400);

    // 3. Title Bar
    const titleBar = this.make.graphics({ x: 0, y: 0, add: false });
    titleBar.fillStyle(0x333333, 1);
    titleBar.fillRect(0, 0, 600, 30);
    titleBar.generateTexture('title_bar', 600, 30);

    // 4. Close Button (X)
    const closeBtn = this.make.graphics({ x: 0, y: 0, add: false });
    closeBtn.fillStyle(0xcc0000, 1);
    closeBtn.fillRect(0, 0, 30, 30);
    closeBtn.lineStyle(2, 0xffffff, 1);
    closeBtn.lineBetween(8, 8, 22, 22);
    closeBtn.lineBetween(22, 8, 8, 22);
    closeBtn.generateTexture('close_btn', 30, 30);

    // 5. Log Out Icon (Open Door)
    const logoutG = this.make.graphics({ x: 0, y: 0, add: false });
    logoutG.lineStyle(4, 0xdddddd, 1);
    logoutG.strokeRect(16, 12, 32, 44);
    logoutG.fillStyle(0x333333, 1);
    logoutG.fillRect(18, 14, 28, 40);
    logoutG.fillStyle(0xcc3333, 1);
    logoutG.beginPath();
    logoutG.moveTo(18, 14); logoutG.lineTo(40, 8);
    logoutG.lineTo(40, 52); logoutG.lineTo(18, 54);
    logoutG.closePath(); logoutG.fillPath();
    logoutG.generateTexture('logout_icon', 64, 64);

    // 6. Recycle Bin Icon
    const binG = this.make.graphics({ x: 0, y: 0, add: false });
    binG.fillStyle(0xc0c0c0, 1);
    binG.beginPath();
    binG.moveTo(14, 20); binG.lineTo(50, 20);
    binG.lineTo(44, 56); binG.lineTo(20, 56);
    binG.closePath(); binG.fillPath();
    binG.lineStyle(2, 0x999999, 1);
    binG.strokePath();
    binG.fillStyle(0xaaaaaa, 1);
    binG.fillRect(10, 14, 44, 6);
    binG.fillRect(26, 8, 12, 6);
    binG.lineBetween(24, 25, 26, 50);
    binG.lineBetween(32, 25, 32, 50);
    binG.lineBetween(40, 25, 38, 50);
    binG.generateTexture('recycle_icon', 64, 64);

    // 7. Manual (Book) Icon
    const bookG = this.make.graphics({ x: 0, y: 0, add: false });
    bookG.fillStyle(0x004488, 1);
    bookG.beginPath();
    bookG.moveTo(32, 16); bookG.lineTo(8, 12);
    bookG.lineTo(8, 52); bookG.lineTo(32, 56);
    bookG.lineTo(56, 52); bookG.lineTo(56, 12);
    bookG.closePath(); bookG.fillPath();
    bookG.fillStyle(0xffffff, 1);
    bookG.beginPath();
    bookG.moveTo(32, 18); bookG.lineTo(12, 15);
    bookG.lineTo(12, 48); bookG.lineTo(32, 52);
    bookG.closePath(); bookG.fillPath();
    bookG.fillStyle(0xeeeeee, 1);
    bookG.beginPath();
    bookG.moveTo(32, 18); bookG.lineTo(52, 15);
    bookG.lineTo(52, 48); bookG.lineTo(32, 52);
    bookG.closePath(); bookG.fillPath();
    bookG.fillStyle(0xcc0000, 1);
    bookG.fillRect(30, 14, 4, 42);
    bookG.generateTexture('manual_icon', 64, 64);
  }

  // ===== Desktop Background =====
  createBackground() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x3a6ea5, 0x3a6ea5, 0x123456, 0x123456, 1);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);
    this.desktopContainer.add(bg);

    this.scale.on('resize', (gameSize) => {
      bg.clear();
      bg.fillGradientStyle(0x3a6ea5, 0x3a6ea5, 0x123456, 0x123456, 1);
      bg.fillRect(0, 0, gameSize.width, gameSize.height);
      if (this.notepadTextarea && this.activeWindow && this.activeWindow.name === 'notepad') {
        this.updateTextareaPosition();
      }
    });
  }

  // ===== Desktop Icons =====
  buildDesktopIcons() {
    this.metubeGroup = this.createDesktopIcon(
      50, 60, 'icon_metube', 'Infiltrating', (x, y) => this.openMeTubeWindow(x, y)
    );
    this.logoutGroup = this.createDesktopIcon(
      50, 160, 'logout_icon', 'Log Out', () => this.triggerShutdown()
    );
    this.recycleBinGroup = this.createDesktopIcon(
      50, 260, 'recycle_icon', 'Recycle Bin', () => { /* no-op */ }
    );
    this.manualGroup = this.createDesktopIcon(
      50, 360, 'manual_icon', 'Manual', (x, y) => this.openNotepadWindow(x, y)
    );
  }

  createDesktopIcon(x, y, textureKey, labelText, onClickCallback) {
    const iconGroup = this.add.container(x, y);
    this.desktopContainer.add(iconGroup);

    // Soft drop shadows
    const shadows = [];
    for (let i = 1; i <= 6; i++) {
      const offset = i * 1.5;
      const alpha = 0.25 / (i * 1.2);
      const scale = 1 + (i * 0.02);
      shadows.push(
        this.add.image(-offset, offset, textureKey)
          .setTint(0x000000).setAlpha(alpha).setScale(scale)
      );
    }

    const icon = this.add.image(0, 0, textureKey)
      .setInteractive({ useHandCursor: true, draggable: true });
    const label = this.add.text(0, 45, labelText, {
      fontFamily: 'Arial', fontSize: '14px', color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 4, y: 2 },
    }).setOrigin(0.5);

    iconGroup.add([...shadows, icon, label]);

    // Dragging
    let startDragX = 0, startDragY = 0;
    icon.on('dragstart', (pointer) => {
      startDragX = iconGroup.x - pointer.x;
      startDragY = iconGroup.y - pointer.y;
    });
    icon.on('drag', (pointer) => {
      iconGroup.x = pointer.x + startDragX;
      iconGroup.y = pointer.y + startDragY;
    });

    // Drop to recycle bin
    icon.on('dragend', () => {
      if (textureKey !== 'recycle_icon' && this.recycleBinGroup) {
        const dist = Phaser.Math.Distance.Between(
          iconGroup.x, iconGroup.y,
          this.recycleBinGroup.x, this.recycleBinGroup.y
        );
        if (dist < 60) {
          iconGroup.destroy();
          beep(200, 0.12, 'square', 0.06);
        }
      }
    });

    // Double-click simulation
    let lastTime = 0;
    icon.on('pointerdown', () => {
      const clickDelay = this.time.now - lastTime;
      lastTime = this.time.now;
      if (clickDelay < 350) {
        beep(900, 0.04, 'square', 0.04);
        onClickCallback(iconGroup.x, iconGroup.y);
      }
    });

    // Hover
    icon.on('pointerover', () => icon.setTint(0xdddddd));
    icon.on('pointerout', () => icon.clearTint());

    return iconGroup;
  }

  // ===== Shutdown =====
  triggerShutdown() {
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 1);
    overlay.fillRect(0, 0, this.scale.width, this.scale.height);
    overlay.setDepth(9999);

    const shutdownText = this.add.text(
      this.scale.width / 2, this.scale.height / 2,
      'System Shutting Down...', {
        fontFamily: 'Courier New', fontSize: '24px', color: '#ffffff',
      }
    ).setOrigin(0.5).setDepth(10000);

    noise(0.3, 0.15);
    beep(220, 0.4, 'sawtooth', 0.1);

    this.later(() => {
      shutdownText.setText('It is now safe to turn off your computer.');
    }, 2000);

    // After 4s, restart the scene (back to login)
    this.later(() => {
      this.scene.restart();
    }, 5000);
  }

  // ===== MeTube Window =====
  openMeTubeWindow(startX = 50, startY = 60) {
    if (this.activeWindow) {
      this.activeWindow.setDepth(this.children.length);
      return;
    }

    const winWidth = this.scale.width;
    const winHeight = this.scale.height;
    const windowContainer = this.add.container(startX, startY);
    windowContainer.setScale(0);
    this.activeWindow = windowContainer;

    // Window background
    const bg = this.add.graphics();
    bg.fillStyle(0xf0f0f0, 1);
    bg.fillRect(0, 0, winWidth, winHeight);
    bg.lineStyle(2, 0x888888, 1);
    bg.strokeRect(0, 0, winWidth, winHeight);

    // Title bar
    const titleBarBg = this.add.graphics();
    titleBarBg.fillStyle(0x333333, 1);
    titleBarBg.fillRect(0, 0, winWidth, 30);

    const titleText = this.add.text(10, 7, 'Infiltrating - Broadcast Yourself (Desktop)', {
      fontFamily: 'Arial', fontSize: '14px', color: '#ffffff',
    });

    const closeBtn = this.add.image(winWidth - 30, 0, 'close_btn')
      .setOrigin(0).setInteractive({ useHandCursor: true });

    // Header strip
    const header = this.add.graphics();
    header.fillStyle(0xffffff, 1);
    header.fillRect(0, 30, winWidth, 50);
    header.lineStyle(1, 0xdddddd, 1);
    header.lineBetween(0, 80, winWidth, 80);

    const logo = this.add.image(20, 55, 'icon_metube').setScale(0.4);
    const logoText = this.add.text(45, 45, 'Infiltrating', {
      fontFamily: 'Impact, sans-serif', fontSize: '24px', color: '#000000',
    });

    // Content
    const accessText = this.add.text(20, 100, 'System Access Granted...', {
      fontFamily: 'Arial', fontSize: '18px', color: '#333333',
    });

    const name = (localStorage.getItem('oqw-name') || '').trim() || 'operative';

    const briefing = this.add.text(20, 140, [
      `Welcome, ${name}.`,
      '',
      'Your cover identity has been loaded.',
      'TOTO\'s stealth agent is ready.',
      '',
      'You will infiltrate HUSH Corp\'s platform',
      'disguised as a normal browser window.',
      '',
      'A calibration drill will run first to',
      'familiarize you with the controls.',
      '',
      '[ Read the Manual for full instructions ]',
    ].join('\n'), {
      fontFamily: 'Courier New, monospace', fontSize: '14px',
      color: '#1a1a1f', lineSpacing: 4,
    });

    // Launch button
    const btnW = 260, btnH = 48;
    const btnX = winWidth / 2 - btnW / 2;
    const btnY = winHeight - 100;

    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x2D8659, 1);
    btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
    btnBg.lineStyle(2, 0x1a5e3c, 1);
    btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);

    const btnText = this.add.text(winWidth / 2, btnY + btnH / 2, '▶  LAUNCH MISSION', {
      fontFamily: 'Arial', fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Make button interactive
    const btnHitArea = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });

    btnHitArea.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0x3aad6e, 1);
      btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      btnBg.lineStyle(2, 0x1a5e3c, 1);
      btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
    });
    btnHitArea.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(0x2D8659, 1);
      btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      btnBg.lineStyle(2, 0x1a5e3c, 1);
      btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
    });
    btnHitArea.on('pointerdown', () => {
      if (!this.launching) this.launchMission();
    });

    windowContainer.add([
      bg, titleBarBg, titleText, closeBtn, header, logo, logoText,
      accessText, briefing, btnBg, btnText, btnHitArea,
    ]);
    windowContainer.setDepth(this.children.length);

    // Open animation
    this.tweens.add({
      targets: windowContainer,
      x: 0, y: 0, scaleX: 1, scaleY: 1,
      duration: 350, ease: 'Power2.easeOut',
    });

    // Close button
    closeBtn.on('pointerdown', () => {
      this.tweens.add({
        targets: windowContainer,
        x: startX, y: startY, scaleX: 0, scaleY: 0,
        duration: 250, ease: 'Power2.easeIn',
        onComplete: () => { windowContainer.destroy(); this.activeWindow = null; },
      });
    });

    // Click background to bring to front
    bg.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, winWidth, winHeight),
      Phaser.Geom.Rectangle.Contains
    );
    bg.on('pointerdown', () => windowContainer.setDepth(this.children.length));
  }

  // ===== Launch Mission =====
  launchMission() {
    this.launching = true;
    beep(660, 0.08, 'sine', 0.06);
    this.later(() => beep(880, 0.1, 'sine', 0.06), 100);
    this.later(() => beep(1100, 0.12, 'sine', 0.06), 200);

    // Brief flash then transition
    const flash = this.add.graphics();
    flash.fillStyle(0xffffff, 1);
    flash.fillRect(0, 0, this.scale.width, this.scale.height);
    flash.setDepth(99999);
    flash.setAlpha(0);

    this.tweens.add({
      targets: flash,
      alpha: 1,
      duration: 400,
      ease: 'Power2.easeIn',
      onComplete: () => {
        // Clean up textarea if open
        if (this.notepadTextarea) {
          this.notepadTextarea.remove();
          this.notepadTextarea = null;
        }
        this.scene.start('TutorialScene', { difficulty: 'easy' });
      },
    });
  }

  // ===== Notepad Window =====
  openNotepadWindow(startX = 50, startY = 360) {
    if (this.activeWindow) {
      this.activeWindow.setDepth(this.children.length);
      return;
    }

    const winWidth = 480;
    const winHeight = 400;
    const targetX = (this.scale.width - winWidth) / 2;
    const targetY = (this.scale.height - winHeight) / 2;

    const windowContainer = this.add.container(startX, startY);
    windowContainer.name = 'notepad';
    windowContainer.setScale(0);
    this.activeWindow = windowContainer;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0xf0f0f0, 1);
    bg.fillRect(0, 0, winWidth, winHeight);
    bg.lineStyle(2, 0x888888, 1);
    bg.strokeRect(0, 0, winWidth, winHeight);

    // Title bar (classic Windows blue)
    const titleBarBg = this.add.graphics();
    titleBarBg.fillStyle(0x000080, 1);
    titleBarBg.fillRect(0, 0, winWidth, 30);

    const titleText = this.add.text(10, 7, 'BRIEFING.txt - Notepad', {
      fontFamily: 'Arial', fontSize: '14px', color: '#ffffff',
    });

    const closeBtn = this.add.image(winWidth - 30, 0, 'close_btn')
      .setOrigin(0).setInteractive({ useHandCursor: true });

    // Menu bar
    const menuBar = this.add.graphics();
    menuBar.fillStyle(0xe0e0e0, 1);
    menuBar.fillRect(0, 30, winWidth, 20);
    menuBar.lineStyle(1, 0xcccccc, 1);
    menuBar.lineBetween(0, 50, winWidth, 50);

    const menuText = this.add.text(5, 33, 'File  Edit  Format  View  Help', {
      fontFamily: 'Arial', fontSize: '12px', color: '#000000',
    });

    windowContainer.add([bg, titleBarBg, titleText, closeBtn, menuBar, menuText]);
    windowContainer.setDepth(this.children.length);

    // Draggable title bar
    titleBarBg.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, winWidth - 30, 30),
      Phaser.Geom.Rectangle.Contains
    );
    this.input.setDraggable(titleBarBg);

    let startDragX = 0, startDragY = 0;
    titleBarBg.on('dragstart', (pointer) => {
      startDragX = windowContainer.x - pointer.x;
      startDragY = windowContainer.y - pointer.y;
      windowContainer.setDepth(this.children.length);
    });
    titleBarBg.on('drag', (pointer) => {
      windowContainer.x = pointer.x + startDragX;
      windowContainer.y = pointer.y + startDragY;
      this.updateTextareaPosition();
    });

    bg.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, winWidth, winHeight),
      Phaser.Geom.Rectangle.Contains
    );
    bg.on('pointerdown', () => windowContainer.setDepth(this.children.length));

    // HTML Textarea (real text input)
    this.notepadTextarea = document.createElement('textarea');
    this.notepadTextarea.className = 'notepad-textarea';
    this.notepadTextarea.value = NOTEPAD_CONTENT;
    this.notepadTextarea.readOnly = true;
    document.body.appendChild(this.notepadTextarea);
    this.notepadTextarea.style.display = 'none';

    // Open animation
    this.tweens.add({
      targets: windowContainer,
      x: targetX, y: targetY, scaleX: 1, scaleY: 1,
      duration: 350, ease: 'Power2.easeOut',
      onComplete: () => {
        if (this.notepadTextarea) {
          this.notepadTextarea.style.display = 'block';
          this.updateTextareaPosition();
        }
      },
    });

    // Close
    closeBtn.on('pointerdown', () => {
      if (this.notepadTextarea) {
        this.notepadTextarea.remove();
        this.notepadTextarea = null;
      }
      this.tweens.add({
        targets: windowContainer,
        x: startX, y: startY, scaleX: 0, scaleY: 0,
        duration: 250, ease: 'Power2.easeIn',
        onComplete: () => { windowContainer.destroy(); this.activeWindow = null; },
      });
    });
  }

  updateTextareaPosition() {
    if (!this.activeWindow || !this.notepadTextarea) return;

    const padding = 2;
    const headerHeight = 50; // title bar + menu bar
    const winWidth = 480;
    const winHeight = 400;

    // The textarea lives in page-space. Because the game canvas sits inside the
    // scaled .viewport (1920×1080 design surface scaled to fit the browser),
    // we need to convert the container's logical position into actual page px.
    const canvas = this.sys.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / this.scale.width;
    const scaleY = rect.height / this.scale.height;

    const x = rect.left + (this.activeWindow.x + padding) * scaleX;
    const y = rect.top + (this.activeWindow.y + headerHeight + padding) * scaleY;

    this.notepadTextarea.style.left = `${x}px`;
    this.notepadTextarea.style.top = `${y}px`;
    this.notepadTextarea.style.width = `${(winWidth - padding * 2) * scaleX}px`;
    this.notepadTextarea.style.height = `${(winHeight - headerHeight - padding * 2) * scaleY}px`;
    this.notepadTextarea.style.fontSize = `${Math.max(10, 14 * scaleY)}px`;

    const scale = this.activeWindow.scaleX;
    this.notepadTextarea.style.display = scale < 1 ? 'none' : 'block';
  }
}
