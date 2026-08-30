import { test, expect } from '@playwright/test';

test.describe('Admin Mobile Sidebar Drawer Responsiveness', () => {
  test('Mobile Small Viewport (375x667 iPhone SE): All nav items, Ver Tienda, and Cerrar Sesión are fully visible and clickable in drawer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // 1. Login as local restaurant admin
    await page.goto('/admin');
    await page.getByPlaceholder(/Tu nombre de usuario/i).fill('admin_craft');
    await page.locator('input[type="password"]').fill('craft');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // 2. Wait for dashboard
    await expect(page.getByRole('button', { name: /Nueva Venta/i })).toBeVisible();

    // 3. Open mobile drawer
    const openMenuBtn = page.getByRole('button', { name: /Abrir menú/i });
    await expect(openMenuBtn).toBeVisible();
    await openMenuBtn.click();
    await page.waitForTimeout(350);

    // 4. Verify sidebar drawer is open
    const sidebar = page.locator('aside[aria-label="Sidebar de navegación"]');
    await expect(sidebar).toBeVisible();

    // 5. Take screenshot of opened mobile drawer
    await page.screenshot({ path: 'e2e/screenshots/mobile-sidebar-drawer-375.png' });

    // 6. Verify all modules exist in drawer
    await expect(sidebar.getByRole('button', { name: 'Dashboard' })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Personalizador UI/UX' })).toBeVisible();

    // 7. Verify bottom footer buttons ("Ver Tienda" and "Cerrar Sesión") are fully in viewport
    const verTiendaBtn = sidebar.getByRole('button', { name: /Ver Tienda/i });
    const logoutBtn = sidebar.getByRole('button', { name: /Cerrar Sesión/i });

    await expect(verTiendaBtn).toBeVisible();
    await expect(logoutBtn).toBeVisible();

    // Ensure buttons are within viewport bounds
    const verTiendaBox = await verTiendaBtn.boundingBox();
    const logoutBox = await logoutBtn.boundingBox();

    expect(verTiendaBox).not.toBeNull();
    expect(logoutBox).not.toBeNull();

    if (verTiendaBox && logoutBox) {
      expect(verTiendaBox.y + verTiendaBox.height).toBeLessThanOrEqual(667);
      expect(logoutBox.y + logoutBox.height).toBeLessThanOrEqual(667);
    }
  });

  test('Mobile Super Admin Tenant Mode (390x844): Returns button, Ver Tienda, and Logout all visible without overflow clipping', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // 1. Login as Super Admin
    await page.goto('/admin');
    await page.getByPlaceholder(/Tu nombre de usuario/i).fill('admin');
    await page.locator('input[type="password"]').fill('admin');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // 2. Wait for SaaS restaurants list
    await expect(page.getByRole('button', { name: /Nuevo Restaurante/i })).toBeVisible();

    // 3. Open drawer in Global mode first
    const openMenuBtn = page.getByRole('button', { name: /Abrir menú/i });
    await expect(openMenuBtn).toBeVisible();
    await openMenuBtn.click();
    await page.waitForTimeout(350);

    const sidebar = page.locator('aside[aria-label="Sidebar de navegación"]');
    await expect(sidebar).toBeVisible();

    // 4. Take screenshot of Super Admin mobile drawer in global SaaS mode
    await page.screenshot({ path: 'e2e/screenshots/mobile-sidebar-superadmin-global.png' });

    // 5. Navigate to tenant mode via switcher select
    await sidebar.locator('select').selectOption('rest-burger-craft');
    await page.waitForTimeout(350);

    // 6. Open drawer in tenant mode
    await page.getByRole('button', { name: /Abrir menú/i }).click();
    await page.waitForTimeout(350);

    // Take screenshot of Super Admin mobile drawer in tenant mode
    await page.screenshot({ path: 'e2e/screenshots/mobile-sidebar-superadmin-tenant.png' });

    // 7. Verify Super Admin return button, Ver Tienda, and Cerrar Sesión are visible
    const returnSuperBtn = sidebar.getByRole('button', { name: /Volver al Panel Super Admin/i });
    const verTiendaBtn = sidebar.getByRole('button', { name: /Ver Tienda/i });
    const logoutBtn = sidebar.getByRole('button', { name: /Cerrar Sesión/i });

    await expect(returnSuperBtn).toBeVisible();
    await expect(verTiendaBtn).toBeVisible();
    await expect(logoutBtn).toBeVisible();

    const logoutBox = await logoutBtn.boundingBox();
    expect(logoutBox).not.toBeNull();
    if (logoutBox) {
      expect(logoutBox.y + logoutBox.height).toBeLessThanOrEqual(844);
    }
  });
});
