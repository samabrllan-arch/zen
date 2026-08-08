export function setupCanvas(canvasId) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  
  window.addEventListener('resize', resize);
  resize();
  
  return { canvas, ctx };
}

export function drawCircle(ctx, x, y, radius, color, isStroke = false, lineWidth = 2) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  if (isStroke) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
}

export function drawPolygon(ctx, x, y, radius, sides, color, rotation = 0) {
  if (sides < 3) return;
  ctx.beginPath();
  const step = (Math.PI * 2) / sides;
  for (let i = 0; i < sides; i++) {
    const angle = rotation + i * step;
    const px = x + radius * Math.cos(angle);
    const py = y + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export function drawArrow(ctx, x, y, angle, length, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  
  // Línea principal
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(length, 0);
  ctx.stroke();
  
  // Cabeza de la flecha
  ctx.beginPath();
  ctx.moveTo(length, 0);
  ctx.lineTo(length - 5, -3);
  ctx.lineTo(length - 5, 3);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  
  ctx.restore();
}
