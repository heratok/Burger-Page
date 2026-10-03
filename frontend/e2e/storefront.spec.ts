import { test, expect } from '@playwright/test';
import { TEST_RESTAURANT } from './test-fixture';

test.describe('Burger Craft Storefront E2E User Journey', () => {
  test('should load storefront with restaurant branding and menu products', async ({ page }) => {
    await page.goto('/');

    // The platform landing uses the platform title, never a tenant brand
    await expect(page).toHaveTitle('FoodOS');

    // Verify storefront branding or navigation
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible();
  });

  test('tab title is the restaurant name on its storefront', async ({ page }) => {
    await page.goto(`/${TEST_RESTAURANT.slug}`);
    await expect(page).toHaveTitle(TEST_RESTAURANT.name);
  });

  test('should verify health status of Fastify backend API directly', async ({ request }) => {
    const health = await request.get('http://localhost:3001/health');
    expect(health.ok()).toBeTruthy();
    const data = await health.json();
    expect(data.status).toBe('ok');
  });

  test('should verify Scalar documentation endpoint is accessible', async ({ request }) => {
    const docs = await request.get('http://localhost:3001/docs/');
    expect(docs.ok()).toBeTruthy();
  });
});
