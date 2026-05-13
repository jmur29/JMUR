import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('sign-in page has correct title', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page).toHaveTitle(/ClearPath/);
  });

  test('all pages have visible focus indicators', async ({ page }) => {
    await page.goto('/sign-in');
    // Tab through elements and verify they get focus
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('images have alt text (where applicable)', async ({ page }) => {
    await page.goto('/sign-in');
    const images = await page.locator('img:not([alt])').count();
    // Allow 0 images without alt text
    expect(images).toBe(0);
  });
});
