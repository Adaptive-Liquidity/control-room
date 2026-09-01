import { test, expect, type Page } from '@playwright/test';

const EDITOR_EMAIL = process.env.E2E_EDITOR_EMAIL ?? 'editor@aeon.test';
const EDITOR_PASSWORD = process.env.E2E_EDITOR_PASSWORD ?? 'AeonEditor123!';
const REVIEWER_EMAIL = process.env.E2E_REVIEWER_EMAIL ?? 'reviewer@aeon.test';
const REVIEWER_PASSWORD = process.env.E2E_REVIEWER_PASSWORD ?? 'AeonReview123!';

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/auth/signin');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/auth/signin'), { timeout: 30_000 });
}

test.describe('studio desk loop', () => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Set E2E_WITH_AUTH=1 and seed users');

  test('editor save submit, reviewer request revision, editor resubmit', async ({ page }) => {
    const title = `Desk loop ${Date.now()}`;
    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD);
    await page.goto('/studio');
    await page.getByPlaceholder('Title', { exact: true }).fill(title);
    await page.getByPlaceholder(/Start writing/i).fill('Plain draft body for revision loop.');
    await page.getByRole('button', { name: 'Submit for Approval' }).click();
    await page.waitForURL(/queue/, { timeout: 15_000 });

    await page.context().clearCookies();
    await signIn(page, REVIEWER_EMAIL, REVIEWER_PASSWORD);
    await page.goto('/queue');
    await page.getByText(title, { exact: true }).first().click();
    await expect(page.getByText(/revisionId:/)).toBeVisible();
    await page.getByPlaceholder('Required for reject / request revision').fill('Please add a disclaimer.');
    await page.getByRole('button', { name: 'Request revision' }).click();
    await expect(page.getByText('Revision requested').first()).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD);
    await page.goto('/queue');
    await page.getByRole('tab', { name: 'All' }).click();
    await page.getByText(title, { exact: true }).first().click();
    await expect(page.getByRole('link', { name: 'Open in Studio' })).toBeVisible();
    await page.getByRole('link', { name: 'Open in Studio' }).click();
    await expect(page).toHaveURL(/\/studio\?id=/);
    await expect(page.getByText('Please add a disclaimer.')).toBeVisible();
    await page.getByPlaceholder(/Start writing/i).fill('Plain draft body. Not financial advice.');
    await page.getByRole('button', { name: 'Submit for Approval' }).click();
    await page.waitForURL(/queue/, { timeout: 15_000 });
    await expect(page.getByText(title).first()).toBeVisible();
  });

  test('generate without webhook keeps the editor', async ({ page, request }) => {
    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD);
    await page.goto('/studio');
    await page.getByPlaceholder('Title', { exact: true }).fill('Stay here');
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const authed = await request.post('/api/studio/generate', {
      headers: { Cookie: cookieHeader, 'content-type': 'application/json' },
      data: { channel: 'TWITTER', type: 'TWITTER_THREAD' },
    });
    if (!process.env.N8N_GENERATE_WEBHOOK_URL) {
      expect(authed.status()).toBe(503);
    }
    await expect(page.getByPlaceholder('Title', { exact: true })).toHaveValue('Stay here');
  });
});
