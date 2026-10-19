// «Режим автора»: переход к любой сцене, ускорение, правка всех текстов и таймингов
// прямо на телефоне, проверка датчиков. Открывается через #dev в адресе
// или пятью быстрыми касаниями в левом верхнем углу экрана.
import { h, storage } from '../core/dom.js';
import { saveDraft, clearDraft } from '../core/content.js';
import { clearSave } from '../core/state.js';

const PINNED = 'lethe.author';

function leaves(obj, path = [], out = []) {
  if (Array.isArray(obj)) obj.forEach((v, i) => leaves(v, [...path, i], out));
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) if (!k.startsWith('_')) leaves(v, [...path, k], out);
  } else out.push([path, obj]);
  return out;
}

function setPath(obj, path, value) {
  let o = obj;
  for (let i = 0; i < path.length - 1; i++) o = o[path[i]];
  o[path[path.length - 1]] = value;
}

export class Author {
  constructor(deps) {
    Object.assign(this, deps);
    this.open = false;
    this.tab = 'scenes';
    this.work = null;
    this.dirty = false;
    this.fab = h('button', { class: 'author-fab', type: 'button', 'aria-label': 'Режим автора', hidden: true, onclick: () => this.toggle() }, '✎');
    this.sheet = h('aside', { class: 'author', hidden: true, 'aria-label': 'Режим автора' });
    document.body.append(this.fab, this.sheet);
    if (location.hash === '#dev' || storage(PINNED)) this.enable();
    window.addEventListener('hashchange', () => { if (location.hash === '#dev') this.enable(); });
    // пять быстрых касаний в левом верхнем углу
    let taps = [];
    window.addEventListener('pointerdown', (e) => {
      if (e.clientX > 64 || e.clientY > 64) return;
      const now = performance.now();
      taps = taps.filter((t) => now - t < 2000);
      taps.push(now);
      if (taps.length >= 5) {
        taps = [];
        this.enable();
        this.toggle(true);
      }
    }, true);
  }

  enable() {
    this.fab.hidden = false;
    storage(PINNED, true);
  }

  toggle(force) {
    this.open = force ?? !this.open;
    this.sheet.hidden = !this.open;
    if (this.open) this.render();
  }

  render() {
    const tabs = [['scenes', 'Сцены'], ['texts', 'Тексты'], ['sensors', 'Датчики']];
    const head = h('div', { class: 'au-head' },
      h('b', {}, 'Режим автора'),
      h('div', { class: 'au-tabs', role: 'tablist' }, tabs.map(([id, label]) => h('button', {
        class: `au-tab ${this.tab === id ? 'on' : ''}`,
        type: 'button',
        role: 'tab',
        'aria-selected': String(this.tab === id),
        onclick: () => { this.tab = id; this.render(); },
      }, label))),
      h('button', { class: 'au-x', type: 'button', 'aria-label': 'Закрыть', onclick: () => this.toggle(false) }, '×'));
    const body = h('div', { class: 'au-body' });
    clearInterval(this.sensorT);
    if (this.tab === 'scenes') this.renderScenes(body);
    if (this.tab === 'texts') this.renderTexts(body);
    if (this.tab === 'sensors') this.renderSensors(body);
    this.sheet.replaceChildren(head, body);
  }

  renderScenes(body) {
    const d = this.director;
    const speeds = h('div', { class: 'au-row' }, h('span', {}, 'Скорость:'),
      [1, 3, 10].map((s) => h('button', {
        class: `au-chip ${d.speed === s ? 'on' : ''}`,
        type: 'button',
        onclick: () => { d.speed = s; this.render(); },
      }, `×${s}`)));
    const list = h('ol', { class: 'au-scenes' }, d.scenes.map((s) => h('li', {},
      h('button', {
        class: `au-scene ${d.current?.id === s.id ? 'on' : ''}`,
        type: 'button',
        onclick: () => {
          this.toggle(false);
          d.jump(s.id);
        },
      }, h('span', {}, s.title || s.id), h('small', { class: 'mono' }, s.id)))));
    const reset = h('button', {
      class: 'au-btn danger',
      type: 'button',
      onclick: () => {
        clearSave();
        this.resetState();
        this.toggle(false);
        d.jump('warning');
      },
    }, 'Стереть прогресс и начать заново');
    body.append(
      h('p', { class: 'au-note' }, 'Нажмите сцену, чтобы перейти к ней. Звук и датчики включаются после первого нажатия «Начать сеанс».'),
      speeds, list, reset);
  }

  renderTexts(body) {
    if (!this.work) this.work = JSON.parse(JSON.stringify(this.game.C));
    const status = h('p', { class: 'au-note' }, this.dirty
      ? 'Есть несохранённые правки — они уже работают в игре.'
      : this.game.draft ? 'Используется ваш черновик сценария.' : 'Исходный сценарий.');
    const search = h('input', { class: 'au-search', type: 'search', placeholder: 'Поиск: ключ или текст', id: 'au-search', value: this.query || '' });
    const list = h('div', { class: 'au-fields' });
    const draw = () => {
      const q = (this.query || '').toLowerCase();
      const items = leaves(this.work).filter(([p, v]) => !q || p.join('.').toLowerCase().includes(q) || String(v).toLowerCase().includes(q));
      list.replaceChildren(...items.slice(0, 60).map(([path, value]) => {
        const id = `f-${path.join('-')}`;
        const isNum = typeof value === 'number';
        const isBool = typeof value === 'boolean';
        const input = isBool
          ? h('input', { type: 'checkbox', id })
          : isNum
            ? h('input', { type: 'number', id, value: String(value), step: 'any' })
            : h('textarea', { id, rows: String(Math.min(6, Math.ceil(String(value).length / 38) || 1)) });
        if (isBool) input.checked = value;
        if (!isNum && !isBool) input.value = value;
        input.addEventListener('change', () => {
          const v = isBool ? input.checked : isNum ? Number(input.value) : input.value;
          setPath(this.work, path, v);
          this.dirty = true;
          this.game.setContent(this.work);
          status.textContent = 'Есть несохранённые правки — они уже работают в игре.';
        });
        return h('label', { class: 'au-field', for: id }, h('span', { class: 'mono' }, path.join('.')), input);
      }));
      if (items.length > 60) list.append(h('p', { class: 'au-note' }, `Показаны 60 из ${items.length}. Уточните поиск.`));
    };
    search.addEventListener('input', () => { this.query = search.value; draw(); });
    draw();
    const msg = h('p', { class: 'au-msg', 'aria-live': 'polite' });
    const json = () => JSON.stringify({ _readme: this.game.defaults._readme, ...this.work }, null, 2);
    const save = h('button', {
      class: 'au-btn primary',
      type: 'button',
      onclick: async () => {
        saveDraft(this.work);
        this.game.draft = this.work;
        this.dirty = false;
        if (this.game.publish) {
          msg.textContent = 'Сохраняю в артефакт…';
          try {
            await this.game.publish(json());
            msg.textContent = 'Сохранено. Новая версия сценария опубликована.';
          } catch (e) {
            msg.textContent = `Сохранено только в этом браузере (публикация недоступна: ${e?.code || 'ошибка'}). Сделайте экспорт, чтобы не потерять.`;
          }
        } else {
          msg.textContent = 'Сохранено в этом браузере. Для переноса на ПК нажмите «Экспорт».';
        }
      },
    }, 'Сохранить');
    const exp = h('button', {
      class: 'au-btn',
      type: 'button',
      onclick: async () => {
        try {
          await this.game.download('script.ru.json', json());
          msg.textContent = 'Файл script.ru.json отдан на сохранение. На ПК положите его в src/content/.';
        } catch (e) {
          msg.textContent = e?.code === 'declined' ? 'Сохранение отменено.' : 'Скачать не получилось — используйте «Копировать».';
        }
      },
    }, 'Экспорт JSON');
    const copy = h('button', {
      class: 'au-btn',
      type: 'button',
      onclick: () => {
        navigator.clipboard.writeText(json()).then(
          () => { msg.textContent = 'JSON скопирован.'; },
          () => { msg.textContent = 'Буфер обмена недоступен.'; });
      },
    }, 'Копировать');
    const revert = h('button', {
      class: 'au-btn danger',
      type: 'button',
      onclick: () => {
        clearDraft();
        this.game.draft = null;
        this.work = JSON.parse(JSON.stringify(this.game.base));
        this.game.setContent(this.work);
        this.dirty = false;
        this.render();
      },
    }, 'Вернуть исходный');
    body.append(status, search, list, h('div', { class: 'au-actions' }, save, exp, copy, revert), msg);
  }

  renderSensors(body) {
    const out = h('pre', { class: 'au-pre mono' });
    const micBtn = h('button', {
      class: 'au-btn',
      type: 'button',
      onclick: async () => {
        await this.mic.audio.init();
        micBtn.textContent = (await this.mic.start()) ? 'Микрофон включён' : 'Микрофон недоступен';
      },
    }, 'Включить микрофон');
    const motionBtn = h('button', { class: 'au-btn', type: 'button', onclick: () => this.motion.permission() }, 'Разрешить датчики');
    const vibBtn = h('button', {
      class: 'au-btn',
      type: 'button',
      onclick: () => {
        this.haptics.probe();
        this.haptics.lubdub(1, { sound: false });
      },
    }, 'Проверить вибрацию');
    body.append(h('div', { class: 'au-actions' }, micBtn, motionBtn, vibBtn), out);
    const tick = () => {
      const t = this.motion.tilt();
      out.textContent = [
        `Платформа: ${this.platform.isNative ? 'приложение (Capacitor)' : 'браузер'}`,
        `Голос речи: ${this.tts.voice ? this.tts.voice.name : 'нет русского голоса'}`,
        `Вибрация: ${this.haptics.can ? 'есть' : 'нет (замена звуком и тряской)'}`,
        `Микрофон: ${this.mic.on ? `${this.mic.level().toFixed(1)} дБ, фон ${this.mic.base.toFixed(1)} дБ` : 'выключен'}`,
        `Наклон: ${this.motion.live ? `β ${this.motion.beta.toFixed(0)}°, γ ${this.motion.gamma.toFixed(0)}°` : 'нет данных (палец вместо датчика)'}`,
        `Наклон x/y: ${t.x.toFixed(2)} / ${t.y.toFixed(2)}`,
        `Экраном вниз: ${this.motion.faceDown ? 'да' : 'нет'}`,
        `Тряска: ${this.motion.energy.toFixed(2)}`,
        `Сцена: ${this.director.current?.id || '—'}`,
      ].join('\n');
    };
    tick();
    this.sensorT = setInterval(() => { if (this.open && this.tab === 'sensors') tick(); }, 200);
  }
}
