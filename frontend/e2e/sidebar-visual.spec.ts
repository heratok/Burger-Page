import { test, expect } from '@playwright/test';

test('capture sidebar expanded and collapsed screenshots for visual inspection', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  // 1. Login as Super Admin
  await page.goto('/admin');
  await page.getByPlaceholder(/Tu nombre de usuario/i).fill('admin');
  await page.locator('input[type="password"]').fill('admin');
  await page.getByRole('button', { name: /Acceder al Panel/i }).click();

  await expect(page).toHaveURL(/\/admin\/restaurants/);

  // Take screenshot in global SaaS mode expanded
  await page.screenshot({ path: 'test-results/saas-global-expanded.png' });

  // Collapse sidebar
  const toggleBtn = page.getByRole('button', { name: /Contraer menú/i }).first();
  await toggleBtn.click();
  await page.waitForTimeout(300);

  // Take screenshot in global SaaS mode collapsed
  await page.screenshot({ path: 'test-results/saas-global-collapsed.png' });

  // Manage a restaurant
  await page.goto('/admin/dashboard');
  await page.waitForTimeout(300);

  // Take screenshot in restaurant mode collapsed
  await page.screenshot({ path: 'test-results/restaurant-collapsed.png' });

  // Expand sidebar in restaurant mode
  const expandBtn = page.getByRole('button', { name: /Expandir menú/i }).first();
  await expandBtn.click();
  await page.waitForTimeout(300);

  // Take screenshot in restaurant mode expanded
  await page.screenshot({ path: 'test-results/restaurant-expanded.png' });
});
