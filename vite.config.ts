import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages demo build: VITE_BASE=/warehouse-orders-pwa/ (defaults to / everywhere else).
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered in src/main.tsx, so the app can reload itself onto a new version.
      injectRegister: false,
      // A new version takes over by itself — it must not wait for the old page to hand over.
      workbox: { skipWaiting: true, clientsClaim: true },
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'ניהול הזמנות',
        short_name: 'הזמנות',
        lang: 'he',
        dir: 'rtl',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f8fafc',
        theme_color: '#1e3a8a',
        icons: [{ src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  server: {
    // dev:live — the app calls /api, forwarded to the local API server (npm run server).
    proxy: { '/api': 'http://localhost:8787' },
  },
  // Business-day rules run in Israel time; pin the tests to it so CI (UTC) matches a local run.
  test: { environment: 'node', env: { TZ: 'Asia/Jerusalem' } },
});
