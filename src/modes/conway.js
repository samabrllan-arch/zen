// ═══════════════════════════════════════════════════════
// CONWAY'S GAME OF LIFE — "Zen Life"
// A meditative cellular automaton simulation with
// phosphor decay trails, glowing aesthetic cells,
// interactive drawing, and iconic presets.
// ═══════════════════════════════════════════════════════

import { zenAudio } from '../utils/audio.js';

const PALETTES = {
  neon: (ratio) => `hsl(${280 + ratio * 160}, 100%, 65%)`,
  pastel: (ratio) => `hsl(${180 + ratio * 160}, 75%, 75%)`,
  mono: (ratio) => `hsl(0, 0%, ${60 + ratio * 35}%)`,
  rainbow: (ratio) => `hsl(${(ratio * 360) % 360}, 90%, 62%)`,
  fire: (ratio) => `hsl(${15 + ratio * 45}, 100%, 55%)`,
  ocean: (ratio) => `hsl(${190 + ratio * 50}, 85%, 52%)`,
};

export class ConwayMode {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    
    this.isActive = false;
    this.isPaused = false;

    // Grid configuration
    this.cellSize = 14;
    this.cols = 0;
    this.rows = 0;
    this.grid = null;      // Uint8Array: 1 = alive, 0 = dead
    this.nextGrid = null;  // Uint8Array
    this.trailGrid = null; // Float32Array: 0.0 to 1.0 (phosphor decay)
    this.ageGrid = null;   // Uint16Array: consecutive generations alive

    // Simulation metrics
    this.generation = 0;
    this.aliveCount = 0;
    this.speed = 12; // generations per second
    this.lastStepTime = 0;
    this.wrap = true; // toroidal universe

    // Aesthetics
    this.palette = 'neon';
    this.showTrail = true;
    this.glowIntensity = 10;
    this.soundEnabled = true;

    // Drawing state
    this.isPointerDown = false;
    this.drawMode = 1; // 1 = paint alive, 0 = erase
    this.lastDrawnCell = null;
  }

  start() {
    this.isActive = true;
    this.initGrid();
    // Seed with a soothing central pattern if empty
    if (this.aliveCount === 0) {
      this.loadPreset('pulsar');
    }
  }

  stop() {
    this.isActive = false;
  }

  togglePause() {
    this.isPaused = !this.isPaused;
  }

  initGrid() {
    const newCols = Math.max(10, Math.floor(this.canvas.width / this.cellSize));
    const newRows = Math.max(10, Math.floor(this.canvas.height / this.cellSize));

    if (newCols === this.cols && newRows === this.rows && this.grid) {
      return;
    }

    const oldGrid = this.grid;
    const oldCols = this.cols;
    const oldRows = this.rows;

    this.cols = newCols;
    this.rows = newRows;
    const size = this.cols * this.rows;

    this.grid = new Uint8Array(size);
    this.nextGrid = new Uint8Array(size);
    this.trailGrid = new Float32Array(size);
    this.ageGrid = new Uint16Array(size);

    // If resizing with an existing grid, copy cells centered
    if (oldGrid && oldCols && oldRows) {
      const offsetX = Math.floor((this.cols - oldCols) / 2);
      const offsetY = Math.floor((this.rows - oldRows) / 2);
      let count = 0;

      for (let r = 0; r < oldRows; r++) {
        for (let c = 0; c < oldCols; c++) {
          if (oldGrid[r * oldCols + c]) {
            const tr = r + offsetY;
            const tc = c + offsetX;
            if (tr >= 0 && tr < this.rows && tc >= 0 && tc < this.cols) {
              this.grid[tr * this.cols + tc] = 1;
              count++;
            }
          }
        }
      }
      this.aliveCount = count;
    } else {
      this.aliveCount = 0;
    }
  }

  setCellSize(size) {
    this.cellSize = Math.max(8, Math.min(32, size));
    this.initGrid();
  }

  setSpeed(genPerSec) {
    this.speed = Math.max(1, Math.min(50, genPerSec));
  }

  setWrap(wrap) {
    this.wrap = wrap;
  }

  setPalette(p) {
    this.palette = p;
  }

  setTrail(on) {
    this.showTrail = on;
  }

  setGlow(v) {
    this.glowIntensity = v;
  }

  setSound(on) {
    this.soundEnabled = on;
  }

  clear() {
    if (!this.grid) return;
    this.grid.fill(0);
    this.nextGrid.fill(0);
    this.trailGrid.fill(0);
    this.ageGrid.fill(0);
    this.generation = 0;
    this.aliveCount = 0;
  }

  randomize(density = 0.2) {
    if (!this.grid) return;
    this.clear();
    let count = 0;
    const total = this.cols * this.rows;
    for (let i = 0; i < total; i++) {
      if (Math.random() < density) {
        this.grid[i] = 1;
        count++;
      }
    }
    this.aliveCount = count;
    this.generation = 0;
    zenAudio.playLifeChime(this.aliveCount, total);
  }

  // Pointer drawing methods
  handlePointerDown(clientX, clientY) {
    const cell = this._screenToCell(clientX, clientY);
    if (!cell) return;
    this.isPointerDown = true;
    
    // Toggle: if clicked an alive cell, switch to erase; otherwise paint
    const idx = cell.r * this.cols + cell.c;
    this.drawMode = this.grid[idx] ? 0 : 1;
    this._setCell(cell.c, cell.r, this.drawMode);
    this.lastDrawnCell = cell;
  }

  handlePointerMove(clientX, clientY) {
    if (!this.isPointerDown) return;
    const cell = this._screenToCell(clientX, clientY);
    if (!cell) return;
    if (this.lastDrawnCell && this.lastDrawnCell.c === cell.c && this.lastDrawnCell.r === cell.r) {
      return;
    }
    this._setCell(cell.c, cell.r, this.drawMode);
    this.lastDrawnCell = cell;
  }

  handlePointerUp() {
    this.isPointerDown = false;
    this.lastDrawnCell = null;
  }

  _screenToCell(x, y) {
    if (!this.cols || !this.rows) return null;
    const c = Math.floor(x / this.cellSize);
    const r = Math.floor(y / this.cellSize);
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return null;
    return { c, r };
  }

  _setCell(c, r, val) {
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return;
    const idx = r * this.cols + c;
    if (this.grid[idx] !== val) {
      this.grid[idx] = val;
      if (val === 1) {
        this.aliveCount++;
        this.trailGrid[idx] = 1.0;
        this.ageGrid[idx] = 1;
      } else {
        this.aliveCount = Math.max(0, this.aliveCount - 1);
        this.ageGrid[idx] = 0;
      }
    }
  }

  // Conway Step (B3/S23)
  step() {
    if (!this.grid) return;
    const cols = this.cols;
    const rows = this.rows;
    const grid = this.grid;
    const next = this.nextGrid;
    const age = this.ageGrid;
    const trail = this.trailGrid;
    const wrap = this.wrap;

    let aliveNow = 0;
    let births = 0;

    for (let r = 0; r < rows; r++) {
      const rowOffset = r * cols;
      const rUp = r > 0 ? (r - 1) * cols : (wrap ? (rows - 1) * cols : -1);
      const rDown = r < rows - 1 ? (r + 1) * cols : (wrap ? 0 : -1);

      for (let c = 0; c < cols; c++) {
        const cLeft = c > 0 ? c - 1 : (wrap ? cols - 1 : -1);
        const cRight = c < cols - 1 ? c + 1 : (wrap ? 0 : -1);

        // Count 8 neighbors
        let neighbors = 0;

        if (rUp !== -1) {
          if (cLeft !== -1 && grid[rUp + cLeft]) neighbors++;
          if (grid[rUp + c]) neighbors++;
          if (cRight !== -1 && grid[rUp + cRight]) neighbors++;
        }

        if (cLeft !== -1 && grid[rowOffset + cLeft]) neighbors++;
        if (cRight !== -1 && grid[rowOffset + cRight]) neighbors++;

        if (rDown !== -1) {
          if (cLeft !== -1 && grid[rDown + cLeft]) neighbors++;
          if (grid[rDown + c]) neighbors++;
          if (cRight !== -1 && grid[rDown + cRight]) neighbors++;
        }

        const idx = rowOffset + c;
        const state = grid[idx];

        if (state === 1) {
          // Live cell survives with 2 or 3 neighbors
          if (neighbors === 2 || neighbors === 3) {
            next[idx] = 1;
            age[idx] = Math.min(100, age[idx] + 1);
            aliveNow++;
          } else {
            next[idx] = 0;
            age[idx] = 0;
            trail[idx] = 1.0; // leave phosphor decay
          }
        } else {
          // Dead cell reproduces with exactly 3 neighbors
          if (neighbors === 3) {
            next[idx] = 1;
            age[idx] = 1;
            trail[idx] = 1.0;
            aliveNow++;
            births++;
          } else {
            next[idx] = 0;
          }
        }
      }
    }

    // Swap buffers
    this.grid.set(next);
    this.aliveCount = aliveNow;
    this.generation++;

    // Ambient chime if enabled and interesting activity
    if (this.soundEnabled && births > 0 && this.generation % 4 === 0) {
      zenAudio.playLifeChime(aliveNow, cols * rows);
    }
  }

  update() {
    if (!this.isActive) return;
    this.initGrid();

    // Decay phosphor trails
    if (this.trailGrid) {
      const decay = 0.04;
      for (let i = 0; i < this.trailGrid.length; i++) {
        if (this.trailGrid[i] > 0) {
          this.trailGrid[i] = Math.max(0, this.trailGrid[i] - decay);
        }
      }
    }

    // Step generation on interval
    if (!this.isPaused) {
      const now = performance.now();
      const interval = 1000 / this.speed;
      if (now - this.lastStepTime >= interval) {
        this.step();
        this.lastStepTime = now;
      }
    }
  }

  draw() {
    if (!this.isActive || !this.grid) return;
    const ctx = this.ctx;
    const cs = this.cellSize;
    const cols = this.cols;
    const rows = this.rows;
    const grid = this.grid;
    const trail = this.trailGrid;
    const age = this.ageGrid;
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    const colorFn = PALETTES[this.palette] || PALETTES.neon;
    const cellRadius = Math.max(2, cs * 0.38);

    // Subtle grid lines for zen minimalist alignment
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.022)' : 'rgba(0, 0, 0, 0.035)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= cols; c++) {
      const x = c * cs;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rows * cs);
    }
    for (let r = 0; r <= rows; r++) {
      const y = r * cs;
      ctx.moveTo(0, y);
      ctx.lineTo(cols * cs, y);
    }
    ctx.stroke();

    // Draw Phosphor Trails (decaying dead cells)
    if (this.showTrail) {
      for (let r = 0; r < rows; r++) {
        const rowOffset = r * cols;
        for (let c = 0; c < cols; c++) {
          const idx = rowOffset + c;
          const trVal = trail[idx];
          if (trVal > 0.02 && grid[idx] === 0) {
            const x = c * cs + cs / 2;
            const y = r * cs + cs / 2;
            const col = colorFn(0.5);
            ctx.fillStyle = col;
            ctx.globalAlpha = trVal * 0.28;
            ctx.beginPath();
            ctx.arc(x, y, cellRadius * (0.4 + trVal * 0.5), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    // Draw Living Cells with Glow & Heatmap Age
    if (this.glowIntensity > 0) {
      ctx.shadowBlur = this.glowIntensity;
    }

    for (let r = 0; r < rows; r++) {
      const rowOffset = r * cols;
      for (let c = 0; c < cols; c++) {
        const idx = rowOffset + c;
        if (grid[idx] === 1) {
          const x = c * cs + cs / 2;
          const y = r * cs + cs / 2;
          const cellAge = age[idx] || 1;
          const ageRatio = Math.min(1, cellAge / 30);
          const col = colorFn(ageRatio);

          if (this.glowIntensity > 0) {
            ctx.shadowColor = col;
          }

          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(x, y, cellRadius, 0, Math.PI * 2);
          ctx.fill();

          // Subtle bright core highlight
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.beginPath();
          ctx.arc(x - cellRadius * 0.2, y - cellRadius * 0.2, cellRadius * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }

  // Presets catalog
  loadPreset(name) {
    this.clear();
    const midC = Math.floor(this.cols / 2);
    const midR = Math.floor(this.rows / 2);

    const stamp = (pattern, startC, startR) => {
      pattern.forEach((row, dr) => {
        for (let dc = 0; dc < row.length; dc++) {
          if (row[dc] === 'O' || row[dc] === '1') {
            const c = startC + dc;
            const r = startR + dr;
            this._setCell(c, r, 1);
          }
        }
      });
    };

    switch (name) {
      case 'glider': {
        const pattern = [
          '.O.',
          '..O',
          'OOO'
        ];
        stamp(pattern, midC - 1, midR - 1);
        break;
      }

      case 'lwss': { // Lightweight Spaceship
        const pattern = [
          '.O..O',
          'O....',
          'O...O',
          'OOOO.'
        ];
        stamp(pattern, midC - 2, midR - 2);
        break;
      }

      case 'pulsar': { // Period-3 oscillator
        const pattern = [
          '..OOO...OOO..',
          '.............',
          'O....O.O....O',
          'O....O.O....O',
          'O....O.O....O',
          '..OOO...OOO..',
          '.............',
          '..OOO...OOO..',
          'O....O.O....O',
          'O....O.O....O',
          'O....O.O....O',
          '.............',
          '..OOO...OOO..'
        ];
        stamp(pattern, midC - 6, midR - 6);
        break;
      }

      case 'gun': { // Gosper Glider Gun
        const pattern = [
          '........................O...........',
          '......................O.O...........',
          '............OO......OO............OO',
          '...........O...O....OO............OO',
          'OO........O.....O...OO..............',
          'OO........O...O.OO....O.O...........',
          '..........O.....O.......O...........',
          '...........O...O....................',
          '............OO......................'
        ];
        stamp(pattern, Math.max(2, midC - 18), Math.max(2, midR - 5));
        break;
      }

      case 'pentadecathlon': { // Period-15 oscillator
        const pattern = [
          '..O......O..',
          'OO.OOOOOO.OO',
          '..O......O..'
        ];
        stamp(pattern, midC - 6, midR - 1);
        break;
      }

      case 'acorn': { // Methuselah (5206 generations of evolution)
        const pattern = [
          '.O.....',
          '...O...',
          'OO..OOO'
        ];
        stamp(pattern, midC - 3, midR - 1);
        break;
      }

      case 'random':
      default:
        this.randomize(0.18);
        return;
    }

    zenAudio.playLifeChime(this.aliveCount, this.cols * this.rows);
  }
}
