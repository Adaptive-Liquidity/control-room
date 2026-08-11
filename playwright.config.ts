import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

/**
 * E2E against a running app (dev or preview).
 * Start the server separately, or set PLAYWRIGHT_BASE_URL.
 * Skips gracefully when auth fixtures are unavailable.
 *
 * Desktop runs the full suite; phone/tablet projects run only mobile.spec.ts.
 * iOS device descriptors default to WebKit — overridden to Chromium because
 * `npm run test:e2e:install` installs Chromium only.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: '**/mobile.spec.ts',
    },
    {
      name: 'mobile-chrome', // 390x844 phone
      use: { ...devices['iPhone 14'], browserName: 'chromium' },
      testMatch: '**/mobile.spec.ts',
    },
    {
      name: 'mobile-small', // 360x800 small Android
      use: { ...devices['Pixel 5'], viewport: { width: 360, height: 800 } },
      testMatch: '**/mobile.spec.ts',
    },
    {
      name: 'tablet', // 768x1024
      use: { ...devices['iPad Mini'], browserName: 'chromium' },
      testMatch: '**/mobile.spec.ts',
    },
  ],
});
