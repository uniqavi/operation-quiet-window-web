// Agent: 2 sidebar recommendation cards leave their slots and home in on
// the player. After ~7s they return. Phaser-free.

import { AGENTS, DAMAGE } from '../../config.js';

import { aabb, dist, playerBox } from '../physics.js';
import { beep } from '../audio.js';
import { drawRecCard } from '../draw.js';
import { damagePlayer } from '../combat.js';

const T = AGENTS.chasingRecs;

export function updateAll(agents, dt, state) {
  for (const a of agents) update(a, dt, state);
}

function update(a, dt, state) {
  const p = state.player;
  if (a.state === 'idle') {
    const slot = state.dynamicRecs.find(r => r.idx === a.recIdx);
    if (!slot) return;
    const cx = slot.x + slot.w / 2;
    const cy = slot.y + slot.h / 2;
    if (dist(p.x, p.y, cx, cy) < a.triggerR) {
      a.state = 'awakening';
      a.life = 0;
      beep(180, 0.18, 'sawtooth', 0.08);
      beep(280, 0.18, 'sawtooth', 0.06);
    } else {
      a.x = slot.x;
      a.y = slot.y;
    }
  } else if (a.state === 'awakening') {
    a.life += dt;
    if (a.life > T.awakenDuration) {
      a.state = 'chasing';
      a.life = 0;
    }
  } else if (a.state === 'chasing') {
    a.life += dt;
    const cx = a.x + a.w / 2;
    const cy = a.y + a.h / 2;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    a.vx += (dx / d) * T.accel * dt;
    a.vy += (dy / d) * T.accel * dt;
    a.vx *= T.damping;
    a.vy *= T.damping;
    a.x += a.vx * dt;
    a.y += a.vy * dt;

    const pbx = p.x - p.size / 2;
    const pby = p.y - p.size * 0.375;
    const pbw = p.size;
    const pbh = p.size * 0.75;
        
    // Rect-Rect collision
    if (pbx < a.x + a.w && pbx + pbw > a.x && pby < a.y + a.h && pby + pbh > a.y) {
      const dx = p.x - (a.x + a.w / 2);
      const dy = p.y - (a.y + a.h / 2);
      const len = Math.hypot(dx, dy) || 1;
      damagePlayer(state, DAMAGE.chasingRec, (dx / len) * T.knockMag, (dy / len) * T.knockMag);
      a.state = 'idle'; // "consumes" the agent after it hits
      noise(0.2, 0.1);
    }

    if (a.life > T.chaseDuration) {
      a.state = 'returning';
      a.life = 0;
    }
  } else if (a.state === 'returning') {
    const slot = state.dynamicRecs.find(r => r.idx === a.recIdx);
    if (!slot) return;
    a.x += (slot.x - a.x) * Math.min(1, dt * 3);
    a.y += (slot.y - a.y) * Math.min(1, dt * 3);
    if (dist(a.x, a.y, slot.x, slot.y) < 5) {
      a.state = 'idle';
      a.vx = 0;
      a.vy = 0;
    }
  }
}

// True if the rec slot at idx is currently the chasing agent (so GameScene
// skips the idle card and draws the empty slot frame instead).
export function isAgentSlot(agents, idx) {
  return agents.some((a) => a.recIdx === idx && a.state !== 'idle');
}

// Draw the empty slot when an agent has left it.
export function drawEmptySlot(ctx, slot) {
  ctx.fillStyle = '#222';
  ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
  ctx.setLineDash([]);
  ctx.fillStyle = '#666';
  ctx.font = '10px ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('[ slot empty ]', slot.x + 10, slot.y + slot.h / 2);
}

// Draw all active (non-idle) chasing rec agents.
export function drawAgents(ctx, agents, state) {
  for (const a of agents) {
    if (a.state === 'idle') continue;
    const wobbleX = a.state === 'awakening' ? Math.sin(state.time * 30) * 4 : 0;
    drawRecCard(ctx, a.x + wobbleX, a.y, a.w, a.h, a.recIdx, true, a.state, state.time);
  }
}
