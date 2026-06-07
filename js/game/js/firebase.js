/**
 * PiArena - Firebase Service
 * All Firebase/Firestore operations
 * @version 1.0.0
 */

'use strict';

// ============================================================
// FIREBASE CONFIG
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaS0pUMInpPZtG63tVXZ5L6MAja72gUPhdY-Y",
  authDomain: "piarena-603c4.firebaseapp.com",
  projectId: "piarena-603c4",
  storageBucket: "piarena-603c4.firebasestorage.app",
  messagingSenderId: "132766086542",
  appId: "1:132766086542:web:07aee9a45f2cff64f1206f"
};

// ============================================================
// FIREBASE SERVICE
// ============================================================

export class FirebaseService {
  constructor() {
    this.db = null;
    this.initialized = false;
    this._unsubscribers = [];
  }

  async init() {
    try {
      if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK not loaded');
        return false;
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }

      this.db = firebase.firestore();
      this.initialized = true;
      console.log('✅ Firebase initialized');
      return true;
    } catch(e) {
      console.error('Firebase init error:', e);
      return false;
    }
  }

  // ─── USER PROFILE ────────────────────────────────────────

  async saveUserProfile(userId, data) {
    if (!this.initialized) return false;
    try {
      await this.db.collection('users').doc(userId).set({
        ...data,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return true;
    } catch(e) {
      console.error('saveUserProfile error:', e);
      return false;
    }
  }

  async loadUserProfile(userId) {
    if (!this.initialized) return null;
    try {
      const doc = await this.db.collection('users').doc(userId).get();
      return doc.exists ? doc.data() : null;
    } catch(e) {
      console.error('loadUserProfile error:', e);
      return null;
    }
  }

  // ─── LEADERBOARD ─────────────────────────────────────────

  async getLeaderboard(metric = 'wins', limit = 10) {
    if (!this.initialized) return [];
    try {
      const snap = await this.db.collection('users')
        .orderBy(metric, 'desc')
        .limit(limit)
        .get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch(e) {
      console.error('getLeaderboard error:', e);
      return [];
    }
  }

  subscribeLeaderboard(callback, metric = 'wins', limit = 10) {
    if (!this.initialized) return () => {};
    const unsub = this.db.collection('users')
      .orderBy(metric, 'desc')
      .limit(limit)
      .onSnapshot(snap => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
      }, err => console.error('Leaderboard subscription error:', err));
    this._unsubscribers.push(unsub);
    return unsub;
  }

  // ─── GAME HISTORY ────────────────────────────────────────

  async saveGameResult(userId, result) {
    if (!this.initialized) return false;
    try {
      await this.db.collection('users').doc(userId)
        .collection('history')
        .add({
          ...result,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      return true;
    } catch(e) {
      console.error('saveGameResult error:', e);
      return false;
    }
  }

  async getGameHistory(userId, limit = 10) {
    if (!this.initialized) return [];
    try {
      const snap = await this.db.collection('users').doc(userId)
        .collection('history')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();
      return snap.docs.map(doc => doc.data());
    } catch(e) {
      console.error('getGameHistory error:', e);
      return [];
    }
  }

  // ─── TOURNAMENTS ─────────────────────────────────────────

  async createTournament(tournamentData) {
    if (!this.initialized) return null;
    try {
      const ref = await this.db.collection('tournaments').add({
        ...tournamentData,
        status: 'waiting',
        players: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return ref.id;
    } catch(e) {
      console.error('createTournament error:', e);
      return null;
    }
  }

  async joinTournament(tournamentId, userId, username) {
    if (!this.initialized) return false;
    try {
      await this.db.collection('tournaments').doc(tournamentId).update({
        players: firebase.firestore.FieldValue.arrayUnion({ userId, username })
      });
      return true;
    } catch(e) {
      console.error('joinTournament error:', e);
      return false;
    }
  }

  // ─── ONLINE PLAYER COUNT ─────────────────────────────────

  async updatePresence(userId, username) {
    if (!this.initialized) return;
    try {
      await this.db.collection('presence').doc(userId).set({
        username,
        online: true,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch(e) {}
  }

  async getOnlineCount() {
    if (!this.initialized) return 0;
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const snap = await this.db.collection('presence')
        .where('online', '==', true)
        .where('lastSeen', '>=', fiveMinutesAgo)
        .get();
      return snap.size;
    } catch(e) {
      return 0;
    }
  }

  // ─── REPORTING ───────────────────────────────────────────

  async reportIssue(userId, type, description) {
    if (!this.initialized) return false;
    try {
      await this.db.collection('reports').add({
        userId, type, description,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending'
      });
      return true;
    } catch(e) {
      return false;
    }
  }

  // ─── CLEANUP ─────────────────────────────────────────────

  cleanup() {
    this._unsubscribers.forEach(fn => fn());
    this._unsubscribers = [];
  }
}

export const firebaseService = new FirebaseService();
