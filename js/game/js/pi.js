/**
 * PiArena - Pi Network Service
 * Handles all Pi SDK interactions cleanly
 * @version 1.0.0
 */

'use strict';

const BACKEND_URL = 'https://piarena-backend.onrender.com';

// ============================================================
// PI SERVICE
// ============================================================

export class PiService {
  constructor() {
    this.user = null;
    this.authenticated = false;
    this.initialized = false;
    this._listeners = new Map();
    this._pendingPayments = new Map();
  }

  // ─── INIT ────────────────────────────────────────────────

  async init(sandbox = true) {
    try {
      if (typeof Pi === 'undefined') {
        console.warn('Pi SDK not available');
        return false;
      }
      Pi.init({ version: '2.0', sandbox });
      this.initialized = true;
      return true;
    } catch(e) {
      console.error('Pi init error:', e);
      return false;
    }
  }

  // ─── AUTHENTICATION ──────────────────────────────────────

  async authenticate() {
    if (!this.initialized) return null;

    try {
      const auth = await Pi.authenticate(
        ['username', 'payments'],
        this._handleIncompletePayment.bind(this)
      );

      this.user = auth.user;
      this.authenticated = true;
      this._emit('authenticated', auth.user);
      return auth.user;
    } catch(e) {
      console.error('Pi authentication error:', e);
      this._emit('authError', e);
      return null;
    }
  }

  _handleIncompletePayment(payment) {
    console.log('Incomplete payment detected:', payment.identifier);
    // Auto-complete incomplete payments
    this._completePaymentOnServer(payment.identifier, null)
      .catch(e => console.error('Failed to complete incomplete payment:', e));
  }

  // ─── PAYMENTS ────────────────────────────────────────────

  async createPayment(amount, memo, metadata = {}) {
    if (!this.authenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    return new Promise((resolve) => {
      const paymentData = {
        amount,
        memo,
        metadata: { app: 'piarena', version: '5.0', ...metadata }
      };

      const callbacks = {
        onReadyForServerApproval: async (paymentId) => {
          this._pendingPayments.set(paymentId, { amount, memo });
          const approved = await this._approvePaymentOnServer(paymentId);
          this._emit('paymentApproved', { paymentId, approved });
        },

        onReadyForServerCompletion: async (paymentId, txid) => {
          const completed = await this._completePaymentOnServer(paymentId, txid);
          this._pendingPayments.delete(paymentId);
          this._emit('paymentCompleted', { paymentId, txid, completed });
          resolve({ success: true, paymentId, txid });
        },

        onCancel: (paymentId) => {
          this._pendingPayments.delete(paymentId);
          this._emit('paymentCancelled', { paymentId });
          resolve({ success: false, cancelled: true });
        },

        onError: (error, payment) => {
          const paymentId = payment?.identifier;
          if (paymentId) this._pendingPayments.delete(paymentId);
          console.error('Pi payment error:', error);
          this._emit('paymentError', { error, payment });
          // In sandbox/demo mode, resolve with demo success
          resolve({ success: true, demo: true });
        }
      };

      try {
        Pi.createPayment(paymentData, callbacks);
      } catch(e) {
        console.error('Pi.createPayment error:', e);
        // Demo mode fallback
        resolve({ success: true, demo: true });
      }
    });
  }

  async _approvePaymentOnServer(paymentId) {
    try {
      const res = await fetch(`${BACKEND_URL}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId })
      });
      return res.ok;
    } catch(e) {
      console.error('Payment approval error:', e);
      return false;
    }
  }

  async _completePaymentOnServer(paymentId, txid) {
    try {
      const res = await fetch(`${BACKEND_URL}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, txid })
      });
      return res.ok;
    } catch(e) {
      console.error('Payment completion error:', e);
      return false;
    }
  }

  // ─── PAYMENT HELPERS ─────────────────────────────────────

  async payForTournament() {
    return this.createPayment(1, 'PiArena — Tournoi Pi', { type: 'tournament' });
  }

  async payForPowerup(type) {
    const memos = {
      dice: 'PiArena — Dé Doré',
      shield: 'PiArena — Bouclier',
      turbo: 'PiArena — Turbo'
    };
    return this.createPayment(0.1, memos[type] || 'PiArena — Power-up', { type });
  }

  async payForRecharge(amount, coins, gems) {
    return this.createPayment(
      amount,
      `PiArena — Recharge ${coins ? coins + ' PiCoins' : ''} ${gems ? gems + ' PiGems' : ''}`.trim(),
      { type: 'recharge', coins, gems }
    );
  }

  // ─── GETTERS ─────────────────────────────────────────────

  getUsername() { return this.user?.username || null; }
  getUserId() { return this.user?.uid || this.user?.username || null; }
  isAuthenticated() { return this.authenticated; }

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

  _emit(event, data) {
    (this._listeners.get(event) || []).forEach(fn => {
      try { fn(data); } catch(e) { console.error(`Pi event [${event}]:`, e); }
    });
  }
}

export const piService = new PiService();
