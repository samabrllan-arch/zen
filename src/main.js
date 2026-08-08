import { setupCanvas } from './utils/canvas.js';
import { BouncingMode } from './modes/bouncing.js';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker
registerSW({ immediate: true });

// Canvas
const { canvas, ctx } = setupCanvas('gameCanvas');

// Engine
const engine = new BouncingMode(canvas, ctx);
engine.start();

// UI refs
const ballCounter = document.getElementById('ball-counter');

function updateCounter() {
  ballCounter.textContent = `${engine.balls.length} ball${engine.balls.length !== 1 ? 's' : ''}`;
}

// ═══ INTERACTION ═══
// Click to spawn ball
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  // Adjust for device pixel ratio if needed, setupCanvas usually handles width/height via CSS
  // but assuming coordinates are 1:1 with canvas size:
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  
  engine.addBall(x, y);
  updateCounter();
});

// Pause Button
const btnPause = document.getElementById('btn-pause');
btnPause.addEventListener('click', () => {
  engine.togglePause();
  if (engine.isPaused) {
    btnPause.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
  } else {
    btnPause.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>`;
  }
});

// Modal UI
const modalOverlay = document.getElementById('modal-overlay');
document.getElementById('btn-settings').addEventListener('click', () => {
  modalOverlay.classList.remove('hidden');
});
document.getElementById('btn-close-modal').addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
});
modalOverlay.addEventListener('mousedown', (e) => {
  if (e.target === modalOverlay) {
    modalOverlay.classList.add('hidden');
  }
});

// ═══ CONTROLS ═══
document.getElementById('btn-add').addEventListener('click', () => {
  engine.addBall();
  updateCounter();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  engine.clearBalls();
  updateCounter();
});

// Gravity
const gravToggle = document.getElementById('opt-gravity');
const gravSlider = document.getElementById('opt-gravity-val');
const gravLabel = document.getElementById('gravity-val-label');
const gravSliderRow = document.getElementById('gravity-slider-row');

gravToggle.addEventListener('change', () => {
  engine.setGravity(gravToggle.checked);
  gravSliderRow.classList.toggle('hidden', !gravToggle.checked);
});

gravSlider.addEventListener('input', () => {
  const v = gravSlider.value / 100;
  engine.setGravityVal(v);
  gravLabel.textContent = v.toFixed(2);
});

// Collision & Effects
document.getElementById('opt-collision').addEventListener('change', (e) => {
  engine.setCollision(e.target.checked);
});

const effectBtns = document.querySelectorAll('.effect-btn');
effectBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    effectBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    engine.setCollisionEffect(btn.dataset.effect);
  });
});

// Disappear
const disappearToggle = document.getElementById('opt-disappear');
const bouncesMaxRow = document.getElementById('bounces-max-row');
const bouncesRow = document.getElementById('bounces-row');

const bouncesSlider = document.getElementById('opt-bounces');
const bouncesLabel = document.getElementById('bounces-label');
const disappearProbSlider = document.getElementById('opt-disappear-prob');
const disappearProbLabel = document.getElementById('disappear-prob-label');

disappearToggle.addEventListener('change', () => {
  engine.setDisappear(disappearToggle.checked);
  bouncesMaxRow.classList.toggle('hidden', !disappearToggle.checked);
  bouncesRow.classList.toggle('hidden', !disappearToggle.checked);
});

bouncesSlider.addEventListener('input', () => {
  engine.setMaxBounces(parseInt(bouncesSlider.value));
  bouncesLabel.textContent = bouncesSlider.value;
});

disappearProbSlider.addEventListener('input', () => {
  const prob = parseInt(disappearProbSlider.value);
  engine.setDisappearProb(prob / 100);
  disappearProbLabel.textContent = prob + '%';
});

// Spawn Prob
const spawnProbSlider = document.getElementById('opt-spawn-prob');
const spawnProbLabel = document.getElementById('spawn-prob-label');
spawnProbSlider.addEventListener('input', () => {
  const prob = parseInt(spawnProbSlider.value);
  engine.setSpawnProb(prob / 1000); // Scale down so 100% isn't chaotic
  spawnProbLabel.textContent = prob + '%';
});

// Speed
const speedSlider = document.getElementById('opt-speed');
const speedLabel = document.getElementById('speed-label');
speedSlider.addEventListener('input', () => {
  engine.setSpeed(parseInt(speedSlider.value));
  speedLabel.textContent = speedSlider.value;
});

// Size
const sizeMinSlider = document.getElementById('opt-size-min');
const sizeMinLabel = document.getElementById('size-min-label');
const sizeMaxSlider = document.getElementById('opt-size-max');
const sizeMaxLabel = document.getElementById('size-max-label');

sizeMinSlider.addEventListener('input', () => {
  engine.setSizeMin(parseInt(sizeMinSlider.value));
  sizeMinLabel.textContent = sizeMinSlider.value;
});
sizeMaxSlider.addEventListener('input', () => {
  engine.setSizeMax(parseInt(sizeMaxSlider.value));
  sizeMaxLabel.textContent = sizeMaxSlider.value;
});

// ═══ STYLE ═══
document.getElementById('opt-darkmode').addEventListener('change', (e) => {
  document.documentElement.setAttribute('data-theme', e.target.checked ? 'dark' : 'light');
  document.querySelector('meta[name="theme-color"]')
    .setAttribute('content', e.target.checked ? '#0a0a0d' : '#e7eae6');
});

const paletteBtns = document.querySelectorAll('.palette-btn');
paletteBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    paletteBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    engine.setPalette(btn.dataset.palette);
  });
});

document.getElementById('opt-trail').addEventListener('change', (e) => {
  engine.setTrail(e.target.checked);
});

const glowSlider = document.getElementById('opt-glow');
const glowLabel = document.getElementById('glow-label');
glowSlider.addEventListener('input', () => {
  engine.setGlow(parseInt(glowSlider.value));
  glowLabel.textContent = glowSlider.value;
});

const borderThickSlider = document.getElementById('opt-border-thick');
const borderThickLabel = document.getElementById('border-thick-label');
borderThickSlider.addEventListener('input', () => {
  engine.setBorderThickness(parseFloat(borderThickSlider.value));
  borderThickLabel.textContent = borderThickSlider.value;
});

// ═══ RANDOM MODE ═══
const randomToggle = document.getElementById('opt-random');
const randomStatus = document.getElementById('random-status');
const randomSpeedSlider = document.getElementById('opt-random-speed');

let randomInterval = null;

function getRandomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function randomizeSettings() {
  // We simulate inputs on the UI so it stays in sync
  
  // Gravity
  const grav = Math.random() > 0.3;
  gravToggle.checked = grav;
  gravToggle.dispatchEvent(new Event('change'));
  if (grav) {
    gravSlider.value = getRandomInt(10, 80);
    gravSlider.dispatchEvent(new Event('input'));
  }

  // Collision
  const col = Math.random() > 0.5;
  const colToggle = document.getElementById('opt-collision');
  colToggle.checked = col;
  colToggle.dispatchEvent(new Event('change'));

  // Speed
  speedSlider.value = getRandomInt(2, 15);
  speedSlider.dispatchEvent(new Event('input'));

  // Size
  const sMin = getRandomInt(4, 20);
  const sMax = getRandomInt(sMin + 5, 60);
  sizeMinSlider.value = sMin;
  sizeMaxSlider.value = sMax;
  sizeMinSlider.dispatchEvent(new Event('input'));
  sizeMaxSlider.dispatchEvent(new Event('input'));

  // Disappear
  const dis = Math.random() > 0.5;
  disappearToggle.checked = dis;
  disappearToggle.dispatchEvent(new Event('change'));
  if (dis) {
    bouncesSlider.value = getRandomInt(2, 30);
    bouncesSlider.dispatchEvent(new Event('input'));
    
    disappearProbSlider.value = getRandomInt(0, 100);
    disappearProbSlider.dispatchEvent(new Event('input'));
  }

  // Trail
  const trail = Math.random() > 0.5;
  const optTrail = document.getElementById('opt-trail');
  optTrail.checked = trail;
  optTrail.dispatchEvent(new Event('change'));

  // Glow
  glowSlider.value = getRandomInt(0, 25);
  glowSlider.dispatchEvent(new Event('input'));
  
  // Border thickness
  borderThickSlider.value = getRandomInt(1, 8);
  borderThickSlider.dispatchEvent(new Event('input'));

  // Palette
  const palettes = ['neon', 'pastel', 'mono', 'rainbow', 'fire', 'ocean'];
  const pal = palettes[getRandomInt(0, palettes.length - 1)];
  const pBtn = document.querySelector(`.palette-btn[data-palette="${pal}"]`);
  if(pBtn) pBtn.click();
  
  // Effect
  const effects = ['none', 'particles', 'flash'];
  const eff = effects[getRandomInt(0, effects.length - 1)];
  const eBtn = document.querySelector(`.effect-btn[data-effect="${eff}"]`);
  if(eBtn) eBtn.click();
}

function startRandom() {
  const speed = parseInt(randomSpeedSlider.value);
  const changeMs = Math.max(800, 5000 - speed * 400);

  randomizeSettings();
  randomInterval = setInterval(randomizeSettings, changeMs);
  
  // Set spawn prob a bit high so it acts automatic
  spawnProbSlider.value = 10;
  spawnProbSlider.dispatchEvent(new Event('input'));
}

function stopRandom() {
  clearInterval(randomInterval);
  randomInterval = null;
  spawnProbSlider.value = 0;
  spawnProbSlider.dispatchEvent(new Event('input'));
}

randomToggle.addEventListener('change', () => {
  if (randomToggle.checked) {
    randomStatus.textContent = 'ON';
    startRandom();
  } else {
    randomStatus.textContent = 'OFF';
    stopRandom();
  }
});

randomSpeedSlider.addEventListener('input', () => {
  if (randomToggle.checked) {
    stopRandom();
    startRandom();
  }
});

// ═══ GAME LOOP ═══
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  engine.update();
  engine.draw();
  if(!engine.isPaused) updateCounter();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
