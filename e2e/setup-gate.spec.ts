import { test, expect } from '@playwright/test';

const withAuth = !!process.env.E2E_WITH_AUTH;

test.describe('setup gate', () => {
  test.skip(!withAuth, 'Set E2E_WITH_AUTH=1 after seeding users');

  test('authenticated user reaches setup or main shell', async ({ page }) => {
    await page.goto('/setup');
    await expect(page.locator('body')).toBeVisible();
    // Either the setup wizard is shown, or middleware already cleared needsSetup
    // and redirected into the authenticated shell.
    const onSetup = page.url().includes('/setup');
    const onShell =
      page.url().includes('/dashboard') ||
      page.url().includes('/queue') ||
      page.url().includes('/agents');
    expect(onSetup || onShell).toBeTruthy();
  });
});
