import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('redirects unauthenticated users to sign-in', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/sign-in/);
  });

  test('sign-in page renders correctly', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.locator('body')).toBeVisible();
    // Clerk renders an iframe or its own form
    await expect(page).toHaveTitle(/ClearPath/);
  });

  test('root redirects to dashboard', async ({ page }) => {
    // When not logged in, root → sign-in
    await page.goto('/');
    // Should redirect somewhere (not stay at /)
    await expect(page).not.toHaveURL('http://localhost:5173/');
  });
});
