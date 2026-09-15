import { setupCanvas } from './utils/canvas.js';
import { BouncingMode } from './modes/bouncing.js';
import { ConwayMode } from './modes/conway.js';
import { zenAudio } from './utils/audio.js';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker
registerSW({ immediate: true });

// Canvas
const { canvas, ctx } = setupCanvas('gameCanvas');

// Engines
const bouncingEngine = new BouncingMode(canvas, ctx);
const conwayEngine = new ConwayMode(canvas, ctx);

let currentMode = 'bouncing'; // 'bouncing' | 'conway'
bouncingEngine.start();

// Unlock Web Audio API on first user interaction anywhere
const unlockAudio = () => {
  zenAudio.unlock();
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
};
window.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('keydown', unlockAudio, { passive: true });

// UI References
const ballCounter = document.getElementById('ball-counter');
const btnPause = document.getElementById('btn-pause');
const btnAudio = document.getElementById('btn-audio');
const modeSwitcher = document.getElementById('mode-switcher');
const btnModeBouncing = document.getElementById('btn-mode-bouncing');
const btnModeConway = document.getElementById('btn-mode-conway');
const conwayBar = document.getElementById('conway-bar');
const presetMenu = document.getElementById('conway-preset-menu');
const btnPresets = document.getElementById('btn-conway-presets');

function updateCounter() {
  if (currentMode === 'bouncing') {
    ballCounter.textContent = `${bouncingEngine.balls.length} bola${bouncingEngine.balls.length !== 1 ? 's' : ''}`;
  } else {
    ballCounter.textContent = `Gen ${conwayEngine.generation} • ${conwayEngine.aliveCount} vivas`;
  }
}

function updatePauseIcon(isPaused) {
  if (isPaused) {
    btnPause.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
  } else {
    btnPause.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>`;
  }
}

// ═══ MODE SWITCHING ═══
function setMode(mode) {
  if (mode === currentMode) return;
  currentMode = mode;

  if (mode === 'bouncing') {
    conwayEngine.stop();
    bouncingEngine.start();
    btnModeBouncing.classList.add('active');
    btnModeConway.classList.remove('active');
    conwayBar.classList.add('hidden');
    updatePauseIcon(bouncingEngine.isPaused);
  } else {
    bouncingEngine.stop();
    conwayEngine.start();
    btnModeConway.classList.add('active');
    btnModeBouncing.classList.remove('active');
    conwayBar.classList.remove('hidden');
    updatePauseIcon(conwayEngine.isPaused);
  }

  updateCounter();
  saveSettings();
}

const onModeBtnTouch = (mode, e) => {
  if (e) {
    e.stopPropagation();
  }
  setMode(mode);
};

btnModeBouncing.addEventListener('pointerdown', (e) => onModeBtnTouch('bouncing', e));
btnModeBouncing.addEventListener('click', (e) => onModeBtnTouch('bouncing', e));

btnModeConway.addEventListener('pointerdown', (e) => onModeBtnTouch('conway', e));
btnModeConway.addEventListener('click', (e) => onModeBtnTouch('conway', e));

// ═══ CANVAS INTERACTION ═══
function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

canvas.addEventListener('pointerdown', (e) => {
  const { x, y } = getCanvasCoords(e);

  if (currentMode === 'bouncing') {
    bouncingEngine.addBall(x, y);
    updateCounter();
  } else {
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
    conwayEngine.handlePointerDown(e.pointerId, x, y);
    updateCounter();
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (currentMode === 'conway') {
    const { x, y } = getCanvasCoords(e);
    conwayEngine.handlePointerMove(e.pointerId, x, y);
    updateCounter();
  }
});

window.addEventListener('pointerup', (e) => {
  if (currentMode === 'conway') {
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (_) {}
    conwayEngine.handlePointerUp(e.pointerId);
  }
});

window.addEventListener('pointercancel', (e) => {
  if (currentMode === 'conway') {
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (_) {}
    conwayEngine.handlePointerUp(e.pointerId);
  }
});

// Wheel zoom in Conway
canvas.addEventListener('wheel', (e) => {
  if (currentMode === 'conway') {
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);
    conwayEngine.handleWheel(x, y, e.deltaY);
    updateZoomDisplay();
  }
}, { passive: false });

// ═══ HUD BUTTONS ═══
// Pause Button
btnPause.addEventListener('click', () => {
  if (currentMode === 'bouncing') {
    bouncingEngine.togglePause();
    updatePauseIcon(bouncingEngine.isPaused);
  } else {
    conwayEngine.togglePause();
    updatePauseIcon(conwayEngine.isPaused);
  }
});

// Audio Toggle Button in HUD
btnAudio.addEventListener('click', () => {
  const isMuted = !zenAudio.isMuted;
  zenAudio.setMuted(isMuted);
  btnAudio.classList.toggle('muted', isMuted);
  btnAudio.classList.toggle('active', !isMuted);
  
  const optSound = document.getElementById('opt-sound');
  if (optSound && optSound.checked !== !isMuted) {
    optSound.checked = !isMuted;
  }
  saveSettings();
});

// ═══ CONWAY TOOLBAR & ZOOM & TOOLS ═══
document.getElementById('btn-conway-step').addEventListener('click', () => {
  conwayEngine.step();
  updateCounter();
});

document.getElementById('btn-conway-random').addEventListener('click', () => {
  conwayEngine.randomize();
  updateCounter();
});

document.getElementById('btn-conway-clear').addEventListener('click', () => {
  conwayEngine.clear();
  updateCounter();
});

// Conway Tools: Draw vs Pan
const btnToolDraw = document.getElementById('btn-conway-tool-draw');
const btnToolPan = document.getElementById('btn-conway-tool-pan');

function setConwayTool(tool) {
  conwayEngine.setTool(tool);
  if (btnToolDraw) btnToolDraw.classList.toggle('active', tool === 'draw');
  if (btnToolPan) btnToolPan.classList.toggle('active', tool === 'pan');
}

if (btnToolDraw) btnToolDraw.addEventListener('click', () => setConwayTool('draw'));
if (btnToolPan) btnToolPan.addEventListener('click', () => setConwayTool('pan'));

// Conway Zoom controls
const btnZoomOut = document.getElementById('btn-conway-zoom-out');
const btnZoomReset = document.getElementById('btn-conway-zoom-reset');
const btnZoomIn = document.getElementById('btn-conway-zoom-in');

function updateZoomDisplay() {
  if (btnZoomReset) {
    btnZoomReset.textContent = `${conwayEngine.zoom.toFixed(1)}x`;
  }
}

if (btnZoomOut) {
  btnZoomOut.addEventListener('click', () => {
    conwayEngine.zoomOut();
    updateZoomDisplay();
  });
}

if (btnZoomIn) {
  btnZoomIn.addEventListener('click', () => {
    conwayEngine.zoomIn();
    updateZoomDisplay();
  });
}

if (btnZoomReset) {
  btnZoomReset.addEventListener('click', () => {
    conwayEngine.resetView();
    updateZoomDisplay();
  });
}

// Zen Pattern Rain
const btnConwayRain = document.getElementById('btn-conway-rain');
const optConwayRainToggle = document.getElementById('opt-conway-rain-toggle');

function setRainActive(active) {
  conwayEngine.setRain(active);
  if (btnConwayRain) btnConwayRain.classList.toggle('active', active);
  if (optConwayRainToggle) optConwayRainToggle.checked = active;
  saveSettings();
}

if (btnConwayRain) {
  btnConwayRain.addEventListener('click', () => {
    setRainActive(!conwayEngine.rainEnabled);
  });
}

if (optConwayRainToggle) {
  optConwayRainToggle.addEventListener('change', () => {
    setRainActive(optConwayRainToggle.checked);
  });
}

// Presets Dropdown / Popover
const btnClosePresets = document.getElementById('btn-close-presets');

btnPresets.addEventListener('click', (e) => {
  e.stopPropagation();
  presetMenu.classList.toggle('hidden');
});

if (btnClosePresets) {
  btnClosePresets.addEventListener('click', (e) => {
    e.stopPropagation();
    presetMenu.classList.add('hidden');
  });
}

document.querySelectorAll('.preset-card-item').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const preset = btn.dataset.preset;
    conwayEngine.loadPreset(preset);
    presetMenu.classList.add('hidden');
    updateCounter();
  });
});

document.addEventListener('click', (e) => {
  if (!presetMenu.contains(e.target) && !btnPresets.contains(e.target)) {
    presetMenu.classList.add('hidden');
  }
});

// ═══ CONTEXTUAL SETTINGS MODAL ═══
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const groupBouncing = document.getElementById('settings-group-bouncing');
const groupConway = document.getElementById('settings-group-conway');

function openSettingsModal() {
  if (currentMode === 'bouncing') {
    if (modalTitle) modalTitle.textContent = 'Configuración • Bolas Zen';
    if (groupBouncing) groupBouncing.classList.remove('hidden');
    if (groupConway) groupConway.classList.add('hidden');
  } else {
    if (modalTitle) modalTitle.textContent = 'Configuración • Juego de la Vida';
    if (groupBouncing) groupBouncing.classList.add('hidden');
    if (groupConway) groupConway.classList.remove('hidden');
  }
  modalOverlay.classList.remove('hidden');
}

document.getElementById('btn-settings').addEventListener('click', openSettingsModal);

document.getElementById('btn-close-modal').addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
});

modalOverlay.addEventListener('mousedown', (e) => {
  if (e.target === modalOverlay) {
    modalOverlay.classList.add('hidden');
  }
});

// Theme Switcher (Dark / Light)
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0a0a0d' : '#e7eae6');

  document.querySelectorAll('.theme-pill-btn, .theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

document.querySelectorAll('.theme-pill-btn, .theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    applyTheme(btn.dataset.theme);
    saveSettings();
  });
});

// ═══ BOUNCING CONTROLS ═══
document.getElementById('btn-add').addEventListener('click', () => {
  if (currentMode === 'conway') setMode('bouncing');
  bouncingEngine.addBall();
  updateCounter();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  if (currentMode === 'bouncing') {
    bouncingEngine.clearBalls();
  } else {
    conwayEngine.clear();
  }
  updateCounter();
});

// Gravity
const gravToggle = document.getElementById('opt-gravity');
const gravSlider = document.getElementById('opt-gravity-val');
const gravLabel = document.getElementById('gravity-val-label');
const gravSliderRow = document.getElementById('gravity-slider-row');

gravToggle.addEventListener('change', () => {
  bouncingEngine.setGravity(gravToggle.checked);
  gravSliderRow.classList.toggle('hidden', !gravToggle.checked);
});

gravSlider.addEventListener('input', () => {
  const v = gravSlider.value / 100;
  bouncingEngine.setGravityVal(v);
  gravLabel.textContent = v.toFixed(2);
});

// Collision & Effects
document.getElementById('opt-collision').addEventListener('change', (e) => {
  bouncingEngine.setCollision(e.target.checked);
});

const effectBtns = document.querySelectorAll('.effect-btn');
effectBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    effectBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    bouncingEngine.setCollisionEffect(btn.dataset.effect);
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
  bouncingEngine.setDisappear(disappearToggle.checked);
  bouncesMaxRow.classList.toggle('hidden', !disappearToggle.checked);
});

bouncesSlider.addEventListener('input', () => {
  bouncingEngine.setMaxBounces(parseInt(bouncesSlider.value));
  bouncesLabel.textContent = bouncesSlider.value;
});

disappearProbSlider.addEventListener('input', () => {
  const prob = parseInt(disappearProbSlider.value);
  bouncingEngine.setDisappearProb(prob / 100);
  disappearProbLabel.textContent = prob + '%';
});

// Spawn Prob
const spawnProbSlider = document.getElementById('opt-spawn-prob');
const spawnProbLabel = document.getElementById('spawn-prob-label');
spawnProbSlider.addEventListener('input', () => {
  const prob = parseInt(spawnProbSlider.value);
  bouncingEngine.setSpawnProb(prob / 100);
  spawnProbLabel.textContent = prob + '%';
});

// Speed
const speedSlider = document.getElementById('opt-speed');
const speedLabel = document.getElementById('speed-label');
speedSlider.addEventListener('input', () => {
  bouncingEngine.setSpeed(parseInt(speedSlider.value));
  speedLabel.textContent = speedSlider.value;
});

// Size
const sizeMinSlider = document.getElementById('opt-size-min');
const sizeMinLabel = document.getElementById('size-min-label');
const sizeMaxSlider = document.getElementById('opt-size-max');
const sizeMaxLabel = document.getElementById('size-max-label');

sizeMinSlider.addEventListener('input', () => {
  bouncingEngine.setSizeMin(parseInt(sizeMinSlider.value));
  sizeMinLabel.textContent = sizeMinSlider.value;
});
sizeMaxSlider.addEventListener('input', () => {
  bouncingEngine.setSizeMax(parseInt(sizeMaxSlider.value));
  sizeMaxLabel.textContent = sizeMaxSlider.value;
});

// ═══ STYLE & PALETTES ═══
const optDarkmode = document.getElementById('opt-darkmode');
if (optDarkmode) {
  optDarkmode.addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-theme', e.target.checked ? 'dark' : 'light');
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', e.target.checked ? '#0a0a0d' : '#e7eae6');
  });
}

const paletteBtns = document.querySelectorAll('.palette-btn');
paletteBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    paletteBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    bouncingEngine.setPalette(btn.dataset.palette);
    conwayEngine.setPalette(btn.dataset.palette);
  });
});

const optTrail = document.getElementById('opt-trail');
if (optTrail) {
  optTrail.addEventListener('change', (e) => {
    bouncingEngine.setTrail(e.target.checked);
  });
}

const glowSlider = document.getElementById('opt-glow');
const glowLabel = document.getElementById('glow-label');
if (glowSlider && glowLabel) {
  glowSlider.addEventListener('input', () => {
    const g = parseInt(glowSlider.value);
    bouncingEngine.setGlow(g);
    conwayEngine.setGlow(g);
    glowLabel.textContent = glowSlider.value;
  });
}

const borderThickSlider = document.getElementById('opt-border-thick');
const borderThickLabel = document.getElementById('border-thick-label');
if (borderThickSlider && borderThickLabel) {
  borderThickSlider.addEventListener('input', () => {
    bouncingEngine.setBorderThickness(parseFloat(borderThickSlider.value));
    borderThickLabel.textContent = borderThickSlider.value;
  });
}

// ═══ BATTLE MODE ═══
const battleToggle = document.getElementById('opt-battle');
const battleHealthRow = document.getElementById('battle-health-row');
const battleHealthSlider = document.getElementById('opt-battle-health');
const battleHealthLabel = document.getElementById('battle-health-label');

battleToggle.addEventListener('change', () => {
  bouncingEngine.setBattleMode(battleToggle.checked);
  battleHealthRow.classList.toggle('hidden', !battleToggle.checked);
});

battleHealthSlider.addEventListener('input', () => {
  const hp = parseInt(battleHealthSlider.value);
  bouncingEngine.setBattleHealth(hp);
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
    if (currentMode === 'bouncing' && bouncingEngine.balls.length < 150) {
      bouncingEngine.addBall();
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

// ═══ AUDIO CONTROLS ═══
const optSound = document.getElementById('opt-sound');
const optVolume = document.getElementById('opt-volume');
const volumeLabel = document.getElementById('volume-val-label');
const optSpatial = document.getElementById('opt-spatial');
const instrumentBtns = document.querySelectorAll('.instrument-btn');

optSound.addEventListener('change', () => {
  zenAudio.setMuted(!optSound.checked);
  conwayEngine.setSound(optSound.checked);
  btnAudio.classList.toggle('muted', !optSound.checked);
  btnAudio.classList.toggle('active', optSound.checked);
});

optVolume.addEventListener('input', () => {
  const vol = parseInt(optVolume.value) / 100;
  zenAudio.setVolume(vol);
  volumeLabel.textContent = `${optVolume.value}%`;
});

optSpatial.addEventListener('change', () => {
  zenAudio.setSpatialAudio(optSpatial.checked);
});

instrumentBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    instrumentBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    zenAudio.setInstrument(btn.dataset.instrument);
  });
});

// ═══ CONWAY CONTROLS ═══
const optConwaySpeed = document.getElementById('opt-conway-speed');
const conwaySpeedLabel = document.getElementById('conway-speed-label');
const optConwaySize = document.getElementById('opt-conway-size');
const conwaySizeLabel = document.getElementById('conway-size-label');
const optConwayWrap = document.getElementById('opt-conway-wrap');
const optConwayTrail = document.getElementById('opt-conway-trail');

optConwaySpeed.addEventListener('input', () => {
  const s = parseInt(optConwaySpeed.value);
  conwayEngine.setSpeed(s);
  conwaySpeedLabel.textContent = s;
});

optConwaySize.addEventListener('input', () => {
  const sz = parseInt(optConwaySize.value);
  conwayEngine.setCellSize(sz);
  conwaySizeLabel.textContent = `${sz}px`;
  updateCounter();
});

optConwayWrap.addEventListener('change', () => {
  conwayEngine.setWrap(optConwayWrap.checked);
});

optConwayTrail.addEventListener('change', () => {
  conwayEngine.setTrail(optConwayTrail.checked);
});

// ═══ WAKE LOCK (SAFE) ═══
let wakeLock = null;
const wakeLockToggle = document.getElementById('opt-wakelock');

const requestWakeLock = async () => {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
  } catch (err) {
    console.warn(`Wake Lock error: ${err.name}, ${err.message}`);
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
    mode: currentMode,
    gravity: document.getElementById('opt-gravity')?.checked ?? true,
    gravityVal: document.getElementById('opt-gravity-val')?.value ?? '20',
    collision: document.getElementById('opt-collision')?.checked ?? false,
    effect: document.querySelector('.effect-btn.active')?.dataset.effect || 'none',
    spawnProb: document.getElementById('opt-spawn-prob')?.value ?? '0',
    disappearProb: document.getElementById('opt-disappear-prob')?.value ?? '20',
    disappear: document.getElementById('opt-disappear')?.checked ?? false,
    bounces: document.getElementById('opt-bounces')?.value ?? '5',
    speed: document.getElementById('opt-speed')?.value ?? '5',
    sizeMin: document.getElementById('opt-size-min')?.value ?? '8',
    sizeMax: document.getElementById('opt-size-max')?.value ?? '18',
    theme: document.documentElement.getAttribute('data-theme') || 'dark',
    palette: document.querySelector('.palette-btn.active')?.dataset.palette || 'neon',
    trail: document.getElementById('opt-trail')?.checked ?? true,
    glow: document.getElementById('opt-glow')?.value ?? '12',
    borderThick: document.getElementById('opt-border-thick')?.value ?? '2',
    autospawn: document.getElementById('opt-autospawn')?.checked ?? false,
    autospawnSpeed: document.getElementById('opt-autospawn-speed')?.value ?? '5',
    wakelock: document.getElementById('opt-wakelock')?.checked ?? false,
    battle: document.getElementById('opt-battle')?.checked ?? false,
    battleHealth: document.getElementById('opt-battle-health')?.value ?? '5',
    // Audio & Conway
    sound: document.getElementById('opt-sound')?.checked ?? true,
    volume: document.getElementById('opt-volume')?.value ?? '50',
    spatial: document.getElementById('opt-spatial')?.checked ?? true,
    instrument: document.querySelector('.instrument-btn.active')?.dataset.instrument || 'bells',
    conwaySpeed: document.getElementById('opt-conway-speed')?.value ?? '12',
    conwaySize: document.getElementById('opt-conway-size')?.value ?? '14',
    conwayWrap: document.getElementById('opt-conway-wrap')?.checked ?? true,
    conwayTrail: document.getElementById('opt-conway-trail')?.checked ?? true,
    conwayRain: conwayEngine.rainEnabled
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
      if (el && val !== undefined && el.checked !== val) {
        el.checked = val;
        el.dispatchEvent(new Event('change'));
      }
    };
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined && el.value !== val) {
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

    if (s.theme) {
      applyTheme(s.theme);
    }

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

    // Audio & Conway settings load
    setCheck('opt-sound', s.sound);
    setVal('opt-volume', s.volume);
    setCheck('opt-spatial', s.spatial);
    if (s.instrument) {
      const iBtn = document.querySelector(`.instrument-btn[data-instrument="${s.instrument}"]`);
      if (iBtn) iBtn.click();
    }

    setVal('opt-conway-speed', s.conwaySpeed);
    setVal('opt-conway-size', s.conwaySize);
    setCheck('opt-conway-wrap', s.conwayWrap);
    setCheck('opt-conway-trail', s.conwayTrail);

    if (s.conwayRain !== undefined) {
      setRainActive(s.conwayRain);
    }

    if (s.mode && s.mode !== currentMode) {
      setMode(s.mode);
    }
    
  } catch(e) {
    console.error("Error loading settings", e);
  }
}

// Bind save to all inputs in the modal
document.getElementById('modal-overlay').addEventListener('input', saveSettings);
document.getElementById('modal-overlay').addEventListener('change', saveSettings);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target.closest('.palette-btn') || e.target.closest('.effect-btn') || e.target.closest('.instrument-btn') || e.target.closest('.theme-pill-btn') || e.target.closest('.theme-btn')) {
    setTimeout(saveSettings, 50);
  }
});

// Load settings on startup
window.addEventListener('DOMContentLoaded', loadSettings);

// ═══ GAME LOOP ═══
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentMode === 'bouncing') {
    bouncingEngine.update();
    bouncingEngine.draw();
  } else {
    conwayEngine.update();
    conwayEngine.draw();
  }

  updateCounter();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
