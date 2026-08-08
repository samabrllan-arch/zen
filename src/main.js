import { setupCanvas } from './utils/canvas.js';
import { BouncingMode } from './modes/bouncing.js';

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

// ═══ TAB LOGIC ═══
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-panel');

tabs.forEach(t => {
  t.addEventListener('click', () => {
    tabs.forEach(b => b.classList.toggle('active', b === t));
    panels.forEach(p => p.classList.toggle('active', p.id === t.dataset.tab));
  });
});

// ═══ CONTROLS TAB ═══
document.getElementById('btn-add').addEventListener('click', () => {
  engine.addBall();
  updateCounter();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  engine.clearBalls();
  updateCounter();
});

// Gravity toggle + slider
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

// Collision
document.getElementById('opt-collision').addEventListener('change', (e) => {
  engine.setCollision(e.target.checked);
});

// Disappear
const disappearToggle = document.getElementById('opt-disappear');
const bouncesRow = document.getElementById('bounces-row');
const bouncesSlider = document.getElementById('opt-bounces');
const bouncesLabel = document.getElementById('bounces-label');

disappearToggle.addEventListener('change', () => {
  engine.setDisappear(disappearToggle.checked);
  bouncesRow.classList.toggle('hidden', !disappearToggle.checked);
});

bouncesSlider.addEventListener('input', () => {
  engine.setMaxBounces(parseInt(bouncesSlider.value));
  bouncesLabel.textContent = bouncesSlider.value;
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

// ═══ STYLE TAB ═══
// Dark mode
document.getElementById('opt-darkmode').addEventListener('change', (e) => {
  document.documentElement.setAttribute('data-theme', e.target.checked ? 'dark' : 'light');
  document.querySelector('meta[name="theme-color"]')
    .setAttribute('content', e.target.checked ? '#08080f' : '#f0f0f5');
});

// Palette
const paletteBtns = document.querySelectorAll('.palette-btn');
paletteBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    paletteBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    engine.setPalette(btn.dataset.palette);
  });
});

// Trail
document.getElementById('opt-trail').addEventListener('change', (e) => {
  engine.setTrail(e.target.checked);
});

// Glow
const glowSlider = document.getElementById('opt-glow');
const glowLabel = document.getElementById('glow-label');
glowSlider.addEventListener('input', () => {
  engine.setGlow(parseInt(glowSlider.value));
  glowLabel.textContent = glowSlider.value;
});

// ═══ RANDOM MODE ═══
const randomToggle = document.getElementById('opt-random');
const randomStatus = document.getElementById('random-status');
const randomSpeedSlider = document.getElementById('opt-random-speed');

let randomInterval = null;
let spawnInterval = null;

function getRandomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function randomizeSettings() {
  // Gravity
  const grav = Math.random() > 0.3;
  engine.setGravity(grav);
  gravToggle.checked = grav;
  if (grav) {
    const gv = Math.random() * 0.8;
    engine.setGravityVal(gv);
    gravSlider.value = gv * 100;
    gravLabel.textContent = gv.toFixed(2);
  }

  // Collision
  const col = Math.random() > 0.5;
  engine.setCollision(col);
  document.getElementById('opt-collision').checked = col;

  // Speed
  const spd = getRandomInt(2, 15);
  engine.setSpeed(spd);
  speedSlider.value = spd;
  speedLabel.textContent = spd;

  // Size
  const sMin = getRandomInt(4, 20);
  const sMax = getRandomInt(sMin + 5, 60);
  engine.setSizeMin(sMin);
  engine.setSizeMax(sMax);
  sizeMinSlider.value = sMin;
  sizeMaxSlider.value = sMax;
  sizeMinLabel.textContent = sMin;
  sizeMaxLabel.textContent = sMax;

  // Disappear
  const dis = Math.random() > 0.5;
  engine.setDisappear(dis);
  disappearToggle.checked = dis;
  if (dis) {
    const bn = getRandomInt(2, 30);
    engine.setMaxBounces(bn);
    bouncesSlider.value = bn;
    bouncesLabel.textContent = bn;
  }

  // Trail
  const trail = Math.random() > 0.5;
  engine.setTrail(trail);
  document.getElementById('opt-trail').checked = trail;

  // Glow
  const glow = getRandomInt(0, 25);
  engine.setGlow(glow);
  glowSlider.value = glow;
  glowLabel.textContent = glow;

  // Palette
  const palettes = ['neon', 'pastel', 'mono', 'rainbow', 'fire', 'ocean'];
  const pal = palettes[getRandomInt(0, palettes.length - 1)];
  engine.setPalette(pal);
  paletteBtns.forEach(b => b.classList.toggle('active', b.dataset.palette === pal));
}

function startRandom() {
  const speed = parseInt(randomSpeedSlider.value);
  const changeMs = Math.max(800, 5000 - speed * 400);
  const spawnMs = Math.max(300, 1200 - speed * 80);

  randomizeSettings();
  randomInterval = setInterval(randomizeSettings, changeMs);
  spawnInterval = setInterval(() => {
    if (engine.balls.length < 80) {
      engine.addBall();
      updateCounter();
    }
  }, spawnMs);
}

function stopRandom() {
  clearInterval(randomInterval);
  clearInterval(spawnInterval);
  randomInterval = null;
  spawnInterval = null;
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
  updateCounter();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
