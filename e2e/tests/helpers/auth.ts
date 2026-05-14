import { Page } from '@playwright/test';
import { SEED_IDS } from './fixtures';

// Uses the server-side test auth bypass (x-test-user-id header).
// The server accepts this when NODE_ENV=test && TEST_AUTH_BYPASS=true.
// No Clerk tokens needed — works in CI against a seeded local database.

async function setTestUser(page: Page, userId: string): Promise<void> {
  // Intercept every outbound API call and inject the bypass header.
  await page.route('**/api/**', async (route) => {
    await route.continue({
      headers: { ...route.request().headers(), 'x-test-user-id': userId },
    });
  });
  await page.goto('/dashboard');
  await page.waitForURL('**/dashboard', { timeout: 10_000 });
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await setTestUser(page, SEED_IDS.ADMIN_USER_ID);
}

export async function loginAsUnderwriter(page: Page): Promise<void> {
  await setTestUser(page, SEED_IDS.UW_USER_ID);
}

export function adminHeaders(): Record<string, string> {
  return { 'x-test-user-id': SEED_IDS.ADMIN_USER_ID };
}
