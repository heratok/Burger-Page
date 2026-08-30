import { test, expect } from '@playwright/test';

test.describe('Manual Sale POS Modal - Mobile & Desktop Responsiveness', () => {
  test('Mobile Viewport (390x844 iPhone 13/14/15): Catalog, Floating Bar, Cart & POS Flow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/orders');

    // Authenticate
    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible();
    await userInput.fill('admin_craft');

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('craft');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // Wait for Kanban
    await expect(page.getByRole('heading', { name: /Nuevos \/ Pendientes/i })).toBeVisible();

    // Open Nueva Venta POS modal
    const nuevaVentaBtn = page.getByRole('button', { name: /Nueva Venta/i }).first();
    await nuevaVentaBtn.click();

    // Verify modal is open
    await expect(page.getByText(/Punto de Venta/i)).toBeVisible();

    // Step 1: Catalog Tab is active by default
    await expect(page.getByRole('button', { name: /1. Catálogo/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /2. Pedido & Cobro/i })).toBeVisible();

    // Take screenshot of Mobile Catalog tab
    await page.screenshot({ path: 'e2e/screenshots/mobile-pos-catalog.png' });

    // Add a product to order
    const addProductBtn = page.getByRole('button', { name: /Agregar/i }).first();
    await addProductBtn.click();

    // Floating action bar appears at the bottom
    const floatingBarBtn = page.getByRole('button', { name: /Ver Pedido \/ Cobrar/i });
    await expect(floatingBarBtn).toBeVisible();

    // Take screenshot of Mobile Catalog with floating action bar
    await page.screenshot({ path: 'e2e/screenshots/mobile-pos-catalog-floating.png' });

    // Click on floating bar or Tab 2
    await floatingBarBtn.click();

    // Now on Cart & Cobro tab
    await expect(page.getByRole('button', { name: /\+ Agregar más platos/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Registrar Venta/i })).toBeVisible();

    // Take screenshot of Mobile Cart & Cobro tab
    await page.screenshot({ path: 'e2e/screenshots/mobile-pos-cart-v2.png' });
  });

  test('Mobile Small Viewport (375x667 iPhone SE): Complete sale without overflow issues', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/admin/orders');

    // Authenticate
    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible();
    await userInput.fill('admin_craft');

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('craft');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // Open Nueva Venta POS modal
    const nuevaVentaBtn = page.getByRole('button', { name: /Nueva Venta/i }).first();
    await nuevaVentaBtn.click();

    // Add a product
    await page.getByRole('button', { name: /Agregar/i }).first().click();

    // Switch to cart
    await page.getByRole('button', { name: /Ver Pedido \/ Cobrar/i }).click();

    // Select Mesa service
    await page.getByRole('button', { name: /Mesa/i }).click();
    await page.getByPlaceholder(/Ej: 3, Terraza 1/i).fill('Mesa 4');

    // Add observation
    await page.getByPlaceholder(/Ej: Sin cebolla, salsas aparte/i).fill('Sin salsas en mesa 4');

    // Submit sale
    const submitBtn = page.getByRole('button', { name: /Registrar Venta/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Modal closes and order is registered
    await expect(page.getByText(/Punto de Venta/i)).not.toBeVisible();
  });

  test('Desktop Viewport (1280x800): 2-column side-by-side layout works seamlessly', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/admin/orders');

    // Authenticate
    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible();
    await userInput.fill('admin_craft');

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('craft');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // Open Nueva Venta POS modal
    const nuevaVentaBtn = page.getByRole('button', { name: /Nueva Venta/i }).first();
    await nuevaVentaBtn.click();

    // On desktop, both catalog and cart are visible simultaneously without mobile tab bar
    await expect(page.getByRole('button', { name: /1. Catálogo/i })).not.toBeVisible();
    await expect(page.getByPlaceholder(/Buscar producto por nombre/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Mostrador/i })).toBeVisible();

    // Take screenshot of Desktop POS
    await page.screenshot({ path: 'e2e/screenshots/desktop-pos.png' });
  });
});
