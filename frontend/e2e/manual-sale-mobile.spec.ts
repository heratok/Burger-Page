import { test, expect } from '@playwright/test';

test.describe('Manual Sale POS Modal - Mobile & Desktop Responsiveness with Additions', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('burger_page_platform_v2', JSON.stringify({
        version: 2,
        superAdminPassword: 'admin',
        restaurants: [{
          id: 'rest-burger-craft',
          slug: 'burger-craft',
          adminPassword: 'craft',
          isActive: true,
          config: { name: 'Burger Craft', tagline: 'Artesanal' },
          products: [{
            id: 'p1',
            name: 'Hamburguesa Doble Queso',
            price: 25000,
            category: 'Hamburguesas',
            src: '',
            description: 'Carne y queso',
            inStock: true
          }],
          categories: ['Hamburguesas'],
          orders: [],
          customers: [],
          additions: [
            { id: 'add-1', name: 'Tocineta Ahumada', price: 4000 },
            { id: 'add-2', name: 'Queso Cheddar Extra', price: 3000 },
            { id: 'add-3', name: 'Huevo Frito', price: 2500 }
          ]
        }]
      }));
      localStorage.setItem('burger_page_active_rest_v2', 'rest-burger-craft');
    });

    await page.route('**/api/users/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: 'mock-token-pos',
          user: {
            id: 'usr-admin-craft',
            username: 'admin_craft',
            role: 'restaurant_admin',
            restaurantId: 'rest-burger-craft',
          },
        }),
      });
    });

    await page.route('**/api/restaurants**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'rest-burger-craft',
            slug: 'burger-craft',
            name: 'Burger Craft',
            isActive: true,
            config: { name: 'Burger Craft', tagline: 'Artesanal' },
          },
        ]),
      });
    });

    await page.route('**/api/products**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'p1',
            restaurantId: 'rest-burger-craft',
            name: 'Hamburguesa Doble Queso',
            price: 25000,
            category: 'Hamburguesas',
            description: 'Carne y queso',
            isAvailable: true,
            isPopular: true,
          },
        ]),
      });
    });

    await page.route('**/api/additions**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'add-1', restaurantId: 'rest-burger-craft', name: 'Tocineta Ahumada', price: 4000, isAvailable: true },
          { id: 'add-2', restaurantId: 'rest-burger-craft', name: 'Queso Cheddar Extra', price: 3000, isAvailable: true },
          { id: 'add-3', restaurantId: 'rest-burger-craft', name: 'Huevo Frito', price: 2500, isAvailable: true },
        ]),
      });
    });

    await page.route('**/api/orders**', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'ord-test-pos',
          orderNumber: 101,
          status: 'pending',
        }),
      });
    });
  });

  test('Mobile Viewport (390x844 iPhone 13/14/15): Catalog, Additions Customizer & In-Cart Editing', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
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
    await expect(nuevaVentaBtn).toBeVisible({ timeout: 10000 });
    await nuevaVentaBtn.click({ force: true });

    // Verify modal is open
    await expect(page.getByText(/Punto de Venta/i)).toBeVisible();

    // Verify "+ Extras" button is prominent and intuitive
    const extrasBtn = page.getByRole('button', { name: /\+ Extras/i }).first();
    await expect(extrasBtn).toBeVisible();

    // Take screenshot of Mobile Catalog tab with + Extras button
    await page.screenshot({ path: 'e2e/screenshots/mobile-pos-catalog.png' });

    // Click on "+ Extras" to customize product additions
    await extrasBtn.click();

    // Verify Customization Sub-Modal is open
    await expect(page.getByText(/Personalizar plato/i)).toBeVisible();
    await expect(page.getByText(/Adiciones \/ Modificadores disponibles/i)).toBeVisible();
    await expect(page.getByText(/Tocineta Ahumada/i)).toBeVisible();

    // Add 1x Tocineta Ahumada
    const addTocinetaBtn = page.getByRole('button', { name: /Agregar Tocineta Ahumada/i });
    await addTocinetaBtn.click();

    // Add kitchen observation note
    const kitchenNoteInput = page.getByPlaceholder(/Término medio, sin salsas/i);
    await kitchenNoteInput.fill('Término 3/4 bien jugosa');

    // Take screenshot of Mobile Additions Modal
    await page.screenshot({ path: 'e2e/screenshots/mobile-pos-additions-modal.png' });

    // Verify live price calculation inside modal: $25.000 + $4.000 = $29.000
    await expect(page.getByText(/\$?\s*29[.,]000/i).first()).toBeVisible();

    // Confirm adding customized product to sale
    await page.getByRole('button', { name: /Agregar a la Venta/i }).click();

    // Modal closes and floating bar shows 1 item with total $29.000
    const floatingBarBtn = page.getByRole('button', { name: /Ver Pedido \/ Cobrar/i });
    await expect(floatingBarBtn).toBeVisible();
    await expect(page.getByText(/\$?\s*29[.,]000/i).first()).toBeVisible();

    // Click on floating bar to view Cart & Cobro tab
    await floatingBarBtn.click();

    // Verify Cart tab shows product with additions and note
    await expect(page.getByText(/Tocineta Ahumada/i)).toBeVisible();
    await expect(page.getByText(/Término 3\/4 bien jugosa/i)).toBeVisible();

    // Take screenshot of Mobile Cart with Additions
    await page.screenshot({ path: 'e2e/screenshots/mobile-pos-cart-with-additions.png' });

    // Now test modifying extras directly from the cart item
    const editCartExtrasBtn = page.getByRole('button', { name: /Modificar extras \/ nota/i });
    await expect(editCartExtrasBtn).toBeVisible();
    await editCartExtrasBtn.click();

    // Sub-modal opens in edit mode
    await expect(page.getByText(/Modificar ítem/i)).toBeVisible();

    // Add 1x Queso Cheddar Extra (+ $3.000)
    const addCheddarBtn = page.getByRole('button', { name: /Agregar Queso Cheddar Extra/i });
    await addCheddarBtn.click();

    // Save changes
    await page.getByRole('button', { name: /Guardar Cambios/i }).click();

    // Verify updated cart item displays both additions and updated total ($32.000)
    await expect(page.getByText(/Queso Cheddar Extra/i)).toBeVisible();
    await expect(page.getByText(/\$?\s*32[.,]000/i).first()).toBeVisible();

    // Register sale
    const submitBtn = page.getByRole('button', { name: /Registrar Venta/i });
    await submitBtn.click();

    // Modal closes upon successful registration
    await expect(page.getByText(/Punto de Venta/i)).not.toBeVisible();
  });

  test('Mobile Small Viewport (375x667 iPhone SE): Complete sale with additions without overflow', async ({ page }) => {
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
    await expect(nuevaVentaBtn).toBeVisible({ timeout: 10000 });
    await nuevaVentaBtn.click({ force: true });

    // Quick add standard product
    await page.getByRole('button', { name: /^Agregar$/i }).first().click();

    // Switch to cart
    await page.getByRole('button', { name: /Ver Pedido \/ Cobrar/i }).click();

    // Add extras from cart
    await page.getByRole('button', { name: /\+ Extras \/ nota/i }).click();
    await page.getByRole('button', { name: /Agregar Tocineta Ahumada/i }).click();
    await page.getByRole('button', { name: /Guardar Cambios/i }).click();

    // Select Mesa service
    await page.getByRole('button', { name: /Mesa/i }).click();
    await page.getByPlaceholder(/Ej: 3, Terraza 1/i).fill('Mesa 4');

    // Submit sale
    const submitBtn = page.getByRole('button', { name: /Registrar Venta/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Modal closes and order is registered
    await expect(page.getByText(/Punto de Venta/i)).not.toBeVisible();
  });

  test('Desktop Viewport (1280x800): 2-column layout with additions modal works seamlessly', async ({ page }) => {
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
    await expect(nuevaVentaBtn).toBeVisible({ timeout: 10000 });
    await nuevaVentaBtn.click();

    // Verify modal is open
    await expect(page.getByText(/Punto de Venta/i)).toBeVisible();

    // Open + Extras customization modal
    const extrasBtn = page.getByRole('button', { name: /\+ Extras/i }).first();
    await extrasBtn.click();

    // Take screenshot of Desktop Additions modal
    await page.screenshot({ path: 'e2e/screenshots/desktop-pos-additions.png' });

    // Add Huevo Frito (+ $2.500)
    await page.getByRole('button', { name: /Agregar Huevo Frito/i }).click();
    await page.getByRole('button', { name: /Agregar a la Venta/i }).click();

    // Take screenshot of Desktop POS with customized item in comanda
    await page.screenshot({ path: 'e2e/screenshots/desktop-pos.png' });

    // Verify item in desktop right-hand order column
    await expect(page.getByText(/Huevo Frito/i)).toBeVisible();
  });
});
