import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for ai-avatar-bot-vanilla-js.
 * Supports Track A (UI Contract Parity) and Track B (Real Engine Smoke).
 */
const reportDir = process.env.PLAYWRIGHT_HTML_REPORT_DIR || 'playwright-report/all';

export default defineConfig({
  testDir: './test/e2e/specs',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: reportDir }]],

  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      args: [
        '--autoplay-policy=no-user-gesture-required',
        '--use-gl=angle',
        '--enable-webgl',
        '--no-sandbox'
      ]
    }
  },

  projects: [
    {
      name: 'contract',
      testMatch: /contract\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'engine',
      testMatch: /engine\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    }
  ],

  webServer: {
    command: 'yarn dev --port 5173 --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  }
});
