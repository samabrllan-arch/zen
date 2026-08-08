import { drawPolygon, drawArrow } from '../utils/canvas.js';
import { pointInCircle } from '../utils/physics.js';

export class ArcheryMode {
  constructor(canvas, ctx, onScore) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.onScore = onScore;
    
    this.targets = [];
    this.arrows = []; // These are the "Sparks"
    this.particles = [];
    
    this.damage = 1;
    this.isActive = false;
  }
  
  start() {
    this.isActive = true;
    if (this.arrows.length === 0) {
      this.addArrow(); // Start with 1 spark
    }
    if (this.targets.length === 0) {
      this.spawnCluster();
    }
  }
  
  stop() {
    this.isActive = false;
  }

  addArrow() {
    const angle = Math.random() * Math.PI * 2;
    this.arrows.push({
      x: this.canvas.width / 2,
      y: this.canvas.height - 20,
      vx: Math.cos(angle) * 4,
      vy: Math.sin(angle) * 4,
      angle: angle,
      color: '#60a5fa' // accent blue
    });
  }
  
  spawnCluster() {
    this.targets = [];
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // Create a dense grid-like cluster of polygons
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (Math.min(this.canvas.width, this.canvas.height) * 0.4);
      
      this.targets.push({
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist,
        radius: 15 + Math.random() * 20,
        sides: Math.floor(3 + Math.random() * 4),
        hp: 10 + Math.random() * 20,
        maxHp: 30,
        color: `hsl(${Math.random() * 360}, 60%, 40%)`,
        rotation: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.02
      });
    }
  }
  
  createParticles(x, y, color) {
    for (let i = 0; i < 5; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 1,
        color
      });
    }
  }
  
  update(dt, time) {
    if (!this.isActive) return;
    
    // Respawn cluster if empty
    if (this.targets.length === 0) {
      this.spawnCluster();
    }
    
    // Update targets
    for (let i = this.targets.length - 1; i >= 0; i--) {
      this.targets[i].rotation += this.targets[i].rotSpeed;
    }
    
    // Update arrows (Sparks)
    for (let i = 0; i < this.arrows.length; i++) {
      const a = this.arrows[i];
      a.x += a.vx;
      a.y += a.vy;
      
      // Screen bounds collision (Bounce)
      if (a.x < 0 || a.x > this.canvas.width) {
        a.vx *= -1;
        a.x = Math.max(0, Math.min(a.x, this.canvas.width));
      }
      if (a.y < 0 || a.y > this.canvas.height) {
        a.vy *= -1;
        a.y = Math.max(0, Math.min(a.y, this.canvas.height));
      }
      
      a.angle = Math.atan2(a.vy, a.vx);
      
      // Collision with targets
      for (let j = this.targets.length - 1; j >= 0; j--) {
        const t = this.targets[j];
        if (pointInCircle(a.x, a.y, t.x, t.y, t.radius)) {
          // Deal damage
          t.hp -= this.damage;
          this.onScore(this.damage * 0.5); // Give currency based on damage
          
          // Bounce off target
          const nx = (a.x - t.x) / t.radius;
          const ny = (a.y - t.y) / t.radius;
          const dot = a.vx * nx + a.vy * ny;
          a.vx = a.vx - 2 * dot * nx;
          a.vy = a.vy - 2 * dot * ny;
          
          // Push out of target slightly
          a.x += nx * 2;
          a.y += ny * 2;
          
          this.createParticles(a.x, a.y, '#fff');
          
          if (t.hp <= 0) {
            this.createParticles(t.x, t.y, t.color);
            this.onScore(t.maxHp); // Bonus for breaking
            this.targets.splice(j, 1);
          }
          break; // Only hit one target per frame
        }
      }
    }
    
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.03;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }
  
  draw() {
    if (!this.isActive) return;
    
    // Draw targets
    for (const t of this.targets) {
      this.ctx.globalAlpha = 0.8;
      drawPolygon(this.ctx, t.x, t.y, t.radius, t.sides, t.color, t.rotation);
      this.ctx.globalAlpha = 1.0;
      
      // Health bar (very small)
      this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
      this.ctx.fillRect(t.x - 10, t.y + t.radius + 2, 20, 2);
      this.ctx.fillStyle = '#34d399';
      this.ctx.fillRect(t.x - 10, t.y + t.radius + 2, 20 * Math.max(0, t.hp / t.maxHp), 2);
    }
    
    // Draw arrows (Sparks)
    for (const a of this.arrows) {
      drawArrow(this.ctx, a.x, a.y, a.angle, 12, a.color);
    }
    
    // Draw particles
    for (const p of this.particles) {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.life;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1.0;
    }
  }
}
