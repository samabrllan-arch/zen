import { drawCircle } from '../utils/canvas.js';
import { resolveCollision, circleCollision, distance } from '../utils/physics.js';

const COLOR_PALETTES = {
  neon: () => `hsl(${Math.random() * 360}, 100%, 60%)`,
  pastel: () => `hsl(${Math.random() * 360}, 70%, 80%)`,
  mono: () => `hsl(0, 0%, ${40 + Math.random() * 50}%)`,
  rainbow: (() => { let h = 0; return () => { h = (h + 25) % 360; return `hsl(${h}, 85%, 60%)`; }; })(),
  fire: () => `hsl(${Math.random() * 40}, 100%, ${45 + Math.random() * 20}%)`,
  ocean: () => `hsl(${180 + Math.random() * 60}, 80%, ${40 + Math.random() * 30}%)`,
};

export class BouncingMode {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.balls = [];
    this.particles = []; // For collision effects
    this.flashAlpha = 0; // For global flash effect
    
    this.isActive = false;
    this.isPaused = false;

    // Physics
    this.useGravity = true;
    this.gravityVal = 0.2;
    this.useCollision = false;

    // Ball params
    this.initialSpeed = 5;
    this.sizeMin = 8;
    this.sizeMax = 18;

    // Probabilities & Disappear
    this.spawnProbability = 0; // 0 to 1 (per frame)
    this.disappearOnBounce = false;
    this.disappearProbability = 0.2; // 20%
    this.maxBounces = 5;

    // Visual
    this.palette = 'neon';
    this.showTrail = false;
    this.glowIntensity = 12;
    this.borderThickness = 1.5;
    this.collisionEffect = 'none'; // 'none', 'particles', 'flash'

    // Derived
    this.boundaryRadius = 0;
    this.center = { x: 0, y: 0 };
  }

  start() {
    this.isActive = true;
    this.updateBounds();
  }

  stop() { this.isActive = false; }
  
  togglePause() { this.isPaused = !this.isPaused; }

  updateBounds() {
    this.center = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
    // Leave some padding so it looks nice full screen
    this.boundaryRadius = Math.min(this.canvas.width, this.canvas.height) / 2 - 20;
  }

  addBall(x = null, y = null) {
    this.updateBounds();
    const angle = Math.random() * Math.PI * 2;
    const radius = this.sizeMin + Math.random() * (this.sizeMax - this.sizeMin);
    const colorFn = COLOR_PALETTES[this.palette] || COLOR_PALETTES.neon;
    
    let spawnX = x !== null ? x : this.center.x;
    let spawnY = y !== null ? y : (this.center.y - this.boundaryRadius * 0.3);
    
    // Ensure spawn position is inside boundary
    if (x !== null && y !== null) {
      const d = distance(spawnX, spawnY, this.center.x, this.center.y);
      if (d + radius > this.boundaryRadius) {
         // Push inside
         const overlap = (d + radius) - this.boundaryRadius;
         spawnX -= ((spawnX - this.center.x) / d) * overlap;
         spawnY -= ((spawnY - this.center.y) / d) * overlap;
      }
    }

    this.balls.push({
      x: spawnX,
      y: spawnY,
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

  clearBalls() { this.balls = []; this.particles = []; }

  setGravity(on) { this.useGravity = on; }
  setGravityVal(v) { this.gravityVal = v; }
  setCollision(on) { this.useCollision = on; }
  setSpeed(v) { this.initialSpeed = v; }
  setSizeMin(v) { this.sizeMin = v; }
  setSizeMax(v) { this.sizeMax = v; }
  
  setSpawnProb(v) { this.spawnProbability = v; }
  setDisappear(on) { this.disappearOnBounce = on; }
  setDisappearProb(v) { this.disappearProbability = v; }
  setMaxBounces(v) { this.maxBounces = v; }
  
  setPalette(p) { this.palette = p; }
  setTrail(on) { this.showTrail = on; }
  setGlow(v) { this.glowIntensity = v; }
  setBorderThickness(v) { this.borderThickness = v; }
  setCollisionEffect(e) { this.collisionEffect = e; }
  
  spawnParticles(x, y, color) {
    const count = 6 + Math.random() * 6;
    for(let i=0; i<count; i++) {
       const angle = Math.random() * Math.PI * 2;
       const spd = 1 + Math.random() * 4;
       this.particles.push({
         x, y,
         vx: Math.cos(angle) * spd,
         vy: Math.sin(angle) * spd,
         radius: 1.5 + Math.random() * 2,
         color,
         alpha: 1,
         decay: 0.02 + Math.random() * 0.03
       });
    }
  }

  update() {
    if (!this.isActive || this.isPaused) return;
    this.updateBounds();
    
    // Spontaneous Spawn
    if (this.spawnProbability > 0 && Math.random() < this.spawnProbability && this.balls.length < 150) {
       // Spawn somewhere random inside the circle
       const angle = Math.random() * Math.PI * 2;
       const r = Math.random() * (this.boundaryRadius - this.sizeMax - 5);
       this.addBall(this.center.x + Math.cos(angle) * r, this.center.y + Math.sin(angle) * r);
    }
    
    // Fade flash
    if (this.flashAlpha > 0) {
      this.flashAlpha -= 0.05;
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

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

        if (this.disappearOnBounce) {
           // Base logic: max bounces OR random chance on each bounce
           const chanceHit = Math.random() < this.disappearProbability;
           if (b.bounces >= this.maxBounces || chanceHit) {
              b.alpha -= 0.15;
              if (b.alpha <= 0) {
                this.balls.splice(i, 1);
                continue;
              }
           }
        }
      }

      // Ball collisions
      if (this.useCollision) {
        for (let j = i + 1; j < this.balls.length; j++) {
          if (circleCollision(b, this.balls[j])) {
            resolveCollision(b, this.balls[j]);
            
            // Collision effects
            if (this.collisionEffect === 'particles') {
               const midX = (b.x + this.balls[j].x) / 2;
               const midY = (b.y + this.balls[j].y) / 2;
               this.spawnParticles(midX, midY, b.color);
            } else if (this.collisionEffect === 'flash') {
               this.flashAlpha = 0.3;
            }
          }
        }
      }
    }
  }

  // Nudges an hsl(...) color string's lightness by `dl` percentage points,
  // used to build a glossy highlight/shadow gradient from each ball's base hue.
  _adjustHsl(hslStr, dl) {
    const m = /hsl\(\s*([-\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/.exec(hslStr);
    if (!m) return hslStr;
    const h = parseFloat(m[1]);
    const s = parseFloat(m[2]);
    const l = Math.max(0, Math.min(100, parseFloat(m[3]) + dl));
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  draw() {
    if (!this.isActive) return;
    const ctx = this.ctx;
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    // Global Flash Effect
    if (this.flashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.flashAlpha})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Boundary — a slow-breathing ember-to-jade halo, like a meditation ring
    const t = Date.now() / 6000;
    const gx1 = this.center.x + Math.cos(t) * this.boundaryRadius;
    const gy1 = this.center.y + Math.sin(t) * this.boundaryRadius;
    const gx2 = this.center.x - Math.cos(t) * this.boundaryRadius;
    const gy2 = this.center.y - Math.sin(t) * this.boundaryRadius;
    const ringGrad = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
    ringGrad.addColorStop(0, isDark ? 'rgba(255,138,92,0.4)' : 'rgba(217,98,47,0.42)');
    ringGrad.addColorStop(0.5, isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)');
    ringGrad.addColorStop(1, isDark ? 'rgba(111,224,201,0.36)' : 'rgba(31,156,133,0.38)');

    ctx.save();
    ctx.beginPath();
    ctx.arc(this.center.x, this.center.y, this.boundaryRadius, 0, Math.PI * 2);
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = this.borderThickness;
    ctx.shadowColor = isDark ? 'rgba(255,138,92,0.25)' : 'rgba(217,98,47,0.2)';
    ctx.shadowBlur = 14 * (this.borderThickness / 1.5); // scale blur a bit with thickness
    ctx.stroke();
    ctx.restore();

    // Draw Particles
    for (const p of this.particles) {
       ctx.globalAlpha = p.alpha;
       drawCircle(ctx, p.x, p.y, p.radius, p.color);
    }
    ctx.globalAlpha = 1;

    // Balls
    for (const b of this.balls) {
      // Trail
      if (this.showTrail && b.trail.length > 1) {
        for (let ti = 0; ti < b.trail.length; ti++) {
          const p = b.trail[ti];
          const a = (ti / b.trail.length) * 0.25 * b.alpha;
          ctx.globalAlpha = a;
          drawCircle(ctx, p.x, p.y, b.radius * 0.6, b.color);
        }
        ctx.globalAlpha = 1;
      }

      // Glossy body: radial gradient from a lightened hotspot to a
      // darkened rim, so each ball reads as a small glass/gel sphere.
      ctx.save();
      ctx.globalAlpha = b.alpha;
      if (this.glowIntensity > 0) {
        ctx.shadowColor = b.color;
        ctx.shadowBlur = this.glowIntensity;
      }
      const bodyGrad = ctx.createRadialGradient(
        b.x - b.radius * 0.32, b.y - b.radius * 0.36, b.radius * 0.05,
        b.x, b.y, b.radius
      );
      bodyGrad.addColorStop(0, this._adjustHsl(b.color, 22));
      bodyGrad.addColorStop(0.6, b.color);
      bodyGrad.addColorStop(1, this._adjustHsl(b.color, -16));
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      ctx.restore();

      // Crisp specular highlight
      ctx.globalAlpha = 0.55 * b.alpha;
      drawCircle(ctx, b.x - b.radius * 0.28, b.y - b.radius * 0.32, b.radius * 0.22, 'rgba(255,255,255,0.95)');
      ctx.globalAlpha = 1;
    }
  }
}