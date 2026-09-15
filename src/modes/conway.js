// ═══════════════════════════════════════════════════════
// CONWAY'S GAME OF LIFE — "Zen Life 20/10"
// High-performance cellular automaton engine with:
// - Hardware-accelerated offscreen sprite caching
// - Smooth Zoom & Pan (pinch-to-zoom, wheel, pan tool)
// - Zen Auto-Pattern Rain (Lluvia de Patrones)
// - Viewport culling for 120 FPS mobile performance
// - Multi-tool support (Draw vs Pan)
// ═══════════════════════════════════════════════════════

import { zenAudio } from '../utils/audio.js';

export const PATTERNS = {
  glider: {
    name: 'Planeador (Glider)',
    desc: 'Viajero diagonal eterno',
    icon: '🛸',
    grid: [
      '.O.',
      '..O',
      'OOO'
    ]
  },
  lwss: {
    name: 'Nave Ligera (LWSS)',
    desc: 'Nave espacial horizontal rápida',
    icon: '🛰️',
    grid: [
      '.O..O',
      'O....',
      'O...O',
      'OOOO.'
    ]
  },
  pulsar: {
    name: 'Púlsar (Oscilador)',
    desc: 'Fascinante flor pulsante de período 3',
    icon: '💫',
    grid: [
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
    ]
  },
  gun: {
    name: 'Cañón de Gosper',
    desc: 'Fábrica infinita de planeadores',
    icon: '🚀',
    grid: [
      '........................O...........',
      '......................O.O...........',
      '............OO......OO............OO',
      '...........O...O....OO............OO',
      'OO........O.....O...OO..............',
      'OO........O...O.OO....O.O...........',
      '..........O.....O.......O...........',
      '...........O...O....................',
      '............OO......................'
    ]
  },
  pentadecathlon: {
    name: 'Pentadecathlon (P15)',
    desc: 'Oscilador rítmico de 15 fases',
    icon: '⚡',
    grid: [
      '..O......O..',
      'OO.OOOOOO.OO',
      '..O......O..'
    ]
  },
  acorn: {
    name: 'Bellota (Acorn)',
    desc: 'Semilla mágica que florece por 5206 ciclos',
    icon: '🌱',
    grid: [
      '.O.....',
      '...O...',
      'OO..OOO'
    ]
  },
  toad: {
    name: 'Sapo (Toad)',
    desc: 'Oscilador clásico de 2 fases',
    icon: '🐸',
    grid: [
      '.OOO',
      'OOO.'
    ]
  },
  beacon: {
    name: 'Faro (Beacon)',
    desc: 'Faro intermitente zen',
    icon: '🏮',
    grid: [
      'OO..',
      'OO..',
      '..OO',
      '..OO'
    ]
  }
};

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
    this.stillCount = 0;
    this.oscillatingCount = 0;
    this.prev2Grid = null; // Buffer from 2 generations ago to detect oscillators
    this.speed = 12; // generations per second
    this.lastStepTime = 0;
    this.wrap = true; // toroidal universe

    // Camera: Zoom & Pan
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.minZoom = 0.35;
    this.maxZoom = 4.0;

    // Active tool: 'draw' | 'line' | 'cross' | 'pan'
    this.tool = 'draw';
    this.radialAngleStep = 90; // Default: 90° perpendicular cross
    this.lineStartCell = null;
    this.previewCells = [];

    // Zen Pattern Rain (Lluvia de Patrones)
    this.rainEnabled = false;
    this.lastRainTime = 0;
    this.rainIntervalMs = 2400; // spawn pattern every 2.4s

    // Aesthetics
    this.palette = 'neon';
    this.showTrail = true;
    this.glowIntensity = 10;
    this.soundEnabled = true;

    // Sprite Caches for 60-120 FPS hardware blit
    this.cellSpriteCache = []; // pre-rendered offscreen canvases for cell ages
    this.trailSprite = null;   // pre-rendered offscreen canvas for trail glow
    this.initSpriteCache();

    // Touch & Pointer State
    this.activePointers = new Map();
    this.lastPinchDist = 0;
    this.lastPinchMid = null;
    this.drawMode = 1; // 1 = paint alive, 0 = erase
    this.lastDrawnCell = null;
    this.isSinglePointerDrag = false;
    this.lastPanPointer = null;

    // Spontaneous spawns visual ripple
    this.ripples = [];
  }

  // Pre-render cell textures with baked glow into small offscreen canvases
  initSpriteCache() {
    this.cellSpriteCache = [];
    const colorFn = PALETTES[this.palette] || PALETTES.neon;
    const spriteSize = 48; // crisp high-DPI sprite
    const center = spriteSize / 2;
    const baseRadius = 14;

    for (let i = 0; i < 12; i++) {
      const offCanvas = document.createElement('canvas');
      offCanvas.width = spriteSize;
      offCanvas.height = spriteSize;
      const oCtx = offCanvas.getContext('2d');

      const ageRatio = Math.min(1, i / 10);
      const col = colorFn(ageRatio);

      // Baked soft glow
      const grad = oCtx.createRadialGradient(center, center, baseRadius * 0.3, center, center, baseRadius * 1.55);
      grad.addColorStop(0, col);
      grad.addColorStop(0.65, col);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      oCtx.fillStyle = grad;
      oCtx.beginPath();
      oCtx.arc(center, center, baseRadius * 1.55, 0, Math.PI * 2);
      oCtx.fill();

      // Solid cell body
      oCtx.fillStyle = col;
      oCtx.beginPath();
      oCtx.arc(center, center, baseRadius, 0, Math.PI * 2);
      oCtx.fill();

      // Gleam highlight
      oCtx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      oCtx.beginPath();
      oCtx.arc(center - baseRadius * 0.25, center - baseRadius * 0.25, baseRadius * 0.35, 0, Math.PI * 2);
      oCtx.fill();

      this.cellSpriteCache.push(offCanvas);
    }

    // Pre-render phosphor trail dot
    const tCanvas = document.createElement('canvas');
    tCanvas.width = 32;
    tCanvas.height = 32;
    const tCtx = tCanvas.getContext('2d');
    const tCenter = 16;
    const tGrad = tCtx.createRadialGradient(tCenter, tCenter, 2, tCenter, tCenter, 14);
    tGrad.addColorStop(0, colorFn(0.5));
    tGrad.addColorStop(0.8, colorFn(0.5));
    tGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    tCtx.fillStyle = tGrad;
    tCtx.beginPath();
    tCtx.arc(tCenter, tCenter, 14, 0, Math.PI * 2);
    tCtx.fill();
    this.trailSprite = tCanvas;
  }

  start() {
    this.isActive = true;
    this.initGrid();
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
    const effCell = this.cellSize * this.zoom;
    const minCols = Math.max(16, Math.ceil(this.canvas.width / effCell) + 8);
    const minRows = Math.max(16, Math.ceil(this.canvas.height / effCell) + 8);

    if (this.grid) {
      this.ensureViewportCoverage();
      return;
    }

    this.cols = minCols;
    this.rows = minRows;
    const size = this.cols * this.rows;

    this.grid = new Uint8Array(size);
    this.nextGrid = new Uint8Array(size);
    this.trailGrid = new Float32Array(size);
    this.ageGrid = new Uint16Array(size);
    this.prev2Grid = new Uint8Array(size);
    this.aliveCount = 0;
    this.stillCount = 0;
    this.oscillatingCount = 0;
  }

  // Expands grid in any direction while preserving existing cells and exact screen positions
  expandGrid(addLeft, addRight, addTop, addBottom) {
    if (addLeft === 0 && addRight === 0 && addTop === 0 && addBottom === 0) return;
    const oldCols = this.cols;
    const oldRows = this.rows;
    const oldGrid = this.grid;
    const oldNext = this.nextGrid;
    const oldTrail = this.trailGrid;
    const oldAge = this.ageGrid;
    const oldPrev2 = this.prev2Grid;

    const newCols = oldCols + addLeft + addRight;
    const newRows = oldRows + addTop + addBottom;
    const newSize = newCols * newRows;

    const newGrid = new Uint8Array(newSize);
    const newNext = new Uint8Array(newSize);
    const newTrail = new Float32Array(newSize);
    const newAge = new Uint16Array(newSize);
    const newPrev2 = new Uint8Array(newSize);

    if (oldGrid) {
      for (let r = 0; r < oldRows; r++) {
        const oldRowOffset = r * oldCols;
        const newRowOffset = (r + addTop) * newCols;
        for (let c = 0; c < oldCols; c++) {
          const oldIdx = oldRowOffset + c;
          const newIdx = newRowOffset + (c + addLeft);
          newGrid[newIdx] = oldGrid[oldIdx];
          newNext[newIdx] = oldNext[oldIdx];
          newTrail[newIdx] = oldTrail[oldIdx];
          newAge[newIdx] = oldAge[oldIdx];
          if (oldPrev2) newPrev2[newIdx] = oldPrev2[oldIdx];
        }
      }
    }

    this.cols = newCols;
    this.rows = newRows;
    this.grid = newGrid;
    this.nextGrid = newNext;
    this.trailGrid = newTrail;
    this.ageGrid = newAge;
    this.prev2Grid = newPrev2;

    // Compensate camera pan so existing cells don't jump on screen
    const effCell = this.cellSize * this.zoom;
    this.panX -= addLeft * effCell;
    this.panY -= addTop * effCell;
  }

  // Ensures the grid dynamically covers the visible viewport and beyond as you zoom out or pan
  ensureViewportCoverage() {
    if (!this.canvas.width || !this.canvas.height) return;
    const effCell = this.cellSize * this.zoom;
    const minVisibleC = Math.floor(-this.panX / effCell);
    const maxVisibleC = Math.ceil((this.canvas.width - this.panX) / effCell);
    const minVisibleR = Math.floor(-this.panY / effCell);
    const maxVisibleR = Math.ceil((this.canvas.height - this.panY) / effCell);

    const margin = 8;
    let addLeft = 0;
    let addRight = 0;
    let addTop = 0;
    let addBottom = 0;

    if (minVisibleC < 0) {
      addLeft = Math.abs(minVisibleC) + margin;
    }
    if (maxVisibleC >= this.cols) {
      addRight = (maxVisibleC - this.cols) + margin;
    }
    if (minVisibleR < 0) {
      addTop = Math.abs(minVisibleR) + margin;
    }
    if (maxVisibleR >= this.rows) {
      addBottom = (maxVisibleR - this.rows) + margin;
    }

    // Ensure total dimensions span at least full view
    const minCols = Math.ceil(this.canvas.width / effCell) + margin * 2;
    const minRows = Math.ceil(this.canvas.height / effCell) + margin * 2;
    if (this.cols + addLeft + addRight < minCols) {
      const diff = minCols - (this.cols + addLeft + addRight);
      addLeft += Math.floor(diff / 2);
      addRight += Math.ceil(diff / 2);
    }
    if (this.rows + addTop + addBottom < minRows) {
      const diff = minRows - (this.rows + addTop + addBottom);
      addTop += Math.floor(diff / 2);
      addBottom += Math.ceil(diff / 2);
    }

    if (addLeft > 0 || addRight > 0 || addTop > 0 || addBottom > 0) {
      this.expandGrid(addLeft, addRight, addTop, addBottom);
    }
  }

  // ═══ CAMERA / ZOOM & PAN CONTROLS ═══
  zoomAt(deltaFactor, focalX, focalY) {
    const oldZoom = this.zoom;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, oldZoom * deltaFactor));
    if (Math.abs(newZoom - oldZoom) < 0.001) return;

    // Anchor around focal point so content under cursor/pinch stays fixed
    this.panX = focalX - (focalX - this.panX) * (newZoom / oldZoom);
    this.panY = focalY - (focalY - this.panY) * (newZoom / oldZoom);
    this.zoom = newZoom;

    // Dynamically expand grid to seamlessly fill the visible screen at the new zoom level
    this.ensureViewportCoverage();
  }

  zoomIn() {
    this.zoomAt(1.25, this.canvas.width / 2, this.canvas.height / 2);
  }

  zoomOut() {
    this.zoomAt(0.8, this.canvas.width / 2, this.canvas.height / 2);
  }

  resetView() {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.ensureViewportCoverage();
  }

  // Smoothly recenters view onto the centroid of active cells or canvas center
  centerView() {
    if (this.aliveCount > 0 && this.grid) {
      let sumC = 0, sumR = 0, count = 0;
      for (let r = 0; r < this.rows; r++) {
        const rowOffset = r * this.cols;
        for (let c = 0; c < this.cols; c++) {
          if (this.grid[rowOffset + c] === 1) {
            sumC += c;
            sumR += r;
            count++;
          }
        }
      }
      if (count > 0) {
        const avgC = sumC / count;
        const avgR = sumR / count;
        const effCell = this.cellSize * this.zoom;
        this.panX = (this.canvas.width / 2) - (avgC + 0.5) * effCell;
        this.panY = (this.canvas.height / 2) - (avgR + 0.5) * effCell;
        this.ensureViewportCoverage();
        return;
      }
    }
    this.resetView();
  }

  getDidacticMetrics() {
    return {
      generation: this.generation,
      alive: this.aliveCount,
      still: this.stillCount,
      oscillating: this.oscillatingCount
    };
  }

  setTool(tool) {
    this.tool = tool; // 'draw' | 'line' | 'cross' | 'pan'
    this.previewCells = [];
    this.lineStartCell = null;
  }

  setRadialAngle(degrees) {
    this.radialAngleStep = Math.max(10, Math.min(90, degrees));
  }

  toggleRain() {
    return this.setRain(!this.rainEnabled);
  }

  setRain(active) {
    this.rainEnabled = active;
    if (this.rainEnabled) {
      this.lastRainTime = performance.now();
      this.spawnRandomPattern(); // Immediate pleasant drop of life!
    }
    return this.rainEnabled;
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
    this.ensureViewportCoverage();
  }

  setPalette(p) {
    this.palette = p;
    this.initSpriteCache();
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
    if (this.prev2Grid) this.prev2Grid.fill(0);
    this.generation = 0;
    this.aliveCount = 0;
    this.stillCount = 0;
    this.oscillatingCount = 0;
    this.previewCells = [];
    this.lineStartCell = null;
    this.ripples = [];
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

  // ═══ SCREEN <-> CELL TRANSFORMATION ═══
  screenToCell(screenX, screenY) {
    if (!this.cols || !this.rows) return null;
    const effCell = this.cellSize * this.zoom;
    const worldX = (screenX - this.panX);
    const worldY = (screenY - this.panY);
    let c = Math.floor(worldX / effCell);
    let r = Math.floor(worldY / effCell);

    if (this.wrap) {
      c = ((c % this.cols) + this.cols) % this.cols;
      r = ((r % this.rows) + this.rows) % this.rows;
      return { c, r };
    }

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

  // Bresenham line algorithm for perfectly straight grid lines
  _getLineCells(x0, y0, x1, y1) {
    const cells = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;
    let cx = x0;
    let cy = y0;

    while (true) {
      cells.push({ c: cx, r: cy });
      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx) { err += dx; cy += sy; }
    }
    return cells;
  }

  // Symmetrical perpendicular cross / radial star generator (customizable degree interval)
  _getCrossCells(x0, y0, x1, y1, stepDegrees = this.radialAngleStep || 90) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);

    // If tap or minimal drag, use default radius of 6 cells for an immediate neat shape
    const R = dist < 1.5 ? 6 : Math.round(dist);

    // Base angle from drag vector, or 0 if tap
    let baseAngle = dist < 1.5 ? 0 : Math.atan2(dy, dx);

    // Snap base angle to nearest 15 degrees for rock-solid alignment on touchscreens
    const snapRad = (15 * Math.PI) / 180;
    baseAngle = Math.round(baseAngle / snapRad) * snapRad;

    const stepRad = (stepDegrees * Math.PI) / 180;
    // Number of distinct lines through center covering 180 degrees
    const lineCount = Math.max(1, Math.round(180 / stepDegrees));

    const set = new Set();
    const result = [];
    const add = (pt) => {
      const k = `${pt.c},${pt.r}`;
      if (!set.has(k)) {
        set.add(k);
        result.push(pt);
      }
    };

    for (let i = 0; i < lineCount; i++) {
      const angle = baseAngle + i * stepRad;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const ax = Math.round(x0 + R * cosA);
      const ay = Math.round(y0 + R * sinA);
      const bx = Math.round(x0 - R * cosA);
      const by = Math.round(y0 - R * sinA);
      const line = this._getLineCells(bx, by, ax, ay);
      for (let j = 0; j < line.length; j++) {
        add(line[j]);
      }
    }

    return result;
  }

  // ═══ POINTER & TOUCH INTERACTIONS ═══
  handlePointerDown(pointerId, screenX, screenY) {
    this.activePointers.set(pointerId, { x: screenX, y: screenY });

    if (this.activePointers.size === 1) {
      this.lastPanPointer = { x: screenX, y: screenY };

      if (this.tool === 'pan') {
        this.isSinglePointerDrag = true;
      } else if (this.tool === 'line') {
        const cell = this.screenToCell(screenX, screenY);
        if (cell) {
          this.lineStartCell = cell;
          this.previewCells = [cell];
        }
      } else if (this.tool === 'cross') {
        const cell = this.screenToCell(screenX, screenY);
        if (cell) {
          this.lineStartCell = cell;
          this.previewCells = this._getCrossCells(cell.c, cell.r, cell.c, cell.r, this.radialAngleStep);
        }
      } else {
        // Draw mode
        const cell = this.screenToCell(screenX, screenY);
        if (cell) {
          const idx = cell.r * this.cols + cell.c;
          this.drawMode = this.grid[idx] ? 0 : 1;
          this._setCell(cell.c, cell.r, this.drawMode);
          this.lastDrawnCell = cell;
        }
      }
    } else if (this.activePointers.size === 2) {
      // 2 fingers = pinch-to-zoom & 2-finger pan
      const pts = Array.from(this.activePointers.values());
      this.lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.lastPinchMid = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2
      };
      this.isSinglePointerDrag = false;
      this.lastDrawnCell = null;
      this.previewCells = [];
      this.lineStartCell = null;
    }
  }

  handlePointerMove(pointerId, screenX, screenY) {
    if (!this.activePointers.has(pointerId)) return;
    this.activePointers.set(pointerId, { x: screenX, y: screenY });

    if (this.activePointers.size === 2) {
      const pts = Array.from(this.activePointers.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const currentMid = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2
      };

      if (this.lastPinchDist > 0 && currentDist > 0) {
        const factor = currentDist / this.lastPinchDist;
        this.zoomAt(factor, currentMid.x, currentMid.y);
      }

      if (this.lastPinchMid) {
        this.panX += (currentMid.x - this.lastPinchMid.x);
        this.panY += (currentMid.y - this.lastPinchMid.y);
      }

      this.lastPinchDist = currentDist;
      this.lastPinchMid = currentMid;
      return;
    }

    if (this.activePointers.size === 1) {
      if (this.tool === 'pan' || this.isSinglePointerDrag) {
        if (this.lastPanPointer) {
          this.panX += screenX - this.lastPanPointer.x;
          this.panY += screenY - this.lastPanPointer.y;
          this.lastPanPointer = { x: screenX, y: screenY };
        }
      } else if (this.tool === 'line') {
        if (this.lineStartCell) {
          const currentCell = this.screenToCell(screenX, screenY);
          if (currentCell) {
            this.previewCells = this._getLineCells(this.lineStartCell.c, this.lineStartCell.r, currentCell.c, currentCell.r);
          }
        }
      } else if (this.tool === 'cross') {
        if (this.lineStartCell) {
          const currentCell = this.screenToCell(screenX, screenY);
          if (currentCell) {
            this.previewCells = this._getCrossCells(
              this.lineStartCell.c,
              this.lineStartCell.r,
              currentCell.c,
              currentCell.r,
              this.radialAngleStep
            );
          }
        }
      } else if (this.tool === 'draw') {
        const cell = this.screenToCell(screenX, screenY);
        if (!cell) return;
        if (this.lastDrawnCell && this.lastDrawnCell.c === cell.c && this.lastDrawnCell.r === cell.r) {
          return;
        }
        this._setCell(cell.c, cell.r, this.drawMode);
        this.lastDrawnCell = cell;
      }
    }
  }

  handlePointerUp(pointerId) {
    this.activePointers.delete(pointerId);

    if (this.activePointers.size === 0) {
      // Bake preview line or cross if geometric tool was active
      if ((this.tool === 'line' || this.tool === 'cross') && this.previewCells.length > 0) {
        for (const pt of this.previewCells) {
          let c = pt.c;
          let r = pt.r;
          if (this.wrap) {
            c = ((c % this.cols) + this.cols) % this.cols;
            r = ((r % this.rows) + this.rows) % this.rows;
          }
          this._setCell(c, r, 1);
        }
        zenAudio.playLifeChime(Math.min(30, this.previewCells.length), this.cols * this.rows);
        const midPt = this.previewCells[Math.floor(this.previewCells.length / 2)];
        if (midPt) {
          const effCell = this.cellSize * this.zoom;
          this.ripples.push({
            x: midPt.c * effCell + this.panX,
            y: midPt.r * effCell + this.panY,
            radius: 4,
            maxRadius: 28,
            alpha: 1.0
          });
        }
        this.previewCells = [];
        this.lineStartCell = null;
      }

      this.lastDrawnCell = null;
      this.isSinglePointerDrag = false;
      this.lastPanPointer = null;
      this.lastPinchDist = 0;
      this.lastPinchMid = null;
    } else if (this.activePointers.size === 1) {
      const remaining = Array.from(this.activePointers.values())[0];
      this.lastPanPointer = { x: remaining.x, y: remaining.y };
      this.lastPinchDist = 0;
      this.lastPinchMid = null;
    }
  }

  handleWheel(screenX, screenY, deltaY) {
    const factor = deltaY < 0 ? 1.15 : 0.87;
    this.zoomAt(factor, screenX, screenY);
  }

  // ═══ PATTERN STAMPING & ZEN AUTO-SPAWN ═══
  stampPattern(key, startC, startR) {
    const p = PATTERNS[key];
    if (!p) return;
    const pattern = p.grid;

    for (let dr = 0; dr < pattern.length; dr++) {
      const row = pattern[dr];
      for (let dc = 0; dc < row.length; dc++) {
        if (row[dc] === 'O' || row[dc] === '1') {
          let c = startC + dc;
          let r = startR + dr;
          if (this.wrap) {
            c = ((c % this.cols) + this.cols) % this.cols;
            r = ((r % this.rows) + this.rows) % this.rows;
          }
          this._setCell(c, r, 1);
        }
      }
    }

    // Add visual glowing ripple
    const effCell = this.cellSize * this.zoom;
    const screenX = (startC + pattern[0].length / 2) * effCell + this.panX;
    const screenY = (startR + pattern.length / 2) * effCell + this.panY;
    this.ripples.push({
      x: screenX,
      y: screenY,
      radius: 4,
      maxRadius: Math.max(25, pattern[0].length * effCell),
      alpha: 1.0
    });
  }

  // Load preset in center (or clear first if desired)
  loadPreset(name) {
    if (name === 'random') {
      this.randomize(0.2);
      return;
    }
    this.clear();
    const p = PATTERNS[name];
    if (!p) return;

    const midC = Math.floor(this.cols / 2 - p.grid[0].length / 2);
    const midR = Math.floor(this.rows / 2 - p.grid.length / 2);
    this.stampPattern(name, midC, midR);

    zenAudio.playLifeChime(this.aliveCount, this.cols * this.rows);
  }

  // Spawns a random pattern gently anywhere on the board (Zen Pattern Rain)
  spawnRandomPattern() {
    const keys = ['glider', 'lwss', 'pulsar', 'toad', 'beacon', 'acorn'];
    const choice = keys[Math.floor(Math.random() * keys.length)];
    const p = PATTERNS[choice];
    if (!p) return;

    const effCell = this.cellSize * this.zoom;
    const patW = p.grid[0].length;
    const patH = p.grid.length;

    // Target inside currently visible viewport so user always sees the pattern flourish!
    const minVisC = Math.max(1, Math.floor(-this.panX / effCell) + 2);
    const maxVisC = Math.min(this.cols - patW - 1, Math.ceil((this.canvas.width - this.panX) / effCell) - patW - 2);
    const minVisR = Math.max(1, Math.floor(-this.panY / effCell) + 2);
    const maxVisR = Math.min(this.rows - patH - 1, Math.ceil((this.canvas.height - this.panY) / effCell) - patH - 2);

    let c, r;
    if (maxVisC > minVisC && maxVisR > minVisR) {
      c = Math.floor(minVisC + Math.random() * (maxVisC - minVisC));
      r = Math.floor(minVisR + Math.random() * (maxVisR - minVisR));
    } else {
      const margin = 2;
      const maxC = Math.max(margin, this.cols - patW - margin);
      const maxR = Math.max(margin, this.rows - patH - margin);
      c = Math.floor(margin + Math.random() * (maxC - margin));
      r = Math.floor(margin + Math.random() * (maxR - margin));
    }

    this.stampPattern(choice, c, r);

    if (this.soundEnabled) {
      zenAudio.playLifeChime(15, this.cols * this.rows);
    }
  }

  // ═══ SIMULATION STEP (B3/S23) ═══
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
    let stillNow = 0;
    let oscillatingNow = 0;

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
          if (neighbors === 2 || neighbors === 3) {
            next[idx] = 1;
            const newAge = Math.min(100, age[idx] + 1);
            age[idx] = newAge;
            aliveNow++;
            if (newAge >= 4) {
              stillNow++;
            } else if (this.prev2Grid && this.prev2Grid[idx] === 1) {
              oscillatingNow++;
            }
          } else {
            next[idx] = 0;
            age[idx] = 0;
            trail[idx] = 1.0; // Phosphor decay
          }
        } else {
          if (neighbors === 3) {
            next[idx] = 1;
            age[idx] = 1;
            trail[idx] = 1.0;
            aliveNow++;
            births++;
            if (this.prev2Grid && this.prev2Grid[idx] === 1) {
              oscillatingNow++;
            }
          } else {
            next[idx] = 0;
          }
        }
      }
    }

    // Save previous state for 2-cycle oscillator detection
    if (this.prev2Grid && this.prev2Grid.length === grid.length) {
      this.prev2Grid.set(grid);
    }

    // Swap buffers
    this.grid.set(next);
    this.aliveCount = aliveNow;
    this.stillCount = stillNow;
    this.oscillatingCount = oscillatingNow;
    this.generation++;

    // Ambient chime if enabled
    if (this.soundEnabled && births > 0 && this.generation % 5 === 0) {
      zenAudio.playLifeChime(aliveNow, cols * rows);
    }
  }

  update() {
    if (!this.isActive) return;
    this.initGrid();

    // Decay phosphor trails
    if (this.showTrail && this.trailGrid) {
      const decay = 0.045;
      for (let i = 0; i < this.trailGrid.length; i++) {
        if (this.trailGrid[i] > 0) {
          this.trailGrid[i] = Math.max(0, this.trailGrid[i] - decay);
        }
      }
    }

    // Update visual ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rip = this.ripples[i];
      rip.radius += 1.8;
      rip.alpha -= 0.035;
      if (rip.alpha <= 0 || rip.radius >= rip.maxRadius) {
        this.ripples.splice(i, 1);
      }
    }

    const now = performance.now();

    // Zen Pattern Rain
    if (this.rainEnabled && !this.isPaused) {
      if (now - this.lastRainTime >= this.rainIntervalMs) {
        this.spawnRandomPattern();
        this.lastRainTime = now;
      }
    }

    // Step generation on interval
    if (!this.isPaused) {
      const interval = 1000 / this.speed;
      if (now - this.lastStepTime >= interval) {
        this.step();
        this.lastStepTime = now;
      }
    }
  }

  // ═══ ULTRA-OPTIMIZED HARDWARE-ACCELERATED RENDER LOOP ═══
  draw() {
    if (!this.isActive || !this.grid) return;
    const ctx = this.ctx;
    const cols = this.cols;
    const rows = this.rows;
    const grid = this.grid;
    const trail = this.trailGrid;
    const age = this.ageGrid;

    const effCell = this.cellSize * this.zoom;
    const panX = this.panX;
    const panY = this.panY;
    const viewW = this.canvas.width;
    const viewH = this.canvas.height;

    // Viewport Culling: Compute visible column & row range
    const minCol = Math.max(0, Math.floor((-panX) / effCell));
    const maxCol = Math.min(cols, Math.ceil((viewW - panX) / effCell));
    const minRow = Math.max(0, Math.floor((-panY) / effCell));
    const maxRow = Math.min(rows, Math.ceil((viewH - panY) / effCell));

    // Subtle aesthetic grid lines
    if (effCell >= 5) {
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.065)';
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (let c = minCol; c <= maxCol; c++) {
        const x = Math.round(c * effCell + panX) + 0.5;
        ctx.moveTo(x, Math.max(0, minRow * effCell + panY));
        ctx.lineTo(x, Math.min(viewH, maxRow * effCell + panY));
      }
      for (let r = minRow; r <= maxRow; r++) {
        const y = Math.round(r * effCell + panY) + 0.5;
        ctx.moveTo(Math.max(0, minCol * effCell + panX), y);
        ctx.lineTo(Math.min(viewW, maxCol * effCell + panX), y);
      }
      ctx.stroke();
    }

    // 1. Draw Phosphor Trails (using cached soft trail texture)
    if (this.showTrail && this.trailSprite) {
      const trailDrawSize = effCell * 1.15;
      const trailOffset = (trailDrawSize - effCell) / 2;

      for (let r = minRow; r < maxRow; r++) {
        const rowOffset = r * cols;
        for (let c = minCol; c < maxCol; c++) {
          const idx = rowOffset + c;
          const trVal = trail[idx];
          if (trVal > 0.04 && grid[idx] === 0) {
            ctx.globalAlpha = trVal * 0.35;
            const x = c * effCell + panX - trailOffset;
            const y = r * effCell + panY - trailOffset;
            ctx.drawImage(this.trailSprite, x, y, trailDrawSize, trailDrawSize);
          }
        }
      }
      ctx.globalAlpha = 1.0;
    }

    // 2. Draw Living Cells (Blitting pre-rendered glowing sprites - ZERO shadowBlur cost!)
    const spriteCount = this.cellSpriteCache.length;
    const drawSize = effCell * 1.45;
    const drawOffset = (drawSize - effCell) / 2;

    for (let r = minRow; r < maxRow; r++) {
      const rowOffset = r * cols;
      for (let c = minCol; c < maxCol; c++) {
        const idx = rowOffset + c;
        if (grid[idx] === 1) {
          const cellAge = age[idx] || 1;
          const spriteIdx = Math.min(spriteCount - 1, Math.floor((cellAge / 25) * (spriteCount - 1)));
          const sprite = this.cellSpriteCache[spriteIdx];

          const x = c * effCell + panX - drawOffset;
          const y = r * effCell + panY - drawOffset;

          ctx.drawImage(sprite, x, y, drawSize, drawSize);
        }
      }
    }

    // 3. Draw Pattern Spawn Ripples
    if (this.ripples.length > 0) {
      ctx.save();
      for (const rip of this.ripples) {
        ctx.strokeStyle = PALETTES[this.palette](0.8);
        ctx.lineWidth = 2;
        ctx.globalAlpha = rip.alpha;
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Draw Line & Cross Interactive Preview
    if (this.previewCells && this.previewCells.length > 0) {
      ctx.save();
      const colorFn = PALETTES[this.palette] || PALETTES.neon;
      const previewColor = colorFn(0.65);
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

      ctx.fillStyle = previewColor;
      ctx.shadowColor = previewColor;
      ctx.shadowBlur = 8;
      ctx.globalAlpha = 0.82;

      for (const pt of this.previewCells) {
        let pc = pt.c;
        let pr = pt.r;
        if (this.wrap) {
          pc = ((pc % cols) + cols) % cols;
          pr = ((pr % rows) + rows) % rows;
        }
        const cx = pc * effCell + panX + effCell / 2;
        const cy = pr * effCell + panY + effCell / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(2, effCell * 0.42), 0, Math.PI * 2);
        ctx.fill();
      }

      // Connecting guide lines for clarity
      if (this.lineStartCell && this.previewCells.length > 1) {
        const startX = this.lineStartCell.c * effCell + panX + effCell / 2;
        const startY = this.lineStartCell.r * effCell + panY + effCell / 2;

        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);

        if (this.tool === 'line') {
          const endPt = this.previewCells[this.previewCells.length - 1];
          const endX = endPt.c * effCell + panX + effCell / 2;
          const endY = endPt.r * effCell + panY + effCell / 2;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        } else if (this.tool === 'cross') {
          const endPt = this.previewCells[this.previewCells.length - 1];
          const dx = (endPt.c - this.lineStartCell.c) * effCell;
          const dy = (endPt.r - this.lineStartCell.r) * effCell;
          const R = Math.max(6 * effCell, Math.hypot(dx, dy));
          const stepDeg = this.radialAngleStep || 90;
          const stepRad = (stepDeg * Math.PI) / 180;
          const lineCount = Math.max(1, Math.round(180 / stepDeg));

          ctx.beginPath();
          for (let i = 0; i < lineCount; i++) {
            const angle = i * stepRad;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            ctx.moveTo(startX - R * cosA, startY - R * sinA);
            ctx.lineTo(startX + R * cosA, startY + R * sinA);
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 5. Containment Frame for Bounded Universe (when wrap = false)
    if (!this.wrap) {
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      ctx.save();
      const frameX = panX;
      const frameY = panY;
      const frameW = cols * effCell;
      const frameH = rows * effCell;

      ctx.strokeStyle = isDark ? 'rgba(255, 138, 92, 0.45)' : 'rgba(217, 98, 47, 0.5)';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = isDark ? 'rgba(255, 138, 92, 0.35)' : 'rgba(217, 98, 47, 0.25)';
      ctx.shadowBlur = 12;
      ctx.strokeRect(frameX, frameY, frameW, frameH);
      ctx.restore();
    }
  }
}
