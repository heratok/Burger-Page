import { test, expect } from '@playwright/test';

test.describe('Order Edit in Backoffice POS - Responsive Verification (320px, 390px, 768px, 1280px)', () => {
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
          config: { name: 'Burger Craft', tagline: 'Artesanal', deliveryFee: 5000 },
          products: [{
            id: 'p1',
            name: 'Hamburguesa Doble Queso',
            price: 25000,
            category: 'Hamburguesas',
            src: '',
            description: 'Carne y doble queso',
            inStock: true
          }, {
            id: 'p2',
            name: 'Papas Rústicas',
            price: 12000,
            category: 'Acompañamientos',
            src: '',
            description: 'Crujientes con paprika',
            inStock: true
          }],
          categories: ['Hamburguesas', 'Acompañamientos'],
          orders: [{
            id: 'ord-101',
            orderNumber: 101,
            customer: {
              nombre: 'Carlos Gómez',
              telefono: '3001234567',
              direccion: 'Calle 10 # 4-20',
              barrio: 'El Poblado',
            },
            items: [{
              id: 'p1',
              name: 'Hamburguesa Doble Queso',
              price: 25000,
              cantidad: 2,
              total: 50000,
              observacion: 'Término medio',
              adiciones: [{ name: 'Tocineta', price: 4000, cantidad: 1 }],
            }],
            total: 54000,
            deliveryFee: 5000,
            finalTotal: 59000,
            metodo: 'Efectivo',
            pagoCon: '60000',
            cambio: 1000,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }],
          customers: [{
            id: 'cust-1',
            nombre: 'Carlos Gómez',
            telefono: '3001234567',
            direccion: 'Calle 10 # 4-20',
            barrio: 'El Poblado',
            totalOrders: 1,
            totalSpent: 59000,
            lastOrderDate: new Date().toISOString(),
            loyaltyTier: 'bronze',
          }],
          additions: [
            { id: 'add-1', name: 'Tocineta', price: 4000 },
            { id: 'add-2', name: 'Queso Extra', price: 3000 },
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
        body: JSON.stringify([{
          id: 'rest-burger-craft',
          slug: 'burger-craft',
          name: 'Burger Craft',
          isActive: true,
          config: { name: 'Burger Craft', tagline: 'Artesanal', deliveryFee: 5000 },
        }]),
      });
    });

    await page.route('**/api/orders**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  const viewports = [
    { name: 'mobile-narrow-320', width: 320, height: 640 },
    { name: 'mobile-standard-390', width: 390, height: 844 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'desktop-1280', width: 1280, height: 800 },
  ];

  for (const vp of viewports) {
    test(`Viewport ${vp.name} (${vp.width}x${vp.height}): Edit order modal and verification`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/admin/orders');

      // Login
      const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
      await expect(userInput).toBeVisible({ timeout: 10000 });
      await userInput.fill('admin_craft');
      await page.locator('input[type="password"]').fill('craft');
      await page.getByRole('button', { name: /Acceder al Panel/i }).click();

      // Verify order #101 is displayed on the board
      const orderNumberElem = page.getByText('#101').first();
      await expect(orderNumberElem).toBeVisible({ timeout: 10000 });

      // Open details modal
      const detailsBtn = page.getByTitle(/Ver detalles completos de la orden/i).first();
      await expect(detailsBtn).toBeVisible();
      await detailsBtn.click();

      // Verify OrderDetailModal header has "Orden #101" and "Editar venta" button
      await expect(page.getByText('Orden #101')).toBeVisible();
      const editSaleBtn = page.locator('div.fixed').locator('button').filter({ hasText: 'Editar venta' });
      await expect(editSaleBtn).toBeVisible();

      // Screenshot OrderDetailModal with Editar venta button
      await page.screenshot({ path: `e2e/screenshots/order-detail-${vp.name}.png` });

      // Click "Editar venta"
      await editSaleBtn.click();

      // Verify ManualSaleModal opens in edit mode
      await expect(page.getByText('Editar Venta #101')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/Modificá los productos, cliente, notas o método de pago de la orden/i)).toBeVisible();

      // Verify prepopulated customer name and phone
      const customerInput = page.getByPlaceholder('Nombre completo');
      await expect(customerInput).toBeVisible();
      await expect(customerInput).toHaveValue('Carlos Gómez');

      // Verify submit button has "Guardar cambios"
      const saveBtn = page.getByRole('button', { name: /Guardar cambios/i });
      await expect(saveBtn).toBeVisible();

      // Screenshot ManualSaleModal in edit mode
      await page.screenshot({ path: `e2e/screenshots/manual-sale-edit-${vp.name}.png` });

      // Modify customer name to test editing
      await customerInput.fill('Carlos Gómez (Modificado)');

      // Submit changes
      await saveBtn.click();

      // Verify modal closes and updated name is visible
      await expect(page.getByText('Editar Venta #101')).not.toBeVisible();
      await expect(page.getByText('Carlos Gómez (Modificado)')).toBeVisible({ timeout: 5000 });

      // Take screenshot of updated order card
      await page.screenshot({ path: `e2e/screenshots/order-updated-${vp.name}.png` });
    });
  }

  test('Quick edit directly from card pencil button in feed and kanban views', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/admin/orders');

    // Login
    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible({ timeout: 10000 });
    await userInput.fill('admin_craft');
    await page.locator('input[type="password"]').fill('craft');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // In feed view, click the quick edit pencil button directly on the card
    const cardEditBtn = page.locator('button[title="Editar venta"]').first();
    await expect(cardEditBtn).toBeVisible();
    await cardEditBtn.click();

    // Verify modal opens in edit mode
    await expect(page.getByText('Editar Venta #101')).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: /Cancelar/i }).first().click();
    await expect(page.getByText('Editar Venta #101')).not.toBeVisible();

    // Switch to Kanban view
    const kanbanBtn = page.getByRole('button', { name: /Kanban/i });
    await kanbanBtn.click();

    // In kanban column, click the quick edit pencil button
    const kanbanCardEditBtn = page.locator('button[title="Editar venta"]').first();
    await expect(kanbanCardEditBtn).toBeVisible();
    await kanbanCardEditBtn.click();

    // Verify modal opens in edit mode
    await expect(page.getByText('Editar Venta #101')).toBeVisible();
    await page.getByRole('button', { name: /Cancelar/i }).first().click();
    await expect(page.getByText('Editar Venta #101')).not.toBeVisible();
  });
});
