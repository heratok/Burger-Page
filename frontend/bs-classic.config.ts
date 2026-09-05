/**
 * BrowserStack classic integration — per-test sessions.
 *
 * Each test connects to its own BrowserStack cloud browser via CDP WebSocket
 * (one session = one context, avoiding BrowserStack's single-context limit and
 * post-failure session leaks). A BrowserStack Local tunnel is started in
 * globalSetup so cloud browsers can reach the app on localhost.
 *
 * Credentials come from the environment (never committed):
 *   BROWSERSTACK_USERNAME / BROWSERSTACK_ACCESS_KEY
 */
import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const USERNAME = process.env.BROWSERSTACK_USERNAME;
const ACCESS_KEY = process.env.BROWSERSTACK_ACCESS_KEY;
const PLAYWRIGHT_VERSION = '1.62.1';

function capsFor(name: string, extra: Record<string, string> = {}) {
  return {
    browser: 'chrome',
    browser_version: 'latest',
    os: 'Windows',
    os_version: '11',
    name,
    build: `Burger-Page-Classic-${new Date().toISOString().slice(0, 16).replace(/[-:]/g, '')}`,
    project: 'Burger-Page',
    resolution: '1920x1080',
    'browserstack.username': USERNAME,
    'browserstack.accessKey': ACCESS_KEY,
    'browserstack.local': 'true',
    'browserstack.debug': 'true',
    'browserstack.console': 'info',
    'browserstack.networkLogs': 'true',
    'browserstack.playwrightVersion': '1.latest',
    'client.playwrightVersion': PLAYWRIGHT_VERSION,
    ...extra,
  };
}

export default defineConfig({
  testDir: path.resolve(__dirname, 'e2e'),
  testMatch: '**/browserstack-suite.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 300_000,
  expect: { timeout: 20_000 },
  globalSetup: path.resolve(__dirname, 'bs-global-setup.ts'),
  globalTeardown: path.resolve(__dirname, 'bs-global-teardown.ts'),
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-bs', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
  },
  projects: [
    {
      name: 'win11-chrome',
      use: {
        bstackCaps: capsFor('Burger-Page: Win11 Chrome'),
      },
    },
    {
      name: 'win11-edge',
      use: {
        bstackCaps: capsFor('Burger-Page: Win11 Edge', { browser: 'edge' }),
      },
    },
    {
      name: 'chrome-mobile-375',
      use: {
        bstackCaps: capsFor('Burger-Page: Chrome 375x667 (iPhone SE)'),
        viewport: { width: 375, height: 667 },
      },
    },
    {
      name: 'chrome-mobile-390',
      use: {
        bstackCaps: capsFor('Burger-Page: Chrome 390x844 (iPhone 12/14)'),
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});