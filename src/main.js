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
const conwayBar = document.getElementById('conway-bar');
const bouncingBar = document.getElementById('bouncing-bar');
const btnBouncingGravity = document.getElementById('btn-bouncing-gravity');
const btnBouncingTrail = document.getElementById('btn-bouncing-trail');
const presetMenu = document.getElementById('conway-preset-menu');
const btnPresets = document.getElementById('btn-conway-presets');

// Didactic Game Selector
const btnGameSelector = document.getElementById('btn-game-selector');
const gameSelectorWrap = document.getElementById('game-selector-wrap');
const gameSelectorMenu = document.getElementById('game-selector-menu');
const btnCloseGameSelector = document.getElementById('btn-close-game-selector');
const gameSelectorIcon = document.getElementById('game-selector-icon');
const gameSelectorName = document.getElementById('game-selector-name');
const gameCards = document.querySelectorAll('.game-card[data-mode]');

function updateCounter() {
  if (currentMode === 'bouncing') {
    ballCounter.innerHTML = `<span class="hud-bouncing-count">${bouncingEngine.balls.length} bola${bouncingEngine.balls.length !== 1 ? 's' : ''}</span>`;
  } else {
    const m = conwayEngine.getDidacticMetrics();
    ballCounter.innerHTML = `
      <div class="hud-conway-stacked">
        <div class="hud-conway-row1"><span class="hud-gen-label">Gen ${m.generation}</span> • <span class="hud-alive-label">${m.alive} vivas</span></div>
        <div class="hud-conway-row2">${m.still} est • ${m.oscillating} osc</div>
      </div>
    `;
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
  if (mode === currentMode) {
    if (gameSelectorMenu) gameSelectorMenu.classList.add('hidden');
    if (gameSelectorWrap) gameSelectorWrap.classList.remove('open');
    return;
  }
  currentMode = mode;

  if (mode === 'bouncing') {
    conwayEngine.stop();
    bouncingEngine.start();
    if (gameSelectorIcon) gameSelectorIcon.textContent = '⚪';
    if (gameSelectorName) gameSelectorName.textContent = 'Bolas Zen';
    if (bouncingBar) bouncingBar.classList.remove('hidden');
    if (conwayBar) conwayBar.classList.add('hidden');
    if (btnBouncingGravity) btnBouncingGravity.classList.toggle('active', bouncingEngine.useGravity);
    if (btnBouncingTrail) btnBouncingTrail.classList.toggle('active', bouncingEngine.showTrail);
    updatePauseIcon(bouncingEngine.isPaused);
  } else {
    bouncingEngine.stop();
    conwayEngine.start();
    if (gameSelectorIcon) gameSelectorIcon.textContent = '🧬';
    if (gameSelectorName) gameSelectorName.textContent = 'Juego de la Vida';
    if (bouncingBar) bouncingBar.classList.add('hidden');
    if (conwayBar) conwayBar.classList.remove('hidden');
    updatePauseIcon(conwayEngine.isPaused);
  }

  // Update card active tags in selector
  gameCards.forEach(card => {
    const isActive = card.dataset.mode === mode;
    card.classList.toggle('active', isActive);
    const tag = card.querySelector('.game-card-badge');
    if (tag) {
      if (isActive) {
        tag.className = 'game-card-badge active-tag';
        tag.textContent = 'Activo';
      } else if (card.dataset.mode === 'conway') {
        tag.className = 'game-card-badge didact-tag';
        tag.textContent = 'Didáctico';
      } else {
        tag.className = 'game-card-badge soon-tag';
        tag.textContent = 'Disponible';
      }
    }
  });

  if (gameSelectorMenu) gameSelectorMenu.classList.add('hidden');
  if (gameSelectorWrap) gameSelectorWrap.classList.remove('open');

  updateCounter();
  saveSettings();
}

// Game Selector Events
if (btnGameSelector && gameSelectorMenu) {
  btnGameSelector.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = gameSelectorMenu.classList.toggle('hidden');
    gameSelectorWrap?.classList.toggle('open', !isHidden);
  });
}

if (btnCloseGameSelector) {
  btnCloseGameSelector.addEventListener('click', (e) => {
    e.stopPropagation();
    gameSelectorMenu?.classList.add('hidden');
    gameSelectorWrap?.classList.remove('open');
  });
}

gameCards.forEach(card => {
  card.addEventListener('click', (e) => {
    e.stopPropagation();
    const targetMode = card.dataset.mode;
    if (targetMode) setMode(targetMode);
  });
});

document.addEventListener('click', (e) => {
  if (gameSelectorMenu && !gameSelectorMenu.contains(e.target) && !btnGameSelector?.contains(e.target)) {
    gameSelectorMenu.classList.add('hidden');
    gameSelectorWrap?.classList.remove('open');
  }
});

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
document.getElementById('btn-conway-step')?.addEventListener('click', () => {
  conwayEngine.step();
  updateCounter();
});

document.getElementById('btn-conway-random')?.addEventListener('click', () => {
  conwayEngine.randomize();
  updateCounter();
});

document.getElementById('btn-conway-clear')?.addEventListener('click', () => {
  conwayEngine.clear();
  updateCounter();
});

// Conway Tools: Draw, Line, Cross, Pan
const btnToolDraw = document.getElementById('btn-conway-tool-draw');
const btnToolLine = document.getElementById('btn-conway-tool-line');
const btnToolCross = document.getElementById('btn-conway-tool-cross');
const btnToolPan = document.getElementById('btn-conway-tool-pan');
const btnConwayCenter = document.getElementById('btn-conway-center');
const crossAngleBadge = document.getElementById('cross-angle-badge');
const crossAngleMenu = document.getElementById('cross-angle-menu');

function setConwayTool(tool) {
  conwayEngine.setTool(tool);
  if (btnToolDraw) btnToolDraw.classList.toggle('active', tool === 'draw');
  if (btnToolLine) btnToolLine.classList.toggle('active', tool === 'line');
  if (btnToolCross) btnToolCross.classList.toggle('active', tool === 'cross');
  if (btnToolPan) btnToolPan.classList.toggle('active', tool === 'pan');
}

if (btnToolDraw) btnToolDraw.addEventListener('click', () => setConwayTool('draw'));
if (btnToolLine) btnToolLine.addEventListener('click', () => setConwayTool('line'));
if (btnToolPan) btnToolPan.addEventListener('click', () => setConwayTool('pan'));

if (btnToolCross) {
  btnToolCross.addEventListener('click', (e) => {
    if (conwayEngine.tool !== 'cross') {
      setConwayTool('cross');
    } else {
      // Toggle angle popover when already active
      e.stopPropagation();
      crossAngleMenu?.classList.toggle('hidden');
    }
  });
}

// Center camera on active cluster or origin
if (btnConwayCenter) {
  btnConwayCenter.addEventListener('click', () => {
    conwayEngine.centerView();
    updateZoomDisplay();
  });
}

// Set Radial Cross Angle
function setRadialAngle(angle) {
  conwayEngine.setRadialAngle(angle);
  if (crossAngleBadge) crossAngleBadge.textContent = `${angle}°`;

  // Update angle button active states
  document.querySelectorAll('.angle-opt-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.angle) === angle);
  });
  document.querySelectorAll('.radial-angle-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.angle) === angle);
  });

  if (crossAngleMenu) crossAngleMenu.classList.add('hidden');
  saveSettings();
}

document.querySelectorAll('.angle-opt-btn, .radial-angle-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const angle = parseInt(btn.dataset.angle);
    if (!isNaN(angle)) {
      setRadialAngle(angle);
      setConwayTool('cross');
    }
  });
});

document.addEventListener('click', (e) => {
  if (crossAngleMenu && !crossAngleMenu.contains(e.target) && !btnToolCross?.contains(e.target)) {
    crossAngleMenu.classList.add('hidden');
  }
});

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

// ═══ BOUNCING FLOATING TOOLBAR CONTROLS ═══
const btnBouncingSpeed = document.getElementById('btn-bouncing-speed');
const bouncingSpeedDisplay = document.getElementById('bouncing-speed-display');
const optTimescale = document.getElementById('opt-timescale');
const timescaleLabel = document.getElementById('timescale-label');

const speedSteps = [1.0, 1.5, 2.0, 3.0, 0.5];
let currentSpeedStepIdx = 0;

function updateBouncingTimeScale(scale) {
  bouncingEngine.setTimeScale(scale);
  if (bouncingSpeedDisplay) bouncingSpeedDisplay.textContent = `${scale.toFixed(1)}x`;
  if (optTimescale) optTimescale.value = Math.round(scale * 10);
  if (timescaleLabel) timescaleLabel.textContent = `${scale.toFixed(1)}x`;
}

if (btnBouncingSpeed) {
  btnBouncingSpeed.addEventListener('click', () => {
    currentSpeedStepIdx = (currentSpeedStepIdx + 1) % speedSteps.length;
    updateBouncingTimeScale(speedSteps[currentSpeedStepIdx]);
    saveSettings();
  });
}

if (optTimescale) {
  optTimescale.addEventListener('input', () => {
    const val = parseInt(optTimescale.value) / 10;
    bouncingEngine.setTimeScale(val);
    if (timescaleLabel) timescaleLabel.textContent = `${val.toFixed(1)}x`;
    if (bouncingSpeedDisplay) bouncingSpeedDisplay.textContent = `${val.toFixed(1)}x`;
  });
}

// Bouncing Boundary Area
const btnBouncingArea = document.getElementById('btn-bouncing-area');
const bouncingAreaDisplay = document.getElementById('bouncing-area-display');
const optBoundaryScale = document.getElementById('opt-boundary-scale');
const boundaryScaleLabel = document.getElementById('boundary-scale-label');

const areaSteps = [1.0, 0.75, 0.5, 0.35];
let currentAreaStepIdx = 0;

function updateBouncingBoundaryScale(scale) {
  bouncingEngine.setBoundaryScale(scale);
  const pct = Math.round(scale * 100);
  if (bouncingAreaDisplay) bouncingAreaDisplay.textContent = `Área: ${pct}%`;
  if (optBoundaryScale) optBoundaryScale.value = pct;
  if (boundaryScaleLabel) boundaryScaleLabel.textContent = `${pct}%`;
}

if (btnBouncingArea) {
  btnBouncingArea.addEventListener('click', () => {
    currentAreaStepIdx = (currentAreaStepIdx + 1) % areaSteps.length;
    updateBouncingBoundaryScale(areaSteps[currentAreaStepIdx]);
    saveSettings();
  });
}

if (optBoundaryScale) {
  optBoundaryScale.addEventListener('input', () => {
    const val = parseInt(optBoundaryScale.value);
    bouncingEngine.setBoundaryScale(val / 100);
    if (boundaryScaleLabel) boundaryScaleLabel.textContent = `${val}%`;
    if (bouncingAreaDisplay) bouncingAreaDisplay.textContent = `Área: ${val}%`;
  });
}

// Add & Clear in Bouncing Bar
const btnBouncingAdd = document.getElementById('btn-bouncing-add');
if (btnBouncingAdd) {
  btnBouncingAdd.addEventListener('click', () => {
    bouncingEngine.addBall();
    updateCounter();
  });
}

const btnBouncingClear = document.getElementById('btn-bouncing-clear');
if (btnBouncingClear) {
  btnBouncingClear.addEventListener('click', () => {
    bouncingEngine.clearBalls();
    updateCounter();
  });
}

// Gravity in Bouncing Bar & Settings
const optGravity = document.getElementById('opt-gravity');
const gravSliderRow = document.getElementById('gravity-slider-row');

function updateBouncingGravity(active) {
  bouncingEngine.setGravity(active);
  if (btnBouncingGravity) btnBouncingGravity.classList.toggle('active', active);
  if (optGravity && optGravity.checked !== active) optGravity.checked = active;
  if (gravSliderRow) gravSliderRow.classList.toggle('hidden', !active);
}

if (btnBouncingGravity) {
  btnBouncingGravity.addEventListener('click', () => {
    updateBouncingGravity(!bouncingEngine.useGravity);
    saveSettings();
  });
}

// Trail in Bouncing Bar & Settings
const optTrail = document.getElementById('opt-trail');

function updateBouncingTrail(active) {
  bouncingEngine.setTrail(active);
  if (btnBouncingTrail) btnBouncingTrail.classList.toggle('active', active);
  if (optTrail && optTrail.checked !== active) optTrail.checked = active;
}

if (btnBouncingTrail) {
  btnBouncingTrail.addEventListener('click', () => {
    updateBouncingTrail(!bouncingEngine.showTrail);
    saveSettings();
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

// Gravity in Settings Modal
const gravToggle = document.getElementById('opt-gravity');
const gravSlider = document.getElementById('opt-gravity-val');
const gravLabel = document.getElementById('gravity-val-label');

if (gravToggle) {
  gravToggle.addEventListener('change', () => {
    updateBouncingGravity(gravToggle.checked);
  });
}

if (gravSlider) {
  gravSlider.addEventListener('input', () => {
    const v = gravSlider.value / 100;
    bouncingEngine.setGravityVal(v);
    if (gravLabel) gravLabel.textContent = v.toFixed(2);
  });
}

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

if (optTrail) {
  optTrail.addEventListener('change', (e) => {
    updateBouncingTrail(e.target.checked);
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

// Boundary scale & timescale sliders handled above in BOUNCING FLOATING TOOLBAR CONTROLS

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
    boundaryScale: document.getElementById('opt-boundary-scale')?.value ?? '100',
    timescale: document.getElementById('opt-timescale')?.value ?? '10',
    radialAngle: conwayEngine.radialAngleStep || 90,
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

    if (s.gravity !== undefined) {
      updateBouncingGravity(s.gravity);
    }
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

    if (s.trail !== undefined) {
      updateBouncingTrail(s.trail);
    }
    setVal('opt-glow', s.glow);
    setVal('opt-border-thick', s.borderThick);
    
    setVal('opt-autospawn-speed', s.autospawnSpeed);
    setCheck('opt-autospawn', s.autospawn);

    setCheck('opt-wakelock', s.wakelock);
    
    if (s.boundaryScale) {
      updateBouncingBoundaryScale(parseInt(s.boundaryScale) / 100);
    }
    if (s.timescale) {
      updateBouncingTimeScale(parseInt(s.timescale) / 10);
    }
    if (s.radialAngle) {
      setRadialAngle(parseInt(s.radialAngle));
    }

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
