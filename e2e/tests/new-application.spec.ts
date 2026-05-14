import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('New Application Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/applications/new');
  });

  test('wizard renders step 1 — Borrower', async ({ page }) => {
    await expect(page.getByText(/borrower/i)).toBeVisible();
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/last name/i)).toBeVisible();
  });

  test('step 1 validates required fields', async ({ page }) => {
    // Try to advance without filling fields
    const nextBtn = page.getByRole('button', { name: /next/i });
    await nextBtn.click();
    // Should show validation errors
    await expect(page.getByText(/required/i)).toBeVisible();
  });

  test('full wizard flow creates application', async ({ page }) => {
    // Step 1: Borrower
    await page.fill('[name="firstName"]', 'Jane');
    await page.fill('[name="lastName"]', 'Smith');
    await page.fill('[name="email"]', 'jane@example.com');
    await page.fill('[name="phone"]', '416-555-0199');
    await page.fill('[name="sin"]', '987654321');
    await page.fill('[name="dob"]', '1988-03-20');
    await page.selectOption('[name="employmentType"]', 'EMPLOYED');
    await page.fill('[name="creditScore"]', '740');
    await page.getByRole('button', { name: /next/i }).click();

    // Step 2: Property
    await expect(page.getByText(/property/i)).toBeVisible();
    await page.fill('[name="address"]', '123 Maple Street');
    await page.fill('[name="city"]', 'Toronto');
    await page.selectOption('[name="province"]', 'ON');
    await page.fill('[name="postalCode"]', 'M5V 2T6');
    await page.selectOption('[name="propertyType"]', 'DETACHED');
    await page.selectOption('[name="occupancy"]', 'OWNER');
    await page.fill('[name="purchasePrice"]', '750000');
    await page.fill('[name="downPayment"]', '150000');
    await page.getByRole('button', { name: /next/i }).click();

    // Step 3: Terms
    await expect(page.getByText(/terms/i)).toBeVisible();
    await page.fill('[name="contractRate"]', '5.5');
    await page.selectOption('[name="amortizationYears"]', '25');
    await page.selectOption('[name="termYears"]', '5');
    await page.getByRole('button', { name: /create/i }).click();

    // Should navigate to the new application detail
    await expect(page).toHaveURL(/\/applications\/(?!new)/);
    await expect(page.getByText(/CP-/)).toBeVisible();
  });
});
