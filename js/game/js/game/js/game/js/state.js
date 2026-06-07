/**
 * PiArena - State Management
 * Single source of truth for all app state
 * @version 1.0.0
 */

'use strict';

// ============================================================
// DEFAULT STATE
// ============================================================

const DEFAULT_STATE = {
  // User
  user: {
    piUsername: null,
    piUserId: null,
    authenticated: false,
    piBalance: 0
  },

  // Economy
  economy: {
    coins: 500,
    gems: 10,
    inventory: [],
    lastBonus: null,
    lastJackpot: null
  },

  // Progression
  progression: {
    xp: 20,
    level: 1,
    streak: 0,
    lastLogin: null,
    passLevel: 1,
    passXP: 5,
    hasPremiumPass: false
  },

  // Stats
  stats: {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    captures: 0,
    sixes: 0,
    piWon: 0,
    winRate: 0
  },

  // Achievements
  achievements: {},

  // History (last 20 games)
  history: [],

  // Missions
  missions: {
    daily: {
      date: null,
      d1: { progress: 0, goal: 3,  reward: 100,  currency: 'coins', done: false },
      d2: { progress: 0, goal: 1,  reward: 200,  currency: 'coins', done: false },
      d3: { progress: 0, goal: 5,  reward: 50,   currency: 'coins', done: false },
      d4: { progress: 0, goal: 1,  reward: 20,   currency: 'coins', done: false },
      d5: { progress: 0, goal: 1,  reward: 30,   currency: 'coins', done: false }
    },
    weekly: {
      week: null,
      w1: { progress: 0, goal: 5,  reward: 500,  currency: 'coins', done: false },
      w2: { progress: 0, goal: 20, reward: 1000, currency: 'coins', done: false },
      w3: { progress: 0, goal: 20, reward: 200,  currency: 'gems',  done: false },
      w4: { progress: 0, goal: 1,  reward: 100,  currency: 'gems',  done: false }
    }
  },

  // Settings
  settings: {
    sound: true,
    music: true,
    vibration: true,
    language: 'fr',
    theme: 'default',
    tutorialDone: false
  },

  // Current game session (not persisted)
  session: {
    gameActive: false,
    gameMode: null,
    isTournament: false
  }
};

// ============================================================
// STATE MANAGER
// ============================================================

export class StateManager {
  constructor() {
    this._state = this._deepClone(DEFAULT_STATE);
    this._listeners = new Map();
    this._pendingSave = null;
  }

  // ─── INIT ────────────────────────────────────────────────

  init() {
    this._loadFromStorage();
    this._resetDailyMissions();
    this._resetWeeklyMissions();
    this._checkStreakReset();
  }

  // ─── GETTERS ─────────────────────────────────────────────

  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this._state);
  }

  getAll() {
    return this._deepClone(this._state);
  }

  getUser()        { return { ...this._state.user }; }
  getEconomy()     { return { ...this._state.economy }; }
  getProgression() { return { ...this._state.progression }; }
  getStats()       { return { ...this._state.stats }; }
  getSettings()    { return { ...this._state.settings }; }
  getMissions()    { return this._deepClone(this._state.missions); }
  getAchievements(){ return { ...this._state.achievements }; }
  getHistory()     { return [...this._state.history]; }

  // ─── SETTERS ─────────────────────────────────────────────

  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const obj = keys.reduce((o, k) => o[k], this._state);
    const oldValue = obj[lastKey];
    obj[lastKey] = value;
    this._emit(path, value, oldValue);
    this._scheduleSave();
  }

  update(path, updater) {
    const current = this.get(path);
    const next = updater(current);
    this.set(path, next);
  }

  // ─── USER ────────────────────────────────────────────────

  setUser(piUser) {
    this._state.user = {
      piUsername: piUser.username,
      piUserId: piUser.uid || piUser.username,
      authenticated: true,
      piBalance: this._state.user.piBalance
    };
    this._emit('user', this._state.user);
    this._scheduleSave();
  }

  setPiBalance(balance) {
    this.set('user.piBalance', balance);
  }

  // ─── ECONOMY ─────────────────────────────────────────────

  addCoins(amount) {
    if (amount <= 0) return false;
    this._state.economy.coins += amount;
    this._emit('economy.coins', this._state.economy.coins);
    this._scheduleSave();
    return true;
  }

  spendCoins(amount) {
    if (this._state.economy.coins < amount) return false;
    this._state.economy.coins -= amount;
    this._emit('economy.coins', this._state.economy.coins);
    this._scheduleSave();
    return true;
  }

  addGems(amount) {
    if (amount <= 0) return false;
    this._state.economy.gems += amount;
    this._emit('economy.gems', this._state.economy.gems);
    this._scheduleSave();
    return true;
  }

  spendGems(amount) {
    if (this._state.economy.gems < amount) return false;
    this._state.economy.gems -= amount;
    this._emit('economy.gems', this._state.economy.gems);
    this._scheduleSave();
    return true;
  }

  hasItem(itemId) {
    return this._state.economy.inventory.includes(itemId);
  }

  addItem(itemId) {
    if (!this.hasItem(itemId)) {
      this._state.economy.inventory.push(itemId);
      this._scheduleSave();
    }
  }

  claimDailyBonus() {
    const today = new Date().toDateString();
    if (this._state.economy.lastBonus === today) {
      return { success: false, reason: 'Already claimed today' };
    }
    this._state.economy.lastBonus = today;
    this.addCoins(300);
    this._incrementStreak();
    return { success: true, reward: 300 };
  }

  rollJackpot() {
    const prizes = [50, 100, 200, 500, 1000, 5000];
    const weights = [40, 25, 15, 10, 8, 2];
    const rand = Math.random() * 100;
    let cumulative = 0, prize = 50;
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (rand < cumulative) { prize = prizes[i]; break; }
    }
    this.addCoins(prize);
    return prize;
  }

  // ─── PROGRESSION ─────────────────────────────────────────

  addXP(amount) {
    this._state.progression.xp += amount;
    this._checkLevelUp();
    this._emit('progression', this._state.progression);
    this._scheduleSave();
  }

  _checkLevelUp() {
    const needed = this._state.progression.level * 100;
    if (this._state.progression.xp >= needed) {
      this._state.progression.level++;
      this._state.progression.xp -= needed;
      this._emit('levelUp', this._state.progression.level);
    }
  }

  _incrementStreak() {
    const today = new Date().toDateString();
    const last = this._state.progression.lastLogin;
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (last === yesterday) {
      this._state.progression.streak++;
    } else if (last !== today) {
      this._state.progression.streak = 1;
    }

    this._state.progression.lastLogin = today;

    if (this._state.progression.streak >= 7) {
      this.unlockAchievement('streak_7');
    }
    this._scheduleSave();
  }

  _checkStreakReset() {
    const today = new Date().toDateString();
    const last = this._state.progression.lastLogin;
    if (!last) return;

    const daysDiff = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
    if (daysDiff > 1) {
      this._state.progression.streak = 0;
      this._scheduleSave();
    }
  }

  getLevelName() {
    const level = this._state.progression.level;
    if (level < 3)  return { name: 'Débutant', emoji: '🌱' };
    if (level < 6)  return { name: 'Joueur',   emoji: '⭐' };
    if (level < 10) return { name: 'Expert',   emoji: '💎' };
    if (level < 15) return { name: 'Maître',   emoji: '👑' };
    return { name: 'Roi Pi', emoji: '🔱' };
  }

  // ─── STATS ───────────────────────────────────────────────

  recordGame(result) {
    const stats = this._state.stats;
    stats.gamesPlayed++;
    if (result.won) {
      stats.wins++;
      this.unlockAchievement('first_win');
      this.progressMission('d2');
      this.progressMission('w1');
    } else {
      stats.losses++;
    }
    stats.winRate = stats.gamesPlayed > 0
      ? Math.round((stats.wins / stats.gamesPlayed) * 100)
      : 0;

    stats.captures += result.captures || 0;
    stats.sixes += result.sixes || 0;
    if (result.piWon) stats.piWon += result.piWon;

    this.progressMission('d1');
    this.progressMission('w2');
    this.addXP(result.won ? 50 : 15);

    // Add to history
    this._state.history.unshift({
      result: result.won ? 'win' : 'lose',
      mode: result.mode,
      date: new Date().toLocaleDateString(),
      coins: result.won ? 500 : 100,
      pi: result.piWon || 0,
      duration: result.duration || 0
    });
    if (this._state.history.length > 20) this._state.history.pop();

    if (stats.wins >= 10) this.unlockAchievement('win_10');
    if (stats.captures >= 50) this.unlockAchievement('capture_50');

    this._emit('stats', stats);
    this._scheduleSave();
  }

  recordCapture() {
    this._state.stats.captures++;
    this.progressMission('d3');
    this.progressMission('w3');
    this.unlockAchievement('first_capture');
    this._scheduleSave();
  }

  recordSix() {
    this._state.stats.sixes++;
    this.progressMission('d4');
    this.unlockAchievement('first_6');
    this._scheduleSave();
  }

  // ─── ACHIEVEMENTS ────────────────────────────────────────

  unlockAchievement(id) {
    if (this._state.achievements[id]) return false;
    this._state.achievements[id] = { unlockedAt: Date.now() };
    this._emit('achievement', id);
    this._scheduleSave();
    return true;
  }

  hasAchievement(id) {
    return !!this._state.achievements[id];
  }

  // ─── MISSIONS ────────────────────────────────────────────

  progressMission(id) {
    const category = id.startsWith('d') ? 'daily' : 'weekly';
    const mission = this._state.missions[category][id];
    if (!mission || mission.done) return;

    mission.progress++;
    if (mission.progress >= mission.goal) {
      mission.done = true;
      this._rewardMission(mission);
    }
    this._emit('missions', this._state.missions);
    this._scheduleSave();
  }

  _rewardMission(mission) {
    if (mission.currency === 'coins') this.addCoins(mission.reward);
    else if (mission.currency === 'gems') this.addGems(mission.reward);
  }

  _resetDailyMissions() {
    const today = new Date().toDateString();
    if (this._state.missions.daily.date !== today) {
      const daily = this._state.missions.daily;
      daily.date = today;
      ['d1','d2','d3','d4','d5'].forEach(id => {
        daily[id].progress = 0;
        daily[id].done = false;
      });
      this._scheduleSave();
    }
  }

  _resetWeeklyMissions() {
    const week = this._getWeekKey();
    if (this._state.missions.weekly.week !== week) {
      const weekly = this._state.missions.weekly;
      weekly.week = week;
      ['w1','w2','w3','w4'].forEach(id => {
        weekly[id].progress = 0;
        weekly[id].done = false;
      });
      this._scheduleSave();
    }
  }

  _getWeekKey() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil((((now - start) / 86400000) + start.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${week}`;
  }

  // ─── SETTINGS ────────────────────────────────────────────

  updateSettings(partial) {
    Object.assign(this._state.settings, partial);
    this._emit('settings', this._state.settings);
    this._scheduleSave();
  }

  // ─── PERSISTENCE ─────────────────────────────────────────

  _scheduleSave() {
    if (this._pendingSave) clearTimeout(this._pendingSave);
    this._pendingSave = setTimeout(() => this._saveToStorage(), 500);
  }

  _saveToStorage() {
    try {
      const { session, ...persistable } = this._state;
      localStorage.setItem('piArena_state_v2', JSON.stringify(persistable));
    } catch(e) {
      console.warn('State save failed:', e);
    }
  }

  _loadFromStorage() {
    try {
      const raw = localStorage.getItem('piArena_state_v2');
      if (raw) {
        const saved = JSON.parse(raw);
        this._deepMerge(this._state, saved);
      }
    } catch(e) {
      console.warn('State load failed:', e);
    }
  }

  exportForFirebase() {
    const s = this._state;
    return {
      username: s.user.piUsername,
      level: s.progression.level,
      xp: s.progression.xp,
      streak: s.progression.streak,
      coins: s.economy.coins,
      gems: s.economy.gems,
      gamesPlayed: s.stats.gamesPlayed,
      wins: s.stats.wins,
      captures: s.stats.captures,
      piWon: s.stats.piWon,
      updatedAt: Date.now()
    };
  }

  importFromFirebase(data) {
    if (!data) return;
    if (data.level > this._state.progression.level) {
      this._state.progression.level = data.level;
      this._state.progression.xp = data.xp;
    }
    if (data.coins > this._state.economy.coins) this._state.economy.coins = data.coins;
    if (data.gems > this._state.economy.gems) this._state.economy.gems = data.gems;
    this._state.stats.gamesPlayed = Math.max(this._state.stats.gamesPlayed, data.gamesPlayed || 0);
    this._state.stats.wins = Math.max(this._state.stats.wins, data.wins || 0);
    this._state.stats.captures = Math.max(this._state.stats.captures, data.captures || 0);
    this._scheduleSave();
  }

  // ─── EVENTS ──────────────────────────────────────────────

  on(event, listener) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(listener);
    return () => this.off(event, listener);
  }

  off(event, listener) {
    const ls = this._listeners.get(event);
    if (ls) {
      const i = ls.indexOf(listener);
      if (i !== -1) ls.splice(i, 1);
    }
  }

  _emit(event, ...args) {
    (this._listeners.get(event) || []).forEach(fn => {
      try { fn(...args); } catch(e) { console.error(`State event [${event}]:`, e); }
    });
    (this._listeners.get('*') || []).forEach(fn => {
      try { fn(event, ...args); } catch(e) {}
    });
  }

  // ─── UTILS ───────────────────────────────────────────────

  _deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  _deepMerge(target, source) {
    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        this._deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    });
  }
}

// Singleton
export const state = new StateManager();
