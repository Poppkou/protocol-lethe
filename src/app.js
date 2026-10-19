// Вход для полной версии (Vite → приложение Android/iOS через Capacitor или сайт).
// Шрифты лежат внутри приложения, интернет не нужен.
import '@fontsource/golos-text/400.css';
import '@fontsource/golos-text/500.css';
import '@fontsource/golos-text/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/neucha/400.css';
import './styles.css';
import defaults from './content/script.ru.json';
import { boot } from './main.js';

boot({ defaults });
