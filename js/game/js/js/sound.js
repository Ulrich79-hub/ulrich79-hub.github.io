/**
 * PiArena - Sound Engine
 * Web Audio API based sound system
 * @version 1.0.0
 */

'use strict';

export class SoundEngine {
  constructor() {
    this._ctx = null;
    this._soundEnabled = true;
    this._musicEnabled = true;
    this._musicNode = null;
    this._musicTimeout = null;
    this._volume = 0.7;
  }

  _getCtx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this._ctx;
  }

  setSoundEnabled(v) { this._soundEnabled = v; }
  setMusicEnabled(v) { this._musicEnabled = v; if (v) this.startMusic(); else this.stopMusic(); }
  setVolume(v) { this._volume = Math.max(0, Math.min(1, v)); }

  play(type) {
    if (!this._soundEnabled) return;
    try {
      const ac = this._getCtx();
      const sounds = {
        roll:     () => this._tone(ac, 'sawtooth', 200, 50, 0.3, 0.3, 0),
        six:      () => this._chord(ac, [523, 659, 784], 'sine', 0.3),
        move:     () => this._tone(ac, 'sine', 440, 440, 0.15, 0.1, 0),
        step:     () => this._tone(ac, 'triangle', 600, 600, 0.08, 0.05, 0),
        capture:  () => this._tone(ac, 'sawtooth', 800, 100, 0.4, 0.4, 0),
        home:     () => this._chord(ac, [523, 659, 784, 1047], 'sine', 0.25),
        victory:  () => this._chord(ac, [523, 659, 784, 1047, 1318], 'sine', 0.35),
        alert:    () => this._tone(ac, 'square', 880, 880, 0.15, 0.1, 0),
        cantmove: () => this._tone(ac, 'sawtooth', 200, 100, 0.15, 0.2, 0),
        powerup:  () => this._tone(ac, 'sine', 300, 1200, 0.25, 0.3, 0),
        bonus:    () => this._chord(ac, [440, 554, 659], 'sine', 0.2),
        click:    () => this._tone(ac, 'sine', 1000, 1000, 0.1, 0.05, 0),
        error:    () => this._tone(ac, 'sawtooth', 150, 100, 0.2, 0.15, 0)
      };
      if (sounds[type]) sounds[type]();
    } catch(e) {}
  }

  _tone(ac, type, freqStart, freqEnd, gain, duration, delay) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.connect(g);
    g.connect(ac.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, ac.currentTime + delay);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(freqEnd, 20), ac.currentTime + delay + duration
      );
    }

    g.gain.setValueAtTime(gain * this._volume, ac.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + duration);

    osc.start(ac.currentTime + delay);
    osc.stop(ac.currentTime + delay + duration + 0.01);
  }

  _chord(ac, frequencies, type, gain) {
    frequencies.forEach((freq, i) => {
      const delay = i * 0.1;
      this._tone(ac, type, freq, freq, gain, 0.35, delay);
    });
  }

  startMusic() {
    if (!this._musicEnabled) return;
    if (this._musicTimeout) return; // Already playing

    const notes = [261, 294, 329, 349, 392, 440, 392, 349, 329, 294];
    let index = 0;

    const playNext = () => {
      if (!this._musicEnabled) return;
      try {
        const ac = this._getCtx();
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.connect(g);
        g.connect(ac.destination);
        osc.type = 'sine';
        osc.frequency.value = notes[index % notes.length];
        g.gain.setValueAtTime(0.035 * this._volume, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.65);
        osc.start();
        osc.stop(ac.currentTime + 0.65);
        index++;
      } catch(e) {}

      if (this._musicEnabled) {
        this._musicTimeout = setTimeout(playNext, 700);
      }
    };

    setTimeout(playNext, 1000);
  }

  stopMusic() {
    if (this._musicTimeout) {
      clearTimeout(this._musicTimeout);
      this._musicTimeout = null;
    }
  }

  vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }
}

export const soundEngine = new SoundEngine();
