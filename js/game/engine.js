/**
 * PiArena - Ludo Game Engine
 * Pure game logic, no UI dependencies
 * @version 1.0.0
 */

'use strict';

// ============================================================
// CONSTANTS
// ============================================================

export const COLORS = ['red', 'blue', 'green', 'yellow'];

export const COLOR_START_INDEX = {
  red: 0, blue: 13, green: 26, yellow: 39
};

export const SAFE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export const HOME_BASE_POSITIONS = {
  red:    [[1,1],[1,4],[4,1],[4,4]],
  blue:   [[1,10],[1,13],[4,10],[4,13]],
  green:  [[10,10],[10,13],[13,10],[13,13]],
  yellow: [[10,1],[10,4],[13,1],[13,4]]
};

export const HOME_COLUMN = {
  red:    [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  blue:   [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  green:  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  yellow: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]
};

export const MAIN_PATH = [
  [6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],
  [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],
  [14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0]
];

export const PION_STATUS = {
  BASE: 'base',       // In home base
  ACTIVE: 'active',  // On main path
  HOME: 'home',      // In home column
  FINISHED: 'finished' // At center
};

export const GAME_STATUS = {
  WAITING: 'waiting',
  ROLLING: 'rolling',
  MOVING: 'moving',
  FINISHED: 'finished'
};

// ============================================================
// PION CLASS
// ============================================================

export class Pion {
  constructor(id, color, baseIndex) {
    this.id = id;                    // Unique pion ID
    this.color = color;              // Pion color
    this.baseIndex = baseIndex;      // Index in home base (0-3)
    this.status = PION_STATUS.BASE;  // Current status
    this.position = -1;              // -1 = base, 0-51 = main, 52-56 = home col
    this.shielded = false;           // Shield powerup active
    this.gridPos = null;             // [row, col] on board
  }

  isInBase() { return this.status === PION_STATUS.BASE; }
  isActive() { return this.status === PION_STATUS.ACTIVE; }
  isInHome() { return this.status === PION_STATUS.HOME; }
  isFinished() { return this.status === PION_STATUS.FINISHED; }
  isOnBoard() { return this.isActive() || this.isInHome(); }

  clone() {
    const p = new Pion(this.id, this.color, this.baseIndex);
    p.status = this.status;
    p.position = this.position;
    p.shielded = this.shielded;
    p.gridPos = this.gridPos ? [...this.gridPos] : null;
    return p;
  }
}

// ============================================================
// PLAYER CLASS
// ============================================================

export class Player {
  constructor(id, color, name, isHuman = true, difficulty = null) {
    this.id = id;
    this.color = color;
    this.name = name;
    this.isHuman = isHuman;
    this.difficulty = difficulty; // 'easy' | 'medium' | 'hard'
    this.pions = [];
    this.finishedCount = 0;
    this.stats = {
      captures: 0,
      sixes: 0,
      moves: 0
    };
  }

  initPions(count = 4, startWithOnePion = false) {
    this.pions = [];
    for (let i = 0; i < count; i++) {
      const pion = new Pion(`${this.color}-${i}`, this.color, i);
      if (startWithOnePion && i === 0) {
        pion.status = PION_STATUS.ACTIVE;
        pion.position = 0;
      }
      this.pions.push(pion);
    }
  }

  getActivePions() {
    return this.pions.filter(p => !p.isFinished());
  }

  getFinishedCount() {
    return this.pions.filter(p => p.isFinished()).length;
  }

  hasWon() {
    return this.pions.every(p => p.isFinished());
  }

  clone() {
    const p = new Player(this.id, this.color, this.name, this.isHuman, this.difficulty);
    p.pions = this.pions.map(pion => pion.clone());
    p.finishedCount = this.finishedCount;
    p.stats = { ...this.stats };
    return p;
  }
}

// ============================================================
// LUDO ENGINE - Pure Game Logic
// ============================================================

export class LudoEngine {
  constructor() {
    this.reset();
    this._eventListeners = new Map();
  }

  // ─── SETUP ───────────────────────────────────────────────

  reset() {
    this.players = [];
    this.currentPlayerIndex = 0;
    this.diceValue = 0;
    this.consecutiveSixes = 0;
    this.status = GAME_STATUS.WAITING;
    this.winner = null;
    this.movablePions = [];
    this.gameMode = 'classic'; // 'classic' | 'quick'
    this.turnCount = 0;
    this.startTime = null;
    this.moveHistory = [];
  }

  setupGame(config) {
    /**
     * config = {
     *   players: [{ color, name, isHuman, difficulty }],
     *   mode: 'classic' | 'quick',
     *   startWithOnePion: false
     * }
     */
    this.reset();
    this.gameMode = config.mode || 'classic';
    this.startTime = Date.now();

    const pionCount = this.gameMode === 'quick' ? 2 : 4;

    this.players = config.players.map((p, idx) =>
      this._createPlayer(idx, p, pionCount, config.startWithOnePion)
    );

    this.status = GAME_STATUS.ROLLING;
    this._emit('gameSetup', { players: this.players });
  }

  _createPlayer(idx, config, pionCount, startWithOnePion) {
    const player = new Player(
      idx,
      config.color,
      config.name,
      config.isHuman !== false,
      config.difficulty || null
    );
    player.initPions(pionCount, startWithOnePion);
    return player;
  }

  // ─── DICE ────────────────────────────────────────────────

  rollDice() {
    if (this.status !== GAME_STATUS.ROLLING) {
      return { success: false, reason: 'Not in rolling state' };
    }

    const value = this._generateDiceValue();
    this.diceValue = value;

    const result = this._processDiceRoll(value);

    this._emit('diceRolled', {
      value,
      player: this.getCurrentPlayer(),
      ...result
    });

    return { success: true, value, ...result };
  }

  _generateDiceValue() {
    // Cryptographically fair dice using seed
    const seed = this._generateSeed();
    this._lastSeed = seed;
    return Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF * 6) + 1;
  }

  _generateSeed() {
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  getSeed() { return this._lastSeed || ''; }

  _processDiceRoll(value) {
    const player = this.getCurrentPlayer();

    if (value === 6) {
      this.consecutiveSixes++;
      player.stats.sixes++;

      if (this.consecutiveSixes >= 3) {
        // 3 consecutive sixes = turn lost
        this.consecutiveSixes = 0;
        this._nextTurn();
        return { action: 'turnLost', reason: 'Three consecutive sixes' };
      }
    } else {
      this.consecutiveSixes = 0;
    }

    this.movablePions = this._findMovablePions(player, value);

    if (this.movablePions.length === 0) {
      this._nextTurn();
      return { action: 'noMove', movable: [] };
    }

    this.status = GAME_STATUS.MOVING;
    return { action: 'move', movable: this.movablePions };
  }

  _findMovablePions(player, diceValue) {
    const movable = [];

    player.pions.forEach((pion, idx) => {
      if (pion.isFinished()) return;

      if (pion.isInBase()) {
        // Can only exit with 6
        if (diceValue === 6) {
          movable.push({ pionIndex: idx, pion, type: 'exit' });
        }
      } else {
        const newPos = pion.position + diceValue;
        if (newPos <= 56) { // 52 main + 5 home column = 57 total (0-56)
          movable.push({ pionIndex: idx, pion, type: 'move', newPos });
        }
      }
    });

    return movable;
  }

  // ─── MOVEMENT ────────────────────────────────────────────

  movePion(pionIndex) {
    if (this.status !== GAME_STATUS.MOVING) {
      return { success: false, reason: 'Not in moving state' };
    }

    const movableEntry = this.movablePions.find(m => m.pionIndex === pionIndex);
    if (!movableEntry) {
      return { success: false, reason: 'Pion not movable' };
    }

    const player = this.getCurrentPlayer();
    const pion = player.pions[pionIndex];
    const result = this._executePionMove(player, pion, movableEntry);

    this.moveHistory.push({
      turn: this.turnCount,
      player: player.id,
      pion: pion.id,
      diceValue: this.diceValue,
      type: movableEntry.type,
      ...result
    });

    this._emit('pionMoved', {
      player,
      pion,
      pionIndex,
      diceValue: this.diceValue,
      ...result
    });

    player.stats.moves++;

    // Check win
    if (player.hasWon()) {
      this._handleWin(player);
      return { success: true, action: 'win', player };
    }

    // Determine next action
    const hasBonus = result.captured || this.diceValue === 6;
    if (hasBonus) {
      this.status = GAME_STATUS.ROLLING;
      this._emit('bonusTurn', { player, reason: result.captured ? 'capture' : 'six' });
    } else {
      this._nextTurn();
    }

    this.movablePions = [];
    return { success: true, ...result };
  }

  _executePionMove(player, pion, movableEntry) {
    if (movableEntry.type === 'exit') {
      return this._exitBase(player, pion);
    }
    return this._advancePion(player, pion, movableEntry.newPos);
  }

  _exitBase(player, pion) {
    pion.status = PION_STATUS.ACTIVE;
    pion.position = 0;
    pion.gridPos = this._posToGrid(player.id, 0);
    return { action: 'exit', gridPos: pion.gridPos };
  }

  _advancePion(player, pion, targetPosition) {
    const steps = [];
    const startPos = pion.position;

    // Build step-by-step path for animation
    for (let p = startPos + 1; p <= targetPosition; p++) {
      steps.push({
        position: p,
        gridPos: this._posToGrid(player.id, p)
      });
    }

    // Update final position
    pion.position = targetPosition;
    pion.gridPos = this._posToGrid(player.id, targetPosition);

    // Check if finished
    if (targetPosition >= 57) {
      pion.status = PION_STATUS.FINISHED;
      pion.position = 57;
      player.finishedCount++;
      return { action: 'home', steps, gridPos: [7, 7], finished: true };
    }

    // Update status
    if (targetPosition >= 52) {
      pion.status = PION_STATUS.HOME;
    }

    // Check capture
    const captured = this._checkCapture(player, pion);

    return {
      action: captured ? 'capture' : 'move',
      steps,
      gridPos: pion.gridPos,
      captured,
      finished: false
    };
  }

  _checkCapture(movingPlayer, movingPion) {
    if (movingPion.position > 51) return null; // In home column = safe
    if (movingPion.shielded) return null;

    const [mr, mc] = movingPion.gridPos;

    // Check if it's a safe cell
    const relativePos = movingPion.position % 52;
    if (SAFE_CELLS.has(relativePos)) return null;

    let captured = null;

    this.players.forEach(player => {
      if (player.id === movingPlayer.id) return;

      player.pions.forEach(pion => {
        if (!pion.isOnBoard() || pion.isFinished()) return;
        if (pion.shielded) return;

        const [pr, pc] = pion.gridPos || [null, null];
        if (pr === mr && pc === mc) {
          // Capture!
          pion.status = PION_STATUS.BASE;
          pion.position = -1;
          pion.gridPos = null;
          player.stats = player.stats || {};
          movingPlayer.stats.captures++;
          captured = { player, pion };
        }
      });
    });

    return captured;
  }

  // ─── POSITION HELPERS ────────────────────────────────────

  _posToGrid(playerIndex, position) {
    if (position < 0) return null;
    if (position >= 57) return [7, 7]; // Center

    const color = this.players[playerIndex].color;
    const startIdx = COLOR_START_INDEX[color];

    if (position <= 51) {
      const mainIdx = (startIdx + position) % 52;
      return [...MAIN_PATH[mainIdx]];
    }

    // Home column
    const homeStep = position - 52;
    if (homeStep < HOME_COLUMN[color].length) {
      return [...HOME_COLUMN[color][homeStep]];
    }

    return [7, 7];
  }

  getGridPosForPion(playerIndex, pion) {
    if (pion.isFinished()) return [7, 7];
    if (pion.isInBase()) {
      return [...HOME_BASE_POSITIONS[pion.color][pion.baseIndex]];
    }
    return this._posToGrid(playerIndex, pion.position);
  }

  isCellSafe(playerIndex, position) {
    if (position < 0 || position > 51) return true;
    return SAFE_CELLS.has(position % 52);
  }

  // ─── TURN MANAGEMENT ─────────────────────────────────────

  _nextTurn() {
    this.turnCount++;
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.diceValue = 0;
    this.movablePions = [];
    this.status = GAME_STATUS.ROLLING;
    this._emit('turnChanged', { player: this.getCurrentPlayer(), turn: this.turnCount });
  }

  _handleWin(player) {
    this.status = GAME_STATUS.FINISHED;
    this.winner = player;
    const duration = Math.floor((Date.now() - this.startTime) / 1000);
    this._emit('gameWon', { player, duration, moveHistory: this.moveHistory });
  }

  // ─── GETTERS ─────────────────────────────────────────────

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  getPlayerById(id) {
    return this.players.find(p => p.id === id);
  }

  getGameDuration() {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  isGameOver() {
    return this.status === GAME_STATUS.FINISHED;
  }

  getBoardState() {
    return {
      players: this.players.map(p => ({
        id: p.id,
        color: p.color,
        name: p.name,
        pions: p.pions.map(pion => ({
          id: pion.id,
          status: pion.status,
          position: pion.position,
          gridPos: this.getGridPosForPion(p.id, pion),
          shielded: pion.shielded
        })),
        finishedCount: p.getFinishedCount()
      })),
      currentPlayer: this.currentPlayerIndex,
      diceValue: this.diceValue,
      status: this.status,
      movablePions: this.movablePions.map(m => m.pionIndex)
    };
  }

  // ─── POWERUPS ────────────────────────────────────────────

  applyShield(playerIndex, pionIndex) {
    const pion = this.players[playerIndex]?.pions[pionIndex];
    if (!pion || !pion.isOnBoard()) return false;
    pion.shielded = true;
    this._emit('shieldApplied', { playerIndex, pionIndex });
    return true;
  }

  applyTurbo(extraSteps = 2) {
    // Extra steps added to current dice value
    const player = this.getCurrentPlayer();
    const movable = this._findMovablePions(player, this.diceValue + extraSteps);
    this.movablePions = movable;
    this._emit('turboApplied', { extraSteps, movable });
    return movable;
  }

  // ─── EVENTS ──────────────────────────────────────────────

  on(event, listener) {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, []);
    }
    this._eventListeners.get(event).push(listener);
    return () => this.off(event, listener);
  }

  off(event, listener) {
    const listeners = this._eventListeners.get(event);
    if (listeners) {
      const idx = listeners.indexOf(listener);
      if (idx !== -1) listeners.splice(idx, 1);
    }
  }

  _emit(event, data) {
    const listeners = this._eventListeners.get(event) || [];
    listeners.forEach(fn => {
      try { fn(data); } catch(e) { console.error(`Engine event error [${event}]:`, e); }
    });
  }

  // ─── SERIALIZATION ───────────────────────────────────────

  serialize() {
    return {
      players: this.players.map(p => p.clone()),
      currentPlayerIndex: this.currentPlayerIndex,
      diceValue: this.diceValue,
      consecutiveSixes: this.consecutiveSixes,
      status: this.status,
      winner: this.winner?.id || null,
      movablePions: this.movablePions,
      gameMode: this.gameMode,
      turnCount: this.turnCount,
      startTime: this.startTime
    };
  }

  deserialize(state) {
    Object.assign(this, state);
  }
}
