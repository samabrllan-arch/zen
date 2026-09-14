// ═══════════════════════════════════════════════════════
// ZEN AUDIO ENGINE — Web Audio API Synthesizer
// Generates relaxing, harmonic, melodic sounds for ball
// bounces and Conway's Game of Life events using
// curated pentatonic scales and stereo spatialization.
// ═══════════════════════════════════════════════════════

class ZenAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    
    this.isMuted = false;
    this.volume = 0.5;
    this.instrument = 'bells'; // 'bells', 'kalimba', 'bowls', 'crystal'
    this.spatialAudio = true;

    // Pentatonic & Zen scales (Hz)
    // Scale 1: Zen / Akebono (D4, E4, F4, A4, Bb4, D5, E5, F5, A5, Bb5, D6, E6)
    this.zenScale = [
      293.66, 329.63, 349.23, 440.0, 466.16,
      587.33, 659.25, 698.46, 880.0, 932.33,
      1174.66, 1318.51
    ];

    // Scale 2: Celestial Pentatonic Major (C4, D4, E4, G4, A4, C5, D5, E5, G5, A5, C6, D6)
    this.celestialScale = [
      261.63, 293.66, 329.63, 392.0, 440.0,
      523.25, 587.33, 659.25, 783.99, 880.0,
      1046.5, 1174.66
    ];

    // Scale 3: Golden Lotus (G3, C4, D4, Eb4, G4, Ab4, C5, D5, Eb5, G5, C6)
    this.lotusScale = [
      196.0, 261.63, 293.66, 311.13, 392.0,
      415.30, 523.25, 587.33, 622.25, 783.99, 1046.5
    ];

    // Throttle & polyphony voice limiter
    this.lastPlayTime = 0;
    this.minIntervalMs = 45; // prevent audio spamming on rapid collisions
    this.activeVoiceCount = 0;
    this.maxVoices = 10;
  }

  // Safe lazy init triggered on first user interaction
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Master dynamics compressor to prevent clipping when multiple balls hit simultaneously
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(24, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(8, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

      // Master gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume * 0.35, this.ctx.currentTime);

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  unlock() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : this.volume * 0.35,
        this.ctx.currentTime,
        0.02
      );
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(
        this.volume * 0.35,
        this.ctx.currentTime,
        0.02
      );
    }
  }

  setInstrument(name) {
    this.instrument = name;
  }

  setSpatialAudio(enabled) {
    this.spatialAudio = enabled;
  }

  // Plays a relaxing chime on ball bounce
  playBounce(x, y, radius, canvasWidth = window.innerWidth, minRadius = 6, maxRadius = 30) {
    if (this.isMuted || this.volume <= 0) return;
    this.init();
    if (!this.ctx || this.ctx.state !== 'running') return;

    const now = performance.now();
    if (now - this.lastPlayTime < this.minIntervalMs) return;
    if (this.activeVoiceCount >= this.maxVoices) return;
    this.lastPlayTime = now;

    // Pick scale according to instrument
    let scale = this.celestialScale;
    if (this.instrument === 'bowls' || this.instrument === 'zen') {
      scale = this.zenScale;
    } else if (this.instrument === 'kalimba') {
      scale = this.lotusScale;
    }

    // Map ball radius: smaller balls = higher delicate notes, larger balls = deeper bass bells
    const norm = 1 - Math.max(0, Math.min(1, (radius - minRadius) / (maxRadius - minRadius || 1)));
    const noteIdx = Math.floor(norm * (scale.length - 1));
    const baseFreq = scale[noteIdx] || 440;

    // Stereo panning based on X coordinate
    let panVal = 0;
    if (this.spatialAudio && canvasWidth > 0) {
      panVal = ((x / canvasWidth) * 2 - 1) * 0.75; // -0.75 to +0.75
    }

    this._synthesizeTone(baseFreq, panVal, this.instrument);
  }

  // Plays an ethereal ambient harmonic chime in Conway mode
  playLifeChime(aliveCount = 10, totalCells = 1000) {
    if (this.isMuted || this.volume <= 0) return;
    this.init();
    if (!this.ctx || this.ctx.state !== 'running') return;

    const now = performance.now();
    if (now - this.lastPlayTime < 90) return; // gentler rate for Conway
    if (this.activeVoiceCount >= this.maxVoices) return;
    this.lastPlayTime = now;

    const scale = this.zenScale;
    const ratio = Math.min(1, aliveCount / (totalCells * 0.25 || 100));
    const noteIdx = Math.floor(ratio * (scale.length - 1));
    const baseFreq = scale[noteIdx] || 523.25;

    this._synthesizeTone(baseFreq, (Math.random() * 0.8 - 0.4), 'crystal', 0.6);
  }

  _synthesizeTone(freq, pan = 0, type = 'bells', gainFactor = 1.0) {
    try {
      this.activeVoiceCount++;
      const ctx = this.ctx;
      const t = ctx.currentTime;

      // Panner
      let outNode = this.compressor;
      if (ctx.createStereoPanner && this.spatialAudio) {
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(pan, t);
        panner.connect(this.compressor);
        outNode = panner;
      }

      // Voice Gain Envelope
      const voiceGain = ctx.createGain();
      voiceGain.connect(outNode);

      // Instrument-specific sound synthesis
      let duration = 0.8;

      if (type === 'kalimba') {
        // Kalimba: warm triangle fundamental + soft transient overtone
        duration = 0.65;
        const osc1 = ctx.createOscillator();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, t);

        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2.98, t);

        const overtoneGain = ctx.createGain();
        overtoneGain.gain.setValueAtTime(0.18, t);
        overtoneGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc2.connect(overtoneGain);
        overtoneGain.connect(voiceGain);

        osc1.connect(voiceGain);

        voiceGain.gain.setValueAtTime(0.0001, t);
        voiceGain.gain.exponentialRampToValueAtTime(0.7 * gainFactor, t + 0.006);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + duration);
        osc2.stop(t + duration);

      } else if (type === 'bowls') {
        // Tibetan Singing Bowls: rich pure sines with slow beat frequency & long sustain
        duration = 1.6;
        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, t);

        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq + 1.2, t);

        osc1.connect(voiceGain);
        osc2.connect(voiceGain);

        voiceGain.gain.setValueAtTime(0.0001, t);
        voiceGain.gain.linearRampToValueAtTime(0.4 * gainFactor, t + 0.04);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + duration);
        osc2.stop(t + duration);

      } else if (type === 'crystal') {
        // Crystal Chime: sparkling high chime with shimmer
        duration = 0.9;
        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq * 1.5, t);

        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 3.01, t);

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(400, t);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(voiceGain);

        voiceGain.gain.setValueAtTime(0.0001, t);
        voiceGain.gain.exponentialRampToValueAtTime(0.45 * gainFactor, t + 0.004);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + duration);
        osc2.stop(t + duration);

      } else {
        // Default: Zen Bells
        duration = 0.95;
        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, t);

        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2.005, t);

        const osc3 = ctx.createOscillator();
        osc3.type = 'triangle';
        osc3.frequency.setValueAtTime(freq * 4.02, t);

        const g3 = ctx.createGain();
        g3.gain.setValueAtTime(0.12, t);
        g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        osc3.connect(g3);
        g3.connect(voiceGain);

        osc1.connect(voiceGain);
        osc2.connect(voiceGain);

        voiceGain.gain.setValueAtTime(0.0001, t);
        voiceGain.gain.exponentialRampToValueAtTime(0.55 * gainFactor, t + 0.005);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

        osc1.start(t);
        osc2.start(t);
        osc3.start(t);
        osc1.stop(t + duration);
        osc2.stop(t + duration);
        osc3.stop(t + duration);
      }

      setTimeout(() => {
        this.activeVoiceCount = Math.max(0, this.activeVoiceCount - 1);
      }, duration * 1000 + 50);

    } catch (err) {
      console.warn('Audio tone synthesis error:', err);
      this.activeVoiceCount = Math.max(0, this.activeVoiceCount - 1);
    }
  }
}

export const zenAudio = new ZenAudioEngine();
