/**
 * PiArena - AI Engine
 * Intelligent computer opponents with 3 difficulty levels
 * @version 1.0.0
 */

'use strict';

import { SAFE_CELLS, HOME_COLUMN } from './engine.js';

// ============================================================
// AI PERSONALITIES
// ============================================================

const AI_PROFILES = {
  easy: {
    name: 'Alfa',
    emoji: '🤖',
    thinkTime: 1200,
    strategy: 'random'
  },
  medium: {
    name: 'Beta',
    emoji: '🧠',
    thinkTime: 1600,
    strategy: 'balanced'
  },
  hard: {
    name: 'Gamma',
    emoji: '👾',
    thinkTime: 2000,
    strategy: 'aggressive'
  }
};

export function getAIProfile(difficulty) {
  return AI_PROFILES[difficulty] || AI_PROFILES.easy;
}

// ============================================================
// AI ENGINE
// ============================================================

export class AIEngine {
  constructor(difficulty = 'easy') {
    this.difficulty = difficulty;
    this.profile = getAIProfile(difficulty);
  }

  /**
   * Choose best pion to move given movable options
   * @param {Object} gameState - Current board state from engine.getBoardState()
   * @param {Array} movablePions - Available pion indices
   * @param {Number} diceValue - Current dice value
   * @param {Number} playerIndex - AI player index
   * @returns {Number} - Best pion index to move
   */
  choosePion(gameState, movablePions, diceValue, playerIndex) {
    if (movablePions.length === 0) return null;
    if (movablePions.length === 1) return movablePions[0];

    switch (this.difficulty) {
      case 'easy':   return this._randomChoice(movablePions);
      case 'medium': return this._balancedChoice(gameState, movablePions, diceValue, playerIndex);
      case 'hard':   return this._aggressiveChoice(gameState, movablePions, diceValue, playerIndex);
      default:       return this._randomChoice(movablePions);
    }
  }

  // ─── EASY: Random ────────────────────────────────────────

  _randomChoice(movablePions) {
    return movablePions[Math.floor(Math.random() * movablePions.length)];
  }

  // ─── MEDIUM: Balanced ────────────────────────────────────

  _balancedChoice(gameState, movablePions, diceValue, playerIndex) {
    const scored = movablePions.map(pionIdx => ({
      pionIdx,
      score: this._scoreMoveMedium(gameState, pionIdx, diceValue, playerIndex)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0].pionIdx;
  }

  _scoreMoveMedium(gameState, pionIdx, diceValue, playerIndex) {
    const player = gameState.players[playerIndex];
    const pion = player.pions[pionIdx];
    let score = 0;

    if (pion.status === 'base') {
      score += 60; // Prioritize exiting base
      return score;
    }

    const newPos = pion.position + diceValue;
    score += newPos * 0.5; // Advance further

    // Check if captures an enemy
    if (this._wouldCapture(gameState, playerIndex, pionIdx, newPos)) {
      score += 80;
    }

    // Check if lands on safe cell
    if (SAFE_CELLS.has(newPos % 52) || newPos > 51) {
      score += 30;
    }

    // Prefer not leaving vulnerable pions
    if (this._isVulnerable(gameState, playerIndex, newPos)) {
      score -= 20;
    }

    return score;
  }

  // ─── HARD: Aggressive with lookahead ─────────────────────

  _aggressiveChoice(gameState, movablePions, diceValue, playerIndex) {
    const scored = movablePions.map(pionIdx => ({
      pionIdx,
      score: this._scoreMoveHard(gameState, pionIdx, diceValue, playerIndex)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0].pionIdx;
  }

  _scoreMoveHard(gameState, pionIdx, diceValue, playerIndex) {
    const player = gameState.players[playerIndex];
    const pion = player.pions[pionIdx];
    let score = 0;

    if (pion.status === 'base') {
      // Exit only if no other good moves
      const hasActivePions = player.pions.some(p => p.status === 'active');
      score += hasActivePions ? 30 : 80;
      return score;
    }

    const newPos = pion.position + diceValue;

    // Core: Advance progress
    score += newPos;

    // High priority: Capture enemies
    const captureTarget = this._findCaptureTarget(gameState, playerIndex, pionIdx, newPos);
    if (captureTarget) score += 150;

    // Block opponent near finish
    if (this._wouldBlock(gameState, playerIndex, newPos)) score += 40;

    // Land on safe cell
    if (SAFE_CELLS.has(newPos % 52) || newPos > 51) score += 50;

    // Avoid being captured next turn
    if (this._isVulnerable(gameState, playerIndex, newPos)) score -= 60;

    // Form blocks with friendly pions
    if (this._formsFriendlyBlock(gameState, playerIndex, pionIdx, newPos)) score += 35;

    // Prioritize almost-finished pions
    if (newPos >= 50) score += 100;

    return score;
  }

  // ─── HELPERS ─────────────────────────────────────────────

  _wouldCapture(gameState, playerIndex, pionIdx, newPos) {
    if (newPos > 51) return false;
    if (SAFE_CELLS.has(newPos % 52)) return false;

    const player = gameState.players[playerIndex];
    const color = player.color;
    const startIdx = this._getStartIndex(color);
    const mainIdx = (startIdx + newPos) % 52;
    const [nr, nc] = this._mainPathGridPos(mainIdx);

    return gameState.players.some((p, pi) => {
      if (pi === playerIndex) return false;
      return p.pions.some(pion => {
        if (!pion.gridPos || pion.status === 'finished' || pion.status === 'base') return false;
        return pion.gridPos[0] === nr && pion.gridPos[1] === nc;
      });
    });
  }

  _findCaptureTarget(gameState, playerIndex, pionIdx, newPos) {
    if (newPos > 51) return null;
    if (SAFE_CELLS.has(newPos % 52)) return null;

    const player = gameState.players[playerIndex];
    const startIdx = this._getStartIndex(player.color);
    const mainIdx = (startIdx + newPos) % 52;
    const [nr, nc] = this._mainPathGridPos(mainIdx);

    for (const [pi, p] of gameState.players.entries()) {
      if (pi === playerIndex) continue;
      for (const pion of p.pions) {
        if (!pion.gridPos) continue;
        if (pion.gridPos[0] === nr && pion.gridPos[1] === nc) {
          return { player: pi, pion };
        }
      }
    }
    return null;
  }

  _isVulnerable(gameState, playerIndex, newPos) {
    if (newPos > 51) return false;
    if (SAFE_CELLS.has(newPos % 52)) return false;

    const player = gameState.players[playerIndex];
    const startIdx = this._getStartIndex(player.color);
    const mainIdx = (startIdx + newPos) % 52;
    const [nr, nc] = this._mainPathGridPos(mainIdx);

    // Check if any opponent can reach this cell in 1-6 moves
    return gameState.players.some((p, pi) => {
      if (pi === playerIndex) return false;
      const opStartIdx = this._getStartIndex(p.color);
      return p.pions.some(pion => {
        if (!pion.gridPos || pion.status !== 'active') return false;
        for (let d = 1; d <= 6; d++) {
          const futureMain = (opStartIdx + pion.position + d) % 52;
          if (futureMain < 52) {
            const [fr, fc] = this._mainPathGridPos(futureMain);
            if (fr === nr && fc === nc) return true;
          }
        }
        return false;
      });
    });
  }

  _wouldBlock(gameState, playerIndex, newPos) {
    if (newPos > 51) return false;
    const player = gameState.players[playerIndex];
    const startIdx = this._getStartIndex(player.color);
    const mainIdx = (startIdx + newPos) % 52;
    const [nr, nc] = this._mainPathGridPos(mainIdx);

    // Check if a friendly pion is already there
    return player.pions.some(p => {
      if (!p.gridPos) return false;
      return p.gridPos[0] === nr && p.gridPos[1] === nc;
    });
  }

  _formsFriendlyBlock(gameState, playerIndex, pionIdx, newPos) {
    if (newPos > 51) return false;
    const player = gameState.players[playerIndex];
    const startIdx = this._getStartIndex(player.color);
    const mainIdx = (startIdx + newPos) % 52;
    const [nr, nc] = this._mainPathGridPos(mainIdx);

    return player.pions.some((p, i) => {
      if (i === pionIdx) return false;
      if (!p.gridPos || p.status !== 'active') return false;
      return p.gridPos[0] === nr && p.gridPos[1] === nc;
    });
  }

  _getStartIndex(color) {
    const starts = { red: 0, blue: 13, green: 26, yellow: 39 };
    return starts[color] || 0;
  }

  _mainPathGridPos(idx) {
    const MAIN_PATH = [
      [6,1],[6,2],[6,3],[6,4],[6,5],
      [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],
      [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
      [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],
      [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
      [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],
      [14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
      [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0]
    ];
    return MAIN_PATH[idx % 52] || [7, 7];
  }

  // ─── AI TURN ORCHESTRATION ───────────────────────────────

  async takeTurn(engine) {
    const { thinkTime } = this.profile;
    const result = engine.rollDice();

    if (!result.success || result.action === 'noMove' || result.action === 'turnLost') {
      return result;
    }

    // Thinking delay
    await this._think(thinkTime);

    const gameState = engine.getBoardState();
    const movablePionIndices = result.movable.map(m => m.pionIndex);
    const chosenPion = this.choosePion(
      gameState,
      movablePionIndices,
      result.value,
      engine.currentPlayerIndex
    );

    return engine.movePion(chosenPion);
  }

  _think(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
