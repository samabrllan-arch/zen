import { drawCircle } from '../utils/canvas.js';
import { resolveCollision, circleCollision, distance } from '../utils/physics.js';
import { zenAudio } from '../utils/audio.js';

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
    this.timeScale = 1.0; // 0.5x, 1.0x, 1.5x, 2.0x, 3.0x

    // Ball params
    this.initialSpeed = 5;
    this.sizeMin = 8;
    this.sizeMax = 18;

    // Boundary & Area Control
    this.boundaryScale = 0.92; // 0.45 (Compacta), 0.72 (Media), 0.92 (Completa)
    this.boundaryRadius = 0;
    this.center = { x: 0, y: 0 };
    this.boundaryGlow = 0; // Reactive glow on bounce

    // Probabilities & Disappear
    this.spawnProbability = 0; // 0 to 1 (per bounce)
    this.disappearOnBounce = false;
    this.disappearProbability = 0.2; // 20%
    this.maxBounces = 5;

    // Visual
    this.palette = 'neon';
    this.showTrail = false;
    this.glowIntensity = 12;
    this.borderThickness = 2.0;
    this.collisionEffect = 'none'; // 'none', 'particles', 'flash'
  }

  start() {
    this.isActive = true;
    this.updateBounds();
  }

  stop() {
    this.isActive = false;
  }
  
  togglePause() {
    this.isPaused = !this.isPaused;
  }

  updateBounds() {
    this.center = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
    const maxRadius = Math.min(this.canvas.width, this.canvas.height) / 2 - 24;
    this.boundaryRadius = Math.max(70, maxRadius * this.boundaryScale);
  }

  setBoundaryScale(scale) {
    this.boundaryScale = Math.max(0.35, Math.min(1.0, scale));
    this.updateBounds();
    // Softly push balls inside if boundary shrank
    for (const b of this.balls) {
      const d = distance(b.x, b.y, this.center.x, this.center.y);
      if (d + b.radius > this.boundaryRadius) {
        const overlap = (d + b.radius) - this.boundaryRadius;
        if (d > 0.001) {
          b.x -= ((b.x - this.center.x) / d) * overlap;
          b.y -= ((b.y - this.center.y) / d) * overlap;
        }
      }
    }
  }

  setTimeScale(scale) {
    this.timeScale = Math.max(0.2, Math.min(4.0, scale));
  }

  addBall(x = null, y = null) {
    this.updateBounds();
    const angle = Math.random() * Math.PI * 2;
    const radius = this.sizeMin + Math.random() * (this.sizeMax - this.sizeMin);
    const colorFn = COLOR_PALETTES[this.palette] || COLOR_PALETTES.neon;
    
    let spawnX = x !== null ? x : this.center.x;
    let spawnY = y !== null ? y : (this.center.y - this.boundaryRadius * 0.35);
    
    // Ensure spawn position is inside boundary
    if (x !== null && y !== null) {
      const d = distance(spawnX, spawnY, this.center.x, this.center.y);
      if (d + radius > this.boundaryRadius) {
         const overlap = (d + radius) - this.boundaryRadius;
         spawnX -= ((spawnX - this.center.x) / d) * overlap;
         spawnY -= ((spawnY - this.center.y) / d) * overlap;
      }
    }

    const b = {
      x: spawnX,
      y: spawnY,
      vx: Math.cos(angle) * this.initialSpeed,
      vy: Math.sin(angle) * this.initialSpeed,
      radius,
      mass: radius,
      color: colorFn(),
      bounces: 0,
      alpha: 1,
      isFading: false,
      trail: []
    };
    
    this._cacheSprite(b);
    this.balls.push(b);
  }

  clearBalls() {
    this.balls = [];
    this.particles = [];
  }

  get gravity() { return this.useGravity; }
  set gravity(on) { this.setGravity(on); }

  get trail() { return this.showTrail; }
  set trail(on) { this.setTrail(on); }

  setGravity(on) {
    this.useGravity = !!on;
    // If turning gravity off, give low-speed/resting balls a gentle float impulse
    if (!this.useGravity) {
      for (const b of this.balls) {
        const spd = Math.hypot(b.vx, b.vy);
        if (spd < 1.5) {
          const angle = Math.random() * Math.PI * 2;
          b.vx = Math.cos(angle) * this.initialSpeed * 0.9;
          b.vy = Math.sin(angle) * this.initialSpeed * 0.9;
        }
      }
    }
  }

  setGravityVal(v) { this.gravityVal = v; }
  setCollision(on) { this.useCollision = on; }
  setSpeed(v) { this.initialSpeed = v; }
  setSizeMin(v) { this.sizeMin = v; }
  setSizeMax(v) { this.sizeMax = v; }
  
  setSpawnProb(v) { this.spawnProbability = v; }
  setDisappear(on) { this.disappearOnBounce = on; }
  setDisappearProb(v) { this.disappearProbability = v; }
  setMaxBounces(v) { this.maxBounces = v; }
  
  setPalette(p) {
    this.palette = p;
    this.balls.forEach(b => {
      const colorFn = COLOR_PALETTES[this.palette] || COLOR_PALETTES.neon;
      b.color = colorFn();
      this._cacheSprite(b);
    });
  }

  setTrail(on) {
    this.showTrail = !!on;
    if (!this.showTrail) {
      this.balls.forEach(b => { b.trail = []; });
    }
  }

  setGlow(v) { 
    if (this.glowIntensity !== v) {
      this.glowIntensity = v; 
      this.balls.forEach(b => this._cacheSprite(b));
    }
  }

  setBorderThickness(v) { this.borderThickness = v; }
  setCollisionEffect(e) { this.collisionEffect = e; }

  spawnParticles(x, y, color) {
    const count = 4 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
       const angle = Math.random() * Math.PI * 2;
       const spd = 1 + Math.random() * 3.5;
       this.particles.push({
         x, y,
         vx: Math.cos(angle) * spd,
         vy: Math.sin(angle) * spd,
         radius: 1.5 + Math.random() * 2,
         color,
         alpha: 1,
         decay: 0.025 + Math.random() * 0.025
       });
    }
  }

  update() {
    if (!this.isActive || this.isPaused) return;
    this.updateBounds();
    
    // Decay reactive boundary glow
    if (this.boundaryGlow > 0) {
      this.boundaryGlow = Math.max(0, this.boundaryGlow - 0.04);
    }

    // Fade flash
    if (this.flashAlpha > 0) {
      this.flashAlpha -= 0.05;
    }

    const dt = this.timeScale;

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    const maxSpeedCap = 35;

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];

      // Gravity
      if (this.useGravity) {
        b.vy += this.gravityVal * dt;
      }

      // Cap speed to prevent tunnel through boundary
      const curSpeed = Math.hypot(b.vx, b.vy);
      if (curSpeed > maxSpeedCap) {
        const factor = maxSpeedCap / curSpeed;
        b.vx *= factor;
        b.vy *= factor;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Trail
      if (this.showTrail) {
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 18) b.trail.shift();
      } else if (b.trail.length > 0) {
        b.trail = [];
      }

      if (b.isFading) {
        b.alpha -= 0.05 * dt;
        if (b.alpha <= 0) {
          this.balls.splice(i, 1);
          continue;
        }
      }

      // Boundary collision
      const d = distance(b.x, b.y, this.center.x, this.center.y);
      if (d + b.radius > this.boundaryRadius) {
        if (d > 0.0001) {
          const nx = (b.x - this.center.x) / d;
          const ny = (b.y - this.center.y) / d;
          const dot = b.vx * nx + b.vy * ny;
          b.vx -= 2 * dot * nx;
          b.vy -= 2 * dot * ny;
          const overlap = (d + b.radius) - this.boundaryRadius;
          b.x -= nx * overlap;
          b.y -= ny * overlap;
        } else {
          b.x = this.center.x + 1;
          b.y = this.center.y + 1;
        }

        b.bounces++;
        this.boundaryGlow = 1.0; // Reactive glow ring

        // Melodic sound on bounce
        zenAudio.playBounce(b.x, b.y, b.radius, this.canvas.width, this.sizeMin, this.sizeMax);

        // Spawn on bounce
        if (this.spawnProbability > 0 && Math.random() < this.spawnProbability && this.balls.length < 150) {
           this.addBall(); 
        }

        // Disappear on bounce (Probabilistic)
        if (this.disappearProbability > 0 && !b.isFading) {
           if (Math.random() < this.disappearProbability) {
              b.isFading = true;
           }
        }

        // Disappear on bounce (Max Bounces toggle)
        if (this.disappearOnBounce && !b.isFading) {
           if (b.bounces >= this.maxBounces) {
              b.isFading = true;
           }
        }
      }
    }

    // High-Performance Spatial Grid Collision for Ball-Ball interactions
    if (this.useCollision && this.balls.length > 1) {
      this._resolveSpatialCollisions();
    }
  }

  // Broadphase spatial grid partitioning - turns O(N^2) into O(N)
  _resolveSpatialCollisions() {
    const cellSize = Math.max(40, this.sizeMax * 2);
    const grid = new Map();

    const ballCount = this.balls.length;
    for (let i = 0; i < ballCount; i++) {
      const b = this.balls[i];
      const cellX = Math.floor(b.x / cellSize);
      const cellY = Math.floor(b.y / cellSize);
      const key = `${cellX},${cellY}`;
      let list = grid.get(key);
      if (!list) {
        list = [];
        grid.set(key, list);
      }
      list.push(i);
    }

    const neighborOffsets = [
      [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]
    ];

    for (const [key, cellList] of grid.entries()) {
      const [cxStr, cyStr] = key.split(',');
      const cx = parseInt(cxStr);
      const cy = parseInt(cyStr);

      for (let n = 0; n < neighborOffsets.length; n++) {
        const nx = cx + neighborOffsets[n][0];
        const ny = cy + neighborOffsets[n][1];
        const nKey = `${nx},${ny}`;
        const neighborList = grid.get(nKey);
        if (!neighborList) continue;

        const isSameCell = (n === 0);
        for (let i = 0; i < cellList.length; i++) {
          const idxA = cellList[i];
          const ballA = this.balls[idxA];
          const jStart = isSameCell ? (i + 1) : 0;

          for (let j = jStart; j < neighborList.length; j++) {
            const idxB = neighborList[j];
            if (idxA === idxB) continue;
            const ballB = this.balls[idxB];

            if (circleCollision(ballA, ballB)) {
              resolveCollision(ballA, ballB);

              if (this.collisionEffect === 'particles') {
                const midX = (ballA.x + ballB.x) / 2;
                const midY = (ballA.y + ballB.y) / 2;
                this.spawnParticles(midX, midY, ballA.color);
              } else if (this.collisionEffect === 'flash') {
                this.flashAlpha = 0.25;
              }
            }
          }
        }
      }
    }
  }

  _adjustHsl(hslStr, dl) {
    const m = /hsl\(\s*([-\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/.exec(hslStr);
    if (!m) return hslStr;
    const h = parseFloat(m[1]);
    const s = parseFloat(m[2]);
    const l = Math.max(0, Math.min(100, parseFloat(m[3]) + dl));
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  // Pre-renders glowing glass spheres into GPU offscreen canvas
  _cacheSprite(b) {
    const padding = Math.max(15, this.glowIntensity + 6);
    const size = Math.ceil((b.radius + padding) * 2);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    const cx = size / 2;
    const cy = size / 2;

    ctx.save();
    if (this.glowIntensity > 0) {
      ctx.shadowColor = b.color;
      ctx.shadowBlur = this.glowIntensity;
    }
    const bodyGrad = ctx.createRadialGradient(
      cx - b.radius * 0.32, cy - b.radius * 0.36, b.radius * 0.05,
      cx, cy, b.radius
    );
    bodyGrad.addColorStop(0, this._adjustHsl(b.color, 22));
    bodyGrad.addColorStop(0.6, b.color);
    bodyGrad.addColorStop(1, this._adjustHsl(b.color, -16));
    ctx.beginPath();
    ctx.arc(cx, cy, b.radius, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(cx - b.radius * 0.28, cy - b.radius * 0.32, b.radius * 0.22, 0, Math.PI * 2);
    ctx.fill();
    
    b.sprite = canvas;
    b.spriteOffset = cx;
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

    // Boundary Ring — meditation ember-to-jade breathing ring with reactive bounce glow
    const t = Date.now() / 6000;
    const gx1 = this.center.x + Math.cos(t) * this.boundaryRadius;
    const gy1 = this.center.y + Math.sin(t) * this.boundaryRadius;
    const gx2 = this.center.x - Math.cos(t) * this.boundaryRadius;
    const gy2 = this.center.y - Math.sin(t) * this.boundaryRadius;
    const ringGrad = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
    ringGrad.addColorStop(0, isDark ? 'rgba(255,138,92,0.48)' : 'rgba(217,98,47,0.5)');
    ringGrad.addColorStop(0.5, isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)');
    ringGrad.addColorStop(1, isDark ? 'rgba(111,224,201,0.44)' : 'rgba(31,156,133,0.46)');

    ctx.save();
    ctx.beginPath();
    ctx.arc(this.center.x, this.center.y, this.boundaryRadius, 0, Math.PI * 2);
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = this.borderThickness + this.boundaryGlow * 1.5;
    ctx.shadowColor = isDark ? 'rgba(255,138,92,0.35)' : 'rgba(217,98,47,0.3)';
    ctx.shadowBlur = (12 + this.boundaryGlow * 18) * (this.borderThickness / 1.5);
    ctx.stroke();

    // Subtle inner ambient circle
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.035)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Draw Particles
    for (const p of this.particles) {
       ctx.globalAlpha = p.alpha;
       ctx.fillStyle = p.color;
       ctx.beginPath();
       ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
       ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Balls & Trails
    for (const b of this.balls) {
      if (this.showTrail && b.trail.length > 1) {
        ctx.fillStyle = b.color;
        for (let ti = 0; ti < b.trail.length; ti++) {
          const p = b.trail[ti];
          const ratio = (ti + 1) / b.trail.length;
          const a = ratio * 0.45 * b.alpha;
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.arc(p.x, p.y, b.radius * (0.3 + 0.5 * ratio), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      ctx.globalAlpha = b.alpha;
      if (b.sprite) {
        ctx.drawImage(b.sprite, b.x - b.spriteOffset, b.y - b.spriteOffset);
      }
      ctx.globalAlpha = 1;
    }
  }
}