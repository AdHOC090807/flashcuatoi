import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig(({ command }) => {
  const base = process.env.VITE_BASE_PATH || (command === 'build' ? '/flashcuatoi/' : '/');

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/icon-192.svg', 'icons/icon-512.svg'],
        manifest: {
          name: 'LexiCards — Spaced Repetition Vocabulary',
          short_name: 'LexiCards',
          description:
            'Offline-first vocabulary learning app with SM-2 spaced repetition, 5 study modes, and analytics.',
          theme_color: '#4f46e5',
          background_color: '#f8fafc',
          display: 'standalone',
          start_url: base,
          scope: base,
          icons: [
            {
              src: 'icons/icon-192.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: 'icons/icon-512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
          runtimeCaching: [
            {
              urlPattern: /\/assets\/.*\.woff2?$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'self-hosted-fonts',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            dexie: ['dexie', 'dexie-react-hooks'],
            charts: ['recharts'],
            i18n: ['i18next', 'react-i18next'],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/tests/setup.ts',
      include: ['src/tests/**/*.test.{ts,tsx}'],
      exclude: ['src/tests/e2e/**'],
    },
  };
});
