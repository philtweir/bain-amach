/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@deck': fileURLToPath(new URL('./handoff/data/deck.json', import.meta.url)) },
  },
  plugins: [preact()],
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['src/**/*.test.ts'], exclude: ['src/**/*.stats.test.ts'] } },
      { extends: true, test: { name: 'stats', include: ['src/**/*.stats.test.ts'], testTimeout: 600000 } },
    ],
  },
});
