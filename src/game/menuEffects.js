// Menu background effects — layered on top of the static menu-bg image
// with a transparent canvas overlay. Adds ambient motion to the menu scene:
// dust in the projector beam, steam from the mug, rain streaks on the window,
// and faint twinkles in the city lights.

const REGIONS = {
  beam: {
    projector: { x: 0.42, y: 0.88 },
    wall: { x: 0.03, y: 0.03, w: 0.43, h: 0.66 },
  },
  mug: { x: 0.8, y: 0.66, w: 0.03, h: 0.04 },
  window: { x: 0.65, y: 0.05, w: 0.25, h: 0.48 },
  city: { x: 0.66, y: 0.12, w: 0.23, h: 0.32 },
};

const PARTICLE_LIMITS = {
  dust: 50,
  rain: 14,
  steam: 6,
  twinkle: 12,
};

export class MenuEffects {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = {
      dust: [],
      rain: [],
      steam: [],
      twinkle: [],
    };
    this.lastT = performance.now();
    this.running = false;
    this.handleResize = this.handleResize.bind(this);
    this.tick = this.tick.bind(this);
  }

  start() {
    if (!this.canvas || this.running) return;
    this.handleResize();
    window.addEventListener('resize', this.handleResize);
    this.running = true;
    this.lastT = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.handleResize);
    if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const key of Object.keys(this.particles)) this.particles[key] = [];
  }

  handleResize() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = rect.width;
    this.H = rect.height;
  }

  tick(t) {
    if (!this.running) return;
    const dt = Math.min(0.05, (t - this.lastT) / 1000);
    this.lastT = t;

    this.updateDust(dt);
    this.updateRain(dt);
    this.updateSteam(dt);
    this.updateTwinkles(dt);

    this.render();
    this.rafId = requestAnimationFrame(this.tick);
  }

  updateDust(dt) {
    const particles = this.particles.dust;
    if (particles.length < PARTICLE_LIMITS.dust && Math.random() < dt * 12) {
      const region = REGIONS.beam;
      const wallX = region.wall.x + Math.random() * region.wall.w;
      const wallY = region.wall.y + Math.random() * region.wall.h;
      const t = 0.15 + Math.random() * 0.85;
      const px = region.projector.x + (wallX - region.projector.x) * t;
      const py = region.projector.y + (wallY - region.projector.y) * t;
      particles.push({
        x: px * this.W,
        y: py * this.H,
        vx: (Math.random() - 0.5) * 6,
        vy: -8 - Math.random() * 12,
        life: 0,
        maxLife: 2.5 + Math.random() * 2.5,
        size: 0.7 + Math.random() * 1.3,
        alpha: 0.18 + Math.random() * 0.22,
      });
    }
    for (const particle of particles) {
      particle.life += dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx += (Math.random() - 0.5) * 5 * dt;
    }
    this.particles.dust = particles.filter((particle) => particle.life < particle.maxLife);
  }

  updateRain(dt) {
    const particles = this.particles.rain;
    if (particles.length < PARTICLE_LIMITS.rain && Math.random() < dt * 4) {
      const region = REGIONS.window;
      particles.push({
        x: (region.x + Math.random() * region.w) * this.W,
        y: (region.y + Math.random() * 0.05) * this.H,
        vy: 60 + Math.random() * 40,
        len: 8 + Math.random() * 12,
        life: 0,
        maxLife: 1.6 + Math.random() * 1.4,
        alpha: 0.18 + Math.random() * 0.22,
      });
    }
    for (const particle of particles) {
      particle.life += dt;
      particle.y += particle.vy * dt;
    }
    const winBottom = (REGIONS.window.y + REGIONS.window.h) * this.H;
    this.particles.rain = particles.filter((particle) => particle.y < winBottom && particle.life < particle.maxLife);
  }

  updateSteam(dt) {
    const particles = this.particles.steam;
    if (particles.length < PARTICLE_LIMITS.steam && Math.random() < dt * 2) {
      const region = REGIONS.mug;
      particles.push({
        x: (region.x + Math.random() * region.w) * this.W,
        y: (region.y + region.h) * this.H,
        vx: (Math.random() - 0.5) * 6,
        vy: -12 - Math.random() * 8,
        life: 0,
        maxLife: 3.0 + Math.random() * 1.5,
        size: 4 + Math.random() * 4,
      });
    }
    for (const particle of particles) {
      particle.life += dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.size += dt * 4;
    }
    this.particles.steam = particles.filter((particle) => particle.life < particle.maxLife);
  }

  updateTwinkles(dt) {
    const particles = this.particles.twinkle;
    if (particles.length < PARTICLE_LIMITS.twinkle && Math.random() < dt * 3) {
      const region = REGIONS.city;
      particles.push({
        x: (region.x + Math.random() * region.w) * this.W,
        y: (region.y + Math.random() * region.h) * this.H,
        life: 0,
        maxLife: 0.7 + Math.random() * 1.4,
        size: 1.0 + Math.random() * 1.4,
        warm: Math.random() < 0.6,
      });
    }
    for (const particle of particles) particle.life += dt;
    this.particles.twinkle = particles.filter((particle) => particle.life < particle.maxLife);
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.W, this.H);

    for (const particle of this.particles.dust) {
      const fadeIn = Math.min(1, particle.life / 0.4);
      const fadeOut = Math.min(1, (particle.maxLife - particle.life) / 0.6);
      const alpha = particle.alpha * fadeIn * fadeOut;
      ctx.fillStyle = `rgba(220, 230, 245, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const particle of this.particles.rain) {
      ctx.strokeStyle = `rgba(200, 215, 230, ${particle.alpha})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(particle.x, particle.y + particle.len);
      ctx.stroke();
    }

    for (const particle of this.particles.steam) {
      const fadeOut = (particle.maxLife - particle.life) / particle.maxLife;
      ctx.fillStyle = `rgba(220, 220, 220, ${0.1 * fadeOut})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const particle of this.particles.twinkle) {
      const norm = particle.life / particle.maxLife;
      const pulse = Math.sin(norm * Math.PI);
      const color = particle.warm ? '255, 175, 90' : '120, 200, 220';
      ctx.fillStyle = `rgba(${color}, ${pulse * 0.75})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * (0.7 + pulse * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}