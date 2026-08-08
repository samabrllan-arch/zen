import { drawCircle } from '../utils/canvas.js';
import { resolveCollision, circleCollision, distance } from '../utils/physics.js';

export class BouncingMode {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    
    this.balls = [];
    this.isActive = false;
    
    this.useGravity = true;
    this.useCollision = false;
    this.gravity = 0.2;
    
    this.boundaryRadius = 0;
    this.center = { x: 0, y: 0 };
  }
  
  start() {
    this.isActive = true;
    if (this.balls.length === 0) {
      this.addBall();
    }
    this.updateBounds();
  }
  
  stop() {
    this.isActive = false;
  }

  setGravity(val) { this.useGravity = val; }
  setCollision(val) { this.useCollision = val; }
  
  updateBounds() {
    this.center = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
    this.boundaryRadius = Math.min(this.canvas.width, this.canvas.height) / 2 - 20;
  }
  
  addBall() {
    const angle = Math.random() * Math.PI * 2;
    const speed = 5;
    this.balls.push({
      x: this.center.x,
      y: this.center.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 10 + Math.random() * 8,
      mass: 1,
      color: `hsl(${Math.random() * 360}, 80%, 70%)`
    });
  }
  
  clearBalls() {
    this.balls = [];
  }
  
  update(dt, time) {
    if (!this.isActive) return;
    this.updateBounds();
    
    for (let i = 0; i < this.balls.length; i++) {
      const b = this.balls[i];
      
      // Apply gravity
      if (this.useGravity) {
        b.vy += this.gravity;
      }
      
      b.x += b.vx;
      b.y += b.vy;
      
      // Boundary collision
      const distToCenter = distance(b.x, b.y, this.center.x, this.center.y);
      if (distToCenter + b.radius > this.boundaryRadius) {
        // Calculate normal vector at point of impact
        const nx = (b.x - this.center.x) / distToCenter;
        const ny = (b.y - this.center.y) / distToCenter;
        
        // Reflect velocity (perfect elasticity)
        const dot = b.vx * nx + b.vy * ny;
        b.vx = b.vx - 2 * dot * nx;
        b.vy = b.vy - 2 * dot * ny;
        
        // Prevent sticking
        const overlap = (distToCenter + b.radius) - this.boundaryRadius;
        b.x -= nx * overlap;
        b.y -= ny * overlap;
      }
      
      // Ball to ball collision
      if (this.useCollision) {
        for (let j = i + 1; j < this.balls.length; j++) {
          const b2 = this.balls[j];
          if (circleCollision(b, b2)) {
            resolveCollision(b, b2);
          }
        }
      }
    }
  }
  
  draw() {
    if (!this.isActive) return;
    
    // Draw boundary
    drawCircle(this.ctx, this.center.x, this.center.y, this.boundaryRadius, 'rgba(255,255,255,0.1)', true, 3);
    
    // Draw balls
    for (const b of this.balls) {
      drawCircle(this.ctx, b.x, b.y, b.radius, b.color);
    }
  }
}
