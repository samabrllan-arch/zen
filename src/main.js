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
        <div class="hud-conway-row1"><span class="hud-gen-label">Gen ${m.generation}</span><span class="hud-sep">•</span><span class="hud-alive-label">${m.alive} vivas</span></div>
        <div class="hud-conway-row2"><span class="hud-still-label">${m.still} est</span><span class="hud-sep">•</span><span class="hud-osc-label">${m.oscillating} osc</span></div>
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
    if (gameSelectorName) gameSelectorName.innerHTML = '<span class="name-full">Bolas Zen</span><span class="name-short">Bolas</span>';
    if (bouncingBar) bouncingBar.classList.remove('hidden');
    if (conwayBar) conwayBar.classList.add('hidden');
    if (btnBouncingGravity) btnBouncingGravity.classList.toggle('active', bouncingEngine.useGravity);
    if (btnBouncingTrail) btnBouncingTrail.classList.toggle('active', bouncingEngine.showTrail);
    updatePauseIcon(bouncingEngine.isPaused);
  } else {
    bouncingEngine.stop();
    conwayEngine.start();
    if (gameSelectorIcon) gameSelectorIcon.textContent = '🧬';
    if (gameSelectorName) gameSelectorName.innerHTML = '<span class="name-full">Juego de la Vida</span><span class="name-short">Vida</span>';
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
  if (typeof updateAnalyticsModal === 'function' && analyticsModalOpen) {
    updateAnalyticsModal(true);
  }
});

document.getElementById('btn-conway-clear')?.addEventListener('click', () => {
  conwayEngine.clear();
  updateCounter();
  if (typeof updateAnalyticsModal === 'function' && analyticsModalOpen) {
    updateAnalyticsModal(true);
  }
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
    if (typeof updateAnalyticsModal === 'function' && analyticsModalOpen) {
      updateAnalyticsModal(true);
    }
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

// ═══ CONWAY REAL-TIME ANALYTICS & SCIENTIFIC MODAL ═══
const modalAnalyticsOverlay = document.getElementById('modal-analytics-overlay');
const btnConwayAnalytics = document.getElementById('btn-conway-analytics');
const btnCloseAnalytics = document.getElementById('btn-close-analytics');
const btnCloseAnalyticsFooter = document.getElementById('btn-close-analytics-footer');
const chartCanvas = document.getElementById('analytics-chart-canvas');
const chartTooltip = document.getElementById('chart-tooltip');
const btnCopyReport = document.getElementById('btn-copy-report');
const copyReportText = document.getElementById('copy-report-text');

// Stat Cards elements
const elInitialVal = document.getElementById('analytics-initial-val');
const elInitialSub = document.getElementById('analytics-initial-sub');
const elPeakVal = document.getElementById('analytics-peak-val');
const elPeakSub = document.getElementById('analytics-peak-sub');
const elAreaVal = document.getElementById('analytics-area-val');
const elAreaSub = document.getElementById('analytics-area-sub');
const elDiagIcon = document.getElementById('analytics-diag-icon');
const elDiagVal = document.getElementById('analytics-diag-val');
const elDiagSub = document.getElementById('analytics-diag-sub');

// Legend live values
const elLegendValAlive = document.getElementById('legend-val-alive');
const elLegendValStill = document.getElementById('legend-val-still');
const elLegendValOsc = document.getElementById('legend-val-osc');

// Milestone table body
const elTableBody = document.getElementById('analytics-table-body');

let analyticsModalOpen = false;
let chartRange = 'all'; // 'all' | 100 | 300
let chartSeries = { alive: true, still: true, osc: true };
let chartHoverData = null;
let lastAnalyticsRenderGen = -1;

function openAnalyticsModal() {
  if (!modalAnalyticsOverlay) return;
  analyticsModalOpen = true;
  modalAnalyticsOverlay.classList.remove('hidden');
  btnConwayAnalytics?.classList.add('active');
  updateAnalyticsModal(true);
}

function closeAnalyticsModal() {
  if (!modalAnalyticsOverlay) return;
  analyticsModalOpen = false;
  modalAnalyticsOverlay.classList.add('hidden');
  btnConwayAnalytics?.classList.remove('active');
  if (chartTooltip) chartTooltip.classList.add('hidden');
  chartHoverData = null;
}

btnConwayAnalytics?.addEventListener('click', () => {
  if (analyticsModalOpen) {
    closeAnalyticsModal();
  } else {
    openAnalyticsModal();
  }
});

btnCloseAnalytics?.addEventListener('click', closeAnalyticsModal);
btnCloseAnalyticsFooter?.addEventListener('click', closeAnalyticsModal);

modalAnalyticsOverlay?.addEventListener('click', (e) => {
  if (e.target === modalAnalyticsOverlay) {
    closeAnalyticsModal();
  }
});

// Clicking HUD badge in Conway mode also opens analytics modal
document.getElementById('hud-stats-badge')?.addEventListener('click', () => {
  if (currentMode === 'conway') {
    openAnalyticsModal();
  }
});

// Escape key closes modals
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (analyticsModalOpen) closeAnalyticsModal();
    if (gameSelectorMenu) {
      gameSelectorMenu.classList.add('hidden');
      gameSelectorWrap?.classList.remove('open');
    }
    if (presetMenu) presetMenu.classList.add('hidden');
    if (modalOverlay) modalOverlay.classList.add('hidden');
  }
});

// Range selectors
document.querySelectorAll('.range-btn[data-range]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.range-btn[data-range]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const r = btn.dataset.range;
    chartRange = r === 'all' ? 'all' : parseInt(r, 10);
    renderAnalyticsChart(conwayEngine.getAnalyticsReport());
  });
});

// Legend series toggle
document.querySelectorAll('.chart-legend-pill[data-series]').forEach(pill => {
  pill.addEventListener('click', () => {
    const s = pill.dataset.series;
    if (s && chartSeries.hasOwnProperty(s)) {
      const nextState = !chartSeries[s];
      // Prevent disabling all 3
      const willHaveActive = Object.keys(chartSeries).some(k => k === s ? nextState : chartSeries[k]);
      if (!willHaveActive) return;
      chartSeries[s] = nextState;
      pill.classList.toggle('active', chartSeries[s]);
      renderAnalyticsChart(conwayEngine.getAnalyticsReport());
    }
  });
});

// Update modal content
function updateAnalyticsModal(force = false) {
  if (!analyticsModalOpen || currentMode !== 'conway') return;
  const report = conwayEngine.getAnalyticsReport();
  if (!report) return;

  if (!force && report.currentGen === lastAnalyticsRenderGen && !chartHoverData) {
    return;
  }
  lastAnalyticsRenderGen = report.currentGen;

  // 1. Update stat cards
  if (elInitialVal) elInitialVal.textContent = report.initialAlive.toLocaleString();
  if (elInitialSub) elInitialSub.textContent = `Generación ${report.initialGen}`;
  if (elPeakVal) elPeakVal.textContent = report.peakAlive.toLocaleString();
  if (elPeakSub) elPeakSub.textContent = `Récord: Gen ${report.peakGen}`;
  if (elAreaVal) elAreaVal.textContent = `${report.currentBoundingBox.w}×${report.currentBoundingBox.h}`;
  if (elAreaSub) elAreaSub.textContent = `${report.currentBoundingBox.area.toLocaleString()} c² (Máx: ${report.maxExpansionArea.toLocaleString()})`;
  if (elDiagIcon) elDiagIcon.textContent = report.diagnosis.icon;
  if (elDiagVal) elDiagVal.textContent = report.diagnosis.title;
  if (elDiagSub) elDiagSub.textContent = report.diagnosis.detail;

  // 2. Update legend counts
  if (elLegendValAlive) elLegendValAlive.textContent = report.currentAlive.toLocaleString();
  if (elLegendValStill) elLegendValStill.textContent = report.currentStill.toLocaleString();
  if (elLegendValOsc) elLegendValOsc.textContent = report.currentOsc.toLocaleString();

  // 3. Update milestone table
  if (elTableBody) {
    if (!report.milestones || report.milestones.length === 0) {
      elTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; opacity:0.6; padding:18px;">Sin generaciones aún. Pulsa Iniciar para registrar la evolución.</td></tr>`;
    } else {
      elTableBody.innerHTML = report.milestones.map(m => {
        const stillPct = m.alive > 0 ? Math.round((m.still / m.alive) * 100) : 0;
        const oscPct = m.alive > 0 ? Math.round((m.osc / m.alive) * 100) : 0;
        return `
          <tr>
            <td><span class="table-milestone-badge">${m.label}</span></td>
            <td><strong>Gen ${m.gen}</strong></td>
            <td class="col-alive">${m.alive.toLocaleString()}</td>
            <td class="col-still">${m.still.toLocaleString()} <span class="pct-tag">(${stillPct}%)</span></td>
            <td class="col-osc">${m.osc.toLocaleString()} <span class="pct-tag">(${oscPct}%)</span></td>
            <td class="col-area">${m.w}×${m.h}</td>
          </tr>
        `;
      }).join('');
    }
  }

  // 4. Render Chart
  renderAnalyticsChart(report);
}

// Chart Rendering Engine (Pure Canvas 2D)
function renderAnalyticsChart(report) {
  if (!chartCanvas || !analyticsModalOpen) return;
  const container = chartCanvas.parentElement;
  if (!container) return;

  const w = container.clientWidth || 500;
  const h = 240;
  const dpr = window.devicePixelRatio || 1;

  if (chartCanvas.width !== Math.round(w * dpr) || chartCanvas.height !== Math.round(h * dpr)) {
    chartCanvas.width = Math.round(w * dpr);
    chartCanvas.height = Math.round(h * dpr);
  }

  const c = chartCanvas.getContext('2d');
  c.resetTransform();
  c.scale(dpr, dpr);
  c.clearRect(0, 0, w, h);

  const rawHistory = report.history || [];
  let data = rawHistory;
  if (typeof chartRange === 'number' && rawHistory.length > chartRange) {
    data = rawHistory.slice(-chartRange);
  }

  // Padding
  const padLeft = 45;
  const padRight = 18;
  const padTop = 20;
  const padBottom = 28;
  const plotW = Math.max(10, w - padLeft - padRight);
  const plotH = Math.max(10, h - padTop - padBottom);

  if (data.length === 0) {
    c.fillStyle = 'rgba(255, 255, 255, 0.4)';
    c.font = '500 13px system-ui, -apple-system, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('Esperando generaciones... Pulsa Iniciar o Paso a Paso.', w / 2, h / 2);
    return;
  }

  // Compute max value among active series
  let maxVal = 10;
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    if (chartSeries.alive && d.alive > maxVal) maxVal = d.alive;
    if (chartSeries.still && d.still > maxVal) maxVal = d.still;
    if (chartSeries.osc && d.osc > maxVal) maxVal = d.osc;
  }
  maxVal = Math.ceil(maxVal * 1.15); // Add 15% headroom

  const minGen = data[0].gen;
  const maxGen = data[data.length - 1].gen;
  const genSpan = Math.max(1, maxGen - minGen);

  const getX = (gen) => padLeft + ((gen - minGen) / genSpan) * plotW;
  const getY = (val) => padTop + plotH - (val / maxVal) * plotH;

  // Draw Horizontal Grid Lines
  c.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  c.lineWidth = 1;
  c.fillStyle = 'rgba(255, 255, 255, 0.4)';
  c.font = '10px system-ui, sans-serif';
  c.textAlign = 'right';
  c.textBaseline = 'middle';

  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const val = Math.round((maxVal / gridSteps) * i);
    const gy = getY(val);
    c.beginPath();
    c.moveTo(padLeft, gy);
    c.lineTo(padLeft + plotW, gy);
    c.stroke();
    c.fillText(val.toString(), padLeft - 6, gy);
  }

  // Draw Generation Labels at Bottom
  c.textAlign = 'center';
  c.textBaseline = 'top';
  c.fillText(`Gen ${minGen}`, padLeft, padTop + plotH + 8);
  if (data.length > 1) {
    c.fillText(`Gen ${maxGen}`, padLeft + plotW, padTop + plotH + 8);
    if (genSpan > 10) {
      const midGen = Math.round((minGen + maxGen) / 2);
      c.fillText(`Gen ${midGen}`, getX(midGen), padTop + plotH + 8);
    }
  }

  // Helper to draw a series line & gradient area
  const drawSeries = (key, strokeColor, glowColor, fillColorStart) => {
    if (!chartSeries[key] || data.length === 0) return;

    // Gradient fill area
    if (fillColorStart) {
      const grad = c.createLinearGradient(0, padTop, 0, padTop + plotH);
      grad.addColorStop(0, fillColorStart);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      c.beginPath();
      c.moveTo(getX(data[0].gen), padTop + plotH);
      for (let i = 0; i < data.length; i++) {
        c.lineTo(getX(data[i].gen), getY(data[i][key]));
      }
      c.lineTo(getX(data[data.length - 1].gen), padTop + plotH);
      c.closePath();
      c.fillStyle = grad;
      c.fill();
    }

    // Line stroke with subtle glow
    c.save();
    c.shadowColor = glowColor;
    c.shadowBlur = 6;
    c.strokeStyle = strokeColor;
    c.lineWidth = 2.2;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i < data.length; i++) {
      const px = getX(data[i].gen);
      const py = getY(data[i][key]);
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.stroke();
    c.restore();

    // If few points (<= 30), draw subtle dots
    if (data.length <= 30) {
      c.fillStyle = strokeColor;
      for (let i = 0; i < data.length; i++) {
        const px = getX(data[i].gen);
        const py = getY(data[i][key]);
        c.beginPath();
        c.arc(px, py, 3, 0, Math.PI * 2);
        c.fill();
      }
    }
  };

  // Draw 3 series in order: osc, still, alive
  drawSeries('osc', '#a855f7', 'rgba(168, 85, 247, 0.6)', 'rgba(168, 85, 247, 0.12)');
  drawSeries('still', '#06b6d4', 'rgba(6, 182, 212, 0.6)', 'rgba(6, 182, 212, 0.12)');
  drawSeries('alive', '#10b981', 'rgba(16, 185, 129, 0.7)', 'rgba(16, 185, 129, 0.22)');

  // Draw Hover / Touch Scrubber Crosshair
  if (chartHoverData) {
    const hx = getX(chartHoverData.gen);
    if (hx >= padLeft && hx <= padLeft + plotW) {
      c.save();
      c.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      c.lineWidth = 1.2;
      c.setLineDash([4, 4]);
      c.beginPath();
      c.moveTo(hx, padTop);
      c.lineTo(hx, padTop + plotH);
      c.stroke();
      c.restore();

      // Draw dot markers at crosshair
      const drawMarker = (key, color) => {
        if (!chartSeries[key]) return;
        const my = getY(chartHoverData[key]);
        c.fillStyle = '#ffffff';
        c.strokeStyle = color;
        c.lineWidth = 2.5;
        c.beginPath();
        c.arc(hx, my, 4.5, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      };

      drawMarker('osc', '#a855f7');
      drawMarker('still', '#06b6d4');
      drawMarker('alive', '#10b981');
    }
  }
}

// Hover / Touch interaction for crosshair tooltip
function handleChartPointer(e) {
  if (!chartCanvas || !analyticsModalOpen) return;
  const report = conwayEngine.getAnalyticsReport();
  const rawHistory = report.history || [];
  if (rawHistory.length === 0) return;

  let data = rawHistory;
  if (typeof chartRange === 'number' && rawHistory.length > chartRange) {
    data = rawHistory.slice(-chartRange);
  }
  if (data.length === 0) return;

  const rect = chartCanvas.getBoundingClientRect();
  const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : null);
  const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : null);
  if (clientX === null || clientY === null) return;

  const mouseX = clientX - rect.left;
  const mouseY = clientY - rect.top;

  const padLeft = 45;
  const padRight = 18;
  const plotW = Math.max(10, rect.width - padLeft - padRight);

  const clampedX = Math.max(padLeft, Math.min(padLeft + plotW, mouseX));
  const ratio = (clampedX - padLeft) / plotW;

  const minGen = data[0].gen;
  const maxGen = data[data.length - 1].gen;
  const targetGen = minGen + ratio * (maxGen - minGen);

  let closest = data[0];
  let minDiff = Math.abs(data[0].gen - targetGen);
  for (let i = 1; i < data.length; i++) {
    const diff = Math.abs(data[i].gen - targetGen);
    if (diff < minDiff) {
      minDiff = diff;
      closest = data[i];
    }
  }

  chartHoverData = closest;
  renderAnalyticsChart(report);

  // Position tooltip
  if (chartTooltip) {
    chartTooltip.classList.remove('hidden');
    const stillPct = closest.alive > 0 ? Math.round((closest.still / closest.alive) * 100) : 0;
    const oscPct = closest.alive > 0 ? Math.round((closest.osc / closest.alive) * 100) : 0;

    chartTooltip.innerHTML = `
      <div class="tip-gen">Generación ${closest.gen}</div>
      <div class="tip-row tip-alive"><span>Vivas:</span><strong>${closest.alive.toLocaleString()}</strong></div>
      <div class="tip-row tip-still"><span>Estáticas:</span><strong>${closest.still.toLocaleString()} (${stillPct}%)</strong></div>
      <div class="tip-row tip-osc"><span>Oscilantes:</span><strong>${closest.osc.toLocaleString()} (${oscPct}%)</strong></div>
      <div class="tip-sub">📐 Expansión: ${closest.w}×${closest.h} (${closest.area.toLocaleString()} c²)</div>
    `;

    const tipWidth = chartTooltip.offsetWidth || 160;
    const tipHeight = chartTooltip.offsetHeight || 100;
    let leftPos = mouseX + 12;
    if (leftPos + tipWidth > rect.width - 10) {
      leftPos = mouseX - tipWidth - 12;
    }
    let topPos = Math.max(8, Math.min(rect.height - tipHeight - 8, mouseY - 40));

    chartTooltip.style.left = `${Math.max(10, leftPos)}px`;
    chartTooltip.style.top = `${topPos}px`;
  }
}

if (chartCanvas) {
  chartCanvas.addEventListener('pointermove', handleChartPointer);
  chartCanvas.addEventListener('pointerleave', () => {
    chartHoverData = null;
    if (chartTooltip) chartTooltip.classList.add('hidden');
    renderAnalyticsChart(conwayEngine.getAnalyticsReport());
  });
  chartCanvas.addEventListener('touchstart', handleChartPointer, { passive: true });
  chartCanvas.addEventListener('touchmove', handleChartPointer, { passive: true });
  chartCanvas.addEventListener('touchend', () => {
    chartHoverData = null;
    if (chartTooltip) chartTooltip.classList.add('hidden');
    renderAnalyticsChart(conwayEngine.getAnalyticsReport());
  });
}

// Window resize updates chart if modal open
window.addEventListener('resize', () => {
  if (analyticsModalOpen) {
    renderAnalyticsChart(conwayEngine.getAnalyticsReport());
  }
});

// Copy scientific summary report to clipboard
btnCopyReport?.addEventListener('click', async () => {
  const report = conwayEngine.getAnalyticsReport();
  if (!report) return;

  const milestoneLines = (report.milestones || []).map(m => {
    const sPct = m.alive > 0 ? Math.round((m.still / m.alive) * 100) : 0;
    const oPct = m.alive > 0 ? Math.round((m.osc / m.alive) * 100) : 0;
    return `  • [${m.label.toUpperCase()}] Gen ${m.gen}: ${m.alive} vivas (${m.still} est [${sPct}%], ${m.osc} osc [${oPct}%]) | Expansión: ${m.w}x${m.h} (${m.area} c²)`;
  }).join('\n');

  const text = [
    '=====================================================',
    '      ZEN APP - INFORME CIENTÍFICO Y DIDÁCTICO       ',
    '             JUEGO DE LA VIDA DE CONWAY              ',
    '=====================================================',
    `Fecha de análisis: ${new Date().toLocaleString()}`,
    `Generación actual evaluada: Gen ${report.currentGen}`,
    '',
    '─── POBLACIÓN Y EVOLUCIÓN ───',
    `• Células iniciales: ${report.initialAlive} vivas (Gen ${report.initialGen})`,
    `• Récord poblacional: ${report.peakAlive} vivas (Gen ${report.peakGen})`,
    `• Población actual: ${report.currentAlive} vivas`,
    `  ↳ Estáticas: ${report.currentStill} (${report.currentAlive > 0 ? Math.round((report.currentStill / report.currentAlive) * 100) : 0}%)`,
    `  ↳ Oscilantes: ${report.currentOsc} (${report.currentAlive > 0 ? Math.round((report.currentOsc / report.currentAlive) * 100) : 0}%)`,
    '',
    '─── DISPERSIÓN ESPACIAL Y NAVEGACIÓN ───',
    `• Marco delimitador actual: ${report.currentBoundingBox.w} x ${report.currentBoundingBox.h} (${report.currentBoundingBox.area} celdas²)`,
    `• Área de expansión máxima: ${report.maxExpansionArea} celdas²`,
    `• Diagnóstico de expansión: ${report.diagnosis.icon} ${report.diagnosis.title}`,
    `  ↳ Detalle: ${report.diagnosis.detail}`,
    '',
    '─── HITOS HISTÓRICOS ───',
    milestoneLines || '  • Sin generaciones previas registradas.',
    '====================================================='
  ].join('\n');

  try {
    await navigator.clipboard.writeText(text);
    if (copyReportText) {
      const orig = copyReportText.textContent;
      copyReportText.textContent = '✓ ¡Informe Copiado!';
      setTimeout(() => {
        if (copyReportText) copyReportText.textContent = orig;
      }, 2500);
    }
  } catch (err) {
    console.error('Error al copiar reporte', err);
  }
});

// ═══ GAME LOOP ═══
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentMode === 'bouncing') {
    bouncingEngine.update();
    bouncingEngine.draw();
  } else {
    conwayEngine.update();
    conwayEngine.draw();
    if (analyticsModalOpen) {
      updateAnalyticsModal();
    }
  }

  updateCounter();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

