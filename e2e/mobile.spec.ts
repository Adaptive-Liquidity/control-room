import { test, expect, type Page } from '@playwright/test';

/**
 * Mobile shell E2E. Runs only in the mobile-chrome / mobile-small / tablet
 * projects (see playwright.config.ts). Auth-dependent tests are gated behind
 * E2E_WITH_AUTH=1 with dev users seeded (`npm run db:ensure-dev-users`).
 */

const REVIEWER_EMAIL = process.env.E2E_REVIEWER_EMAIL ?? 'reviewer@aeon.test';
const REVIEWER_PASSWORD = process.env.E2E_REVIEWER_PASSWORD ?? 'AeonReview123!';

function isTablet() {
  return test.info().project.name === 'tablet';
}

async function signIn(page: Page) {
  await page.goto('/auth/signin');
  await page.getByLabel(/email/i).fill(REVIEWER_EMAIL);
  await page.getByLabel(/password/i).fill(REVIEWER_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/auth/signin'), {
    timeout: 15_000,
  });
}

test('signin page fits the viewport without horizontal scroll', async ({ page }) => {
  await page.goto('/auth/signin');
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflows).toBe(false);
});

test.describe('mobile shell (requires seeded users)', () => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Set E2E_WITH_AUTH=1 and seed users to run');

  test('phone: tab bar navigates and desktop nav is hidden', async ({ page }) => {
    test.skip(isTablet(), 'phone-only assertions');
    await signIn(page);
    await page.goto('/dashboard');

    const mobileNav = page.getByRole('navigation', { name: 'Mobile' });
    await expect(mobileNav).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Primary', exact: true })
    ).toBeHidden();

    await mobileNav.getByRole('link', { name: 'Queue' }).click();
    await expect(page).toHaveURL(/\/queue/);
    await expect(mobileNav.getByRole('link', { name: 'Queue' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  test('phone: More sheet lists remaining destinations and navigates', async ({ page }) => {
    test.skip(isTablet(), 'phone-only assertions');
    await signIn(page);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: /more/i }).click();
    const sheet = page.getByRole('dialog', { name: 'Menu' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Studio' })).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Settings' })).toBeVisible();

    await sheet.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(sheet).toBeHidden();
  });

  test('tablet: icon rail is visible and tab bar is hidden', async ({ page }) => {
    test.skip(!isTablet(), 'tablet-only assertions');
    await signIn(page);
    await page.goto('/dashboard');

    await expect(
      page.getByRole('navigation', { name: 'Primary', exact: true })
    ).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeHidden();
  });

  test('dashboard fits the viewport without horizontal scroll', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard');
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflows).toBe(false);
  });
});
