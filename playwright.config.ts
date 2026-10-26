import { defineConfig, devices } from '@playwright/test';

// Tests can run against a subpath build (as on GitHub Pages): BASE_PATH=/bain-amach/ npm run e2e
const base = process.env.BASE_PATH || '/';

// End-to-end flows run against the production build, so the service worker and offline mode are real.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 240_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173' + base,
    ...devices['iPhone 13'],
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --host 127.0.0.1 --strictPort',
    url: 'http://127.0.0.1:4173' + base,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
