import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Underwriting — Ratios Tab', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.CLERK_TEST_ADMIN_TOKEN && !process.env.TEST_ADMIN_EMAIL,
      'Auth credentials not set');
    await loginAsAdmin(page);
    // Navigate to a seeded application that has all data filled
    await page.goto('/applications');
    // Find an APPROVED or IN_REVIEW application
    const approvedLink = page.getByText(/CP-/i).first();
    await approvedLink.click();
    await page.getByRole('tab', { name: 'Ratios' }).click();
  });

  test('Ratios tab shows Run Calculation button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /run calc/i })).toBeVisible();
  });

  test('running calculation shows results', async ({ page }) => {
    await page.getByRole('button', { name: /run calc/i }).click();
    // Wait for API response
    await page.waitForResponse('**/calculate');
    // Should show ratio values
    await expect(page.getByText(/GDS/i)).toBeVisible();
    await expect(page.getByText(/TDS/i)).toBeVisible();
    await expect(page.getByText(/LTV/i)).toBeVisible();
  });

  test('flags list is displayed', async ({ page }) => {
    await page.getByRole('button', { name: /run calc/i }).click();
    await page.waitForResponse('**/calculate');
    // Flags section should appear
    await expect(page.getByText(/PASS|WARN|FAIL/i)).toBeVisible();
  });
});
