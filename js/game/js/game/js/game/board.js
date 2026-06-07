/**
 * PiArena - Board Renderer
 * Canvas-based professional Ludo board renderer
 * @version 1.0.0
 */

'use strict';

import {
  MAIN_PATH, HOME_BASE_POSITIONS, HOME_COLUMN,
  SAFE_CELLS, COLORS
} from './engine.js';

// ============================================================
// CONSTANTS
// ============================================================

const CELL_COLORS = {
  homeRed:    { fill: 'rgba(231,76,60,.8)',   stroke: 'rgba(231,76,60,.4)' },
  homeBlue:   { fill: 'rgba(41,128,185,.8)',  stroke: 'rgba(41,128,185,.4)' },
  homeGreen:  { fill: 'rgba(39,174,96,.8)',   stroke: 'rgba(39,174,96,.4)' },
  homeYellow: { fill: 'rgba(243,156,18,.8)',  stroke: 'rgba(243,156,18,.4)' },
  colRed:     { fill: 'rgba(231,76,60,.45)',  stroke: 'rgba(231,76,60,.3)' },
  colBlue:    { fill: 'rgba(41,128,185,.45)', stroke: 'rgba(41,128,185,.3)' },
  colGreen:   { fill: 'rgba(39,174,96,.45)',  stroke: 'rgba(39,174,96,.3)' },
  colYellow:  { fill: 'rgba(243,156,18,.45)', stroke: 'rgba(243,156,18,.3)' },
  safe:       { fill: 'rgba(168,230,207,.2)', stroke: 'rgba(168,230,207,.15)' },
  path:       { fill: 'rgba(255,255,255,.07)', stroke: 'rgba(255,255,255,.06)' },
  center:     { fill: 'transparent',          stroke: 'transparent' },
  empty:      { fill: 'rgba(255,255,255,.02)', stroke: 'rgba(255,255,255,.01)' }
};

const PION_COLORS = {
  red:    { main: '#e74c3c', light: '#ff6b6b' },
  blue:   { main: '#2980b9', light: '#74b9ff' },
  green:  { main: '#27ae60', light: '#55efc4' },
  yellow: { main: '#f39c12', light: '#ffeaa7' }
};

// ============================================================
// BOARD RENDERER
// ============================================================

export class BoardRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cellSize = 0;
    this.boardState = null;
    this.movablePions = [];
    this.animationFrame = null;
    this._animTime = 0;

    this._clickHandlers = [];
    this.canvas.addEventListener('click', this._handleClick.bind(this));
  }

  // ─── SETUP ───────────────────────────────────────────────

  resize(containerWidth, containerHeight) {
    const size = Math.min(containerWidth - 12, containerHeight - 12, 420);
    this.canvas.width = size;
    this.canvas.height = size;
    this.cellSize = size / 15;
  }

  onCellClick(handler) {
    this._clickHandlers.push(handler);
  }

  _handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const col = Math.floor(mx / this.cellSize);
    const row = Math.floor(my / this.cellSize);
    this._clickHandlers.forEach(fn => fn({ row, col, x: mx, y: my }));
  }

  // ─── RENDERING ───────────────────────────────────────────

  render(boardState, movablePions = []) {
    this.boardState = boardState;
    this.movablePions = movablePions;

    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this._renderLoop();
  }

  _renderLoop() {
    this._animTime = Date.now();
    this._draw();
    this.animationFrame = requestAnimationFrame(() => this._renderLoop());
  }

  stopRendering() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  _draw() {
    const ctx = this.ctx;
    const cs = this.cellSize;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw cells
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        this._drawCell(r, c);
      }
    }

    // Draw center π
    this._drawCenter();

    // Draw home base circles
    this._drawHomeBases();

    // Draw pieces
    if (this.boardState) {
      this._drawPieces();
    }
  }

  // ─── CELL DRAWING ────────────────────────────────────────

  _getCellType(r, c) {
    if (r <= 5 && c <= 5)   return 'homeRed';
    if (r <= 5 && c >= 9)   return 'homeBlue';
    if (r >= 9 && c >= 9)   return 'homeGreen';
    if (r >= 9 && c <= 5)   return 'homeYellow';
    if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return 'center';
    if (r === 7 && c >= 1 && c <= 5)   return 'colRed';
    if (c === 7 && r >= 1 && r <= 5)   return 'colBlue';
    if (r === 7 && c >= 9 && c <= 13)  return 'colGreen';
    if (c === 7 && r >= 9 && r <= 13)  return 'colYellow';

    const pathIdx = MAIN_PATH.findIndex(([pr, pc]) => pr === r && pc === c);
    if (pathIdx !== -1) {
      return SAFE_CELLS.has(pathIdx) ? 'safe' : 'path';
    }

    return 'empty';
  }

  _drawCell(r, c) {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const x = c * cs, y = r * cs;
    const type = this._getCellType(r, c);

    if (type === 'center') return;

    const { fill, stroke } = CELL_COLORS[type] || CELL_COLORS.empty;

    ctx.fillStyle = fill;
    ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x + 1, y + 1, cs - 2, cs - 2);

    // Safe cell star
    if (type === 'safe') {
      ctx.fillStyle = 'rgba(240,165,0,.7)';
      ctx.font = `${cs * 0.5}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', x + cs / 2, y + cs / 2);
    }

    // Direction arrows on path
    this._drawArrow(r, c, x, y, cs, type);
  }

  _drawArrow(r, c, x, y, cs, type) {
    const ctx = this.ctx;
    if (type !== 'path') return;

    let arrow = '';
    if (r === 6 && c >= 1 && c <= 5)   arrow = '→';
    else if (c === 6 && r >= 1 && r <= 5)   arrow = '↑';
    else if (r === 6 && c >= 9 && c <= 14)  arrow = '→';
    else if (c === 8 && r >= 1 && r <= 5)   arrow = '↓';
    else if (r === 8 && c >= 9 && c <= 14)  arrow = '←';
    else if (c === 8 && r >= 9 && r <= 14)  arrow = '↓';
    else if (r === 8 && c >= 1 && c <= 5)   arrow = '←';
    else if (c === 6 && r >= 9 && r <= 14)  arrow = '↑';
    else if (r === 0 && c >= 6 && c <= 8)   arrow = '→';
    else if (r === 14 && c >= 6 && c <= 8)  arrow = '←';

    if (arrow) {
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.font = `${cs * 0.35}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(arrow, x + cs / 2, y + cs / 2);
    }
  }

  _drawHomeBases() {
    const ctx = this.ctx;
    const cs = this.cellSize;

    COLORS.forEach(color => {
      HOME_BASE_POSITIONS[color].forEach(([r, c]) => {
        const cx = c * cs + cs / 2;
        const cy = r * cs + cs / 2;
        const radius = cs * 0.38;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,.12)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    });
  }

  _drawCenter() {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const cx = 7.5 * cs;
    const cy = 7.5 * cs;

    // 4 colored triangles
    const triangles = [
      { color: 'rgba(231,76,60,.85)',  pts: [[6,6],[9,6],[7.5,7.5]] },
      { color: 'rgba(41,128,185,.85)', pts: [[9,6],[9,9],[7.5,7.5]] },
      { color: 'rgba(243,156,18,.85)', pts: [[6,9],[6,6],[7.5,7.5]] },
      { color: 'rgba(39,174,96,.85)',  pts: [[9,9],[6,9],[7.5,7.5]] }
    ];

    triangles.forEach(({ color, pts }) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(pts[0][1] * cs, pts[0][0] * cs);
      ctx.lineTo(pts[1][1] * cs, pts[1][0] * cs);
      ctx.lineTo(pts[2][1] * cs, pts[2][0] * cs);
      ctx.closePath();
      ctx.fill();
    });

    // π logo with glow
    ctx.save();
    ctx.shadowColor = 'rgba(240,165,0,.9)';
    ctx.shadowBlur = 15 + 5 * Math.sin(this._animTime / 800);

    const grad = ctx.createLinearGradient(cx - 25, cy - 25, cx + 25, cy + 25);
    grad.addColorStop(0, '#6c3fd1');
    grad.addColorStop(1, '#f0a500');

    ctx.font = `bold ${cs * 1.5}px 'Orbitron', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = grad;
    ctx.fillText('π', cx, cy + 2);
    ctx.restore();
  }

  // ─── PIECES DRAWING ──────────────────────────────────────

  _drawPieces() {
    if (!this.boardState?.players) return;

    // Group pions by cell to handle stacking
    const cellGroups = new Map();

    this.boardState.players.forEach((player, playerIdx) => {
      player.pions.forEach((pion, pionIdx) => {
        const gp = pion.gridPos;
        if (!gp) return;

        const key = `${gp[0]},${gp[1]}`;
        if (!cellGroups.has(key)) cellGroups.set(key, []);
        cellGroups.get(key).push({ player, playerIdx, pion, pionIdx });
      });
    });

    // Draw each group
    cellGroups.forEach((group, key) => {
      group.forEach((item, stackIdx) => {
        const { player, playerIdx, pion, pionIdx } = item;
        const [r, c] = pion.gridPos;
        const cs = this.cellSize;

        // Stacking offset
        const offset = stackIdx * cs * 0.12;
        const cx = c * cs + cs / 2 + offset;
        const cy = r * cs + cs / 2 + offset;

        const isMovable = this.movablePions.includes(pionIdx) &&
          player.id === this.boardState.currentPlayer;

        this._drawPion(cx, cy, cs * 0.38, player.color, pionIdx + 1, isMovable, pion.shielded);
      });
    });
  }

  _drawPion(cx, cy, radius, color, label, isMovable, hasShield) {
    const ctx = this.ctx;
    const { main, light } = PION_COLORS[color] || PION_COLORS.red;
    const t = this._animTime;

    // Movable glow animation
    if (isMovable) {
      const alpha = 0.35 + 0.25 * Math.sin(t / 350);
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.7, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();
    }

    // Shield effect
    if (hasShield) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100,200,255,.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Drop shadow
    ctx.beginPath();
    ctx.ellipse(cx, cy + radius * 0.3, radius * 0.8, radius * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.fill();

    // Pion body
    ctx.save();
    ctx.translate(cx, cy);

    const grad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.4, 0, 0, 0, radius);
    grad.addColorStop(0, light);
    grad.addColorStop(0.5, main);
    grad.addColorStop(1, main);

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // White border
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = radius * 0.12;
    ctx.stroke();

    // Highlight
    ctx.beginPath();
    ctx.arc(-radius * 0.25, -radius * 0.35, radius * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fill();

    // Label number
    ctx.fillStyle = 'rgba(0,0,0,.85)';
    ctx.font = `bold ${radius * 0.85}px 'Exo 2', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);

    ctx.restore();
  }

  // ─── DICE RENDERER ───────────────────────────────────────

  static renderDice(canvas, value, animated = false) {
    const ctx = canvas.getContext('2d');
    const s = canvas.width;
    const r = s * 0.16;

    ctx.clearRect(0, 0, s, s);

    // Background
    const grad = ctx.createLinearGradient(0, 0, s, s);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#dddddd');

    // Rounded rect
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(s - r, 0);
    ctx.quadraticCurveTo(s, 0, s, r);
    ctx.lineTo(s, s - r);
    ctx.quadraticCurveTo(s, s, s - r, s);
    ctx.lineTo(r, s);
    ctx.quadraticCurveTo(0, s, 0, s - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();

    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Dots
    ctx.fillStyle = '#1a1a2e';
    const dotR = s * 0.075;
    const dotPositions = {
      1: [[s/2, s/2]],
      2: [[s*0.28, s*0.28], [s*0.72, s*0.72]],
      3: [[s*0.28, s*0.28], [s/2, s/2], [s*0.72, s*0.72]],
      4: [[s*0.28, s*0.28], [s*0.72, s*0.28], [s*0.28, s*0.72], [s*0.72, s*0.72]],
      5: [[s*0.28, s*0.28], [s*0.72, s*0.28], [s/2, s/2], [s*0.28, s*0.72], [s*0.72, s*0.72]],
      6: [[s*0.28, s*0.2], [s*0.72, s*0.2], [s*0.28, s/2], [s*0.72, s/2], [s*0.28, s*0.8], [s*0.72, s*0.8]]
    };

    (dotPositions[value] || []).forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ─── ANIMATIONS ──────────────────────────────────────────

  async animateDice(canvas, callback) {
    let count = 0;
    const total = 14;

    return new Promise(resolve => {
      const frame = () => {
        const v = Math.floor(Math.random() * 6) + 1;
        BoardRenderer.renderDice(canvas, v);
        count++;
        if (count < total) {
          setTimeout(frame, 40 + count * 4);
        } else {
          const finalValue = callback ? callback() : v;
          BoardRenderer.renderDice(canvas, finalValue);
          resolve(finalValue);
        }
      };
      frame();
    });
  }

  // ─── SPLASH / HOME LOGO ──────────────────────────────────

  static animateLogoCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    let angle = 0;
    let rafId = null;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      // Outer glow ring
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.rotate(angle);

      const grad = ctx.createLinearGradient(-size / 2, 0, size / 2, 0);
      grad.addColorStop(0, '#6c3fd1');
      grad.addColorStop(0.5, '#f0a500');
      grad.addColorStop(1, '#6c3fd1');

      ctx.beginPath();
      ctx.arc(0, 0, size * 0.43, 0, Math.PI * 2);
      ctx.strokeStyle = grad;
      ctx.lineWidth = size * 0.05;
      ctx.stroke();
      ctx.restore();

      // Center background
      ctx.fillStyle = '#050510';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size * 0.37, 0, Math.PI * 2);
      ctx.fill();

      // π symbol
      const lg = ctx.createLinearGradient(size * 0.25, size * 0.25, size * 0.75, size * 0.75);
      lg.addColorStop(0, '#6c3fd1');
      lg.addColorStop(1, '#f0a500');

      ctx.font = `bold ${size * 0.4}px 'Orbitron', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = lg;
      ctx.fillText('π', size / 2, size / 2 + 2);

      angle += 0.02;
      rafId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafId);
  }

  destroy() {
    this.stopRendering();
    this._clickHandlers = [];
    this.canvas.removeEventListener('click', this._handleClick);
  }
}
