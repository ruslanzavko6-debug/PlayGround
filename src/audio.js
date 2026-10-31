// Tiny procedural sound engine - no assets needed.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.7;
    this.muted = false;
    this.enabled = false;
    this.noise = null;
    this.nextChirp = 4;
    this.day = 1;
  }

  enable() {
    if (this.enabled) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise(1.5);
      this.enabled = true;
      this.startWind();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { /* audio is a nice-to-have */ }
  }

  makeNoise(seconds) {
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, rate * seconds, rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master && !this.muted) this.master.gain.value = v;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  startWind() {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.035;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    this.windGain = gain;
  }

  update(dt, sky) {
    if (!this.enabled) return;
    this.day = Math.max(0, Math.min(1, sky.sunDir.y * 3 + 0.3));
    if (this.windGain) {
      this.windGain.gain.value = 0.022 + this.day * 0.02;
    }
    this.nextChirp -= dt;
    if (this.nextChirp <= 0) {
      this.nextChirp = 6 + Math.random() * 12;
      if (this.day > 0.4) this.chirp();
    }
  }

  burst({ freq = 800, q = 0.8, dur = 0.12, gain = 0.18, type = 'bandpass', slide = 0 }) {
    if (!this.enabled || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(80, freq + slide), t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.9, dur + 0.02);
    src.stop(t + dur + 0.05);
  }

  tone({ freq = 440, dur = 0.14, gain = 0.12, type = 'sine', slide = 0 }) {
    if (!this.enabled || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(60, freq + slide), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  step(blockSound = 'grass') {
    const map = {
      grass: [900, 0.12, 0.1], dirt: [620, 0.12, 0.13], stone: [1500, 0.15, 0.11],
      sand: [1900, 0.1, 0.08], wood: [700, 0.14, 0.12], leaves: [1200, 0.12, 0.07],
      snow: [1100, 0.1, 0.07], gravel: [800, 0.14, 0.12], glass: [2200, 0.16, 0.07],
      plant: [1000, 0.1, 0.05], water: [500, 0.2, 0.12],
    };
    const [freq, dur, gain] = map[blockSound] || map.grass;
    this.burst({ freq, dur, gain, q: 1.1, slide: -freq * 0.35 });
  }

  dig(blockSound = 'stone') {
    const freq = blockSound === 'stone' ? 1800 : blockSound === 'wood' ? 900 : 1300;
    this.burst({ freq, dur: 0.055, gain: 0.06, q: 1.4, slide: -300 });
  }

  breakBlock(blockSound = 'stone') {
    const freq = blockSound === 'stone' ? 900 : blockSound === 'wood' ? 600 : 1100;
    this.burst({ freq, dur: 0.24, gain: 0.16, q: 0.7, slide: -freq * 0.55 });
    this.tone({ freq: 130, dur: 0.12, gain: 0.05, type: 'sine', slide: -50 });
  }

  place(blockSound = 'stone') {
    const freq = blockSound === 'wood' ? 520 : 780;
    this.burst({ freq, dur: 0.09, gain: 0.12, q: 0.9, slide: -200 });
    this.tone({ freq: 160, dur: 0.08, gain: 0.04, type: 'sine', slide: -40 });
  }

  splash() {
    this.burst({ freq: 700, dur: 0.38, gain: 0.12, q: 0.6, slide: -450, type: 'lowpass' });
  }

  jump() {
    this.burst({ freq: 480, dur: 0.1, gain: 0.045, q: 0.8, slide: 120 });
  }

  ui() {
    this.tone({ freq: 660, dur: 0.06, gain: 0.05, type: 'triangle' });
  }

  chirp() {
    const base = 1500 + Math.random() * 900;
    this.tone({ freq: base, dur: 0.09, gain: 0.025, type: 'sine', slide: 500 });
    setTimeout(() => this.tone({ freq: base + 260, dur: 0.08, gain: 0.02, type: 'sine', slide: -350 }), 120);
  }
}
