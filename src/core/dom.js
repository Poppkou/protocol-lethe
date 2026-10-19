// Мелкие помощники: создание DOM, ожидания с отменой, математика.

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Aborted extends Error {
  constructor() {
    super('aborted');
    this.name = 'AbortError';
  }
}

export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Aborted());
    const t = setTimeout(resolve, Math.max(0, ms));
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Aborted()); }, { once: true });
  });
}

// Ждёт, пока pred() станет истинным. Возвращает true, или false по таймауту.
export async function until(pred, { every = 100, timeout = Infinity, signal } = {}) {
  const t0 = performance.now();
  while (!pred()) {
    if (performance.now() - t0 > timeout) return false;
    await sleep(every, signal);
  }
  return true;
}

// Промис первого события ev на элементе el.
export function once(el, ev, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Aborted());
    const on = (e) => { off(); resolve(e); };
    const ab = () => { off(); reject(new Aborted()); };
    const off = () => { el.removeEventListener(ev, on); signal?.removeEventListener('abort', ab); };
    el.addEventListener(ev, on);
    signal?.addEventListener('abort', ab, { once: true });
  });
}

export const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

export function storage(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key));
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return null;
  }
  return null;
}

// Сегодняшняя дата в виде 19.10.2026
export function todayRu() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function clockRu(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
