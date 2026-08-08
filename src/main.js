import { setupCanvas } from './utils/canvas.js';
import { ArcheryMode } from './modes/archery.js';
import { BouncingMode } from './modes/bouncing.js';

// Setup Canvas
const { canvas, ctx } = setupCanvas('gameCanvas');

// Global State
let currency = 0;
const currencyEl = document.getElementById('currency');

function updateCurrency(amount) {
  currency += amount;
  currencyEl.textContent = formatNumber(Math.floor(currency));
}

function formatNumber(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toString();
}

// Initialize Modes
const archery = new ArcheryMode(canvas, ctx, updateCurrency);
const bouncing = new BouncingMode(canvas, ctx);

let currentMode = archery;
let animationFrameId = null;

// UI Elements
const btnToggleMode = document.getElementById('btn-toggle-mode');
const modeLabel = document.getElementById('mode-label');
const tabBtns = document.querySelectorAll('.tab');
const tabPanels = document.querySelectorAll('.tab-panel');
const tabChaosBtn = document.getElementById('tab-chaos-btn');

// Mode Switching Logic
btnToggleMode.addEventListener('click', () => {
  if (currentMode === archery) {
    archery.stop();
    currentMode = bouncing;
    bouncing.start();
    modeLabel.textContent = 'CHAOS';

    switchTab('tab-chaos');
    tabChaosBtn.style.display = 'flex';
  } else {
    bouncing.stop();
    currentMode = archery;
    archery.start();
    modeLabel.textContent = 'SHARDS';

    switchTab('tab-sparks');
    tabChaosBtn.style.display = 'none';
  }
});

// Tabs Logic
function switchTab(tabId) {
  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  tabPanels.forEach(panel => {
    panel.classList.toggle('active', panel.id === tabId);
  });
}

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab);
  });
});

// Archery Upgrades UI
const statDmg = document.getElementById('stat-dmg');
const statCount = document.getElementById('stat-count');
const costSparkEl = document.getElementById('cost-spark');
const costUpgSparkEl = document.getElementById('cost-upg-spark');

let sparkCost = 10;
let upgCost = 20;

function updateArcheryUI() {
  statDmg.textContent = archery.damage.toFixed(1);
  statCount.textContent = archery.arrows.length;
  costSparkEl.textContent = formatNumber(sparkCost);
  costUpgSparkEl.textContent = formatNumber(upgCost);
}

document.getElementById('btn-add-spark').addEventListener('click', () => {
  if (currency >= sparkCost) {
    updateCurrency(-sparkCost);
    archery.addArrow();
    sparkCost = Math.floor(sparkCost * 1.5);
    updateArcheryUI();
  }
});

document.getElementById('btn-upg-spark').addEventListener('click', () => {
  if (currency >= upgCost) {
    updateCurrency(-upgCost);
    archery.damage *= 1.2;
    upgCost = Math.floor(upgCost * 1.8);
    updateArcheryUI();
  }
});

document.getElementById('btn-merge-spark').addEventListener('click', () => {
  if (archery.arrows.length >= 2) {
    archery.arrows.pop();
    archery.damage *= 2;
    updateArcheryUI();
  }
});

// Bouncing Mode UI
const ballCountEl = document.getElementById('ball-count');

document.getElementById('btn-add-ball').addEventListener('click', () => {
  bouncing.addBall();
  ballCountEl.textContent = bouncing.balls.length;
});

document.getElementById('btn-clear-balls').addEventListener('click', () => {
  bouncing.clearBalls();
  ballCountEl.textContent = 0;
});

document.getElementById('toggle-gravity').addEventListener('change', (e) => {
  bouncing.setGravity(e.target.checked);
});

document.getElementById('toggle-collision').addEventListener('change', (e) => {
  bouncing.setCollision(e.target.checked);
});

// Game Loop
let lastTime = 0;
function gameLoop(time) {
  const dt = time - lastTime;
  lastTime = time;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentMode) {
    currentMode.update(dt, time);
    currentMode.draw();
  }

  animationFrameId = requestAnimationFrame(gameLoop);
}

// Start
archery.start();
updateArcheryUI();
animationFrameId = requestAnimationFrame(gameLoop);
