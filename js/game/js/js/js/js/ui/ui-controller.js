/**
 * PiArena - UI Controller
 * Manages all UI interactions without inline onclick
 * @version 1.0.0
 */

'use strict';

import { state }       from '../state.js';
import { piService }   from '../pi.js';
import { soundEngine } from '../sound.js';
import { firebaseService } from '../firebase.js';
import { BoardRenderer } from '../game/board.js';
import { getAIProfile }  from '../game/ai.js';

// ============================================================
// UI CONTROLLER
// ============================================================

export class UIController {
  constructor(appController) {
    this.app = appController;
    this._toastTimer = null;
    this._logoStopFn = null;
    this._tutorialStep = 1;
    this._selectedMode = 'computer';
    this._selectedColor = 'red';
    this._selectedDiff = 'easy';
    this._selectedPlayers = 3;
    this._selectedGameMode = 'classic';
  }

  // ─── INIT ────────────────────────────────────────────────

  init() {
    this._bindEvents();
    this._startHomeLogo();
    this.updateUI();
    this.buildMissions();
    this.buildStreak();
    this.buildAchievements();
    this.buildHistory();

    // Listen to state changes
    state.on('economy.coins', () => this._updateCurrencies());
    state.on('economy.gems',  () => this._updateCurrencies());
    state.on('levelUp',       () => this.updateUserDisplay());
    state.on('achievement',   id => this._showAchievementUnlock(id));
    state.on('missions',      () => this.buildMissions());
  }

  // ─── EVENT BINDING (no inline onclick) ───────────────────

  _bindEvents() {
    // Navigation
    this._on('nav-home',    'click', () => this.showPage('home'));
    this._on('nav-event',   'click', () => this.showPage('event'));
    this._on('nav-shop',    'click', () => this.showPage('shop'));
    this._on('nav-profile', 'click', () => this.showPage('profile'));

    // Home page
    this._on('tb-add-btn',    'click', () => { this.showPage('shop'); this.setShopTab('pi'); });
    this._on('mode-computer', 'click', () => this._openModeSelect('computer'));
    this._on('mode-local',    'click', () => this._openModeSelect('local'));
    this._on('mode-quick',    'click', () => this._openModeSelect('quick'));
    this._on('mode-tournament','click',() => this._openTournament());
    this._on('mode-online',   'click', () => this.showToast('Bientôt disponible !'));
    this._on('mode-team',     'click', () => this.showToast('Bientôt disponible !'));
    this._on('mode-friends',  'click', () => this.showToast('Bientôt disponible !'));
    this._on('bonus-btn',     'click', () => this._claimBonus());
    this._on('jackpot-btn',   'click', () => this._tryJackpot());

    // Mode selection modal
    this._on('opt-classic', 'click', () => this._selectGameMode('classic'));
    this._on('opt-quick',   'click', () => this._selectGameMode('quick'));
    this._on('step1-next',  'click', () => this._goStep(2));
    this._on('step2-next',  'click', () => this._goStep(3));
    this._on('modal-play',  'click', () => this._confirmStartGame());
    this._on('modal-cancel','click', () => this._closeModeModal());

    // Color selection
    ['red','blue','green','yellow'].forEach(c => {
      this._on(`col-${c}`, 'click', () => this._selectColor(c));
    });

    // Difficulty
    ['easy','medium','hard'].forEach(d => {
      this._on(`diff-${d}`, 'click', () => this._selectDiff(d));
    });

    // Player count
    [2,3,4].forEach(n => {
      this._on(`count-${n}`, 'click', () => this._selectPlayerCount(n));
    });

    // Shop tabs
    this._on('tab-coins', 'click', () => this.setShopTab('coins'));
    this._on('tab-gems',  'click', () => this.setShopTab('gems'));
    this._on('tab-pi',    'click', () => this.setShopTab('pi'));

    // Game controls
    this._on('roll-btn',    'click', () => this.app.playerRoll());
    this._on('sound-btn',   'click', () => this._toggleSound());
    this._on('pause-btn',   'click', () => this.showPause());
    this._on('quit-btn',    'click', () => this._confirmQuit());

    // Power-ups
    this._on('pu-dice',   'click', () => this.app.usePowerup('dice'));
    this._on('pu-shield', 'click', () => this.app.usePowerup('shield'));
    this._on('pu-turbo',  'click', () => this.app.usePowerup('turbo'));

    // Emojis
    ['👍','😂','🔥','😮','😡','👑'].forEach((emoji, i) => {
      this._on(`emoji-${i}`, 'click', () => this._sendEmoji(emoji));
    });

    // Pause modal
    this._on('pause-continue', 'click', () => this._resumeGame());
    this._on('pause-sound',    'click', () => this._toggleSound());
    this._on('pause-music',    'click', () => this._toggleMusic());
    this._on('pause-quit',     'click', () => this.app.quitGame());

    // Victory modal
    this._on('victory-share',   'click', () => this._shareVictory());
    this._on('victory-replay',  'click', () => this._replayGame());
    this._on('victory-menu',    'click', () => this.app.quitGame());

    // Tournament modal
    this._on('tournament-pay',    'click', () => this._confirmTournament());
    this._on('tournament-cancel', 'click', () => this._closeModal('tournament-modal'));

    // Balance modal
    this._on('balance-recharge', 'click', () => {
      this._closeModal('balance-modal');
      this.showPage('shop');
      this.setShopTab('pi');
    });
    this._on('balance-cancel', 'click', () => this._closeModal('balance-modal'));

    // Tutorial
    this._on('tut-next', 'click', () => this._nextTutorial());

    // Recharge options
    this._on('recharge-01', 'click', () => this._rechargePi(0.1, 1000, 0));
    this._on('recharge-05', 'click', () => this._rechargePi(0.5, 0, 100));
    this._on('recharge-10', 'click', () => this._rechargePi(1.0, 5000, 200));

    // Arena Pass
    this._on('buy-pass', 'click', () => this._buyArenaPass());
  }

  _on(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }

  // ─── NAVIGATION ──────────────────────────────────────────

  showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const page = document.getElementById(`page-${pageId}`);
    const nav = document.getElementById(`nav-${pageId}`);
    if (page) page.classList.add('active');
    if (nav) nav.classList.add('active');

    soundEngine.play('click');

    if (pageId === 'home')    this.loadLeaderboard();
    if (pageId === 'profile') { this.buildAchievements(); this.buildHistory(); this.updateStats(); }
    if (pageId === 'event')   { this.buildMissions(); this.buildStreak(); }
    if (pageId === 'shop')    this._updateShopBalance();
  }

  // ─── GAME SCREEN ─────────────────────────────────────────

  showGameScreen(config) {
    document.getElementById('game-screen')?.classList.add('active');
    const labels = { computer:'vs IA', local:'Local', quick:'Quick', tournament:'Tournoi π' };
    const diffs = { easy:'Facile', medium:'Moyen', hard:'Difficile' };
    let label = labels[config.mode] || '';
    if (config.mode === 'computer') label += ` · ${diffs[config.players.find(p=>!p.isHuman)?.difficulty || 'easy']}`;
    this._setText('game-mode-label', label);
  }

  hideGameScreen() {
    document.getElementById('game-screen')?.classList.remove('active');
    this._closeModal('pause-modal');
    this._closeModal('victory-modal');
  }

  // ─── PLAYERS BAR ─────────────────────────────────────────

  updatePlayersBar(boardState) {
    boardState.players.forEach((pl, i) => {
      const pm = document.getElementById(`pm-${i}`);
      if (!pm) return;
      pm.style.display = i < boardState.players.length ? 'block' : 'none';
      this._el(`pm-color-${i}`).style.background = this._colorHex(pl.color);
      this._setText(`pm-name-${i}`, pl.name.length > 8 ? pl.name.substring(0, 8) + '…' : pl.name);
      this._setText(`pm-score-${i}`, `${pl.finishedCount}/${pl.pions.length}`);
      pm.classList.toggle('active-turn', i === boardState.currentPlayer);
    });

    // Hide unused slots
    for (let i = boardState.players.length; i < 4; i++) {
      const pm = document.getElementById(`pm-${i}`);
      if (pm) pm.style.display = 'none';
    }
  }

  // ─── TURN DISPLAY ────────────────────────────────────────

  updateTurnDisplay(player) {
    const el = document.getElementById('turn-msg');
    if (!el) return;
    const msg = player.isHuman ? 'Lance le dé !' : `${player.name} réfléchit...`;
    el.innerHTML = `<span style="color:${this._colorHex(player.color)}">${player.name}</span> — ${msg}`;
  }

  updateGameControls(isHuman, diceRolled) {
    const rollBtn = document.getElementById('roll-btn');
    if (rollBtn) rollBtn.disabled = !isHuman || diceRolled;
  }

  updateTimer(seconds) {
    const bar = document.getElementById('timer-bar');
    if (!bar) return;
    bar.style.width = (seconds / 20 * 100) + '%';
    bar.style.background = seconds <= 5 ? '#e74c3c' : '';
  }

  updateDiceDisplay(value, seed) {
    const disp = document.getElementById('dice-display');
    if (disp) { disp.textContent = value; disp.style.display = 'flex'; }

    const seedEl = document.getElementById('dice-seed-display');
    if (seedEl) seedEl.textContent = `🔗 Dé certifié · seed: ${seed}`;

    // Render dice canvas
    const diceCanvas = document.getElementById('game-dice-canvas');
    if (diceCanvas) BoardRenderer.renderDice(diceCanvas, value);
  }

  animateDice(callback) {
    const diceCanvas = document.getElementById('game-dice-canvas');
    if (!diceCanvas) { callback(); return; }

    const renderer = new BoardRenderer(document.createElement('canvas'));
    renderer.animateDice(diceCanvas, callback);
  }

  // ─── MODALS ──────────────────────────────────────────────

  showPause() {
    document.getElementById('pause-modal')?.classList.add('show');
  }

  showVictory({ player, isHuman, coinsWon, piWon, xpWon, duration, stats }) {
    document.getElementById('victory-emoji').textContent = isHuman ? '🏆' : '😔';
    this._setText('victory-title', isHuman ? 'VICTOIRE !' : `${player.name} gagne !`);
    this._setText('victory-sub', isHuman ? 'Tu as ramené tous tes pions !' : `${player.name} a gagné la partie`);
    this._setText('reward-coins', `+${coinsWon}`);
    this._setText('reward-xp', `+${xpWon}`);
    this._setText('reward-pi', piWon > 0 ? `+${piWon}π` : '—');

    const m = Math.floor(duration / 60), s = duration % 60;
    document.getElementById('victory-stats').innerHTML = `
      <div class="vstat">⏱️ Durée : <span>${m}m ${s}s</span></div>
      <div class="vstat">🎲 Coups : <span>${stats.moves}</span></div>
      <div class="vstat">💥 Captures : <span>${stats.captures}</span></div>
      <div class="vstat">6️⃣ Six : <span>${stats.sixes}</span></div>
    `;

    document.getElementById('victory-modal')?.classList.add('show');
  }

  showTutorial() {
    this._tutorialStep = 1;
    this._updateTutorial();
    document.getElementById('tutorial-overlay')?.classList.add('show');
  }

  showBalanceModal(msg) {
    this._setText('balance-modal-msg', msg);
    document.getElementById('balance-modal')?.classList.add('show');
  }

  showToast(msg, duration = 2500) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  }

  // ─── USER DISPLAY ────────────────────────────────────────

  updateUserDisplay() {
    const user = state.getUser();
    const prog = state.getProgression();
    const { name, emoji } = state.getLevelName();

    const username = user.piUsername || 'Connexion Pi...';
    this._setText('home-username', username);
    this._setText('profile-username', username);

    const levelText = `${emoji} ${name} · Niveau ${prog.level}`;
    this._setText('home-level', levelText);
    this._setText('profile-rank', levelText);

    const needed = prog.level * 100;
    const pct = Math.min((prog.xp / needed) * 100, 100);
    this._setStyle('home-xp', 'width', pct + '%');
    this._setStyle('profile-xp', 'width', pct + '%');
    this._setText('profile-xp-text', `${prog.xp} / ${needed} XP`);

    this._updateCurrencies();
  }

  updateUI() {
    this.updateUserDisplay();
    this.updateStats();
    this._updateCurrencies();
  }

  // ─── LEADERBOARD ─────────────────────────────────────────

  async loadLeaderboard() {
    const container = document.getElementById('home-leaderboard');
    if (!container) return;

    container.innerHTML = '<div class="lb-loading">Chargement...</div>';

    const data = await firebaseService.getLeaderboard('wins', 5);

    if (!data.length) {
      container.innerHTML = '<div class="lb-empty">Sois le premier ! 🏆</div>';
      return;
    }

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    container.innerHTML = data.map((user, i) => `
      <div class="lb-item">
        <div class="lb-rank ${['gold','silver','bronze','',''][i]}">${medals[i]}</div>
        <div class="lb-avatar">π</div>
        <div class="lb-info">
          <div class="lb-name">${user.username || 'Joueur'}</div>
          <div class="lb-score">${user.gamesPlayed || 0} parties</div>
        </div>
        <div class="lb-reward">${user.wins || 0} 🏆</div>
      </div>
    `).join('');
  }

  // ─── MISSIONS ────────────────────────────────────────────

  buildMissions() {
    const missions = state.getMissions();

    const dailyDefs = [
      { id:'d1', icon:'🎮', name:'Jouer 3 parties' },
      { id:'d2', icon:'🏆', name:'Gagner 1 partie' },
      { id:'d3', icon:'💥', name:'Capturer 5 pions' },
      { id:'d4', icon:'6️⃣', name:'Obtenir un 6' },
      { id:'d5', icon:'⚡', name:'Utiliser un power-up' }
    ];

    const weeklyDefs = [
      { id:'w1', icon:'🏆', name:'Gagner 5 parties' },
      { id:'w2', icon:'🎮', name:'Jouer 20 parties' },
      { id:'w3', icon:'💥', name:'Capturer 20 pions' },
      { id:'w4', icon:'🏅', name:'Gagner un tournoi' }
    ];

    this._renderMissions(dailyDefs, missions.daily, 'daily-missions');
    this._renderMissions(weeklyDefs, missions.weekly, 'weekly-missions');
  }

  _renderMissions(defs, data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = defs.map(def => {
      const m = data[def.id];
      const pct = Math.min((m.progress / m.goal) * 100, 100);
      return `
        <div class="mission-card ${m.done ? 'done' : ''}">
          <div class="mission-icon">${def.icon}</div>
          <div class="mission-info">
            <div class="mission-name">${def.name}</div>
            <div class="mission-progress">${Math.min(m.progress, m.goal)}/${m.goal}</div>
            <div class="mission-bar">
              <div class="mission-fill" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="mission-reward">${m.done ? '✅' : `+${m.reward} ${m.currency === 'coins' ? '🪙' : '💎'}`}</div>
        </div>
      `;
    }).join('');
  }

  // ─── STREAK ──────────────────────────────────────────────

  buildStreak() {
    const container = document.getElementById('streak-days');
    if (!container) return;

    const streak = state.getProgression().streak;
    container.innerHTML = '';

    for (let i = 1; i <= 7; i++) {
      const div = document.createElement('div');
      div.className = `streak-day ${i < streak ? 'done' : i === streak ? 'today' : 'todo'}`;
      div.textContent = i;
      container.appendChild(div);
    }
  }

  // ─── ACHIEVEMENTS ────────────────────────────────────────

  buildAchievements() {
    const container = document.getElementById('achievements-list');
    if (!container) return;

    const defs = [
      { id:'first_6',      icon:'6️⃣', name:'Premier Six',      desc:'Obtenir un 6 pour la première fois' },
      { id:'first_capture',icon:'💥', name:'Première Capture',  desc:'Capturer un pion adverse' },
      { id:'first_win',    icon:'🏆', name:'Première Victoire', desc:'Gagner ta première partie' },
      { id:'first_home',   icon:'🏁', name:'Pion Rentré',       desc:'Rentrer un pion au centre' },
      { id:'win_10',       icon:'👑', name:'Champion',          desc:'Gagner 10 parties' },
      { id:'capture_50',   icon:'🔥', name:'Prédateur',         desc:'Capturer 50 pions' },
      { id:'win_pi',       icon:'π',  name:'Millionnaire Pi',   desc:'Gagner 1 Pi au tournoi' },
      { id:'streak_7',     icon:'📅', name:'Fidèle',            desc:'7 jours consécutifs' },
      { id:'level_expert', icon:'💎', name:'Expert',            desc:'Atteindre niveau Expert' }
    ];

    const achievements = state.getAchievements();
    container.innerHTML = defs.map(a => `
      <div class="achievement-item ${achievements[a.id] ? 'done' : ''}">
        <div class="achievement-icon">${a.icon}</div>
        <div class="achievement-info">
          <div class="achievement-name">${a.name}</div>
          <div class="achievement-desc">${a.desc}</div>
        </div>
        <div style="font-size:18px;flex-shrink:0">${achievements[a.id] ? '✅' : '⬜'}</div>
      </div>
    `).join('');
  }

  _showAchievementUnlock(id) {
    const names = {
      first_6: 'Premier Six', first_capture: 'Première Capture',
      first_win: 'Première Victoire', win_10: 'Champion',
      streak_7: 'Fidèle', level_expert: 'Expert'
    };
    this.showToast(`🏆 Achievement : ${names[id] || id}`, 3000);
    soundEngine.play('bonus');
  }

  // ─── HISTORY ─────────────────────────────────────────────

  buildHistory() {
    const container = document.getElementById('history-list');
    if (!container) return;

    const history = state.getHistory();
    if (!history.length) {
      container.innerHTML = '<div class="empty-msg">Aucune partie jouée</div>';
      return;
    }

    const modes = { computer:'vs IA', local:'Local', tournament:'Tournoi π', quick:'Quick' };
    container.innerHTML = history.map(h => `
      <div class="history-item">
        <div class="history-result ${h.result}">${h.result === 'win' ? '🏆' : '💔'}</div>
        <div class="history-info">
          <div class="history-mode">${modes[h.mode] || h.mode}</div>
          <div class="history-date">${h.date}</div>
        </div>
        <div class="history-reward">
          ${h.coins ? '+' + h.coins + '🪙' : ''}
          ${h.pi ? '+' + h.pi + 'π' : ''}
        </div>
      </div>
    `).join('');
  }

  // ─── STATS ───────────────────────────────────────────────

  updateStats() {
    const stats = state.getStats();
    this._setText('stat-games',   stats.gamesPlayed);
    this._setText('stat-wins',    stats.wins);
    this._setText('stat-pi',      stats.piWon.toFixed(1) + 'π');
    this._setText('stat-captures',stats.captures);
    this._setText('stat-winrate', stats.winRate + '%');
    this._setText('stat-streak',  state.getProgression().streak);
  }

  // ─── MODE SELECTION ──────────────────────────────────────

  _openModeSelect(type) {
    this._selectedMode = type;
    this._selectedColor = 'red';
    this._selectedDiff = 'easy';
    this._selectedGameMode = 'classic';
    this._selectedPlayers = type === 'local' ? 2 : 3;

    const titles = {
      computer: '🤖 VS ORDINATEUR',
      local:    '👥 MULTIJOUEUR LOCAL',
      quick:    '⚡ QUICK MODE'
    };
    this._setText('mode-modal-title', titles[type]);

    const diffSection = document.getElementById('difficulty-section');
    if (diffSection) diffSection.style.display = type === 'computer' ? 'block' : 'none';

    this._resetColorSelection();
    this._updateCountButtons(type);
    this._goStep(1);
    document.getElementById('mode-modal')?.classList.add('show');
  }

  _openTournament() {
    if (!piService.isAuthenticated()) {
      this.showBalanceModal('Connecte ton wallet Pi pour les tournois');
      return;
    }
    this._setText('tournament-balance', piService.user?.piBalance?.toFixed(1) || '0.0');
    document.getElementById('tournament-modal')?.classList.add('show');
  }

  async _confirmTournament() {
    this._closeModal('tournament-modal');
    const result = await piService.payForTournament();
    if (result.success) {
      this._selectedMode = 'computer'; // Default
      this._openModeSelect('computer');
    }
  }

  _closeModeModal() {
    this._closeModal('mode-modal');
  }

  _goStep(n) {
    document.querySelectorAll('.mode-select-step').forEach((el, i) => {
      el.classList.toggle('active', i + 1 === n);
    });
  }

  _selectGameMode(mode) {
    this._selectedGameMode = mode;
    document.getElementById('opt-classic')?.classList.toggle('selected', mode === 'classic');
    document.getElementById('opt-quick')?.classList.toggle('selected', mode === 'quick');
  }

  _selectColor(c) {
    this._selectedColor = c;
    ['red','blue','green','yellow'].forEach(col => {
      document.getElementById(`col-${col}`)?.classList.toggle('selected', col === c);
    });
  }

  _selectDiff(d) {
    this._selectedDiff = d;
    ['easy','medium','hard'].forEach(diff => {
      document.getElementById(`diff-${diff}`)?.classList.toggle('selected', diff === d);
    });
  }

  _selectPlayerCount(n) {
    this._selectedPlayers = n;
    document.querySelectorAll('.count-btn').forEach(btn => {
      btn.classList.toggle('selected', parseInt(btn.dataset.n) === n);
    });
  }

  _resetColorSelection() {
    this._selectColor('red');
    this._selectDiff('easy');
    this._selectGameMode('classic');
  }

  _updateCountButtons(type) {
    const container = document.getElementById('player-count-btns');
    if (!container) return;

    const counts = type === 'local' ? [2,3,4] : [2,3,4];
    const defaultCount = type === 'local' ? 2 : 3;

    container.innerHTML = counts.map(n => `
      <button class="count-btn ${n === defaultCount ? 'selected' : ''}" 
              id="count-${n}" data-n="${n}">
        ${n}<span>joueurs</span>
      </button>
    `).join('');

    counts.forEach(n => {
      this._on(`count-${n}`, 'click', () => this._selectPlayerCount(n));
    });

    this._selectedPlayers = defaultCount;
  }

  _confirmStartGame() {
    this._closeModeModal();

    const allColors = ['red','blue','green','yellow'];
    const playerColors = [this._selectedColor];
    const aiColors = allColors.filter(c => c !== this._selectedColor);
    const aiProfile = getAIProfile(this._selectedDiff);

    const players = playerColors.map((color, idx) => ({
      color,
      name: piService.getUsername() || 'Toi',
      isHuman: true
    }));

    for (let i = 1; i < this._selectedPlayers; i++) {
      players.push({
        color: aiColors[i - 1],
        name: `${aiProfile.name} ${i}`,
        isHuman: false,
        difficulty: this._selectedDiff
      });
    }

    // For local mode, all players are human
    if (this._selectedMode === 'local') {
      for (let i = 1; i < this._selectedPlayers; i++) {
        players[i] = {
          color: aiColors[i - 1],
          name: `Joueur ${i + 1}`,
          isHuman: true
        };
      }
    }

    const pionSorti = document.getElementById('pion-sorti-opt')?.checked || false;

    this.app.startGame({
      mode: this._selectedMode,
      players,
      gameMode: this._selectedGameMode,
      startWithOnePion: pionSorti,
      isTournament: false
    });
  }

  // ─── ECONOMY ACTIONS ─────────────────────────────────────

  _claimBonus() {
    const result = state.claimDailyBonus();
    if (result.success) {
      this._setText('bonus-btn', '✅ RÉCLAMÉ');
      this.showToast('🎁 +300 PiCoins réclamés !');
      soundEngine.play('bonus');
    } else {
      this.showToast('✅ Bonus déjà réclamé aujourd\'hui !');
    }
  }

  _tryJackpot() {
    const prize = state.rollJackpot();
    this.showToast(`🎰 +${prize} PiCoins !`);
    soundEngine.play('victory');
  }

  async _rechargePi(piAmount, coins, gems) {
    if (!piService.isAuthenticated()) {
      this.showBalanceModal('Connecte ton wallet Pi pour recharger');
      return;
    }
    const result = await piService.payForRecharge(piAmount, coins, gems);
    if (result.success) {
      state.addCoins(coins);
      state.addGems(gems);
      this.showToast(`✅ +${coins ? coins + '🪙 ' : ''}${gems ? gems + '💎' : ''} ajoutés !`);

      if (piService.isAuthenticated()) {
        await firebaseService.saveUserProfile(
          piService.getUserId(),
          state.exportForFirebase()
        );
      }
    }
  }

  _buyArenaPass() {
    if (state.getEconomy().gems < 50) {
      this.showToast('❌ Il te faut 50 PiGems');
      return;
    }
    state.spendGems(50);
    this.showToast('🎫 Arena Pass Premium activé !');
  }

  setShopTab(tab) {
    ['coins','gems','pi'].forEach(t => {
      document.getElementById(`tab-${t}`)?.classList.toggle('active', t === tab);
      const section = document.getElementById(`shop-${t}`);
      if (section) section.style.display = t === tab ? 'block' : 'none';
    });
    soundEngine.play('click');
  }

  _updateShopBalance() {
    this._setText('pi-balance-shop', (piService.user?.piBalance || 0).toFixed(1));
  }

  // ─── SOUND CONTROLS ──────────────────────────────────────

  _toggleSound() {
    const settings = state.getSettings();
    const newVal = !settings.sound;
    state.updateSettings({ sound: newVal });
    soundEngine.setSoundEnabled(newVal);
    this._setText('sound-btn', newVal ? '🔊' : '🔇');
    this._setText('pause-sound-status', newVal ? 'Activé' : 'Désactivé');
  }

  _toggleMusic() {
    const settings = state.getSettings();
    const newVal = !settings.music;
    state.updateSettings({ music: newVal });
    soundEngine.setMusicEnabled(newVal);
    this._setText('pause-music-status', newVal ? 'Activée' : 'Désactivée');
  }

  // ─── EMOJI ───────────────────────────────────────────────

  _sendEmoji(emoji) {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; pointer-events:none;
      font-size:32px; z-index:300;
      left:${Math.random() * 60 + 20}%; top:60%;
      animation:float-up 1.5s ease-out forwards;
    `;
    el.textContent = emoji;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  // ─── TUTORIAL ────────────────────────────────────────────

  _nextTutorial() {
    this._tutorialStep++;
    if (this._tutorialStep > 3) {
      document.getElementById('tutorial-overlay')?.classList.remove('show');
      state.updateSettings({ tutorialDone: true });
      return;
    }
    this._updateTutorial();
  }

  _updateTutorial() {
    document.querySelectorAll('.tutorial-step').forEach((el, i) => {
      el.classList.toggle('active', i + 1 === this._tutorialStep);
    });
    document.querySelectorAll('.tutorial-dot').forEach((el, i) => {
      el.classList.toggle('active', i + 1 === this._tutorialStep);
    });
    const btn = document.getElementById('tut-next');
    if (btn) btn.textContent = this._tutorialStep === 3 ? '🎮 COMMENCER !' : 'SUIVANT →';
  }

  // ─── GAME ACTIONS ────────────────────────────────────────

  _resumeGame() {
    this._closeModal('pause-modal');
  }

  _confirmQuit() {
    this.app.quitGame();
  }

  _replayGame() {
    this._closeModal('victory-modal');
    this.app.startGame(this.app._gameConfig);
  }

  _shareVictory() {
    const text = `🏆 J'ai gagné sur PiArena ! Le meilleur Ludo sur Pi Network ! https://ulrich79-hub.github.io`;
    if (navigator.share) {
      navigator.share({ title: 'PiArena', text, url: 'https://ulrich79-hub.github.io' });
    } else {
      navigator.clipboard?.writeText(text);
      this.showToast('📋 Lien copié !');
    }
  }

  // ─── HOME LOGO ───────────────────────────────────────────

  _startHomeLogo() {
    const canvas = document.getElementById('home-logo-canvas');
    if (canvas) {
      this._logoStopFn = BoardRenderer.animateLogoCanvas(canvas);
    }
  }

  // ─── HELPERS ─────────────────────────────────────────────

  _closeModal(id) {
    document.getElementById(id)?.classList.remove('show');
  }

  _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  _setStyle(id, prop, value) {
    const el = document.getElementById(id);
    if (el) el.style[prop] = value;
  }

  _el(id) {
    return document.getElementById(id);
  }

  _updateCurrencies() {
    const eco = state.getEconomy();
    this._setText('tb-coins', eco.coins.toLocaleString());
    this._setText('tb-gems', eco.gems);
    this._setText('tb-pi', (state.getUser().piBalance || 0).toFixed(1));
  }

  _colorHex(color) {
    const map = { red:'#e74c3c', blue:'#2980b9', green:'#27ae60', yellow:'#f39c12' };
    return map[color] || '#fff';
  }
}
