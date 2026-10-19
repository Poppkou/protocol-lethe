// Процедурная «фотография» бассейна из нескольких слоёв глубины (параллакс от наклона).
// child — девочка на бортике, figure — насколько близко фигура в дождевике (0 — нет).
import { h, rand } from '../core/dom.js';
import { figureSVG } from './figure.js';

const W = 600;
const H = 450;

function canvasLayer(draw) {
  const c = h('canvas', { class: 'ph-layer' });
  c.width = W;
  c.height = H;
  draw(c.getContext('2d'));
  return c;
}

function drawBack(g) {
  const sky = g.createLinearGradient(0, 0, 0, 260);
  sky.addColorStop(0, '#1f3038');
  sky.addColorStop(1, '#5f8e97');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, 270);
  g.strokeStyle = 'rgba(255,255,255,0.07)';
  for (let x = 0; x < W; x += 18) { g.beginPath(); g.moveTo(x, 150); g.lineTo(x, 262); g.stroke(); }
  for (let y = 150; y < 262; y += 18) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  for (const x of [40, 230, 420]) {
    g.fillStyle = '#0c1520';
    g.fillRect(x, 20, 140, 118);
    g.strokeStyle = 'rgba(170,195,215,0.22)';
    for (let i = 0; i < 26; i++) {
      const rx = x + rand(4, 136);
      const ry = rand(24, 120);
      g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx - 2, ry + rand(8, 18)); g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(x + 8, 26, 30, 106);
  }
  g.fillStyle = 'rgba(240,245,240,0.85)';
  g.beginPath(); g.arc(510, 172, 16, 0, 6.28); g.fill();
  g.strokeStyle = '#1b2a30';
  g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(510, 172); g.lineTo(510, 182); g.stroke();
  g.beginPath(); g.moveTo(510, 172); g.lineTo(510, 159); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.font = '600 20px "Golos Text", sans-serif';
  g.fillText('Б А С С Е Й Н   « Д Е Л Ь Ф И Н »', 150, 186);
}

function drawWater(g) {
  g.fillStyle = '#cfdcd6';
  g.fillRect(0, 248, W, 14);
  const water = g.createLinearGradient(0, 262, 0, H);
  water.addColorStop(0, '#13687e');
  water.addColorStop(1, '#09384a');
  g.fillStyle = water;
  g.fillRect(0, 262, W, H - 262);
  g.strokeStyle = 'rgba(5,30,45,0.6)';
  g.lineWidth = 6;
  for (let i = -4; i <= 4; i++) {
    g.beginPath(); g.moveTo(300 + i * 30, 268); g.lineTo(300 + i * 140, H); g.stroke();
  }
  g.lineWidth = 1.2;
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = `rgba(170,235,245,${rand(0.06, 0.18)})`;
    const x = rand(0, W);
    const y = rand(270, H);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + rand(10, 30), y + rand(-6, 6), x + rand(30, 60), y + rand(-3, 3));
    g.stroke();
  }
}

function drawColumn(g) {
  const grd = g.createLinearGradient(150, 0, 218, 0);
  grd.addColorStop(0, '#7aa5a9');
  grd.addColorStop(0.6, '#a9cdcd');
  grd.addColorStop(1, '#4d7378');
  g.fillStyle = grd;
  g.fillRect(150, 0, 68, 300);
  g.strokeStyle = 'rgba(30,60,60,0.25)';
  for (let y = 0; y < 300; y += 16) { g.beginPath(); g.moveTo(150, y); g.lineTo(218, y); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(150, 292, 74, 10);
}

function drawChild(g) {
  const cx = 372;
  g.fillStyle = '#c99f84';
  g.fillRect(cx - 18, 236, 11, 44);
  g.fillRect(cx + 7, 236, 11, 46);
  g.fillStyle = 'rgba(20,110,130,0.55)';
  g.fillRect(cx - 22, 262, 44, 24);
  g.fillStyle = '#1f2d5c';
  g.beginPath();
  g.roundRect ? g.roundRect(cx - 22, 196, 44, 48, 12) : g.rect(cx - 22, 196, 44, 48);
  g.fill();
  g.strokeStyle = '#d4ab8f';
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - 20, 204); g.lineTo(cx - 32, 244); g.stroke();
  g.beginPath(); g.moveTo(cx + 20, 204); g.lineTo(cx + 30, 244); g.stroke();
  g.fillStyle = '#e2bfa3';
  g.beginPath(); g.arc(cx, 176, 22, 0, 6.28); g.fill();
  // лицо — пиксели
  for (let y = 168; y < 198; y += 5) {
    for (let x = cx - 17; x < cx + 17; x += 5) {
      const v = rand(0.55, 1);
      g.fillStyle = `rgb(${(226 * v) | 0},${(190 * v) | 0},${(160 * v) | 0})`;
      g.fillRect(x, y, 5, 5);
    }
  }
  g.fillStyle = '#e4b01f';
  g.beginPath(); g.arc(cx, 172, 23, Math.PI, 0); g.fill();
  g.fillStyle = '#20262e';
  g.fillRect(cx - 23, 170, 46, 4);
  g.fillStyle = 'rgba(90,170,230,0.85)';
  g.beginPath(); g.ellipse(cx - 9, 175, 7, 5, 0, 0, 6.28); g.fill();
  g.beginPath(); g.ellipse(cx + 9, 175, 7, 5, 0, 0, 6.28); g.fill();
}

function drawRope(g) {
  for (let i = 0; i < 26; i++) {
    const x = -10 + i * 25;
    const y = 404 + Math.sin(i * 0.5) * 6;
    g.fillStyle = i % 2 ? '#f2f2ee' : '#c8232b';
    g.beginPath(); g.ellipse(x, y, 13, 9, 0, 0, 6.28); g.fill();
  }
}

export function poolPhoto({ child = true, figure = 0 } = {}) {
  const wrap = h('div', { class: 'photo' });
  const inner = h('div', { class: 'photo-inner' });
  wrap.append(inner, h('div', { class: 'ph-vignette' }));
  const layers = [];
  const add = (el, depth) => {
    el.dataset.depth = depth;
    inner.append(el);
    layers.push(el);
  };
  add(canvasLayer(drawBack), 0.15);
  add(canvasLayer(drawWater), 0.35);
  if (figure > 0) {
    const f = h('div', { class: 'ph-figure', html: figureSVG({ face: 'pixel' }) });
    f.style.setProperty('--fh', `${26 + figure * 22}%`);
    f.style.setProperty('--fx', `${24 + figure * 3}%`);
    add(f, 0.5);
  }
  add(canvasLayer(drawColumn), 0.6);
  if (child) add(canvasLayer(drawChild), 0.75);
  add(canvasLayer(drawRope), 1);
  const api = {
    el: wrap,
    setTilt(x, y) {
      for (const l of layers) {
        const d = +l.dataset.depth;
        l.style.transform = `translate3d(${(-x * d * 7).toFixed(2)}%, ${(-y * d * 5).toFixed(2)}%, 0) scale(1.2)`;
      }
    },
    setBlur(px) {
      inner.style.filter = `blur(${px}px) saturate(0.85)`;
    },
    flatten() {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      for (const l of layers) if (l.tagName === 'CANVAS') g.drawImage(l, 0, 0);
      return c.toDataURL('image/jpeg', 0.88);
    },
  };
  api.setTilt(0, 0);
  return api;
}
