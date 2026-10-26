import { defineConfig, devices } from '@playwright/test';

// End-to-end flows run against the production build, so the service worker and offline mode are real.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 240_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...devices['iPhone 13'],
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --host 127.0.0.1 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
