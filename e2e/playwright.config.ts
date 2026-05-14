import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['line']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
  // Start the full stack before running tests.
  // In CI: DATABASE_URL, ENCRYPTION_KEY, etc. are injected by the workflow.
  // Locally: run `cp .env.example .env && fill in values` first.
  webServer: [
    {
      command: 'cd ../server && npm run dev',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        PORT: '3001',
        NODE_ENV: 'test',
        TEST_AUTH_BYPASS: 'true',
        DATABASE_URL: process.env.DATABASE_URL ?? '',
        ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? '',
        CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ?? 'sk_test_placeholder',
        CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET ?? 'whsec_placeholder',
        CORS_ORIGIN: 'http://localhost:5173',
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ?? '',
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ?? '',
        S3_BUCKET: process.env.S3_BUCKET ?? '',
      },
    },
    {
      command: 'cd ../client && npm run dev',
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VITE_CLERK_PUBLISHABLE_KEY: process.env.VITE_CLERK_PUBLISHABLE_KEY ?? 'pk_test_placeholder',
        VITE_API_URL: 'http://localhost:3001',
      },
    },
  ],
});
