import { drawCircle } from '../utils/canvas.js';
import { resolveCollision, circleCollision, distance } from '../utils/physics.js';

const COLOR_PALETTES = {
  neon:    () => `hsl(${Math.random()*360}, 100%, 60%)`,
  pastel:  () => `hsl(${Math.random()*360}, 70%, 80%)`,
  mono:    () => `hsl(0, 0%, ${40 + Math.random()*50}%)`,
  rainbow: (() => { let h = 0; return () => { h = (h + 25) % 360; return `hsl(${h}, 85%, 60%)`; }; })(),
  fire:    () => `hsl(${Math.random()*40}, 100%, ${45 + Math.random()*20}%)`,
  ocean:   () => `hsl(${180 + Math.random()*60}, 80%, ${40 + Math.random()*30}%)`,
};

export class BouncingMode {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.balls = [];
    this.isActive = false;

    // Physics
    this.useGravity = true;
    this.gravityVal = 0.2;
    this.useCollision = false;

    // Ball params
    this.initialSpeed = 5;
    this.sizeMin = 8;
    this.sizeMax = 18;

    // Disappear
    this.disappearOnBounce = false;
    this.maxBounces = 5;

    // Visual
    this.palette = 'neon';
    this.showTrail = false;
    this.glowIntensity = 12;

    // Derived
    this.boundaryRadius = 0;
    this.center = { x: 0, y: 0 };
  }

  start() {
    this.isActive = true;
    this.updateBounds();
  }

  stop() { this.isActive = false; }

  updateBounds() {
    this.center = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
    this.boundaryRadius = Math.min(this.canvas.width, this.canvas.height) / 2 - 16;
  }

  addBall() {
    this.updateBounds();
    const angle = Math.random() * Math.PI * 2;
    const radius = this.sizeMin + Math.random() * (this.sizeMax - this.sizeMin);
    const colorFn = COLOR_PALETTES[this.palette] || COLOR_PALETTES.neon;
    this.balls.push({
      x: this.center.x,
      y: this.center.y - this.boundaryRadius * 0.3,
      vx: Math.cos(angle) * this.initialSpeed,
      vy: Math.sin(angle) * this.initialSpeed,
      radius,
      mass: radius,
      color: colorFn(),
      bounces: 0,
      alpha: 1,
      trail: [],
    });
  }

  clearBalls() { this.balls = []; }

  setGravity(on) { this.useGravity = on; }
  setGravityVal(v) { this.gravityVal = v; }
  setCollision(on) { this.useCollision = on; }
  setSpeed(v) { this.initialSpeed = v; }
  setSizeMin(v) { this.sizeMin = v; }
  setSizeMax(v) { this.sizeMax = v; }
  setDisappear(on) { this.disappearOnBounce = on; }
  setMaxBounces(v) { this.maxBounces = v; }
  setPalette(p) { this.palette = p; }
  setTrail(on) { this.showTrail = on; }
  setGlow(v) { this.glowIntensity = v; }

  update() {
    if (!this.isActive) return;
    this.updateBounds();

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];

      // Gravity
      if (this.useGravity) b.vy += this.gravityVal;

      b.x += b.vx;
      b.y += b.vy;

      // Trail
      if (this.showTrail) {
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 12) b.trail.shift();
      } else {
        b.trail = [];
      }

      // Boundary collision
      const d = distance(b.x, b.y, this.center.x, this.center.y);
      if (d + b.radius > this.boundaryRadius) {
        const nx = (b.x - this.center.x) / d;
        const ny = (b.y - this.center.y) / d;
        const dot = b.vx * nx + b.vy * ny;
        b.vx -= 2 * dot * nx;
        b.vy -= 2 * dot * ny;
        const overlap = (d + b.radius) - this.boundaryRadius;
        b.x -= nx * overlap;
        b.y -= ny * overlap;

        b.bounces++;

        if (this.disappearOnBounce && b.bounces >= this.maxBounces) {
          b.alpha -= 0.15;
          if (b.alpha <= 0) {
            this.balls.splice(i, 1);
            continue;
          }
        }
      }

      // Ball collisions
      if (this.useCollision) {
        for (let j = i + 1; j < this.balls.length; j++) {
          if (circleCollision(b, this.balls[j])) {
            resolveCollision(b, this.balls[j]);
          }
        }
      }
    }
  }

  draw() {
    if (!this.isActive) return;
    const ctx = this.ctx;
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    // Boundary
    ctx.beginPath();
    ctx.arc(this.center.x, this.center.y, this.boundaryRadius, 0, Math.PI * 2);
    ctx.strokeStyle = isDark ? 'rgba(108,99,255,0.1)' : 'rgba(79,70,229,0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Balls
    for (const b of this.balls) {
      // Trail
      if (this.showTrail && b.trail.length > 1) {
        for (let t = 0; t < b.trail.length; t++) {
          const p = b.trail[t];
          const a = (t / b.trail.length) * 0.25 * b.alpha;
          ctx.globalAlpha = a;
          ctx.fillStyle = b.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, b.radius * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Glow
      if (this.glowIntensity > 0) {
        ctx.save();
        ctx.shadowColor = b.color;
        ctx.shadowBlur = this.glowIntensity;
        ctx.globalAlpha = b.alpha;
        drawCircle(ctx, b.x, b.y, b.radius, b.color);
        ctx.restore();
      } else {
        ctx.globalAlpha = b.alpha;
        drawCircle(ctx, b.x, b.y, b.radius, b.color);
      }

      // Inner highlight
      ctx.globalAlpha = 0.3 * b.alpha;
      drawCircle(ctx, b.x - b.radius * 0.22, b.y - b.radius * 0.28, b.radius * 0.35, 'white');
      ctx.globalAlpha = 1;
    }
  }
}
