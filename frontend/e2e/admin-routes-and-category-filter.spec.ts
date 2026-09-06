import { test, expect } from '@playwright/test';

test.describe('Admin Routing, Tenant Management & Storefront Category Filter E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  test('TC017 Flow: /admin/login and /login routes render admin login modal instead of RestaurantNotFound', async ({ page }) => {
    // 1. Test /login
    await page.goto('/login');
    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Restaurante no encontrado')).not.toBeVisible();

    // 2. Test /admin/login
    await page.goto('/admin/login');
    await expect(userInput).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Restaurante no encontrado')).not.toBeVisible();

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();

    await userInput.fill('admin');
    await passwordInput.fill('Test0502*');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // Verify backoffice is reached
    await expect(page.getByRole('button', { name: /Dashboard|Restaurantes/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('TC011 Flow: /admin/tenants/new route resolves to admin restaurants module without 404', async ({ page }) => {
    await page.goto('/admin/tenants/new');

    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Restaurante no encontrado')).not.toBeVisible();

    await userInput.fill('admin');
    await page.locator('input[type="password"]').fill('Test0502*');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    await expect(page.getByRole('button', { name: /Nuevo Restaurante/i })).toBeVisible({ timeout: 10000 });
  });

  test('TC019 Flow: Storefront category filter restricts catalog items to selected category', async ({ page }) => {
    await page.goto('/rosto');
    await page.waitForLoadState('domcontentloaded');

    const burgersBtn = page.getByRole('button', { name: 'Hamburguesas', exact: true });
    await expect(burgersBtn).toBeVisible({ timeout: 10000 });
    await burgersBtn.click();

    const burgerItem = page.getByText('Burger Test Diagnostico', { exact: false });
    await expect(burgerItem).toBeVisible({ timeout: 10000 });

    // Non-hamburger items must NOT appear under Hamburguesas
    await expect(page.getByText('Motherboard Godlike Test', { exact: false })).not.toBeVisible();
    await expect(page.getByText('yuca', { exact: true })).not.toBeVisible();
  });
});
