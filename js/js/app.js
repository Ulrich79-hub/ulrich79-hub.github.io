/**
 * PiArena - App Bootstrap
 * Main application controller
 * @version 1.0.0
 */

'use strict';

import { state }           from './state.js';
import { firebaseService } from './firebase.js';
import { piService }       from './pi.js';
import { soundEngine }     from './sound.js';
import { LudoEngine }      from './game/engine.js';
import { AIEngine, getAIProfile } from './game/ai.js';
import { BoardRenderer }   from './game/board.js';
import { UIController }    from './ui/ui-controller.js';

// ============================================================
// APP CONTROLLER
// ============================================================

class App {
  constructor() {
    this.engine = new LudoEngine();
    this.renderer = null;
    this.aiEngine = null;
    this.ui = null;
    this._gameConfig = null;
    this._turnTimer = null;
    this._timerLeft = 20;
  }

  // ─── BOOT SEQUENCE ───────────────────────────────────────

  async boot() {
    console.log('🚀 PiArena booting...');

    // 1. Initialize state
    state.init();

    // 2. Run splash animation
    await this._runSplash();

    // 3. Initialize services (non-blocking)
    this._initServices();

    // 4. Setup UI
    this.ui = new UIController(this);
    this.ui.init();

    // 5. Show home
    this.ui.showPage('home');

    // 6. Show tutorial if needed
    const settings = state.getSettings();
    if (!settings.tutorialDone) {
      setTimeout(() => this.ui.showTutorial(), 800);
    }

    console.log('✅ PiArena ready');
  }

  async _initServices() {
    // Firebase
    await firebaseService.init();

    // Pi SDK
    await piService.init(true); // sandbox mode
    piService.on('authenticated', user => this._onPiAuthenticated(user));
    await piService.authenticate();

    // Sound
    const settings = state.getSettings();
    soundEngine.setSoundEnabled(settings.sound);
    soundEngine.setMusicEnabled(settings.music);
    if (settings.music) soundEngine.startMusic();
  }

  async _onPiAuthenticated(user) {
    state.setUser(user);
    this.ui.updateUserDisplay();

    // Sync with Firebase
    const profile = await firebaseService.loadUserProfile(user.username);
    if (profile) state.importFromFirebase(profile);

    // Update presence
    firebaseService.updatePresence(user.username, user.username);

    // Reload leaderboard
    this.ui.loadLeaderboard();
  }

  // ─── SPLASH ──────────────────────────────────────────────

  _runSplash() {
    return new Promise(resolve => {
      const canvas = document.getElementById('splash-canvas');
      const fill = document.getElementById('splash-fill');

      if (!canvas) { resolve(); return; }

      let angle = 0, progress = 0, frame = 0;
      const ctx = canvas.getContext('2d');

      const draw = () => {
        ctx.clearRect(0, 0, 200, 200);

        // Particles
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + angle;
          const x = 100 + Math.cos(a) * 80;
          const y = 100 + Math.sin(a) * 80;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(108,63,209,${0.3 + 0.4 * Math.sin(angle + i)})`;
          ctx.fill();
        }

        // Ring
        ctx.beginPath();
        ctx.arc(100, 100, 70, 0, Math.PI * 2);
        ctx.strokeStyle = `hsl(${(angle * 180 / Math.PI) % 360}, 70%, 60%)`;
        ctx.lineWidth = 8;
        ctx.stroke();

        // Center
        ctx.fillStyle = '#050510';
        ctx.beginPath();
        ctx.arc(100, 100, 60, 0, Math.PI * 2);
        ctx.fill();

        // π
        const lg = ctx.createLinearGradient(70, 70, 130, 130);
        lg.addColorStop(0, '#6c3fd1');
        lg.addColorStop(1, '#f0a500');
        ctx.font = "bold 60px 'Orbitron', monospace";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = lg;
        ctx.fillText('π', 100, 102);

        angle += 0.04;
      };

      const interval = setInterval(() => {
        draw();
        progress += 3;
        if (fill) fill.style.width = Math.min(progress, 100) + '%';
        frame++;
        if (frame > 33) {
          clearInterval(interval);
          this._hideSplash(resolve);
        }
      }, 50);
    });
  }

  _hideSplash(callback) {
    const splash = document.getElementById('splash');
    const app = document.getElementById('app');
    if (splash) { splash.style.transition = 'opacity .5s'; splash.style.opacity = '0'; }
    if (app) app.style.display = 'flex';
    setTimeout(() => { if (splash) splash.style.display = 'none'; callback(); }, 500);
  }

  // ─── GAME MANAGEMENT ─────────────────────────────────────

  async startGame(config) {
    /**
     * config = {
     *   mode: 'computer' | 'local' | 'quick',
     *   players: [{ color, name, isHuman, difficulty }],
     *   gameMode: 'classic' | 'quick',
     *   isTournament: false
     * }
     */
    this._gameConfig = config;

    // Setup engine
    this.engine.setupGame({
      players: config.players,
      mode: config.gameMode || 'classic',
      startWithOnePion: config.startWithOnePion || false
    });

    // Setup AI if needed
    const aiPlayers = config.players.filter(p => !p.isHuman);
    if (aiPlayers.length > 0) {
      this.aiEngine = new AIEngine(aiPlayers[0].difficulty || 'easy');
    }

    // Setup renderer
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
      this.renderer = new BoardRenderer(canvas);
      this.renderer.resize(
        document.getElementById('board-area')?.clientWidth || 400,
        document.getElementById('board-area')?.clientHeight || 400
      );
      this.renderer.onCellClick(click => this._onBoardClick(click));
    }

    // Listen to engine events
    this._attachEngineListeners();

    // Update UI
    this.ui.showGameScreen(config);
    this._renderGame();
    this._startTurn();
  }

  _attachEngineListeners() {
    // Clean up old listeners
    this.engine._eventListeners.clear();

    this.engine.on('diceRolled', data => this._onDiceRolled(data));
    this.engine.on('pionMoved', data => this._onPionMoved(data));
    this.engine.on('turnChanged', data => this._onTurnChanged(data));
    this.engine.on('bonusTurn', data => this._onBonusTurn(data));
    this.engine.on('gameWon', data => this._onGameWon(data));
  }

  // ─── GAME EVENTS ─────────────────────────────────────────

  _onDiceRolled({ value, player, action, movable }) {
    soundEngine.play(value === 6 ? 'six' : 'roll');
    soundEngine.vibrate([50]);
    this.ui.updateDiceDisplay(value, this.engine.getSeed());

    if (action === 'turnLost') {
      this.ui.showToast('⚠️ 3 six consécutifs — Tour perdu !');
      return;
    }
    if (action === 'noMove') {
      soundEngine.play('cantmove');
      this.ui.showToast('😔 Aucun pion ne peut bouger');
      return;
    }
    if (value === 6) {
      this.ui.showToast('🎉 Six ! Tour bonus !');
      state.recordSix();
    }

    // Update movable pions display
    const movableIndices = movable.map(m => m.pionIndex);
    this.renderer?.render(this.engine.getBoardState(), movableIndices);
    this.ui.updateGameControls(player.isHuman, true);
  }

  _onPionMoved({ player, pion, diceValue, action, captured, steps, finished }) {
    soundEngine.play(finished ? 'home' : (captured ? 'capture' : 'move'));
    soundEngine.vibrate(captured ? [100, 50, 100] : [30]);

    if (captured) {
      this.ui.showToast(`💥 ${player.name} capture un pion !`);
      state.recordCapture();
      this._showConfetti(1);
    }

    if (finished) {
      this.ui.showToast(`🏁 ${player.name} rentre un pion !`);
      this._showConfetti(5);
    }

    state.progressMission('d1');
  }

  _onTurnChanged({ player, turn }) {
    this._startTurn();
  }

  _onBonusTurn({ player, reason }) {
    const msg = reason === 'capture' ? '💥 Capture ! Rejoue !' : '🎮 Six ! Rejoue !';
    this.ui.showToast(msg);
    this._startTurn();
  }

  async _onGameWon({ player, duration }) {
    this._stopTimer();
    soundEngine.play('victory');
    soundEngine.vibrate([200, 100, 200, 100, 300]);
    this._showConfetti(30);

    const isHuman = player.isHuman;
    const isTournament = this._gameConfig?.isTournament;
    const coinsWon = isHuman ? 500 : 100;
    const piWon = isTournament ? 1 : 0;

    if (isHuman) {
      state.addCoins(coinsWon);
      state.recordGame({
        won: true,
        mode: this._gameConfig?.mode,
        captures: this.engine.getCurrentPlayer()?.stats?.captures || 0,
        sixes: this.engine.getCurrentPlayer()?.stats?.sixes || 0,
        piWon,
        duration
      });

      // Save to Firebase
      if (piService.isAuthenticated()) {
        const userId = piService.getUserId();
        await firebaseService.saveUserProfile(userId, state.exportForFirebase());
        await firebaseService.saveGameResult(userId, {
          result: 'win',
          mode: this._gameConfig?.mode,
          duration,
          piWon
        });
      }
    } else {
      state.recordGame({ won: false, mode: this._gameConfig?.mode });
    }

    this.ui.showVictory({
      player, isHuman, coinsWon, piWon,
      xpWon: 50, duration,
      stats: {
        moves: this.engine.turnCount,
        captures: player.stats?.captures || 0,
        sixes: player.stats?.sixes || 0
      }
    });
  }

  // ─── TURN MANAGEMENT ─────────────────────────────────────

  _startTurn() {
    const player = this.engine.getCurrentPlayer();
    this._renderGame();
    this.ui.updateTurnDisplay(player);
    this.ui.updatePlayersBar(this.engine.getBoardState());

    this._startTimer();

    // AI turn
    if (!player.isHuman && this.aiEngine) {
      this.ui.updateGameControls(false, false);
      this._doAITurn();
    } else {
      this.ui.updateGameControls(true, false);
    }
  }

  async _doAITurn() {
    const player = this.engine.getCurrentPlayer();
    this.ui.showToast(`${player.name} réfléchit...`);

    try {
      await this.aiEngine.takeTurn(this.engine);
    } catch(e) {
      console.error('AI turn error:', e);
      this.engine._nextTurn();
    }
  }

  // ─── INPUT ───────────────────────────────────────────────

  playerRoll() {
    const player = this.engine.getCurrentPlayer();
    if (!player.isHuman) return;

    this._stopTimer();
    this.ui.animateDice(() => {
      this.engine.rollDice();
    });
  }

  _onBoardClick({ row, col }) {
    if (this.engine.status !== 'moving') return;
    const player = this.engine.getCurrentPlayer();
    if (!player.isHuman) return;

    // Find which pion was clicked
    const boardState = this.engine.getBoardState();
    const movableIndices = this.engine.movablePions.map(m => m.pionIndex);

    for (const pionIdx of movableIndices) {
      const pion = boardState.players[this.engine.currentPlayerIndex].pions[pionIdx];
      if (!pion.gridPos) continue;
      if (pion.gridPos[0] === row && pion.gridPos[1] === col) {
        this._stopTimer();
        this.engine.movePion(pionIdx);
        return;
      }
    }

    // Auto-select if only one movable
    if (movableIndices.length === 1) {
      this._stopTimer();
      this.engine.movePion(movableIndices[0]);
    }
  }

  // ─── TIMER ───────────────────────────────────────────────

  _startTimer() {
    this._stopTimer();
    this._timerLeft = 20;
    this.ui.updateTimer(20);

    this._turnTimer = setInterval(() => {
      this._timerLeft--;
      this.ui.updateTimer(this._timerLeft);

      if (this._timerLeft <= 5) {
        soundEngine.play('alert');
        soundEngine.vibrate([100]);
      }

      if (this._timerLeft <= 0) {
        this._stopTimer();
        this._autoPlay();
      }
    }, 1000);
  }

  _stopTimer() {
    if (this._turnTimer) {
      clearInterval(this._turnTimer);
      this._turnTimer = null;
    }
  }

  _autoPlay() {
    if (this.engine.status === 'rolling') {
      this.engine.rollDice();
    } else if (this.engine.movablePions.length > 0) {
      this.engine.movePion(this.engine.movablePions[0].pionIndex);
    }
  }

  // ─── POWERUPS ────────────────────────────────────────────

  async usePowerup(type) {
    const player = this.engine.getCurrentPlayer();
    if (!player.isHuman) return;

    const result = await piService.payForPowerup(type);
    if (!result.success) return;

    soundEngine.play('powerup');

    switch(type) {
      case 'dice':
        this.engine.status = 'rolling';
        this.ui.updateGameControls(true, false);
        this.ui.showToast('🎲 Dé Doré ! Relancez !');
        break;
      case 'shield':
        const firstPion = player.pions.findIndex(p => p.isOnBoard?.() || p.status === 'active');
        if (firstPion >= 0) {
          this.engine.applyShield(this.engine.currentPlayerIndex, firstPion);
          this.ui.showToast('🛡️ Bouclier activé !');
          this._renderGame();
        }
        break;
      case 'turbo':
        this.engine.applyTurbo(2);
        this.ui.showToast('🚀 Turbo ! +2 cases !');
        this._renderGame();
        break;
    }

    state.progressMission('d5');
  }

  // ─── RENDER ──────────────────────────────────────────────

  _renderGame() {
    if (!this.renderer) return;
    const boardState = this.engine.getBoardState();
    const movable = this.engine.status === 'moving'
      ? this.engine.movablePions.map(m => m.pionIndex)
      : [];
    this.renderer.render(boardState, movable);
  }

  // ─── QUIT GAME ───────────────────────────────────────────

  quitGame() {
    this._stopTimer();
    this.renderer?.stopRendering();
    this.engine.reset();
    this._gameConfig = null;
    this.ui.hideGameScreen();
    this.ui.showPage('home');
    this.ui.loadLeaderboard();
  }

  // ─── EFFECTS ─────────────────────────────────────────────

  _showConfetti(count = 20) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const el = document.createElement('div');
        el.style.cssText = `
          position:fixed; pointer-events:none;
          width:10px; height:10px; z-index:600;
          left:${Math.random() * 100}%; top:-20px;
          background:${['#6c3fd1','#f0a500','#e74c3c','#27ae60','#2980b9'][Math.floor(Math.random() * 5)]};
          border-radius:${Math.random() > 0.5 ? '50%' : '0'};
          animation:confetti-fall ${2 + Math.random() * 2}s ease-out forwards;
        `;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 4000);
      }, i * 80);
    }
  }
}

// ─── BOOT ────────────────────────────────────────────────────

export const app = new App();

document.addEventListener('DOMContentLoaded', () => {
  app.boot().catch(console.error);
});

window.addEventListener('resize', () => {
  if (app.renderer && app.engine.status !== 'waiting') {
    const area = document.getElementById('board-area');
    if (area) {
      app.renderer.resize(area.clientWidth, area.clientHeight);
      app._renderGame();
    }
  }
});

// Expose to window for HTML onclick compatibility during transition
window.piArena = app;
