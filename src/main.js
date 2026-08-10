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
  ballCounter.textContent = `${engine.balls.length} bola${engine.balls.length !== 1 ? 's' : ''}`;
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

const bouncesSlider = document.getElementById('opt-bounces');
const bouncesLabel = document.getElementById('bounces-label');
const disappearProbSlider = document.getElementById('opt-disappear-prob');
const disappearProbLabel = document.getElementById('disappear-prob-label');

disappearToggle.addEventListener('change', () => {
  engine.setDisappear(disappearToggle.checked);
  bouncesMaxRow.classList.toggle('hidden', !disappearToggle.checked);
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
  engine.setSpawnProb(prob / 100); // Scale 0 to 1
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

// ═══ BATTLE MODE ═══
const battleToggle = document.getElementById('opt-battle');
const battleHealthRow = document.getElementById('battle-health-row');
const battleHealthSlider = document.getElementById('opt-battle-health');
const battleHealthLabel = document.getElementById('battle-health-label');

battleToggle.addEventListener('change', () => {
  engine.setBattleMode(battleToggle.checked);
  battleHealthRow.classList.toggle('hidden', !battleToggle.checked);
});

battleHealthSlider.addEventListener('input', () => {
  const hp = parseInt(battleHealthSlider.value);
  engine.setBattleHealth(hp);
  battleHealthLabel.textContent = hp;
});

// ═══ AUTO SPAWN ═══
const autospawnToggle = document.getElementById('opt-autospawn');
const autospawnStatus = document.getElementById('autospawn-status');
const autospawnSpeedSlider = document.getElementById('opt-autospawn-speed');

let autospawnInterval = null;

function startAutospawn() {
  const speed = parseInt(autospawnSpeedSlider.value);
  const changeMs = Math.max(200, 2000 - speed * 180);

  autospawnInterval = setInterval(() => {
    if (engine.balls.length < 150) {
      engine.addBall();
      updateCounter();
    }
  }, changeMs);
}

function stopAutospawn() {
  clearInterval(autospawnInterval);
  autospawnInterval = null;
}

autospawnToggle.addEventListener('change', () => {
  if (autospawnToggle.checked) {
    autospawnStatus.textContent = 'ON';
    startAutospawn();
  } else {
    autospawnStatus.textContent = 'OFF';
    stopAutospawn();
  }
});

autospawnSpeedSlider.addEventListener('input', () => {
  if (autospawnToggle.checked) {
    stopAutospawn();
    startAutospawn();
  }
});

// ═══ WAKE LOCK ═══
let wakeLock = null;
const wakeLockToggle = document.getElementById('opt-wakelock');

const requestWakeLock = async () => {
  try {
    wakeLock = await navigator.wakeLock.request('screen');
  } catch (err) {
    console.error(`Wake Lock error: ${err.name}, ${err.message}`);
  }
};

const handleWakeLock = async () => {
  if (wakeLockToggle.checked) {
    await requestWakeLock();
  } else {
    if (wakeLock !== null) {
      wakeLock.release();
      wakeLock = null;
    }
  }
};

wakeLockToggle.addEventListener('change', handleWakeLock);
document.addEventListener('visibilitychange', async () => {
  if (wakeLock !== null && document.visibilityState === 'visible') {
    await requestWakeLock();
  }
});

// ═══ LOCAL STORAGE CACHE ═══
function saveSettings() {
  const settings = {
    gravity: document.getElementById('opt-gravity').checked,
    gravityVal: document.getElementById('opt-gravity-val').value,
    collision: document.getElementById('opt-collision').checked,
    effect: document.querySelector('.effect-btn.active')?.dataset.effect || 'none',
    spawnProb: document.getElementById('opt-spawn-prob').value,
    disappearProb: document.getElementById('opt-disappear-prob').value,
    disappear: document.getElementById('opt-disappear').checked,
    bounces: document.getElementById('opt-bounces').value,
    speed: document.getElementById('opt-speed').value,
    sizeMin: document.getElementById('opt-size-min').value,
    sizeMax: document.getElementById('opt-size-max').value,
    darkmode: document.getElementById('opt-darkmode').checked,
    palette: document.querySelector('.palette-btn.active')?.dataset.palette || 'neon',
    trail: document.getElementById('opt-trail').checked,
    glow: document.getElementById('opt-glow').value,
    borderThick: document.getElementById('opt-border-thick').value,
    autospawn: document.getElementById('opt-autospawn').checked,
    autospawnSpeed: document.getElementById('opt-autospawn-speed').value,
    wakelock: document.getElementById('opt-wakelock').checked,
    battle: document.getElementById('opt-battle').checked,
    battleHealth: document.getElementById('opt-battle-health').value
  };
  localStorage.setItem('zenBallsSettings', JSON.stringify(settings));
}

function loadSettings() {
  try {
    const data = localStorage.getItem('zenBallsSettings');
    if (!data) return;
    const s = JSON.parse(data);

    const setCheck = (id, val) => {
      const el = document.getElementById(id);
      if (el && el.checked !== val) {
        el.checked = val;
        el.dispatchEvent(new Event('change'));
      }
    };
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && el.value !== val) {
        el.value = val;
        el.dispatchEvent(new Event('input'));
      }
    };

    setCheck('opt-gravity', s.gravity);
    setVal('opt-gravity-val', s.gravityVal);
    setCheck('opt-collision', s.collision);
    
    if (s.effect) {
      const eBtn = document.querySelector(`.effect-btn[data-effect="${s.effect}"]`);
      if (eBtn) eBtn.click();
    }

    setVal('opt-spawn-prob', s.spawnProb);
    setVal('opt-disappear-prob', s.disappearProb);
    setCheck('opt-disappear', s.disappear);
    setVal('opt-bounces', s.bounces);
    setVal('opt-speed', s.speed);
    setVal('opt-size-min', s.sizeMin);
    setVal('opt-size-max', s.sizeMax);
    setCheck('opt-darkmode', s.darkmode);

    if (s.palette) {
      const pBtn = document.querySelector(`.palette-btn[data-palette="${s.palette}"]`);
      if (pBtn) pBtn.click();
    }

    setCheck('opt-trail', s.trail);
    setVal('opt-glow', s.glow);
    setVal('opt-border-thick', s.borderThick);
    
    setVal('opt-autospawn-speed', s.autospawnSpeed);
    setCheck('opt-autospawn', s.autospawn);

    setCheck('opt-wakelock', s.wakelock);
    
    setVal('opt-battle-health', s.battleHealth);
    setCheck('opt-battle', s.battle);
    
  } catch(e) {
    console.error("Error loading settings", e);
  }
}

// Bind save to all inputs in the modal
document.getElementById('modal-overlay').addEventListener('input', saveSettings);
document.getElementById('modal-overlay').addEventListener('change', saveSettings);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target.closest('.palette-btn') || e.target.closest('.effect-btn')) {
    setTimeout(saveSettings, 50); // wait for active class to be added
  }
});

// Load settings on startup
window.addEventListener('DOMContentLoaded', loadSettings);

// ═══ GAME LOOP ═══
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  engine.update();
  engine.draw();
  if(!engine.isPaused) updateCounter();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
