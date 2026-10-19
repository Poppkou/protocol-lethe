// Фейковый экран блокировки (замена уведомлениям в браузере) и фейковый рабочий стол.
// Стилизованы нарочно обобщённо — без иконок и интерфейса Apple/Google.
import { h, clockRu } from '../core/dom.js';
import { LOGO } from '../ui/ui.js';

export function lockScreen(notes, { hint = 'Нажмите, чтобы вернуться' } = {}) {
  const now = new Date();
  const date = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  return h('div', { class: 'lock' },
    h('div', { class: 'lock-date' }, date),
    h('div', { class: 'lock-time' }, clockRu(now)),
    h('div', { class: 'lock-notes' },
      notes.map((n) => h('div', { class: 'note' },
        h('div', { class: `note-ico ${n.app === 'ЛЕТА' ? 'lethe' : 'msg'}`, html: n.app === 'ЛЕТА' ? LOGO : '' }),
        h('div', { class: 'note-body' },
          h('div', { class: 'note-head' }, h('b', {}, n.title), h('span', {}, 'сейчас')),
          h('div', {}, n.body))))),
    h('div', { class: 'lock-hint' }, hint));
}

const ICON_HUES = [200, 25, 140, 0, 210, 330, 48, 120, 220, 10, 180, 260, 150, 0, 230, 350];

export function homeScreen(apps, onTap) {
  const grid = h('div', { class: 'home-grid' });
  apps.forEach((name, i) => {
    const isLethe = name === 'ЛЕТА';
    const ico = h('span', {
      class: `home-ico ${isLethe ? 'lethe' : ''}`,
      style: isLethe ? null : { background: `linear-gradient(160deg, hsl(${ICON_HUES[i % 16]} 55% 58%), hsl(${ICON_HUES[i % 16]} 60% 38%))` },
      html: isLethe ? LOGO : `<b>${name[0]}</b>`,
    });
    grid.append(h('button', { class: 'home-app', type: 'button', onclick: () => onTap(name) }, ico, h('span', { class: 'home-label' }, name)));
  });
  return h('div', { class: 'home' }, h('div', { class: 'home-time' }, clockRu()), grid);
}
