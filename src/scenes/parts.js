// Общие элементы сцен: строки файлов, кольцо памяти, голосовые сообщения, подпись.
import { h, once, Aborted, rand } from '../core/dom.js';

const ICON_FILE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.5h8l4 4v15H6z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M14 2.5v4h4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

export function fileRow(name, size, action) {
  const btn = h('button', { class: 'btn small', type: 'button' }, action);
  const row = h('div', { class: 'file' },
    h('span', { class: 'file-ico', html: ICON_FILE }),
    h('div', { class: 'file-name' }, h('span', {}, name), h('small', {}, size)),
    btn);
  return { row, btn };
}

// Первая нажатая кнопка из списка; промис с её индексом.
export function clickOne(buttons, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Aborted());
    const handlers = buttons.map((b, i) => {
      const fn = () => { off(); resolve(i); };
      b.addEventListener('click', fn);
      return fn;
    });
    const ab = () => { off(); reject(new Aborted()); };
    const off = () => {
      buttons.forEach((b, i) => b.removeEventListener('click', handlers[i]));
      signal?.removeEventListener('abort', ab);
    };
    signal?.addEventListener('abort', ab, { once: true });
  });
}

export function ringChart(value = 0) {
  const R = 42;
  const C = 2 * Math.PI * R;
  const el = h('div', { class: 'ring' });
  el.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${R}" class="ring-bg"/><circle cx="50" cy="50" r="${R}" class="ring-fg" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg>`;
  const fg = el.querySelector('.ring-fg');
  const label = h('div', { class: 'ring-pct' });
  el.append(label);
  const api = {
    el,
    set(v) {
      fg.style.strokeDashoffset = String(C * (1 - Math.max(0, Math.min(1, v))));
      label.textContent = `${Math.round(v * 100)}%`;
    },
    spin(on) {
      el.classList.toggle('spin', on);
    },
  };
  api.set(value);
  return api;
}

export const parseDur = (s) => {
  const [m, sec] = String(s).split(':').map(Number);
  return (m || 0) * 60 + (sec || 0);
};

// Порча текста: часть букв заменяется на «битые» символы.
export function corrupt(text, level = 0) {
  if (!level) return text;
  const p = [0, 0.06, 0.15, 0.3][Math.min(3, level)];
  const junk = '█▓▒░▚▞▙';
  return [...text].map((ch) => (/\S/.test(ch) && Math.random() < p ? junk[(Math.random() * junk.length) | 0] : ch)).join('');
}

// Пузырь голосового сообщения.
export function voiceBubble(v, { sender = 'С.', state = 'ready' } = {}) {
  const play = h('button', { class: 'v-play', type: 'button', 'aria-label': 'Прослушать', html: ICON_PLAY });
  const del = h('button', { class: 'v-del', type: 'button', 'aria-label': 'Удалить', html: ICON_TRASH });
  const wave = h('div', { class: 'v-wave' });
  let seed = [...v.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  for (let i = 0; i < 30; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    wave.append(h('i', { style: { height: `${20 + (seed / 233280) * 80}%` } }));
  }
  const meta = h('div', { class: 'v-meta' }, h('b', {}, sender), ` · ${v.time} · ${v.dur}`);
  const sub = h('p', { class: 'v-sub', hidden: true });
  const el = h('div', { class: `vmsg ${state}` }, play, h('div', { class: 'v-body' }, wave, meta), del, sub);
  return {
    el,
    play,
    del,
    sub,
    action(signal) {
      return clickOne([play, del], signal).then((i) => (i === 0 ? 'play' : 'delete'));
    },
    setState(s) {
      el.className = `vmsg ${s}`;
    },
    progress(p) {
      const n = wave.children.length;
      [...wave.children].forEach((b, i) => b.classList.toggle('on', i / n < p));
    },
  };
}

// Проигрывает голосовое: атмосфера, субтитры, синтез речи (или записанный файл).
export async function playVoice(ctx, v, b) {
  const { audio, tts, C, state, fx } = ctx;
  b.setState('playing');
  b.sub.hidden = false;
  audio.amb(v.amb);
  if (v.song) audio.song('hum', { level: 0.4, loop: false });
  const durMs = parseDur(v.dur) * 1000;
  const t0 = performance.now();
  const timer = setInterval(() => b.progress((performance.now() - t0) / durMs), 100);
  const glitchT = v.degrade
    ? setInterval(() => {
      if (Math.random() < 0.3 * v.degrade) {
        audio.glitchSound(0.12, 0.04 * v.degrade);
        fx.glitch(120, 0.25 * v.degrade);
      }
    }, 700)
    : null;
  try {
    const typing = ctx.ui.type(b.sub, corrupt(v.text, v.degrade), { signal: ctx.signal, ms: 45 });
    const speaking = (async () => {
      if (v.silent || !state.settings.tts) return ctx.wait(durMs);
      if (C.audio.voiceFiles && (await audio.playFile(v.id, { bus: 'mem', wet: 0.4 }))) return;
      const who = v.degrade ? 'sonyaLow' : 'sonya';
      if (v.degrade >= 3) {
        for (const part of v.text.split('…').map((s) => s.trim()).filter(Boolean)) {
          audio.glitchSound(0.25, 0.08);
          await ctx.wait(450);
          await tts.speak(part, { who, signal: ctx.signal });
        }
        return;
      }
      const ok = await tts.speak(v.text, { who, signal: ctx.signal });
      if (!ok) await ctx.wait(durMs);
    })();
    await Promise.all([typing, speaking, ctx.wait(Math.min(durMs, 3000))]);
    await ctx.wait(400);
  } finally {
    clearInterval(timer);
    clearInterval(glitchT);
    audio.amb(null);
    if (v.song) audio.song(null);
  }
  b.progress(1);
  b.setState('done');
}

// Подпись пальцем. Возвращает штрихи в долях холста.
export async function signaturePad(ctx, { clearLabel, doneLabel }) {
  const canvas = h('canvas', { class: 'sig-pad' });
  const clearBtn = ctx.ui.button(clearLabel, { cls: 'ghost' });
  const doneBtn = ctx.ui.button(doneLabel, { cls: 'primary' });
  doneBtn.disabled = true;
  const box = h('div', { class: 'sig-box' }, canvas, h('div', { class: 'choices' }, clearBtn, doneBtn));
  return {
    box,
    async run() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      const g = canvas.getContext('2d');
      g.scale(dpr, dpr);
      g.lineWidth = 2.4;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.strokeStyle = '#1d3c8a';
      let strokes = [];
      let cur = null;
      let length = 0;
      const pos = (e) => {
        const b = canvas.getBoundingClientRect();
        return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height];
      };
      canvas.addEventListener('pointerdown', (e) => {
        canvas.setPointerCapture?.(e.pointerId);
        cur = [pos(e)];
        strokes.push(cur);
      });
      canvas.addEventListener('pointermove', (e) => {
        if (!cur) return;
        const p = pos(e);
        const q = cur[cur.length - 1];
        length += Math.hypot(p[0] - q[0], p[1] - q[1]);
        cur.push(p);
        g.beginPath();
        g.moveTo(q[0] * r.width, q[1] * r.height);
        g.lineTo(p[0] * r.width, p[1] * r.height);
        g.stroke();
        if (length > 0.8) doneBtn.disabled = false;
      });
      const up = () => { cur = null; };
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
      clearBtn.addEventListener('click', () => {
        strokes = [];
        length = 0;
        g.clearRect(0, 0, r.width, r.height);
        doneBtn.disabled = true;
      });
      await once(doneBtn, 'click', ctx.signal);
      return strokes.map((s) => s.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]));
    },
  };
}

// Повторяет подпись игрока на холсте, «вживую».
export async function replaySignature(ctx, canvas, strokes) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = r.width * dpr;
  canvas.height = r.height * dpr;
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  g.lineWidth = 2;
  g.lineCap = 'round';
  g.strokeStyle = '#1d3c8a';
  const data = strokes?.length ? strokes : fakeScribble();
  for (const s of data) {
    for (let i = 1; i < s.length; i++) {
      g.beginPath();
      g.moveTo(s[i - 1][0] * r.width, s[i - 1][1] * r.height);
      g.lineTo(s[i][0] * r.width, s[i][1] * r.height);
      g.stroke();
      if (i % 3 === 0) await ctx.wait(12);
    }
  }
}

function fakeScribble() {
  const pts = [];
  for (let i = 0; i <= 40; i++) pts.push([0.1 + i * 0.02, 0.55 + Math.sin(i * 0.7) * 0.18 + rand(-0.03, 0.03)]);
  return [pts];
}

export function scheduleNext(ctx, key) {
  if (!ctx.platform.canNotify) return;
  const at = new Date();
  at.setDate(at.getDate() + 1);
  at.setHours(18, 41, 0, 0);
  const n = ctx.C.notifications[key];
  ctx.platform.schedule([{ id: 201, title: n.title, body: n.body, at }]);
}

export function listenedAll(ctx) {
  return ctx.C.voices.slice(0, 6).every((v) => ctx.state.listened[v.id]);
}
