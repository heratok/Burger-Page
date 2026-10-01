import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: path.resolve(__dirname, 'e2e'),
  // Rebuilds the guarded local database before each local run (skipped in CI).
  // Playwright starts the webServers BEFORE globalSetup runs, so the backend
  // pool must survive its database being dropped (see the PgClient pool 'error' handler).
  globalSetup: path.resolve(__dirname, 'e2e/global-setup.ts'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The e2e suites share one live backend/database (seeded Postgres), and
  // several specs mutate the same tenants (orders, customers, products).
  // Running workers in parallel makes those suites race each other and turn
  // green specs flaky, so serialize locally exactly like CI does.
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm --prefix ../backend run dev',
      // An explicit E2E_DATABASE_URL must be the database the backend uses too.
      env: process.env.E2E_DATABASE_URL ? { DATABASE_URL: process.env.E2E_DATABASE_URL } : undefined,
      url: 'http://localhost:3001/health',
      reuseExistingServer: true,
      timeout: process.env.CI ? 90000 : 30000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: process.env.CI ? 90000 : 30000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
