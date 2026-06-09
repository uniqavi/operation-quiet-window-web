import Phaser from 'phaser';
import { initAudio, beep } from '../game/audio.js';
import { loadMusic, playMusic, setMusicMuted } from '../game/music.js';
import { playVoice, stopVoice, setVoiceMuted } from '../game/voice.js';
import { MenuEffects } from '../game/menuEffects.js';

// 去人类化改造：将原本 TOTO 的电话对话，改为冷酷的系统内核加载与静默漏洞注入日志
const CUTSCENE = [
  { speaker: 'SYSTEM', text: "[ BOOTING HUSH_OS V4.0 ] ........................ SUCCESS" },
  { speaker: 'KERNEL', text: "Initializing kernel subsystem... Allocating proxy buffers..." },
  { speaker: 'SYSTEM', text: "[ WARNING ]: ACTIVE MONITORING DETECTED ON TARGET NETWORK." },
  { speaker: 'DAEMON', text: "Deploying anti-tracker middleware. Spoofing signature as 'NormalBrowser/1.0'..." },
  { speaker: 'DAEMON', text: "Injecting silent payload into the HUSH target pipeline..." },
  { speaker: 'SYSTEM', text: "[ MALWARE PLANTED ]: Page control established via 75-pixel viewport." },
  { speaker: 'KERNEL', text: "Scanning live data stream... Intercepting cookie jars and document metadata." },
  { speaker: 'DAEMON', text: "Alert: Security nodes will attempt active trace. Close the distance to corrupt their tracking loops." },
  { speaker: 'SYSTEM', text: "> INITIALIZATION COMPLETE. STANDBY FOR SANDBOX CALIBRATION DRILL..." }
];

// 将原本的玩家自定义名字，改为纯机械的代理节点 ID 生成
function formatLine(text) {
  const seed = (localStorage.getItem('oqw-node-id') || 'NODE-0x7F3A9');
  return text.replace(/\{name\}/g, seed);
}

const SPEAKER_COLORS = {
  SYSTEM: '#2D8659', // 系统绿色
  KERNEL: '#9a9aa0', // 内核灰色
  DAEMON: '#E63946', // 守护进程红色（代替原本的 TOTO 颜色，保留视觉张力）
};

// 彻底移除人类头像资源
const SPEAKER_PORTRAITS = {
  SYSTEM: '',
  KERNEL: '',
  DAEMON: '',
};

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.dom = {
      mainMenu:         document.getElementById('main-menu'),
      diffMenu:         document.getElementById('diff-menu'),
      namePrompt:       document.getElementById('name-prompt'),
      nameInput:        document.getElementById('name-input'),
      nameNote:         document.getElementById('name-note'),
      nameConfirm:      document.getElementById('name-confirm'),
      nameBack:         document.getElementById('name-back'),
      intro:            document.getElementById('intro'),
      settings:         document.getElementById('settings-modal'),
      help:             document.getElementById('help-modal'),
      diffConfirm:      document.getElementById('diff-confirm'),
      dialogueSpeaker:  document.getElementById('dialogue-speaker'),
      dialogueLine:     document.getElementById('dialogue-line'),
      dialogueHint:     document.getElementById('dialogue-hint'),
      dialoguePortrait: document.getElementById('dialogue-portrait'),
    };

    document.body.classList.add('menu-mode');
    this.show(this.dom.mainMenu);
    this.hide(this.dom.diffMenu);
    this.hide(this.dom.namePrompt);
    this.hide(this.dom.intro);
    this.hide(this.dom.settings);
    this.hide(this.dom.help);

    // Restore saved settings
    this.selectedDiff = localStorage.getItem('oqw-difficulty') || 'easy';
    this.markDiffCard(this.selectedDiff);
    this.dom.diffConfirm.disabled = false;
    const savedAudio = localStorage.getItem('oqw-audio') || 'on';
    this.markAudioBtn(savedAudio);

    loadMusic();
    setMusicMuted(savedAudio === 'off');
    setVoiceMuted(savedAudio === 'off');
    playMusic('menu', { fadeMs: 1200 });

    this.fx = [];
    const fxCanvasIds = ['menu-fx-canvas-main', 'menu-fx-canvas-diff', 'menu-fx-canvas-intro'];
    for (const id of fxCanvasIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      const fx = new MenuEffects(el);
      fx.start();
      this.fx.push(fx);
    }

    this.abort = new AbortController();
    const signal = this.abort.signal;

    // Main menu buttons
    this.bindClick('btn-start',      () => this.openDiffMenu(), signal);
    this.bindClick('btn-settings',   () => this.show(this.dom.settings), signal);
    this.bindClick('btn-help',       () => this.show(this.dom.help), signal);
    this.bindClick('settings-close', () => this.hide(this.dom.settings), signal);
    this.bindClick('help-close',     () => this.hide(this.dom.help), signal);

    // Difficulty select
    document.querySelectorAll('.diff-card').forEach((card) => {
      card.addEventListener('click', () => this.selectDiff(card.dataset.diff), { signal });
    });
    this.bindClick('diff-back',    () => this.closeDiffMenu(), signal);
    
    // 打开“授权节点/密钥配置”弹窗（代替原本的人类起名弹窗）
    this.bindClick('diff-confirm', () => this.openNamePrompt(), signal);
    this.bindClick('name-back',    () => this.closeNamePrompt(), signal);
    this.bindClick('name-confirm', () => this.commitNameAndBegin(), signal);

    if (this.dom.nameInput) {
      this.dom.nameInput.addEventListener('input', () => this.refreshNameValidity(), { signal });
      this.dom.nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !this.dom.nameConfirm.disabled) {
          e.preventDefault();
          this.commitNameAndBegin();
        }
      }, { signal });
    }

    // Audio toggle in settings
    document.querySelectorAll('.diff-btn[data-audio]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.audio;
        localStorage.setItem('oqw-audio', v);
        this.markAudioBtn(v);
        setMusicMuted(v === 'off');
        setVoiceMuted(v === 'off');
      }, { signal });
    });

    // Intro skip button
    this.bindClick('intro-skip', (e) => {
      e.stopPropagation();
      this.endCutscene();
    }, signal);

    // Cutscene advance
    this.advanceFn = (e) => {
      if (this.dom.intro.classList.contains('hidden')) return;
      if (e.type === 'keydown' && e.key !== ' ' && e.key !== 'Enter') return;
      if (e.type === 'keydown') e.preventDefault();
      this.advanceCutscene();
    };
    document.addEventListener('keydown', this.advanceFn, { signal });
    this.dom.intro.addEventListener('click', this.advanceFn, { signal });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.abort.abort();
      if (this.typewriterTimer) clearTimeout(this.typewriterTimer);
      if (this.fx) this.fx.forEach((fx) => fx.stop());
    });
  }

  // ===== DOM helpers =====
  bindClick(id, fn, signal) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn, signal ? { signal } : undefined);
  }
  show(el) { el?.classList.remove('hidden'); }
  hide(el) { el?.classList.add('hidden'); }

  markDiffCard(value) {
    document.querySelectorAll('.diff-card').forEach((c) => {
      c.classList.toggle('selected', c.dataset.diff === value);
    });
  }
  markAudioBtn(value) {
    document.querySelectorAll('.diff-btn[data-audio]').forEach((b) => {
      b.classList.toggle('active', b.dataset.audio === value);
    });
  }

  // ===== Difficulty menu flow =====
  openDiffMenu() {
    initAudio();
    this.hide(this.dom.mainMenu);
    this.show(this.dom.diffMenu);
  }
  closeDiffMenu() {
    this.hide(this.dom.diffMenu);
    this.show(this.dom.mainMenu);
  }
  selectDiff(value) {
    this.selectedDiff = value;
    localStorage.setItem('oqw-difficulty', value);
    this.markDiffCard(value);
    this.dom.diffConfirm.disabled = false;
    beep(900, 0.04, 'square', 0.04);
  }

  // ===== 去人类化：修改“起名弹窗”逻辑为“配置代理节点 ID” =====
  openNamePrompt() {
    initAudio();
    this.show(this.dom.namePrompt);
    // 如果没有生成过机器 ID，默认给一个冷酷的随机十六进制
    let saved = localStorage.getItem('oqw-node-id');
    if (!saved) {
      saved = 'NODE_0x' + Math.floor(Math.random() * 0xFFFFF).toString(16).toUpperCase();
    }
    if (this.dom.nameInput) {
      this.dom.nameInput.value = saved;
      setTimeout(() => this.dom.nameInput.focus(), 60);
    }
    this.refreshNameValidity();
  }
  closeNamePrompt() {
    this.hide(this.dom.namePrompt);
  }
  refreshNameValidity() {
    const v = (this.dom.nameInput?.value || '').trim();
    const ok = v.length > 0;
    if (this.dom.nameConfirm) this.dom.nameConfirm.disabled = !ok;
    if (this.dom.nameNote) {
      this.dom.nameNote.classList.toggle('ready', ok);
      this.dom.nameNote.textContent = ok
        ? '▸ proxy authorization key locked. press CONFIRM.'
        : '▸ input proxy node identification key';
    }
  }
  commitNameAndBegin() {
    const v = (this.dom.nameInput?.value || '').trim();
    if (!v) return;
    localStorage.setItem('oqw-node-id', v); // 存入节点 ID
    localStorage.setItem('oqw-name', v);    // 兼容原本的代码字段
    beep(900, 0.05, 'square', 0.04);
    this.hide(this.dom.namePrompt);
    this.beginCutscene();
  }

  // ===== Cutscene =====
  beginCutscene() {
    initAudio();
    this.hide(this.dom.diffMenu);
    this.hide(this.dom.namePrompt);
    this.show(this.dom.intro);
    this.cutsceneIdx = 0;
    this.typingActive = false;

    [0, 250, 600, 850].forEach((delay) => {
      setTimeout(() => beep(880, 0.14, 'sine', 0.06), delay);
    });

    setTimeout(() => this.showLine(0), 1200);
  }

  showLine(idx) {
    const line = CUTSCENE[idx];
    if (!line) return;
    this.dom.dialogueSpeaker.textContent = line.speaker;
    this.dom.dialogueSpeaker.style.background = SPEAKER_COLORS[line.speaker] || '#1a1a1f';
    this.dom.dialogueSpeaker.style.color = '#fff';
    this.dom.dialogueLine.textContent = '';

    const portraitEl = this.dom.dialoguePortrait;
    if (portraitEl) {
      portraitEl.removeAttribute('src');
      portraitEl.classList.add('missing'); // 彻底隐藏人类头像框
    }

    // 禁用原本的人类语音，因为现在是纯机器代码滚动
    stopVoice();

    this.typingActive = true;
    let i = 0;
    const text = formatLine(line.text);
    const tick = () => {
      if (!this.typingActive) {
        this.dom.dialogueLine.textContent = text;
        return;
      }
      if (i < text.length) {
        i++;
        this.dom.dialogueLine.textContent = text.slice(0, i);
        if (text[i - 1] !== ' ' && Math.random() < 0.25) {
          // 打字音效调整为更清脆、更像电传打字机或电脑计算的嘟嘟声
          beep(2000 + Math.random() * 300, 0.003, 'square', 0.008);
        }
        this.typewriterTimer = setTimeout(tick, 15);
      } else {
        this.typingActive = false;
      }
    };
    tick();
  }

  advanceCutscene() {
    if (this.typingActive) {
      clearTimeout(this.typewriterTimer);
      this.typingActive = false;
      const line = CUTSCENE[this.cutsceneIdx];
      this.dom.dialogueLine.textContent = formatLine(line.text);
      return;
    }
    this.cutsceneIdx++;
    if (this.cutsceneIdx >= CUTSCENE.length) {
      this.endCutscene();
    } else {
      this.showLine(this.cutsceneIdx);
    }
  }

  endCutscene() {
    stopVoice();
    const flash = document.createElement('div');
    flash.className = 'cutscene-flash';
    document.body.appendChild(flash);
    requestAnimationFrame(() => flash.classList.add('active'));

    setTimeout(() => beep(440, 0.06, 'square', 0.06), 200);
    setTimeout(() => beep(660, 0.06, 'square', 0.06), 320);
    setTimeout(() => beep(880, 0.1, 'square', 0.07), 460);

    setTimeout(() => {
      this.hide(this.dom.intro);
      document.body.classList.remove('menu-mode');
      this.scene.start('TutorialScene', { difficulty: this.selectedDiff });
      setTimeout(() => {
        flash.classList.remove('active');
        setTimeout(() => flash.remove(), 700);
      }, 100);
    }, 700);
  }
}