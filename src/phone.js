// Вход для версии «один HTML-файл» (артефакт Claude, GitHub Pages, любой хостинг).
// Сценарий встроен в страницу; если рядом лежит script.ru.json — берётся он.
import './styles.css';
import { boot } from './main.js';

const embedded = JSON.parse(document.getElementById('lethe-content').textContent);

// Сохранение правок «Режима автора» как новой версии артефакта (файл script.ru.json рядом со страницей).
async function publish(json) {
  const artifact = await window.claude.use('artifact');
  if (!artifact) throw { code: 'unavailable' };
  return artifact.publish({ 'script.ru.json': json });
}

async function download(filename, text) {
  const downloads = await window.claude.use('downloads');
  if (!downloads) throw { code: 'unavailable' };
  return downloads.save({ filename, data: text });
}

const inClaude = typeof window.claude?.use === 'function';
const start = () => boot({
  defaults: embedded,
  remote: true,
  publish: inClaude ? publish : null,
  download: inClaude ? download : null,
});

const hot = window.claude?.hot;
if (hot?.ready) hot.ready(start);
else start();
