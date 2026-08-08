export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function circleCollision(c1, c2) {
  return distance(c1.x, c1.y, c2.x, c2.y) <= (c1.radius + c2.radius);
}

export function pointInCircle(px, py, cx, cy, radius) {
  return distance(px, py, cx, cy) <= radius;
}

export function resolveCollision(particle, otherParticle) {
  const xVelocityDiff = particle.vx - otherParticle.vx;
  const yVelocityDiff = particle.vy - otherParticle.vy;

  const xDist = otherParticle.x - particle.x;
  const yDist = otherParticle.y - particle.y;

  // Prevent accidental overlap from sticking
  if (xVelocityDiff * xDist + yVelocityDiff * yDist >= 0) {
    const angle = -Math.atan2(otherParticle.y - particle.y, otherParticle.x - particle.x);

    const m1 = particle.mass || 1;
    const m2 = otherParticle.mass || 1;

    const u1 = rotate(particle.vx, particle.vy, angle);
    const u2 = rotate(otherParticle.vx, otherParticle.vy, angle);

    const v1 = { x: u1.x * (m1 - m2) / (m1 + m2) + u2.x * 2 * m2 / (m1 + m2), y: u1.y };
    const v2 = { x: u2.x * (m2 - m1) / (m1 + m2) + u1.x * 2 * m1 / (m1 + m2), y: u2.y };

    const vFinal1 = rotate(v1.x, v1.y, -angle);
    const vFinal2 = rotate(v2.x, v2.y, -angle);

    particle.vx = vFinal1.x;
    particle.vy = vFinal1.y;
    otherParticle.vx = vFinal2.x;
    otherParticle.vy = vFinal2.y;
  }
}

function rotate(velocity_x, velocity_y, angle) {
  return {
    x: velocity_x * Math.cos(angle) - velocity_y * Math.sin(angle),
    y: velocity_x * Math.sin(angle) + velocity_y * Math.cos(angle)
  };
}
