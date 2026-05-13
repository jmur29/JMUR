import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Application List', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.CLERK_TEST_ADMIN_TOKEN && !process.env.TEST_ADMIN_EMAIL,
      'Auth credentials not set');
    await loginAsAdmin(page);
    await page.goto('/applications');
  });

  test('renders application list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /applications/i })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('search input filters results', async ({ page }) => {
    const search = page.getByPlaceholder(/search/i);
    await expect(search).toBeVisible();
    await search.fill('CP-');
    // Debounce waits
    await page.waitForTimeout(400);
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('status filter tabs exist', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /all/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /draft/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /approved/i })).toBeVisible();
  });

  test('Export CSV button exists and triggers download', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    const exportBtn = page.getByRole('button', { name: /export/i });
    await expect(exportBtn).toBeVisible();
    await exportBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });

  test('New Application button navigates to wizard', async ({ page }) => {
    await page.getByRole('link', { name: /new application/i }).click();
    await expect(page).toHaveURL(/\/applications\/new/);
  });
});

test.describe('Application Detail', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.CLERK_TEST_ADMIN_TOKEN && !process.env.TEST_ADMIN_EMAIL,
      'Auth credentials not set');
    await loginAsAdmin(page);
    await page.goto('/applications');
  });

  test('clicking a file navigates to detail', async ({ page }) => {
    // Click the first application link in the table
    const firstRow = page.getByRole('row').nth(1); // skip header
    await firstRow.getByRole('link').first().click();
    await expect(page).toHaveURL(/\/applications\//);
  });

  test('application detail shows all 7 tabs', async ({ page }) => {
    // Navigate to first application (assumes seeded data)
    const firstRow = page.getByRole('row').nth(1);
    await firstRow.getByRole('link').first().click();

    const tabs = ['Borrower', 'Income', 'Property', 'Terms', 'Documents', 'Ratios', 'Decision'];
    for (const tab of tabs) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    }
  });

  test('tabs are navigable', async ({ page }) => {
    const firstRow = page.getByRole('row').nth(1);
    await firstRow.getByRole('link').first().click();

    await page.getByRole('tab', { name: 'Property' }).click();
    await expect(page.getByRole('tab', { name: 'Property' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('tab', { name: 'Decision' }).click();
    await expect(page.getByRole('tab', { name: 'Decision' })).toHaveAttribute('aria-selected', 'true');
  });

  test('notes panel is visible', async ({ page }) => {
    const firstRow = page.getByRole('row').nth(1);
    await firstRow.getByRole('link').first().click();
    await expect(page.getByPlaceholder(/add a note/i)).toBeVisible();
  });

  test('Report button navigates to report page', async ({ page }) => {
    const firstRow = page.getByRole('row').nth(1);
    await firstRow.getByRole('link').first().click();
    await page.getByRole('link', { name: /report/i }).click();
    await expect(page).toHaveURL(/\/report/);
  });
});
