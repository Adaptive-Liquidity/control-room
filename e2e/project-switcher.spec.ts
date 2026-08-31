import { test, expect } from '@playwright/test';

const withAuth = !!process.env.E2E_WITH_AUTH;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@aeon.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'AeonAdmin123!';

test.describe('project switcher', () => {
  test.skip(!withAuth, 'Set E2E_WITH_AUTH=1 after seeding users');

  test('header exposes the active project after HQ setup', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/auth/signin'), { timeout: 15_000 });

    await page.goto('/dashboard');
    if (page.url().includes('/setup')) {
      test.skip(true, 'User still needs HQ setup');
      return;
    }
    await expect(page.getByRole('button', { name: 'Switch project' })).toBeVisible({
      timeout: 15_000,
    });
  });
});
