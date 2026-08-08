import './style.css';
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
  currencyEl.textContent = Math.floor(currency);
}

// Initialize Modes
const archery = new ArcheryMode(canvas, ctx, updateCurrency);
const bouncing = new BouncingMode(canvas, ctx);

let currentMode = archery;
let animationFrameId = null;

// UI Elements
const btnToggleMode = document.getElementById('btn-toggle-mode');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const tabChaosBtn = document.getElementById('tab-chaos-btn');

// Mode Switching Logic
btnToggleMode.addEventListener('click', () => {
  if (currentMode === archery) {
    archery.stop();
    currentMode = bouncing;
    bouncing.start();
    btnToggleMode.textContent = '🔄 Modo: Caos';
    
    // Switch tabs to chaos
    switchTab('tab-chaos');
    tabChaosBtn.style.display = 'block'; // Show chaos tab
  } else {
    bouncing.stop();
    currentMode = archery;
    archery.start();
    btnToggleMode.textContent = '🔄 Modo: Arquería';
    
    // Switch tabs to sparks
    switchTab('tab-sparks');
    tabChaosBtn.style.display = 'none'; // Hide chaos tab
  }
});

// Tabs Logic
function switchTab(tabId) {
  tabBtns.forEach(btn => {
    if (btn.dataset.tab === tabId) btn.classList.add('active');
    else btn.classList.remove('active');
  });
  tabContents.forEach(content => {
    if (content.id === tabId) content.classList.add('active');
    else content.classList.remove('active');
  });
}

tabBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    switchTab(e.target.dataset.tab);
  });
});

// Archery Upgrades UI
const btnAddSpark = document.getElementById('btn-add-spark');
const btnUpgSpark = document.getElementById('btn-upg-spark');
const btnMergeSpark = document.getElementById('btn-merge-spark');
const statDmg = document.getElementById('stat-dmg');
const statCount = document.getElementById('stat-count');
const costSparkEl = document.getElementById('cost-spark');
const costUpgSparkEl = document.getElementById('cost-upg-spark');

let sparkCost = 10;
let upgCost = 20;

function updateArcheryUI() {
  statDmg.textContent = archery.damage.toFixed(1);
  statCount.textContent = archery.arrows.length;
  costSparkEl.textContent = sparkCost;
  costUpgSparkEl.textContent = upgCost;
}

btnAddSpark.addEventListener('click', () => {
  if (currency >= sparkCost) {
    updateCurrency(-sparkCost);
    archery.addArrow();
    sparkCost = Math.floor(sparkCost * 1.5);
    updateArcheryUI();
  }
});

btnUpgSpark.addEventListener('click', () => {
  if (currency >= upgCost) {
    updateCurrency(-upgCost);
    archery.damage *= 1.2;
    upgCost = Math.floor(upgCost * 1.8);
    updateArcheryUI();
  }
});

btnMergeSpark.addEventListener('click', () => {
  if (archery.arrows.length >= 2) {
    // Remove 2 arrows, add 1 with double damage/size (simplification: just multiply global damage for now)
    archery.arrows.pop();
    archery.damage *= 2;
    updateArcheryUI();
  }
});

// Bouncing Mode UI
const btnAddBall = document.getElementById('btn-add-ball');
const btnClearBalls = document.getElementById('btn-clear-balls');
const toggleGravity = document.getElementById('toggle-gravity');
const toggleCollision = document.getElementById('toggle-collision');
const ballCountEl = document.getElementById('ball-count');

btnAddBall.addEventListener('click', () => {
  bouncing.addBall();
  ballCountEl.textContent = bouncing.balls.length;
});

btnClearBalls.addEventListener('click', () => {
  bouncing.clearBalls();
  ballCountEl.textContent = 0;
});

toggleGravity.addEventListener('change', (e) => {
  bouncing.setGravity(e.target.checked);
});

toggleCollision.addEventListener('change', (e) => {
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

// Start Game
archery.start();
updateArcheryUI();
animationFrameId = requestAnimationFrame(gameLoop);
