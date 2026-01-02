
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,        // To jest kluczowe dla Nginxa
    host: '0.0.0.0',   // To wystawia apkę na zewnątrz kontenera
    allowedHosts: true, // To zdejmuje blokadę "Blocked request"
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
