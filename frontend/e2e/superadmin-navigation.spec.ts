import { test, expect } from '@playwright/test';

test.describe('Super Admin Multi-Tenant Navigation, Dedicated SaaS Modules & Impersonation E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  test('Super Admin can navigate between dedicated SaaS modules (Restaurantes, Usuarios, Métricas) and impersonate a tenant', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1. Navigate to Admin login
    await page.goto('/admin');

    // 2. Authenticate as Super Admin
    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible();
    await userInput.fill('admin');

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill('admin');

    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // 3. Verify landing on Global SaaS Directory (/admin/restaurants)
    await expect(page).toHaveURL(/\/admin\/restaurants/);
    await expect(page.getByRole('button', { name: /Restaurantes/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Usuarios & Accesos/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Métricas Globales/i })).toBeVisible();
    await expect(page.getByText('Super Admin').first()).toBeVisible();

    // 4. Test Dedicated Section: Usuarios & Accesos (/admin/users)
    await page.getByRole('button', { name: /Usuarios & Accesos/i }).click();
    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(page.getByText(/Directorio Global de Usuarios/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /\+ Nuevo Usuario/i })).toBeVisible();

    // 5. Test Dedicated Section: Métricas Globales (/admin/metrics)
    await page.getByRole('button', { name: /Métricas Globales/i }).click();
    await expect(page).toHaveURL(/\/admin\/metrics/);
    await expect(page.getByText(/Métricas & Rendimiento Global SaaS/i)).toBeVisible();
    await expect(page.getByText(/Ranking de Restaurantes por Facturación/i)).toBeVisible();

    // 6. Return to Restaurantes directory
    await page.getByRole('button', { name: /Restaurantes/i }).click();
    await expect(page).toHaveURL(/\/admin\/restaurants/);

    // 7. Click "Administrar" on the first restaurant (Burger Craft) in the directory table
    const firstManageButton = page.getByRole('button', { name: /Administrar/i }).first();
    await expect(firstManageButton).toBeVisible();
    await firstManageButton.click();

    // 8. Verify navigation to /admin/dashboard
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // 9. Verify Impersonation Banner & Return Button are visible
    await expect(page.getByText(/Modo Super Admin/i).first()).toBeVisible();
    const returnBtn = page.getByRole('button', { name: /Volver al Panel Super Admin/i }).first();
    await expect(returnBtn).toBeVisible();

    // 10. Verify all restaurant operational modules are accessible in sidebar
    await expect(page.getByRole('button', { name: /Dashboard/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Pedidos en Vivo/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Menú & Carta/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Stock & Insumos/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Clientes CRM/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reportes & Cierre/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Personalizador UI\/UX/i })).toBeVisible();

    // 11. Test collapsing and expanding the sidebar on desktop
    const sidebar = page.locator('aside[role="complementary"]');
    await expect(sidebar).toHaveClass(/lg:w-64/);

    const toggleCollapseBtn = page.getByRole('button', { name: /Contraer menú/i }).first();
    await toggleCollapseBtn.click();
    await expect(sidebar).toHaveClass(/lg:w-16/);

    const toggleExpandBtn = page.getByRole('button', { name: /Expandir menú/i }).first();
    await toggleExpandBtn.click();
    await expect(sidebar).toHaveClass(/lg:w-64/);

    // 12. Click "Volver al Panel Super Admin" to exit tenant administration
    await page.getByRole('button', { name: /Volver al Panel Super Admin/i }).first().click();

    // 13. Verify return to SaaS Directory
    await expect(page).toHaveURL(/\/admin\/restaurants/);
    await expect(page.getByRole('button', { name: /Restaurantes/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Usuarios & Accesos/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Métricas Globales/i })).toBeVisible();
  });
});
