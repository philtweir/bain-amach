/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Two channels on one Pages site (see .github/workflows/pages.yml):
//   release  /bain-amach/       the newest vX.Y.Z tag
//   main     /bain-amach/main/  the tip of main, stamped IN TEST, its own app and its own storage
const channel = process.env.APP_CHANNEL === 'main' ? 'main' : 'release';
const test = channel === 'main';
const base = process.env.BASE_PATH || '/';
const icons = test ? 'icons-test' : 'icons';
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default defineConfig({
  // GitHub Pages serves the app from /<repo>/; the deploy workflow sets BASE_PATH.
  base,
  resolve: {
    alias: { '@deck': fileURLToPath(new URL('./data/deck.json', import.meta.url)) },
  },
  define: {
    // A release shows its tag (APP_VERSION=v1.2.0 from CI); local builds fall back to package.json.
    __APP_VERSION__: JSON.stringify((process.env.APP_VERSION || pkg.version).replace(/^v/, '')),
    __APP_CHANNEL__: JSON.stringify(channel),
    __APP_COMMIT__: JSON.stringify(process.env.APP_COMMIT || ''),
    __APP_BUILT__: JSON.stringify(process.env.APP_BUILT || ''),
    /** The test build's sheet names the current release tag. */
    __APP_RELEASE__: JSON.stringify(process.env.APP_RELEASE || ''),
  },
  build: { target: 'es2022', cssMinify: true, assetsInlineLimit: 0 },
  plugins: [
    preact(),
    // iOS reads the home-screen icon and title from the page, not the manifest.
    {
      name: 'channel-html',
      transformIndexHtml: {
        order: 'pre',
        handler: (html: string) =>
          test ? html.replaceAll('/icons/', '/icons-test/').replace('name="apple-mobile-web-app-title" content="Bain Amach"', 'name="apple-mobile-web-app-title" content="BA test"') : html,
      },
    },
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: [`${icons}/*.png`, `${icons}/*.svg`],
      manifest: {
        name: test ? 'Bain Amach (test)' : 'Bain Amach',
        short_name: test ? 'BA test' : 'Bain Amach',
        description: 'A fast card game for Ulster Irish compound verbs.',
        lang: 'ga',
        start_url: './',
        scope: './',
        // id resolves against the origin, not the base path: './' means https://philtweir.github.io/.
        // The release keeps it so existing installs stay the same app; the test build needs its own.
        id: test ? base : './',
        display: 'standalone',
        display_override: ['standalone'],
        orientation: 'any',
        // Android paints its navigation bar in the manifest colour when it won't draw the app behind
        // it, and the manifest can't vary by theme. The dark tray colour reads as a normal system bar
        // under either theme; the light felt looked broken under the dark one.
        background_color: '#1c2523',
        theme_color: '#1c2523',
        categories: ['games', 'education'],
        icons: [
          { src: `${icons}/icon-48.png`, sizes: '48x48', type: 'image/png', purpose: 'any' },
          { src: `${icons}/icon-72.png`, sizes: '72x72', type: 'image/png', purpose: 'any' },
          { src: `${icons}/icon-96.png`, sizes: '96x96', type: 'image/png', purpose: 'any' },
          { src: `${icons}/icon-144.png`, sizes: '144x144', type: 'image/png', purpose: 'any' },
          { src: `${icons}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${icons}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${icons}/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: `${icons}/icon-monochrome-512.png`, sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
          { src: `${icons}/icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // Everything the game needs, fonts included. Splash images are fetched by iOS at install, not cached here.
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,webmanifest}'],
        // Each channel precaches only its own icons.
        globIgnores: ['splash/**', test ? 'icons/**' : 'icons-test/**'],
        navigateFallback: 'index.html',
        // The release's scope contains the test build's. Never answer navigations for it, or a player with
        // the release installed opening /main/ gets the release app and the test build never registers.
        navigateFallbackDenylist: test ? [] : [new RegExp('^' + escapeRe(base) + 'main/')],
        // Test build's caches get their own name; the release keeps Workbox's default so installs don't re-download.
        ...(test ? { cacheId: 'bain-amach-main' } : {}),
        // Off: Workbox deletes every precache whose name contains this scope, and the test build's cache
        // name contains the release's scope. Precache v2 keeps one cache per channel, so nothing goes stale.
        cleanupOutdatedCaches: false,
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
