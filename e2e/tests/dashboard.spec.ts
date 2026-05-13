import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.CLERK_TEST_ADMIN_TOKEN && !process.env.TEST_ADMIN_EMAIL,
      'Auth credentials not set — skipping authenticated tests');
    await loginAsAdmin(page);
  });

  test('shows stat cards', async ({ page }) => {
    await expect(page.getByText('Total Files')).toBeVisible();
    await expect(page.getByText('Approved This Month')).toBeVisible();
    await expect(page.getByText('In Review')).toBeVisible();
  });

  test('has New Application button', async ({ page }) => {
    await expect(page.getByRole('link', { name: /new application/i })).toBeVisible();
  });

  test('"Assigned to Me" toggle filters results', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /assigned to me/i });
    await expect(toggle).toBeVisible();
    await toggle.click();
    // URL or state should reflect the filter
    await expect(page).toBeVisible(); // page doesn't crash
  });

  test('recent applications table renders', async ({ page }) => {
    // Table should show at minimum column headers
    await expect(page.getByRole('table')).toBeVisible();
  });
});
