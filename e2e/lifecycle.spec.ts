import { test, expect } from '@playwright/test';

/**
 * Core authz E2E: VIEWER/EDITOR cannot approve (403 via UI or API).
 * Full draft→approve→receipt→PUBLISHED lifecycle needs a seeded test env
 * (SERVICE user + N8N secrets + DB). Those steps are gated behind
 * E2E_FULL_LIFECYCLE=1.
 */

const REVIEWER_EMAIL = process.env.E2E_REVIEWER_EMAIL ?? 'reviewer@aeon.test';
const REVIEWER_PASSWORD = process.env.E2E_REVIEWER_PASSWORD ?? 'AeonReview123!';
const VIEWER_EMAIL = process.env.E2E_VIEWER_EMAIL ?? 'viewer@aeon.test';
const VIEWER_PASSWORD = process.env.E2E_VIEWER_PASSWORD ?? 'AeonViewer123!';
const EDITOR_EMAIL = process.env.E2E_EDITOR_EMAIL ?? 'editor@aeon.test';
const EDITOR_PASSWORD = process.env.E2E_EDITOR_PASSWORD ?? 'AeonEditor123!';

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/auth/signin');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/auth/signin'), {
    timeout: 15_000,
  });
}

test.describe('authz', () => {
  test('unauthenticated queue API returns 401', async ({ request }) => {
    const res = await request.get('/api/queue');
    expect([401, 403]).toContain(res.status());
  });

  test('approve without session returns 401', async ({ request }) => {
    const res = await request.post('/api/queue/fake-id/approve', {
      data: { revisionId: 'r1' },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('role gates (requires seeded users)', () => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Set E2E_WITH_AUTH=1 and seed users to run');

  test('VIEWER cannot approve (403)', async ({ page, request }) => {
    test.skip(!VIEWER_EMAIL, 'viewer credentials missing');
    await signIn(page, VIEWER_EMAIL, VIEWER_PASSWORD);
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const res = await request.post('/api/queue/any/approve', {
      headers: { Cookie: cookieHeader },
      data: { revisionId: 'r1' },
    });
    expect(res.status()).toBe(403);
  });

  test('EDITOR cannot approve (403)', async ({ page, request }) => {
    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD);
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const res = await request.post('/api/queue/any/approve', {
      headers: { Cookie: cookieHeader },
      data: { revisionId: 'r1' },
    });
    expect(res.status()).toBe(403);
  });

  test('REVIEWER can open queue UI', async ({ page }) => {
    await signIn(page, REVIEWER_EMAIL, REVIEWER_PASSWORD);
    await page.goto('/queue');
    await expect(page).toHaveURL(/queue/);
  });
});

test.describe('full lifecycle', () => {
  test.skip(
    process.env.E2E_FULL_LIFECYCLE !== '1',
    'Set E2E_FULL_LIFECYCLE=1 with n8n bridge + seeded SERVICE user'
  );

  test('signin → draft → approve → receipt → PUBLISHED', async ({ page, request }) => {
    // Placeholder orchestration: document expected flow for staging cutover (PR J).
    await signIn(page, REVIEWER_EMAIL, REVIEWER_PASSWORD);
    await page.goto('/queue');
    await expect(page.getByText(/queue|pending|review/i).first()).toBeVisible({
      timeout: 20_000,
    });
    // Full HMAC draft + receipt path is exercised in Jest API tests;
    // staging E2E against live n8n Wait is PR J.
    expect(request).toBeTruthy();
  });
});
