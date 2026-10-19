// Собирает версию «для телефона»: всё в одном HTML-файле, без зависимостей.
//   dist-phone/lethe.html     — для артефакта Claude (без <html>/<head>, их добавит Claude)
//   dist-phone/index.html     — полноценная страница для GitHub Pages или любого хостинга
//   dist-phone/script.ru.json — сценарий рядом со страницей (его правит «Режим автора»)
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist-phone');

// В одном файле нативных плагинов нет — подменяем модуль заглушкой.
const nativeStub = {
  name: 'native-stub',
  setup(b) {
    b.onResolve({ filter: /platform\/native\.js$|^\.\/native\.js$/ }, (args) => ({
      path: path.join(args.resolveDir, 'native-stub.js'),
    }));
  },
};

const res = await build({
  absWorkingDir: root,
  entryPoints: ['src/phone.js'],
  bundle: true,
  format: 'iife',
  write: false,
  outdir: out,
  minify: false,
  target: ['es2020', 'safari15', 'chrome90'],
  legalComments: 'none',
  charset: 'utf8',
  plugins: [nativeStub],
  logLevel: 'warning',
});

const js = res.outputFiles.find((f) => f.path.endsWith('.js')).text;
const css = res.outputFiles.find((f) => f.path.endsWith('.css'))?.text || '';
const content = JSON.parse(await fs.readFile(path.join(root, 'src/content/script.ru.json'), 'utf8'));
const safe = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

const head = [
  '<title>Протокол: Лета</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  '<meta name="theme-color" content="#000000">',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&family=JetBrains+Mono:wght@400;600&family=Neucha&display=swap">',
].join('\n');
const styles = `<style>\n${css}</style>`;
const body = [
  '<div id="app" data-mode="void"></div>',
  `<script type="application/json" id="lethe-content">${safe(JSON.stringify(content))}</script>`,
  `<script>\n${safe(js)}</script>`,
].join('\n');

await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, 'lethe.html'), `${head}\n${styles}\n${body}\n`);
await fs.writeFile(
  path.join(out, 'index.html'),
  `<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${head}\n${styles}\n</head>\n<body>\n${body}\n</body>\n</html>\n`,
);
await fs.writeFile(path.join(out, 'script.ru.json'), `${JSON.stringify(content, null, 2)}\n`);

const kb = (n) => `${(n / 1024).toFixed(0)} КБ`;
console.log(`Готово: dist-phone/lethe.html (${kb(Buffer.byteLength(js) + Buffer.byteLength(css))} кода), index.html, script.ru.json`);
