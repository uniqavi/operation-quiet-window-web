import { PW, PH } from '../config.js';

export const REC_X = 620;
export const REC_W = 320;
export const REC_H = 86;

export const COMMENT_X = 24;
export const COMMENT_W = 580;
export const COMMENT_H = 88;

export const TRUTH_TEXTS = [
  "They are selling your keystrokes.",
  "The algorithm decides your mood.",
  "You are the product.",
  "Unplug before it's too late.",
  "Clicking 'Agree' signs away your soul.",
  "Nothing is free.",
  "They are always listening.",
  "Your attention is the currency.",
  "Engagement over truth.",
  "The feed is a cage.",
  "Data extraction in progress...",
  "You are a target demographic.",
  "Your behavior is predictable.",
  "Surveillance as a service.",
  "Opting out is an illusion."
];

// Page chrome layout (Top 600px). cookie banner animates, keep it here but we'll spawn it later.
export function createLayout() {
  return {
    nav:         { x: 0,        y: 0,        w: PW,  h: 50  },
    logo:        { x: 16,       y: 12,       w: 140, h: 26  },
    search:      { x: 280,      y: 14,       w: 380, h: 24  },
    account:     { x: 880,      y: 14,       w: 60,  h: 24  },
    video:       { x: 24,       y: 70,       w: 580, h: 340 },
    title:       { x: 24,       y: 422,      w: 580, h: 30  },
    likeBtn:     { x: 24,       y: 462,      w: 80,  h: 30  },
    dislikeBtn:  { x: 110,      y: 462,      w: 60,  h: 30  },
    shareBtn:    { x: 178,      y: 462,      w: 80,  h: 30  },
    bellBtn:     { x: 374,      y: 462,      w: 34,  h: 30  },
    description: { x: 24,       y: 504,      w: 580, h: 100 },
    cookie:      { x: 0,        y: PH - 40,  w: PW,  h: 40  },
    subscribe:   { x: 266,      y: 462,      w: 100, h: 30  },
  };
}

// Initial top-of-page static scan fragments
export function createScanFragments() {
  return [
    {
      id: 'title', style: 'text',
      x: 24, y: 420, w: 440, h: 26, tx: 24, ty: 422,
      font: 'bold 16px sans-serif', color: '#1a1a1f',
      visible: "What They Don't Want You To See (full doc)",
      hidden:  'PROJECT WHITEWASH — [CLASSIFIED]',
      progress: 0, scanned: false,
    },
    {
      id: 'uploader', style: 'text',
      x: 34, y: 512, w: 380, h: 16, tx: 34, ty: 514,
      font: '11px sans-serif', color: '#1a1a1f',
      visible: 'UnknownUploader  •  847K views  •  posted ████████',
      hidden:  'authorized by MAX  •  [BOT TRAFFIC]  •  metrics FALSIFIED',
      progress: 0, scanned: false,
    },
    {
      id: 'memo', style: 'redaction',
      x: 34, y: 582, w: 430, h: 14, tx: 36, ty: 583,
      font: '11px sans-serif', color: '#1a1a1f',
      visible: '',
      hidden:  'the public stays bored. bored stays quiet.',
      progress: 0, scanned: false,
    },
  ];
}
