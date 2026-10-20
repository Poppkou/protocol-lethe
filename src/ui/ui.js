// Каркас экрана: фейковая строка состояния, сцена, реплики Системы, слой эффектов.
import { h, sleep, once, clockRu, Aborted } from '../core/dom.js';

// Белый кипарис — знак ЛЕТЫ.
export const LOGO = '<svg class="logo" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5c-2.6 4.2-3.8 8.6-3.4 13.2.3 3.3 1.6 5.6 3.4 6.3 1.8-.7 3.1-3 3.4-6.3.4-4.6-.8-9-3.4-13.2z" fill="currentColor"/><path d="M12 6.5v16" stroke="var(--logo-vein)" stroke-width=".9"/></svg>';

const BAT = (p) => `<svg viewBox="0 0 26 12" class="bat" aria-hidden="true"><rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke="currentColor"/><rect x="2" y="2" width="${Math.max(0.5, (19 * p) / 100).toFixed(1)}" height="8" rx="1.5" fill="currentColor"/><rect x="23.5" y="4" width="2" height="4" rx="1" fill="currentColor"/></svg>`;

export class UI {
  constructor(root) {
    this.root = root;
    root.replaceChildren();
    this.stTime = h('span', { class: 'st-time' }, clockRu());
    this.stSession = h('span', { class: 'st-session' });
    this.stTemp = h('span', { class: 'st-temp', hidden: true });
    this.stBat = h('span', { class: 'st-bat' });
    this.status = h('div', { class: 'status', hidden: true }, this.stTime, this.stSession, h('span', { class: 'st-right' }, this.stTemp, this.stBat));
    this.stage = h('main', { class: 'stage' });
    this.sysText = h('p', { class: 'sys-text', 'aria-live': 'polite' });
    // Строка журнала: метка приложения и время реплики, как в системном логе.
    this.sysStamp = h('span', { class: 'sys-stamp' });
    this.sys = h('div', { class: 'sys', hidden: true },
      h('div', { class: 'sys-head' }, h('span', { class: 'sys-logo', html: LOGO }), h('span', { class: 'sys-app' }, 'ЛЕТА'), this.sysStamp),
      this.sysText);
    this.fxCanvas = h('canvas', { class: 'fx', 'aria-hidden': 'true' });
    this.over = h('div', { class: 'over' });
    root.append(this.status, this.stage, this.sys, this.fxCanvas, this.over);
    this.battery = 100;
    this.typeMs = 28;
    this.speed = () => 1;
    this.skipTyping = false;
    setInterval(() => { this.stTime.textContent = clockRu(); }, 15000);
    root.addEventListener('pointerdown', () => { this.skipTyping = true; });
    this.setBattery(100);
  }

  setMode(mode) {
    this.root.dataset.mode = mode;
  }

  showStatus(on) {
    this.status.hidden = !on;
  }

  setBattery(p) {
    this.battery = Math.max(0, Math.min(100, Math.round(p)));
    this.stBat.innerHTML = `${BAT(this.battery)}<span>${this.battery}%</span>`;
    this.stBat.classList.toggle('low', this.battery <= 15);
  }

  setTemp(text) {
    this.stTemp.hidden = !text;
    this.stTemp.textContent = text || '';
  }

  setSession(text) {
    this.stSession.textContent = text || '';
  }

  clear() {
    this.stage.replaceChildren();
    this.stage.className = 'stage';
    this.stage.style.transform = '';
    this.over.replaceChildren();
    this.sysHide();
  }

  // Печатная машинка. Касание экрана допечатывает строку сразу.
  async type(el, text, { signal, ms } = {}) {
    // новая строка в том же элементе прерывает предыдущую
    const gen = (el._typeGen = (el._typeGen || 0) + 1);
    el.textContent = '';
    this.skipTyping = false;
    const per = (ms ?? this.typeMs) / this.speed();
    let out = '';
    for (const ch of text) {
      if (this.skipTyping || per <= 0.5) break;
      out += ch;
      el.textContent = out;
      await sleep(ch === ' ' ? per * 0.5 : /[.,!?…—:]/.test(ch) ? per * 6 : per, signal);
      if (el._typeGen !== gen) return;
    }
    if (el._typeGen === gen) el.textContent = text;
  }

  async sysSay(text, opts = {}) {
    this.sys.hidden = false;
    this.sys.dataset.tone = opts.tone || '';
    const d = new Date();
    this.sysStamp.textContent = `${clockRu()}:${String(d.getSeconds()).padStart(2, '0')}`;
    await this.type(this.sysText, text, opts);
  }

  sysHide() {
    this.sys.hidden = true;
    this.sysText.textContent = '';
  }

  button(label, { cls = '', onclick, id } = {}) {
    return h('button', { class: `btn ${cls}`, type: 'button', onclick, id }, label);
  }

  // Ряд кнопок; промис с индексом нажатой.
  choice(labels, { signal, container = this.stage, cls = '' } = {}) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new Aborted());
      const row = h('div', { class: `choices ${cls}` });
      labels.forEach((label, i) => {
        row.append(this.button(label, {
          cls: i === 0 ? 'primary' : '',
          onclick: () => { row.remove(); resolve(i); },
        }));
      });
      container.append(row);
      signal?.addEventListener('abort', () => { row.remove(); reject(new Aborted()); }, { once: true });
    });
  }

  tap(el, signal) {
    return once(el, 'click', signal);
  }
}
