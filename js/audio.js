// Tiny WebAudio synth for weapon, impact and UI sounds.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) {
      this.resume();
      return;
    }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    const len = Math.floor(this.ctx.sampleRate * 0.8);
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  ready() {
    return this.ctx && this.master && !this.muted;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  pan(value = 0) {
    const p = this.ctx.createStereoPanner?.();
    if (!p) return this.master;
    p.pan.value = Math.max(-0.9, Math.min(0.9, value));
    p.connect(this.master);
    return p;
  }

  env(duration, gain = 0.4) {
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0001, gain), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    return { g, t };
  }

  noiseHit(duration, freq, gain, pan = 0, type = 'lowpass') {
    if (!this.ready()) return;
    const { g, t } = this.env(duration, gain);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.25), t + duration);
    src.connect(f).connect(g).connect(this.pan(pan));
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  shoot(kind = 'ak', pan = 0, volume = 1) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime;
    const dur = kind === 'ak' ? 0.22 : 0.14;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = kind === 'ak' ? 1 : 1.35;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(kind === 'ak' ? 3800 : 5200, t);
    f.frequency.exponentialRampToValueAtTime(380, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.62 * volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.pan(pan));
    src.start(t);
    src.stop(t + dur);

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(kind === 'ak' ? 150 : 220, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + dur);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.5 * volume, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(og).connect(this.master);
    osc.start(t);
    osc.stop(t + dur);
  }

  enemyShot(pan = 0, dist = 8) {
    this.shoot('ak', pan, Math.max(0.18, 1 - dist / 26));
  }

  click(freq = 900, dur = 0.05, gain = 0.12, pan = 0) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.pan(pan));
    o.start(t);
    o.stop(t + dur);
  }

  reload(seconds = 2.2) {
    if (!this.ready()) return;
    this.click(520, 0.05, 0.1);
    this.after(seconds * 0.35, () => this.click(360, 0.07, 0.12));
    this.after(seconds * 0.7, () => this.click(720, 0.05, 0.1));
    this.after(Math.max(0.2, seconds - 0.18), () => this.click(980, 0.06, 0.13));
  }

  after(delay, fn) {
    if (!this.ctx) return;
    const time = delay * 1000;
    setTimeout(() => {
      if (this.ready()) fn();
    }, time);
  }

  hit(head = false) {
    this.click(head ? 1600 : 900, 0.04, 0.13);
    if (head) this.after(0.03, () => this.click(2100, 0.05, 0.1));
  }

  kill() {
    this.click(680, 0.06, 0.1);
    this.after(0.07, () => this.click(1020, 0.1, 0.09));
  }

  empty() {
    this.click(300, 0.04, 0.1);
  }

  knife() {
    this.noiseHit(0.12, 2400, 0.16, 0, 'bandpass');
  }

  hurt() {
    if (!this.ready()) return;
    this.noiseHit(0.24, 620, 0.3, 0, 'lowpass');
    this.click(120, 0.16, 0.14);
  }

  step(pan = 0) {
    this.noiseHit(0.06, 700, 0.05, pan);
  }

  roundStart() {
    if (!this.ready()) return;
    [523, 659, 784].forEach((f, i) => this.after(i * 0.11, () => this.click(f, 0.09, 0.08)));
  }

  win() {
    if (!this.ready()) return;
    [523, 659, 784, 1046].forEach((f, i) => this.after(i * 0.1, () => this.click(f, 0.14, 0.09)));
  }

  lose() {
    if (!this.ready()) return;
    [392, 330, 262, 196].forEach((f, i) => this.after(i * 0.16, () => this.click(f, 0.22, 0.1)));
  }

  ui() {
    this.click(760, 0.035, 0.06);
  }
}
