import { test, expect } from '@playwright/test';

const withAuth = !!process.env.E2E_WITH_AUTH;

test.describe('project switcher', () => {
  test.skip(!withAuth, 'Set E2E_WITH_AUTH=1 after seeding users');

  test('header exposes project context when setup is complete', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('body')).toBeVisible();
    // Switcher renders once packs + membership exist; otherwise setup gate redirects.
    if (page.url().includes('/setup')) {
      test.skip(true, 'User still needs HQ setup');
      return;
    }
    await expect(
      page.getByRole('button', { name: /project|switch|aeon|adaptive/i }).first()
    ).toBeVisible({ timeout: 15000 });
  });
});
