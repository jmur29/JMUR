import { Page } from '@playwright/test';

// Helper to set up a mock auth session via localStorage/cookie
// In real e2e, this would use Clerk's testing tokens
export async function loginAsAdmin(page: Page): Promise<void> {
  // Clerk provides test tokens via CLERK_TEST_USER_TOKEN env var
  // For CI: use Clerk's API to create a test session token
  await page.goto('/sign-in');
  // If CLERK_TEST_ADMIN_TOKEN is set, bypass UI login
  const token = process.env.CLERK_TEST_ADMIN_TOKEN;
  if (token) {
    await page.evaluate((t) => {
      window.localStorage.setItem('__clerk_test_token', t);
    }, token);
    await page.goto('/dashboard');
  } else {
    // UI login fallback
    await page.fill('[name="identifier"]', process.env.TEST_ADMIN_EMAIL ?? 'admin@democu.ca');
    await page.click('button[type="submit"]');
    await page.fill('[name="password"]', process.env.TEST_ADMIN_PASSWORD ?? 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  }
}

export async function loginAsUnderwriter(page: Page): Promise<void> {
  await page.goto('/sign-in');
  const token = process.env.CLERK_TEST_UW_TOKEN;
  if (token) {
    await page.evaluate((t) => {
      window.localStorage.setItem('__clerk_test_token', t);
    }, token);
    await page.goto('/dashboard');
  } else {
    await page.fill('[name="identifier"]', process.env.TEST_UW_EMAIL ?? 'uw@democu.ca');
    await page.click('button[type="submit"]');
    await page.fill('[name="password"]', process.env.TEST_UW_PASSWORD ?? 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  }
}
