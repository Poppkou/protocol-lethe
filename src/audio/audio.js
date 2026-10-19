// Звуковой движок «Леты» на Web Audio API.
// Всё синтезируется на лету — файлы не нужны. Записанную озвучку можно
// подложить в public/audio/voice (см. README), тогда она заменит синтез речи.
//
// Шины: sys (Система — сухо, по центру), mem (воспоминания — кафельный зал),
// ent (сущность — HRTF за спиной), amb (атмосфера), ui, tac (ощущаемый бас).

import { rand } from '../core/dom.js';
import { MELODY, CHORDS, mtof } from './song.js';

const AC = window.AudioContext || window.webkitAudioContext;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.loops = new Map();
    this.files = new Map();
  }

  get ready() {
    return !!this.ctx;
  }

  now() {
    return this.ctx.currentTime;
  }

  async init() {
    if (!AC) return false;
    if (!this.ctx) this.build();
    try {
      await this.ctx.resume();
    } catch {
      // на некоторых WebView resume() бросает до первого жеста — повторим позже
    }
    return true;
  }

  async resume() {
    if (this.ctx && this.ctx.state !== 'running') {
      try { await this.ctx.resume(); } catch { /* не критично */ }
    }
  }

  build() {
    const ctx = (this.ctx = new AC({ latencyHint: 'interactive' }));
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 2;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    this.master = this.gain(0.9);
    this.master.connect(limiter);
    limiter.connect(ctx.destination);

    const bus = (g, dest = this.master) => {
      const n = this.gain(g);
      n.connect(dest);
      return n;
    };
    this.bus = {
      sys: bus(0.9),
      ui: bus(0.5),
      amb: bus(0.8),
      ent: bus(1),
      mem: bus(0.85),
    };
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeIR(2.8, 2.4);
    this.reverb.connect(bus(0.5));
    const tacLP = this.filt('lowpass', 260);
    tacLP.connect(this.master);
    this.bus.tac = bus(1, tacLP);
    this.noise = this.makeNoise(4);
  }

  // ---------- кирпичики ----------
  gain(v = 1) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return g;
  }

  filt(type, f, q = 0.7) {
    const b = this.ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  }

  osc(type, f) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    return o;
  }

  noiseSrc(loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    return s;
  }

  // Однократный шум: старт в момент t, длительность dur.
  noiseShot(dest, t, dur) {
    const s = this.noiseSrc(false);
    s.connect(dest);
    s.start(t, Math.random() * Math.max(0, 3.8 - dur), dur + 0.05);
    return s;
  }

  // Бинауральный источник. Слушатель смотрит в -Z: x — вправо, y — вверх, z>0 — за спиной.
  panner(x = 0, y = 0, z = -1) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 0.4;
    p.rolloffFactor = 0.6;
    this.place(p, x, y, z);
    return p;
  }

  place(p, x, y, z) {
    if (p.positionX) {
      p.positionX.value = x;
      p.positionY.value = y;
      p.positionZ.value = z;
    } else {
      p.setPosition(x, y, z);
    }
  }

  toMem(node, wet = 0.6) {
    node.connect(this.bus.mem);
    const s = this.gain(wet);
    node.connect(s);
    s.connect(this.reverb);
  }

  makeNoise(sec) {
    const len = Math.floor(this.ctx.sampleRate * sec);
    const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  // Импульсная характеристика кафельного бассейна: длинный яркий хвост.
  makeIR(sec, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * sec);
    const b = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < rate * 0.012 ? 0 : 1);
      }
      for (let k = 0; k < 6; k++) {
        const at = Math.floor(rate * rand(0.015, 0.09));
        d[at] += rand(0.3, 0.7) * (Math.random() < 0.5 ? -1 : 1);
      }
    }
    return b;
  }

  // ---------- петли (зацикленные звуки с плавной остановкой) ----------
  loop(name, scope, builder) {
    if (!this.ctx) return null;
    this.stopLoop(name, 0.03);
    const L = { name, scope, out: this.gain(1), srcs: [], timers: [], extra: [] };
    L.start = (n, t) => { n.start(t ?? 0); L.srcs.push(n); return n; };
    L.every = (ms, fn) => { const id = setInterval(fn, ms); L.timers.push(id); return id; };
    L.later = (ms, fn) => { const id = setTimeout(fn, ms); L.timers.push(id); return id; };
    L.onStop = (fn) => L.extra.push(fn);
    builder(L);
    this.loops.set(name, L);
    return L;
  }

  stopLoop(name, fade = 0.4) {
    const L = this.loops.get(name);
    if (!L) return;
    this.loops.delete(name);
    const t = this.now();
    try {
      L.out.gain.cancelScheduledValues(t);
      L.out.gain.setValueAtTime(L.out.gain.value, t);
      L.out.gain.linearRampToValueAtTime(0, t + fade);
    } catch { /* узел уже отключён */ }
    L.timers.forEach((id) => { clearInterval(id); clearTimeout(id); });
    setTimeout(() => {
      L.srcs.forEach((s) => { try { s.stop(); } catch { /* уже остановлен */ } });
      L.extra.forEach((f) => { try { f(); } catch { /* ignore */ } });
      try { L.out.disconnect(); } catch { /* ignore */ }
    }, fade * 1000 + 80);
  }

  stopScope(scope, fade = 0.4) {
    for (const [name, L] of [...this.loops]) if (L.scope === scope) this.stopLoop(name, fade);
  }

  stopAll(fade = 0.02) {
    for (const name of [...this.loops.keys()]) this.stopLoop(name, fade);
  }

  // Мёртвая тишина: всё обрывается мгновенно.
  silence() {
    this.stopAll(0.01);
  }

  // ---------- фон ----------
  // Еле слышный гул «холодильника» с самого начала. Его замечают, только когда он исчезает.
  hum(on) {
    if (!this.ctx) return;
    if (!on) return this.stopLoop('hum', 0.01);
    if (this.loops.has('hum')) return;
    this.loop('hum', 'global', (L) => {
      L.out.connect(this.master);
      for (const [f, g] of [[50, 0.0045], [100, 0.0025], [150, 0.0016], [250, 0.0006]]) {
        const o = this.osc('sine', f);
        o.connect(this.gain(g)).connect(L.out);
        L.start(o);
      }
      const n = this.noiseSrc();
      n.connect(this.filt('lowpass', 180)).connect(this.gain(0.006)).connect(L.out);
      L.start(n);
    });
  }

  rain(on, { level = 0.5, muffled = false, scope = 'scene' } = {}) {
    if (!this.ctx) return;
    if (!on) return this.stopLoop('rain', 1.2);
    this.loop('rain', scope, (L) => {
      L.out.gain.value = 0;
      L.out.gain.linearRampToValueAtTime(level, this.now() + 1.5);
      L.out.connect(this.bus.amb);
      const n = this.noiseSrc();
      n.connect(this.filt('highpass', 500))
        .connect(this.filt('lowpass', muffled ? 1100 : 7000))
        .connect(this.gain(0.16))
        .connect(L.out);
      L.start(n);
      const n2 = this.noiseSrc();
      n2.connect(this.filt('lowpass', 320)).connect(this.gain(0.25)).connect(L.out);
      L.start(n2);
      L.every(45, () => { if (Math.random() < 0.55) this.drop(L.out, muffled); });
    });
  }

  drop(dest, muffled) {
    const t = this.now() + Math.random() * 0.04;
    const g = this.gain(0);
    g.connect(dest);
    g.gain.setValueAtTime(rand(0.05, 0.22), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    const bp = this.filt('bandpass', rand(1500, 6000) * (muffled ? 0.3 : 1), 3);
    bp.connect(g);
    this.noiseShot(bp, t, 0.05);
  }

  // Пешеходный светофор: метроном тревоги. Справа впереди, на улице.
  ticker(on, { rate = 0.55, level = 0.16 } = {}) {
    if (!this.ctx) return;
    if (!on) return this.stopLoop('ticker', 0.04);
    if (this.loops.has('ticker')) return;
    this.loop('ticker', 'global', (L) => {
      L.out.gain.value = level;
      L.out.connect(this.filt('lowpass', 3600)).connect(this.panner(1.6, 0.2, -2.6)).connect(this.bus.amb);
      let next = this.now() + 0.1;
      L.every(50, () => {
        while (next < this.now() + 0.25) {
          this.tickClick(L.out, next);
          next += rate;
        }
      });
    });
  }

  tickClick(dest, t) {
    const o = this.osc('square', 1050);
    const g = this.gain(0);
    o.connect(g).connect(dest);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
    o.start(t);
    o.stop(t + 0.02);
    const g2 = this.gain(0);
    g2.connect(dest);
    g2.gain.setValueAtTime(0.4, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.008);
    const bp = this.filt('bandpass', 2800, 2);
    bp.connect(g2);
    this.noiseShot(bp, t, 0.012);
  }

  // Атмосфера для голосовых сообщений.
  amb(kind) {
    if (!this.ctx) return;
    if (!kind) return this.stopLoop('amb', 0.8);
    this.loop('amb', 'scene', (L) => {
      L.out.gain.value = 0;
      L.out.gain.linearRampToValueAtTime(1, this.now() + 0.6);
      const out = L.out;
      if (kind === 'pool') {
        const n = this.noiseSrc();
        n.connect(this.filt('lowpass', 1100)).connect(this.gain(0.05)).connect(out);
        L.start(n);
        this.toMem(out, 0.9);
        L.every(1700, () => {
          if (Math.random() < 0.7) {
            const t = this.now();
            const g = this.gain(0);
            g.connect(out);
            g.gain.setValueAtTime(rand(0.05, 0.14), t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
            const bp = this.filt('bandpass', rand(500, 1300), 1);
            bp.connect(g);
            this.noiseShot(bp, t, 0.4);
          }
        });
      } else if (kind === 'dryer') {
        const n = this.noiseSrc();
        n.connect(this.filt('bandpass', 1400, 0.8)).connect(this.gain(0.11)).connect(out);
        L.start(n);
        const o = this.osc('sawtooth', 212);
        o.connect(this.filt('lowpass', 800)).connect(this.gain(0.012)).connect(out);
        L.start(o);
        this.toMem(out, 0.35);
      } else if (kind === 'hall') {
        const n = this.noiseSrc();
        n.connect(this.filt('lowpass', 300)).connect(this.gain(0.06)).connect(out);
        L.start(n);
        this.toMem(out, 1);
        L.later(1200, () => this.thump(0.6, { f0: 90, f1: 45, dest: out }));
      } else if (kind === 'rain' || kind === 'street') {
        out.connect(this.bus.amb);
        const n = this.noiseSrc();
        n.connect(this.filt('highpass', 400)).connect(this.filt('lowpass', 5500)).connect(this.gain(kind === 'street' ? 0.2 : 0.12)).connect(out);
        L.start(n);
        L.every(50, () => { if (Math.random() < 0.6) this.drop(out, false); });
        if (kind === 'street') {
          L.every(6500, () => { if (Math.random() < 0.6) this.carPass(out); });
        }
      }
    });
  }

  carPass(dest) {
    const t = this.now();
    const p = this.panner(-4, 0, -3);
    const g = this.gain(0);
    const lp = this.filt('lowpass', 600);
    lp.connect(g).connect(p).connect(dest);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 1.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    if (p.positionX) {
      p.positionX.setValueAtTime(-5, t);
      p.positionX.linearRampToValueAtTime(5, t + 3);
    }
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.linearRampToValueAtTime(1600, t + 1.4);
    lp.frequency.linearRampToValueAtTime(400, t + 3);
    this.noiseShot(lp, t, 3.1);
  }

  // ---------- удары и сердце ----------
  thump(strength = 1, { when = 0, f0 = 62, f1 = 38, dur = 0.16, dest } = {}) {
    if (!this.ctx) return;
    const t = this.now() + when;
    const shot = (freqMul, peak, to) => {
      const o = this.osc('sine', f0 * freqMul);
      o.frequency.setValueAtTime(f0 * freqMul, t);
      o.frequency.exponentialRampToValueAtTime(f1 * freqMul, t + dur);
      const g = this.gain(0);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
      o.connect(g).connect(to);
      o.start(t);
      o.stop(t + dur + 0.1);
    };
    shot(1, 0.9 * strength, dest || this.bus.tac);
    // вторая гармоника — чтобы «слышали» бас даже на маленьком динамике
    shot(2, 0.22 * strength, dest || this.master);
  }

  heartSound(strength = 1) {
    this.thump(strength, { f0: 62, f1: 38 });
    this.thump(strength * 0.6, { when: 0.13, f0: 55, f1: 36 });
  }

  knock(pos) {
    if (!this.ctx) return;
    const t = this.now();
    const out = this.gain(1);
    if (pos) out.connect(this.panner(...pos)).connect(this.bus.ent);
    else out.connect(this.master);
    this.thump(0.9, { f0: 125, f1: 70, dur: 0.07, dest: out });
    const g = this.gain(0);
    g.connect(out);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    const bp = this.filt('bandpass', 1700, 2);
    bp.connect(g);
    this.noiseShot(bp, t, 0.04);
  }

  // ---------- голосоподобные звуки ----------
  whisper({ pos = [-0.35, 0, 0.35], dur = 2.2, level = 0.6 } = {}) {
    if (!this.ctx) return;
    const t = this.now();
    const out = this.gain(0);
    out.connect(this.panner(...pos)).connect(this.bus.ent);
    const hp = this.filt('highpass', 350);
    for (const [f, q, g] of [[650, 6, 0.9], [1150, 7, 0.6], [2600, 8, 0.45], [5200, 2, 0.3]]) {
      const b = this.filt('bandpass', f * rand(0.85, 1.15), q);
      b.frequency.linearRampToValueAtTime(f * rand(0.8, 1.25), t + dur);
      hp.connect(b).connect(this.gain(g)).connect(out);
    }
    let tt = t;
    out.gain.setValueAtTime(0, t);
    while (tt < t + dur) {
      const syl = rand(0.08, 0.22);
      out.gain.linearRampToValueAtTime(level * rand(0.4, 1), tt + syl * 0.3);
      out.gain.linearRampToValueAtTime(level * 0.08, tt + syl);
      tt += syl + rand(0.02, 0.12);
    }
    out.gain.linearRampToValueAtTime(0, tt + 0.1);
    this.noiseShot(hp, t, Math.min(3.5, tt - t + 0.2));
  }

  breath({ pos = [-0.3, 0, 0.4], level = 0.35, dur = 1.4 } = {}) {
    if (!this.ctx) return;
    const t = this.now();
    const g = this.gain(0);
    g.connect(this.panner(...pos)).connect(this.bus.ent);
    const lp = this.filt('lowpass', 2400);
    lp.connect(g);
    const bp = this.filt('bandpass', 900, 0.6);
    bp.connect(lp);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + dur * 0.45);
    g.gain.linearRampToValueAtTime(0, t + dur);
    this.noiseShot(bp, t, dur + 0.1);
  }

  // Дыхание сущности, которое повторяет дыхание игрока (громкость с микрофона).
  mirrorBreath(on) {
    if (!this.ctx) return;
    if (!on) return this.stopLoop('mirror', 0.6);
    this.loop('mirror', 'scene', (L) => {
      const n = this.noiseSrc();
      this.mirrorGain = this.gain(0);
      n.connect(this.filt('bandpass', 850, 0.6)).connect(this.filt('lowpass', 2300)).connect(this.mirrorGain).connect(L.out);
      L.out.connect(this.panner(-0.25, 0.05, 0.3)).connect(this.bus.ent);
      L.start(n);
    });
  }

  setMirror(v) {
    if (this.mirrorGain) this.mirrorGain.gain.setTargetAtTime(Math.min(0.8, v * 0.7), this.now() + 0.3, 0.06);
  }

  // Приглушённый детский голос «из-под стола»: два слога, неразборчиво.
  muffledCall({ pos = [0, -1, -0.3], level = 0.5 } = {}) {
    if (!this.ctx) return;
    const t = this.now();
    const out = this.gain(0);
    out.connect(this.filt('lowpass', 750)).connect(this.panner(...pos)).connect(this.bus.ent);
    const src = this.osc('sawtooth', 320);
    src.frequency.setValueAtTime(330, t);
    src.frequency.linearRampToValueAtTime(300, t + 0.3);
    src.frequency.setValueAtTime(310, t + 0.42);
    src.frequency.linearRampToValueAtTime(260, t + 0.9);
    const f1 = this.filt('bandpass', 500, 6);
    const f2 = this.filt('bandpass', 850, 7);
    f2.frequency.setValueAtTime(850, t + 0.5);
    f2.frequency.linearRampToValueAtTime(2000, t + 0.85);
    src.connect(f1).connect(out);
    src.connect(f2).connect(this.gain(0.6)).connect(out);
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(level, t + 0.04);
    out.gain.linearRampToValueAtTime(level * 0.7, t + 0.25);
    out.gain.linearRampToValueAtTime(0, t + 0.3);
    out.gain.linearRampToValueAtTime(level, t + 0.42);
    out.gain.linearRampToValueAtTime(level * 0.6, t + 0.85);
    out.gain.linearRampToValueAtTime(0, t + 0.95);
    src.start(t);
    src.stop(t + 1);
    const kg = this.gain(0);
    kg.connect(out);
    kg.gain.setValueAtTime(0.3, t + 0.33);
    kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.39);
    const kb = this.filt('bandpass', 2500, 1);
    kb.connect(kg);
    this.noiseShot(kb, t + 0.33, 0.07);
  }

  // ---------- тревога ----------
  binaural(on, { base = 200, diff = 7, level = 0.035 } = {}) {
    if (!this.ctx) return;
    if (!on) return this.stopLoop('binaural', 1.5);
    this.loop('binaural', 'scene', (L) => {
      const m = this.ctx.createChannelMerger(2);
      const l = this.osc('sine', base);
      const r = this.osc('sine', base + diff);
      l.connect(m, 0, 0);
      r.connect(m, 0, 1);
      L.out.gain.value = 0;
      L.out.gain.linearRampToValueAtTime(level, this.now() + 3);
      m.connect(L.out).connect(this.master);
      L.start(l);
      L.start(r);
    });
  }

  // Бесконечно поднимающийся тон Шепарда с «шершавостью» 70 Гц.
  shepard(on, { level = 0.11, period = 9 } = {}) {
    if (!this.ctx) return;
    if (!on) return this.stopLoop('shepard', 1.5);
    this.loop('shepard', 'scene', (L) => {
      const am = this.gain(0.7);
      const lfo = this.osc('sine', 70);
      lfo.connect(this.gain(0.3)).connect(am.gain);
      L.start(lfo);
      L.out.gain.value = 0;
      L.out.gain.linearRampToValueAtTime(level, this.now() + 2);
      am.connect(L.out).connect(this.master);
      const N = 7;
      const f0 = 55;
      const voices = [];
      for (let i = 0; i < N; i++) {
        const o = this.osc('sine', f0);
        const g = this.gain(0);
        o.connect(g).connect(am);
        L.start(o);
        voices.push([o, g]);
      }
      const t0 = this.now();
      L.every(40, () => {
        const ph = ((this.now() - t0) / period) % 1;
        const t = this.now();
        voices.forEach(([o, g], i) => {
          const pos = (i + ph) / N;
          o.frequency.setTargetAtTime(f0 * Math.pow(2, pos * N), t, 0.02);
          g.gain.setTargetAtTime(Math.exp(-Math.pow((pos - 0.5) / 0.17, 2) / 2) * 0.25, t, 0.02);
        });
      });
    });
  }

  alarm(sec = 0.9) {
    if (!this.ctx) return;
    const t = this.now();
    const o = this.osc('square', 880);
    for (let k = 0; k * 0.15 < sec; k++) o.frequency.setValueAtTime(k % 2 ? 622 : 880, t + k * 0.15);
    const am = this.gain(0.5);
    const lfo = this.osc('sine', 70);
    lfo.connect(this.gain(0.5)).connect(am.gain);
    const g = this.gain(0);
    o.connect(this.filt('lowpass', 2400)).connect(am).connect(g).connect(this.master);
    g.gain.setValueAtTime(0.07, t);
    g.gain.setValueAtTime(0.07, t + sec);
    g.gain.linearRampToValueAtTime(0, t + sec + 0.05);
    o.start(t);
    lfo.start(t);
    o.stop(t + sec + 0.1);
    lfo.stop(t + sec + 0.1);
  }

  // Искажённый крик: меньше секунды, шершавость 72 Гц, пики под лимитером.
  scream({ level = 0.5 } = {}) {
    if (!this.ctx) return;
    const t = this.now();
    const d = 0.85;
    const out = this.gain(0);
    const am = this.gain(0.4);
    const lfo = this.osc('sine', 72);
    lfo.connect(this.gain(0.6)).connect(am.gain);
    am.connect(out).connect(this.master);
    const f1 = this.filt('bandpass', 1000, 3);
    const f2 = this.filt('bandpass', 2700, 4);
    f1.connect(am);
    f2.connect(am);
    for (const [mul, g] of [[1, 0.8], [1.48, 0.5], [0.5, 0.4]]) {
      const o = this.osc('sawtooth', 880 * mul);
      o.frequency.setValueAtTime(900 * mul, t);
      o.frequency.exponentialRampToValueAtTime(330 * mul, t + d);
      const gg = this.gain(g);
      o.connect(gg);
      gg.connect(f1);
      gg.connect(f2);
      o.start(t);
      o.stop(t + d + 0.05);
    }
    const ng = this.gain(0.6);
    ng.connect(f2);
    this.noiseShot(ng, t, d);
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(level, t + 0.015);
    out.gain.setValueAtTime(level, t + d - 0.15);
    out.gain.linearRampToValueAtTime(0, t + d);
    lfo.start(t);
    lfo.stop(t + d + 0.05);
    this.thump(1.1, { f0: 70, f1: 32, dur: 0.3 });
  }

  glass() {
    if (!this.ctx) return;
    const t = this.now();
    const out = this.gain(0.9);
    out.connect(this.master);
    const ig = this.gain(0);
    ig.connect(out);
    ig.gain.setValueAtTime(0.7, t);
    ig.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    const hp = this.filt('highpass', 900);
    hp.connect(ig);
    this.noiseShot(hp, t, 0.16);
    for (let i = 0; i < 46; i++) {
      const st = t + Math.pow(Math.random(), 2) * 0.9;
      const o = this.osc('sine', rand(2200, 9500));
      const g = this.gain(0);
      o.connect(g).connect(out);
      const dec = rand(0.04, 0.35);
      g.gain.setValueAtTime(rand(0.02, 0.08), st);
      g.gain.exponentialRampToValueAtTime(0.0001, st + dec);
      o.start(st);
      o.stop(st + dec + 0.02);
    }
    for (let i = 0; i < 30; i++) {
      const st = t + 0.3 + Math.random() * 1.4;
      const g = this.gain(0);
      g.connect(out);
      g.gain.setValueAtTime(rand(0.03, 0.1), st);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.02);
      const bp = this.filt('bandpass', rand(3000, 8000), 8);
      bp.connect(g);
      this.noiseShot(bp, st, 0.03);
    }
    this.thump(1, { f0: 90, f1: 40, dur: 0.25 });
  }

  // Скрежет по стеклу: узкая полоса шума с дрожащей громкостью.
  scrapeSound(sec = 1.2) {
    if (!this.ctx) return;
    const t = this.now();
    const bp = this.filt('bandpass', 2200, 6);
    bp.frequency.setValueAtTime(rand(1800, 2400), t);
    bp.frequency.linearRampToValueAtTime(rand(3000, 3800), t + sec);
    const g = this.gain(0);
    bp.connect(g).connect(this.bus.ent);
    for (let k = 0; k * 0.025 < sec; k++) g.gain.setValueAtTime(rand(0.05, 0.3), t + k * 0.025);
    g.gain.setValueAtTime(0, t + sec);
    this.noiseShot(bp, t, sec);
  }

  // ---------- интерфейс ----------
  uiTick() {
    if (!this.ctx) return;
    const t = this.now();
    const o = this.osc('sine', 1500);
    o.frequency.exponentialRampToValueAtTime(1100, t + 0.012);
    const g = this.gain(0);
    o.connect(g).connect(this.bus.ui);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.start(t);
    o.stop(t + 0.04);
  }

  whoosh() {
    if (!this.ctx) return;
    const t = this.now();
    const bp = this.filt('bandpass', 300, 1.2);
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(5000, t + 0.35);
    const g = this.gain(0);
    bp.connect(g).connect(this.bus.ui);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.08);
    g.gain.linearRampToValueAtTime(0, t + 0.4);
    this.noiseShot(bp, t, 0.42);
    [3600, 4500, 5300].forEach((f, i) => {
      const o = this.osc('sine', f);
      const gg = this.gain(0);
      o.connect(gg).connect(this.bus.ui);
      const st = t + 0.25 + i * 0.05;
      gg.gain.setValueAtTime(0.04, st);
      gg.gain.exponentialRampToValueAtTime(0.0001, st + 0.2);
      o.start(st);
      o.stop(st + 0.22);
    });
  }

  error() {
    if (!this.ctx) return;
    const t = this.now();
    [[330, 0], [311, 0.12]].forEach(([f, d]) => {
      const o = this.osc('square', f);
      const g = this.gain(0);
      o.connect(this.filt('lowpass', 2000)).connect(g).connect(this.bus.ui);
      g.gain.setValueAtTime(0.09, t + d);
      g.gain.setValueAtTime(0.09, t + d + 0.1);
      g.gain.linearRampToValueAtTime(0, t + d + 0.11);
      o.start(t + d);
      o.stop(t + d + 0.12);
    });
  }

  glitchSound(dur = 0.18, level = 0.1) {
    if (!this.ctx) return;
    const t = this.now();
    const o = this.osc('square', 200);
    for (let k = 0; k * 0.015 < dur; k++) o.frequency.setValueAtTime(rand(80, 3000), t + k * 0.015);
    const g = this.gain(0);
    o.connect(g).connect(this.bus.ui);
    for (let k = 0; k * 0.03 < dur; k++) g.gain.setValueAtTime(Math.random() < 0.6 ? level : 0, t + k * 0.03);
    g.gain.setValueAtTime(0, t + dur);
    o.start(t);
    o.stop(t + dur + 0.02);
    const ng = this.gain(0);
    ng.connect(this.bus.ui);
    ng.gain.setValueAtTime(level * 0.8, t);
    ng.gain.setValueAtTime(0, t + dur);
    this.noiseShot(ng, t, dur);
  }

  squeak() {
    if (!this.ctx) return;
    const t = this.now();
    const o = this.osc('sine', 1700);
    o.frequency.linearRampToValueAtTime(2300, t + 0.16);
    const vib = this.osc('sine', 28);
    vib.connect(this.gain(60)).connect(o.frequency);
    const g = this.gain(0);
    o.connect(g).connect(this.bus.ui);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.04, t + 0.03);
    g.gain.linearRampToValueAtTime(0, t + 0.16);
    o.start(t);
    vib.start(t);
    o.stop(t + 0.18);
    vib.stop(t + 0.18);
  }

  birds(on) {
    if (!this.ctx) return;
    if (!on) return this.stopLoop('birds', 2);
    this.loop('birds', 'scene', (L) => {
      L.out.gain.value = 0;
      L.out.gain.linearRampToValueAtTime(1, this.now() + 3);
      L.out.connect(this.bus.amb);
      L.every(900, () => {
        if (Math.random() < 0.5) return;
        const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : this.gain(1);
        if (p.pan) p.pan.value = rand(-0.8, 0.8);
        p.connect(L.out);
        let t = this.now();
        const n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
          const o = this.osc('sine', 2600);
          o.frequency.setValueAtTime(rand(2400, 3200), t);
          o.frequency.linearRampToValueAtTime(rand(3600, 4600), t + 0.05);
          o.frequency.linearRampToValueAtTime(rand(2800, 3400), t + 0.09);
          const g = this.gain(0);
          o.connect(g).connect(p);
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.03, t + 0.01);
          g.gain.linearRampToValueAtTime(0, t + 0.1);
          o.start(t);
          o.stop(t + 0.12);
          t += rand(0.12, 0.2);
        }
      });
    });
  }

  // ---------- песенка Сони ----------
  // mode: 'hum' — напевает с фальшью, 'detuned' — две расстроенные копии,
  // 'muzak' — идеально чистая лифтовая версия (концовка «Лета»).
  song(mode, { level = 0.5, loop = true } = {}) {
    if (!this.ctx) return;
    if (!mode) return this.stopLoop('song', 1.2);
    const bpm = mode === 'muzak' ? 104 : 88;
    const beat = 60 / bpm;
    this.loop('song', 'scene', (L) => {
      L.out.gain.value = 0;
      L.out.gain.linearRampToValueAtTime(level, this.now() + 1);
      if (mode === 'muzak') L.out.connect(this.bus.sys);
      else this.toMem(L.out, 0.8);
      let vib = null;
      if (mode !== 'muzak') {
        const lfo = this.osc('sine', mode === 'detuned' ? 0.6 : 5.5);
        vib = this.gain(mode === 'detuned' ? 18 : 10);
        lfo.connect(vib);
        L.start(lfo);
      }
      let idx = 0;
      let bar = 0;
      let next = this.now() + 0.2;
      let barTime = next;
      L.every(100, () => {
        while (next < this.now() + 0.4) {
          if (idx >= MELODY.length) {
            if (!loop) return;
            idx = 0;
            bar = 0;
            barTime = next;
          }
          const [m, beats] = MELODY[idx];
          const dur = beats * beat;
          if (mode === 'muzak') {
            this.epiano(L.out, mtof(m + 12), next, dur);
            while (barTime <= next + 1e-3) {
              this.pad(L.out, CHORDS[bar % CHORDS.length], barTime, beat * 4);
              barTime += beat * 4;
              bar++;
            }
          } else {
            const off = mode === 'detuned' ? 0 : rand(-22, 22);
            this.humNote(L.out, mtof(m), next, dur, off, vib);
            if (mode === 'detuned') this.humNote(L.out, mtof(m), next, dur, 24, vib);
          }
          next += dur;
          idx++;
        }
      });
    });
  }

  humNote(dest, f, t, dur, cents, vib) {
    const o = this.osc('triangle', f);
    o.detune.value = cents;
    if (vib) vib.connect(o.detune);
    const sub = this.osc('sine', f / 2);
    const g = this.gain(0);
    const lp = this.filt('lowpass', 1300);
    o.connect(lp);
    sub.connect(this.gain(0.4)).connect(lp);
    lp.connect(g).connect(dest);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.06);
    g.gain.setValueAtTime(0.14, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    o.start(t);
    sub.start(t);
    o.stop(t + dur + 0.1);
    sub.stop(t + dur + 0.1);
  }

  epiano(dest, f, t, dur) {
    const c = this.osc('sine', f);
    const m = this.osc('sine', f);
    const idx = this.gain(0);
    m.connect(idx).connect(c.frequency);
    idx.gain.setValueAtTime(f * 1.6, t);
    idx.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.6);
    const g = this.gain(0);
    c.connect(g).connect(dest);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.4, dur * 1.4));
    c.start(t);
    m.start(t);
    c.stop(t + dur * 1.5 + 0.1);
    m.stop(t + dur * 1.5 + 0.1);
  }

  pad(dest, chord, t, dur) {
    for (const n of chord) {
      const o = this.osc('sine', mtof(n));
      const g = this.gain(0);
      o.connect(g).connect(dest);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.025, t + 0.3);
      g.gain.setValueAtTime(0.025, t + dur - 0.2);
      g.gain.linearRampToValueAtTime(0, t + dur);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    const b = this.osc('sine', mtof(chord[0] - 12));
    const bg = this.gain(0);
    b.connect(bg).connect(dest);
    bg.gain.setValueAtTime(0.08, t);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.5);
    b.start(t);
    b.stop(t + dur);
  }

  // ---------- записи ----------
  // Проигрывает AudioBuffer (например, голос игрока). mode: 'raw' | 'machine' | 'ghost'.
  playBuffer(buf, { mode = 'raw', level = 1 } = {}) {
    if (!this.ctx || !buf) return Promise.resolve(false);
    return new Promise((resolve) => {
      const s = this.ctx.createBufferSource();
      if (mode === 'ghost') {
        const rev = this.ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
        for (let c = 0; c < buf.numberOfChannels; c++) rev.getChannelData(c).set(buf.getChannelData(c).slice().reverse());
        s.buffer = rev;
      } else {
        s.buffer = buf;
      }
      const g = this.gain(level);
      if (mode === 'machine') {
        s.playbackRate.value = 0.9;
        const bp = this.filt('bandpass', 1600, 0.6);
        const d = this.ctx.createDelay(0.05);
        d.delayTime.value = 0.011;
        const fb = this.gain(0.55);
        s.connect(bp).connect(g);
        bp.connect(d).connect(fb).connect(d);
        d.connect(g);
        g.connect(this.bus.sys);
      } else if (mode === 'ghost') {
        s.connect(g);
        this.toMem(g, 1);
      } else {
        s.connect(g).connect(this.bus.sys);
      }
      s.onended = () => resolve(true);
      s.start();
    });
  }

  // Записанная озвучка из public/audio/voice/<id>.mp3, если она есть.
  async playFile(id, { bus = 'sys', level = 1, wet = 0 } = {}) {
    if (!this.ctx) return false;
    let buf = this.files.get(id);
    if (buf === null) return false;
    if (!buf) {
      try {
        const r = await fetch(`audio/voice/${id}.mp3`);
        if (!r.ok) throw new Error('нет файла');
        buf = await this.ctx.decodeAudioData(await r.arrayBuffer());
        this.files.set(id, buf);
      } catch {
        this.files.set(id, null);
        return false;
      }
    }
    return new Promise((resolve) => {
      const s = this.ctx.createBufferSource();
      s.buffer = buf;
      const g = this.gain(level);
      s.connect(g);
      if (bus === 'mem') this.toMem(g, wet || 0.5);
      else g.connect(this.bus[bus] || this.bus.sys);
      s.onended = () => resolve(true);
      s.start();
    });
  }
}
