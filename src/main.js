import { setupCanvas } from './utils/canvas.js';
import { ArcheryMode } from './modes/archery.js';
import { BouncingMode } from './modes/bouncing.js';

// Setup Canvas
const { canvas, ctx } = setupCanvas('gameCanvas');

// UI Elements
const uiMainMenu = document.getElementById('main-menu');
const uiArchery = document.getElementById('ui-archery');
const uiBounce = document.getElementById('ui-bounce');

const btnArchery = document.getElementById('btn-archery');
const btnBounce = document.getElementById('btn-bounce');
const backBtns = document.querySelectorAll('.back-btn');

// Modes
const archery = new ArcheryMode(canvas, ctx, (score) => {
  document.getElementById('archery-score').textContent = score;
});
const bouncing = new BouncingMode(canvas, ctx);

let currentMode = null;
let animationFrameId = null;

// Game Loop
function gameLoop(time) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (currentMode) {
    currentMode.update(time);
    currentMode.draw();
  }
  
  animationFrameId = requestAnimationFrame(gameLoop);
}
animationFrameId = requestAnimationFrame(gameLoop);

// Navigation
function showScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

btnArchery.addEventListener('click', () => {
  showScreen(uiArchery);
  currentMode = archery;
  archery.start();
});

btnBounce.addEventListener('click', () => {
  showScreen(uiBounce);
  currentMode = bouncing;
  bouncing.start();
});

backBtns.forEach(btn => btn.addEventListener('click', () => {
  if (currentMode) currentMode.stop();
  currentMode = null;
  showScreen(uiMainMenu);
}));

// Archery Controls
document.getElementById('btn-upgrade-speed').addEventListener('click', () => {
  archery.upgrade('speed');
});
document.getElementById('btn-upgrade-damage').addEventListener('click', () => {
  archery.upgrade('damage');
});

// Bouncing Controls
document.getElementById('btn-add-ball').addEventListener('click', () => {
  bouncing.addBall();
});
document.getElementById('btn-clear-balls').addEventListener('click', () => {
  bouncing.clearBalls();
});
const speedSlider = document.getElementById('speed-slider');
speedSlider.addEventListener('input', (e) => {
  bouncing.setSpeed(parseFloat(e.target.value));
});
