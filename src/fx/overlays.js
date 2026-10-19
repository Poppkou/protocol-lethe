// Визуальные эффекты поверх интерфейса: чернила из углов, глитч, зерно,
// запотевшее стекло, отпечатки ладоней, трещины.
import { h, rand, clamp } from '../core/dom.js';

// ---------- общий холст эффектов ----------
export class FX {
  constructor(canvas, stage) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.stage = stage;
    this.painters = new Set();
    this.lowFlash = false;
    this.ink = 0;
    this.inkTarget = 0;
    this.grain = 0;
    this.blobs = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
    const loop = (t) => {
      this.frame(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.c.width = Math.floor(this.w * dpr);
    this.c.height = Math.floor(this.h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.seedInk();
  }

  seedInk() {
    const { w, h } = this;
    const pts = [[0, 0, 1.3], [w, 0, 1.1], [0, h, 1.2], [w, h, 1.4], [w * 0.5, 0, 0.6], [0, h * 0.45, 0.7], [w, h * 0.6, 0.8], [w * 0.3, h, 0.7], [w * 0.75, 0, 0.5]];
    this.blobs = pts.map(([x, y, s]) => ({ x, y, s, ph: rand(0, 6.28), drip: rand(0.2, 1) }));
  }

  frame(t) {
    const g = this.g;
    g.clearRect(0, 0, this.w, this.h);
    this.ink += (this.inkTarget - this.ink) * 0.01;
    if (this.ink > 0.003) this.drawInk(t);
    if (this.grain > 0) this.drawGrain();
    for (const p of this.painters) p(g, this.w, this.h, t);
  }

  drawInk(t) {
    const g = this.g;
    const base = Math.min(this.w, this.h) * 0.42;
    for (const b of this.blobs) {
      const r0 = base * b.s * this.ink;
      if (r0 < 2) continue;
      const grd = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, r0 * 1.2);
      grd.addColorStop(0, 'rgba(0,0,0,1)');
      grd.addColorStop(0.62, 'rgba(0,0,0,0.96)');
      grd.addColorStop(0.86, 'rgba(0,0,0,0.55)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const r = r0 * (1 + 0.14 * Math.sin(a * 3 + t * 0.0005 + b.ph) + 0.08 * Math.sin(a * 7 - t * 0.0009));
        const x = b.x + Math.cos(a) * r;
        const y = b.y + Math.sin(a) * r;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.fill();
      if (b.y === 0) {
        const len = this.h * 0.35 * this.ink * b.drip;
        const dg = g.createLinearGradient(0, 0, 0, r0 * 0.5 + len);
        dg.addColorStop(0, 'rgba(0,0,0,0.9)');
        dg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = dg;
        g.fillRect(b.x - r0 * 0.25, 0, Math.max(2, r0 * 0.05), r0 * 0.5 + len);
      }
    }
  }

  drawGrain() {
    const g = this.g;
    g.save();
    g.globalAlpha = this.grain;
    for (let i = 0; i < 160; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#fff' : '#000';
      g.fillRect(Math.random() * this.w, Math.random() * this.h, 1.5, 1.5);
    }
    g.restore();
  }

  setInk(v) {
    this.inkTarget = clamp(v, 0, 1);
  }

  add(painter, ms) {
    this.painters.add(painter);
    const remove = () => this.painters.delete(painter);
    if (ms) setTimeout(remove, ms);
    return remove;
  }

  clearPainters() {
    this.painters.clear();
  }

  // Глитч: цветные полосы и сдвиг интерфейса. В режиме «меньше мерцания» — слабее.
  glitch(ms = 250, power = 1) {
    if (this.lowFlash) power *= 0.25;
    const colors = ['rgba(255,0,60,.35)', 'rgba(0,255,220,.28)', 'rgba(0,0,0,.65)', 'rgba(255,255,255,.45)'];
    let last = 0;
    const bars = [];
    this.add((g, w, hgt, t) => {
      if (t - last > 70) {
        last = t;
        bars.length = 0;
        const n = Math.ceil(6 * power);
        for (let i = 0; i < n; i++) bars.push([rand(0, hgt), rand(2, 26), rand(-30, 30), colors[i % colors.length]]);
        if (this.stage) this.stage.style.transform = `translateX(${rand(-6, 6) * power}px) skewX(${rand(-2, 2) * power}deg)`;
      }
      for (const [y, bh, dx, col] of bars) {
        g.fillStyle = col;
        g.fillRect(dx, y, w, bh);
      }
    }, ms);
    setTimeout(() => { if (this.stage) this.stage.style.transform = ''; }, ms + 20);
  }
}

// ---------- стирание пальцем (жирные разводы или запотевшее стекло) ----------
export function wipeLayer(parent, { kind = 'smear', threshold = 0.6, onWipe } = {}) {
  const c = h('canvas', { class: 'wipe' });
  parent.append(c);
  const r = parent.getBoundingClientRect();
  const W = (c.width = Math.max(1, Math.floor(r.width)));
  const H = (c.height = Math.max(1, Math.floor(r.height)));
  const g = c.getContext('2d');
  if (kind === 'fog') {
    g.fillStyle = 'rgba(196,202,208,0.86)';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `rgba(255,255,255,${rand(0.05, 0.3)})`;
      g.beginPath();
      g.arc(rand(0, W), rand(0, H), rand(0.5, 2.2), 0, 6.28);
      g.fill();
    }
  } else {
    g.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      g.strokeStyle = `rgba(${rand(40, 70) | 0},${rand(36, 60) | 0},${rand(30, 50) | 0},${rand(0.08, 0.2)})`;
      g.lineWidth = rand(24, 80);
      g.beginPath();
      const x = rand(-40, W);
      const y = rand(-40, H);
      g.moveTo(x, y);
      g.bezierCurveTo(x + rand(-120, 120), y + rand(-80, 80), x + rand(-160, 160), y + rand(-120, 120), x + rand(-200, 200), y + rand(-160, 160));
      g.stroke();
    }
  }
  const COLS = 12;
  const ROWS = 20;
  const cells = new Set();
  let resolveDone;
  const done = new Promise((res) => { resolveDone = res; });
  let finished = false;
  let lastSound = 0;
  const wipeAt = (x, y) => {
    g.globalCompositeOperation = 'destination-out';
    const grd = g.createRadialGradient(x, y, 4, x, y, 38);
    grd.addColorStop(0, 'rgba(0,0,0,1)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, 38, 0, 6.28);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    const cx = Math.floor((x / W) * COLS);
    const cy = Math.floor((y / H) * ROWS);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const X = cx + dx;
        const Y = cy + dy;
        if (X >= 0 && Y >= 0 && X < COLS && Y < ROWS) cells.add(Y * COLS + X);
      }
    }
    const now = performance.now();
    if (now - lastSound > 220) {
      lastSound = now;
      onWipe?.();
    }
    if (!finished && cells.size / (COLS * ROWS) >= threshold) {
      finished = true;
      resolveDone();
    }
  };
  let down = false;
  c.addEventListener('pointerdown', (e) => {
    down = true;
    c.setPointerCapture?.(e.pointerId);
    const b = c.getBoundingClientRect();
    wipeAt(e.clientX - b.left, e.clientY - b.top);
  });
  c.addEventListener('pointermove', (e) => {
    if (!down) return;
    const b = c.getBoundingClientRect();
    wipeAt(e.clientX - b.left, e.clientY - b.top);
  });
  const up = () => { down = false; };
  c.addEventListener('pointerup', up);
  c.addEventListener('pointercancel', up);
  return {
    el: c,
    done,
    get progress() { return cells.size / (COLS * ROWS); },
    destroy: () => c.remove(),
  };
}

// ---------- детские ладони, отпечатанные изнутри стекла ----------
function handCanvas(size, color) {
  const c = h('canvas', { class: 'print' });
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.translate(size / 2, size * 0.62);
  g.beginPath();
  g.ellipse(0, 0, size * 0.19, size * 0.21, 0, 0, Math.PI * 2);
  g.fill();
  const finger = (x, y, ang, len, wdt) => {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.beginPath();
    g.ellipse(0, -len / 2, wdt, len / 2, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  [[-1.5, -0.18, 0.24], [-0.5, -0.06, 0.29], [0.5, 0.06, 0.28], [1.5, 0.18, 0.22]].forEach(([k, ang, len]) => {
    finger(k * size * 0.085, -size * 0.14, ang, size * len, size * 0.045);
  });
  finger(-size * 0.17, -size * 0.02, -1.05, size * 0.2, size * 0.05);
  return c;
}

export function printsLayer(parent, { color = 'rgba(30,28,26,0.32)', spots } = {}) {
  const wrap = h('div', { class: 'prints' });
  parent.append(wrap);
  const places = spots || [[0.28, 0.32, -0.3], [0.62, 0.26, 0.25], [0.45, 0.55, -0.1], [0.24, 0.7, 0.4], [0.7, 0.66, -0.35]];
  const els = places.map(([x, y, rot], i) => {
    const size = Math.round(Math.min(window.innerWidth, 520) * rand(0.26, 0.32));
    const c = handCanvas(size, color);
    Object.assign(c.style, {
      left: `calc(${x * 100}% - ${size / 2}px)`,
      top: `calc(${y * 100}% - ${size / 2}px)`,
      transform: `rotate(${rot}rad) ${i % 2 ? 'scaleX(-1)' : ''}`,
    });
    wrap.append(c);
    return c;
  });
  let shown = 0;
  return {
    el: wrap,
    next() {
      if (shown < els.length) els[shown++].classList.add('on');
      return shown;
    },
    all() {
      while (shown < els.length) this.next();
    },
    destroy: () => wrap.remove(),
  };
}

// ---------- трещины на стекле ----------
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function crackLayer(parent, { x = 0.5, y = 0.6, seed = 7 } = {}) {
  const c = h('canvas', { class: 'cracks' });
  parent.append(c);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = parent.getBoundingClientRect();
  const W = r.width;
  const H = r.height;
  c.width = Math.floor(W * dpr);
  c.height = Math.floor(H * dpr);
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rnd = seeded(seed);
  const ox = W * x;
  const oy = H * y;
  const maxLen = Math.hypot(W, H) * 0.75;
  const segs = [];
  const rays = [];
  const walk = (sx, sy, ang, budget, s0, depth) => {
    let px = sx;
    let py = sy;
    let dist = 0;
    const pts = [[px, py, s0]];
    while (dist < budget) {
      const step = 12 + rnd() * 22;
      ang += (rnd() - 0.5) * 0.6;
      const nx = px + Math.cos(ang) * step;
      const ny = py + Math.sin(ang) * step;
      dist += step;
      const s = s0 + dist / maxLen;
      segs.push([px, py, nx, ny, s - step / maxLen, s, depth]);
      pts.push([nx, ny, s]);
      if (depth < 2 && rnd() < 0.16) walk(nx, ny, ang + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.6), budget * 0.4, s, depth + 1);
      px = nx;
      py = ny;
      if (px < -20 || py < -20 || px > W + 20 || py > H + 20) break;
    }
    return pts;
  };
  const N = 9;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + rnd() * 0.5;
    rays.push(walk(ox, oy, a, maxLen * (0.55 + rnd() * 0.45), 0, 0));
  }
  // кольца «паутины»
  for (const rr of [26, 64, 118]) {
    for (let i = 0; i < N; i++) {
      const A = rays[i].find((p) => Math.hypot(p[0] - ox, p[1] - oy) >= rr);
      const B = rays[(i + 1) % N].find((p) => Math.hypot(p[0] - ox, p[1] - oy) >= rr);
      if (A && B && rnd() < 0.85) segs.push([A[0], A[1], B[0], B[1], rr / maxLen + 0.08, rr / maxLen + 0.12, 1]);
    }
  }
  segs.sort((a, b) => a[4] - b[4]);
  let drawnTo = 0;
  const draw = (p) => {
    g.clearRect(0, 0, W, H);
    for (const [x1, y1, x2, y2, s1, s2, depth] of segs) {
      if (s1 > p) break;
      const k = clamp((p - s1) / Math.max(1e-4, s2 - s1), 0, 1);
      const ex = x1 + (x2 - x1) * k;
      const ey = y1 + (y2 - y1) * k;
      g.strokeStyle = 'rgba(0,0,0,0.55)';
      g.lineWidth = depth ? 1 : 1.6;
      g.beginPath();
      g.moveTo(x1 + 1, y1 + 1);
      g.lineTo(ex + 1, ey + 1);
      g.stroke();
      g.strokeStyle = `rgba(255,255,255,${depth ? 0.55 : 0.85})`;
      g.lineWidth = depth ? 0.7 : 1.1;
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(ex, ey);
      g.stroke();
    }
  };
  return {
    el: c,
    grow(p) {
      p = clamp(p, 0, 1.2);
      if (Math.abs(p - drawnTo) < 0.004) return;
      drawnTo = p;
      draw(p);
    },
    burst() {
      draw(2);
      const shards = h('div', { class: 'shards' });
      parent.append(shards);
      for (let i = 0; i < 18; i++) {
        const s = h('div', { class: 'shard' });
        const cx = rand(0, 100);
        const cy = rand(0, 100);
        s.style.clipPath = `polygon(${cx}% ${cy}%, ${cx + rand(-14, 14)}% ${cy + rand(6, 18)}%, ${cx + rand(-14, 14)}% ${cy + rand(-18, -6)}%)`;
        s.style.setProperty('--dx', `${rand(-40, 40)}px`);
        s.style.setProperty('--rot', `${rand(-40, 40)}deg`);
        s.style.animationDelay = `${rand(0, 0.5)}s`;
        shards.append(s);
      }
      return shards;
    },
    destroy: () => c.remove(),
  };
}
