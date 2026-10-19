# Протокол: Лета — памятка

Мобильный психологический хоррор на Vite + Capacitor. Подробности — в README.md.

## Где что лежит
- Тексты, голосовые, пункты соглашения и тайминги — `src/content/script.ru.json`.
  `{name}` — имя игрока, `{|а}` / `{ся|ась}` — окончания по роду. Структуру ключей не менять.
- Сцены — `src/scenes/*.js`, порядок — массив `SCENES` в `src/scenes/index.js`
  (`manual: true` — в сцену попадают только явным переходом, это концовки).
- Звук — `src/audio/audio.js`; синтез речи — `src/audio/tts.js`.
- Датчики — `src/sensors/`, эффекты — `src/fx/`, Capacitor-плагины — `src/platform/`.

## Отладка
- Откройте игру с `#dev` в конце адреса: появится «Режим автора» (кнопка ✎ внизу слева) — переход к сценам, скорость ×3/×10, правка текстов, живые датчики.
- В консоли браузера с `#dev` доступен `window.lethe` (режиссёр сцен, состояние, звук).

## Сборки
- `npm run dev:https` — dev-сервер по HTTPS (самоподписанный сертификат) для телефона в той же Wi-Fi-сети: `https://<IP ПК>:5173/#dev`.
- `npm run build` — полная версия в `dist/`.
- `npm run build:phone` — версия в одном HTML-файле в `dist-phone/`.
- `npm run android` — сборка, `cap sync android` и открытие Android Studio (сначала один раз `npm run android:init`).
- GitHub Pages публикуется workflow `.github/workflows/pages.yml` при пуше в `main`.
