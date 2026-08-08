import { drawPolygon, drawArrow } from '../utils/canvas.js';
import { distance, pointInCircle } from '../utils/physics.js';

export class ArcheryMode {
  constructor(canvas, ctx, updateScoreUI) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.updateScoreUI = updateScoreUI;
    
    this.targets = [];
    this.arrows = [];
    this.particles = [];
    
    this.score = 0;
    this.fireRate = 1000; // ms
    this.damage = 1;
    this.lastFireTime = 0;
    
    this.center = { x: canvas.width / 2, y: canvas.height / 2 };
    this.spawnerAngle = 0;
    
    this.isActive = false;
  }
  
  start() {
    this.isActive = true;
    this.score = 0;
    this.targets = [];
    this.arrows = [];
    this.particles = [];
    this.updateScoreUI(this.score);
  }
  
  stop() {
    this.isActive = false;
  }
  
  upgrade(type) {
    if (type === 'speed' && this.score >= 10) {
      this.score -= 10;
      this.fireRate = Math.max(200, this.fireRate - 100);
      this.updateScoreUI(this.score);
      return true;
    }
    if (type === 'damage' && this.score >= 20) {
      this.score -= 20;
      this.damage += 1;
      this.updateScoreUI(this.score);
      return true;
    }
    return false;
  }
  
  spawnTarget() {
    if (this.targets.length < 5 && Math.random() < 0.02) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.min(this.canvas.width, this.canvas.height) * 0.4;
      this.targets.push({
        x: this.center.x + Math.cos(angle) * dist,
        y: this.center.y + Math.sin(angle) * dist,
        radius: 20 + Math.random() * 20,
        sides: Math.floor(3 + Math.random() * 5),
        hp: 3 * this.damage, // Escala con el daño para que no mueran de un golpe al inicio siempre
        color: `hsl(${Math.random() * 360}, 70%, 60%)`,
        rotation: 0,
        rotSpeed: (Math.random() - 0.5) * 0.05
      });
    }
  }
  
  fireArrow(time) {
    if (time - this.lastFireTime > this.fireRate && this.targets.length > 0) {
      this.lastFireTime = time;
      const target = this.targets[0]; // Apunta al más viejo
      const angle = Math.atan2(target.y - this.center.y, target.x - this.center.x);
      
      this.arrows.push({
        x: this.center.x,
        y: this.center.y,
        vx: Math.cos(angle) * 5,
        vy: Math.sin(angle) * 5,
        angle: angle,
        life: 200
      });
    }
  }
  
  createParticles(x, y, color) {
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 1,
        color
      });
    }
  }
  
  update(time) {
    if (!this.isActive) return;
    
    this.center = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
    
    this.spawnTarget();
    this.fireArrow(time);
    
    // Update targets
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      t.rotation += t.rotSpeed;
    }
    
    // Update arrows
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.x += a.vx;
      a.y += a.vy;
      a.life--;
      
      if (a.life <= 0 || a.x < 0 || a.x > this.canvas.width || a.y < 0 || a.y > this.canvas.height) {
        this.arrows.splice(i, 1);
        continue;
      }
      
      // Collision with targets
      for (let j = this.targets.length - 1; j >= 0; j--) {
        const t = this.targets[j];
        if (pointInCircle(a.x, a.y, t.x, t.y, t.radius)) {
          t.hp -= this.damage;
          this.arrows.splice(i, 1);
          this.createParticles(a.x, a.y, '#fff');
          
          if (t.hp <= 0) {
            this.createParticles(t.x, t.y, t.color);
            this.score += 5;
            this.updateScoreUI(this.score);
            this.targets.splice(j, 1);
          }
          break; // Arrow destroyed
        }
      }
    }
    
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }
  
  draw() {
    if (!this.isActive) return;
    
    // Draw central shooter
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.beginPath();
    this.ctx.arc(this.center.x, this.center.y, 30, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Draw targets
    for (const t of this.targets) {
      drawPolygon(this.ctx, t.x, t.y, t.radius, t.sides, t.color, t.rotation);
      // Health bar
      this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
      this.ctx.fillRect(t.x - 15, t.y + t.radius + 5, 30, 4);
      this.ctx.fillStyle = '#fff';
      this.ctx.fillRect(t.x - 15, t.y + t.radius + 5, 30 * (t.hp / (3 * this.damage)), 4);
    }
    
    // Draw arrows
    for (const a of this.arrows) {
      drawArrow(this.ctx, a.x, a.y, a.angle, 15, '#a5b4fc');
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
