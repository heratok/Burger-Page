/**
 * Console-error hygiene: key pages must load without uncaught JS exceptions
 * or unexpected console errors. Ported from the former BrowserStack suite so
 * it runs in the regular local/CI Playwright run.
 */
import { test, expect, type Page } from '@playwright/test';
import { TEST_RESTAURANT } from './test-fixture';

// Expected noise: browsers log network 401/404 responses as console errors,
// and the Vite dev server HMR client can emit websocket noise.
const EXPECTED_NOISE = [/Failed to load resource.*(401|404)/i, /vite|websocket|@vite\/client/i];

function collectErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  return {
    pageErrors,
    unexpectedConsoleErrors: () =>
      consoleErrors.filter((e) => !EXPECTED_NOISE.some((pattern) => pattern.test(e))),
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
});

test('public pages load without JS errors or unexpected console errors', async ({ page }) => {
  const errors = collectErrors(page);

  for (const route of ['/', `/${TEST_RESTAURANT.slug}`, '/admin']) {
    await page.goto(route);
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).toBeVisible();
  }

  expect(errors.pageErrors, `page errors: ${errors.pageErrors.join(' | ')}`).toEqual([]);
  const unexpected = errors.unexpectedConsoleErrors();
  expect(unexpected, `console errors: ${unexpected.join(' | ')}`).toEqual([]);
});

test('restaurant admin dashboard loads without JS errors or unexpected console errors', async ({ page }) => {
  const errors = collectErrors(page);

  await page.goto('/admin');
  await page.getByPlaceholder(/Tu nombre de usuario/i).fill(TEST_RESTAURANT.username);
  await page.locator('input[type="password"]').fill(TEST_RESTAURANT.password);
  await page.getByRole('button', { name: /Acceder al Panel/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 30_000 });
  await page.waitForTimeout(1500);

  expect(errors.pageErrors, `page errors: ${errors.pageErrors.join(' | ')}`).toEqual([]);
  const unexpected = errors.unexpectedConsoleErrors();
  expect(unexpected, `console errors: ${unexpected.join(' | ')}`).toEqual([]);
});
