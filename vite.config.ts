/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  resolve: {
    alias: { '@deck': fileURLToPath(new URL('./handoff/data/deck.json', import.meta.url)) },
  },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2022', cssMinify: true, assetsInlineLimit: 0 },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Bain Amach',
        short_name: 'Bain Amach',
        description: 'A fast card game for Ulster Irish compound verbs.',
        lang: 'ga',
        start_url: './',
        scope: './',
        id: './',
        display: 'standalone',
        display_override: ['standalone'],
        orientation: 'any',
        background_color: '#bfd3cc',
        theme_color: '#bfd3cc',
        categories: ['games', 'education'],
        icons: [
          { src: 'icons/icon-48.png', sizes: '48x48', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-monochrome-512.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // Everything the game needs, fonts included. Splash images are fetched by iOS at install, not cached here.
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,webmanifest}'],
        globIgnores: ['splash/**'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Take control of the first page load so it works offline straight away. Updates still wait for Restart.
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['src/**/*.test.ts'], exclude: ['src/**/*.stats.test.ts'] } },
      { extends: true, test: { name: 'stats', include: ['src/**/*.stats.test.ts'], testTimeout: 600000 } },
    ],
  },
});
