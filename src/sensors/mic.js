// Микрофон: громкость в дБ, калибровка тишины и запись короткой фразы.
// Запись хранится только в памяти (AudioBuffer) и нигде не сохраняется.
import { clamp, sleep } from '../core/dom.js';

export class Mic {
  constructor(audio) {
    this.audio = audio;
    this.stream = null;
    this.src = null;
    this.an = null;
    this.data = null;
    this.smooth = -100;
    this.base = -60;
  }

  get on() {
    return !!this.an;
  }

  async start() {
    if (this.an) return true;
    if (!navigator.mediaDevices?.getUserMedia || !this.audio.ctx) return false;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch {
      return false;
    }
    await this.audio.resume();
    const ctx = this.audio.ctx;
    this.src = ctx.createMediaStreamSource(this.stream);
    this.an = ctx.createAnalyser();
    this.an.fftSize = 2048;
    this.data = new Float32Array(this.an.fftSize);
    this.src.connect(this.an);
    return true;
  }

  // Текущая громкость в дБ полной шкалы (сглаженная).
  level() {
    if (!this.an) return -100;
    this.an.getFloatTimeDomainData(this.data);
    let s = 0;
    for (let i = 0; i < this.data.length; i++) s += this.data[i] * this.data[i];
    const db = 20 * Math.log10(Math.sqrt(s / this.data.length) + 1e-9);
    this.smooth = this.smooth < -90 ? db : this.smooth * 0.6 + db * 0.4;
    return this.smooth;
  }

  // Насколько громче фона комнаты, в дБ.
  over() {
    return this.level() - this.base;
  }

  // 0..1 — для «зеркального» дыхания.
  env() {
    return clamp((this.over() - 2) / 18, 0, 1);
  }

  async calibrate(ms, signal) {
    const vals = [];
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      vals.push(this.level());
      await sleep(50, signal);
    }
    vals.sort((a, b) => a - b);
    this.base = vals.length ? vals[Math.floor(vals.length / 2)] : -60;
    return this.base;
  }

  async record(ms, { signal, onLevel } = {}) {
    const ctx = this.audio.ctx;
    if (!this.src) return { buffer: null, peakOver: 0 };
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const sink = ctx.createGain();
    sink.gain.value = 0;
    const chunks = [];
    proc.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    this.src.connect(proc);
    proc.connect(sink);
    sink.connect(ctx.destination);
    let peak = -100;
    const t0 = performance.now();
    try {
      while (performance.now() - t0 < ms) {
        const l = this.level();
        peak = Math.max(peak, l);
        onLevel?.(l - this.base);
        await sleep(50, signal);
      }
    } finally {
      try { this.src.disconnect(proc); } catch { /* ignore */ }
      proc.disconnect();
      sink.disconnect();
    }
    const len = chunks.reduce((a, c) => a + c.length, 0);
    if (!len) return { buffer: null, peakOver: peak - this.base };
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    let off = 0;
    for (const c of chunks) {
      buf.getChannelData(0).set(c, off);
      off += c.length;
    }
    return { buffer: trim(ctx, buf), peakOver: peak - this.base };
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    try { this.src?.disconnect(); } catch { /* ignore */ }
    this.stream = null;
    this.src = null;
    this.an = null;
    this.smooth = -100;
  }
}

// Обрезает тишину по краям и нормализует громкость.
function trim(ctx, buf) {
  const d = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak < 0.003) return buf;
  const th = peak * 0.12;
  let a = 0;
  let b = d.length - 1;
  while (a < d.length && Math.abs(d[a]) < th) a++;
  while (b > a && Math.abs(d[b]) < th) b--;
  const pad = Math.floor(ctx.sampleRate * 0.12);
  a = Math.max(0, a - pad);
  b = Math.min(d.length - 1, b + pad);
  const out = ctx.createBuffer(1, b - a + 1, ctx.sampleRate);
  const o = out.getChannelData(0);
  const k = 0.8 / peak;
  for (let i = a; i <= b; i++) o[i - a] = d[i] * k;
  return out;
}
