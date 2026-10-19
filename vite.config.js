import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// base: './' — относительные пути, чтобы сборка работала и в приложении (Capacitor), и на GitHub Pages.
// npm run dev:https включает самоподписанный HTTPS: без него телефон в той же Wi-Fi-сети
// не даст странице микрофон, камеру и датчики.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'https' ? [basicSsl()] : [],
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
  server: {
    host: true,
  },
}));
