
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Przekierowuje każde zapytanie zaczynające się od /api_hotres do panel.hotres.pl
      '/api_hotres': {
        target: 'https://panel.hotres.pl',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api_hotres/, ''),
      },
    },
  },
});
