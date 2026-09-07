import { test, expect } from '@playwright/test';

test.describe('Judgment Day Confirmed Severe Fixes E2E Verification Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const envelope = {
        version: 2,
        superAdminPassword: 'admin',
        restaurants: [
          {
            id: 'rest-burger-craft',
            name: 'Burger Craft',
            slug: 'burger-craft',
            adminPassword: 'craft',
            isActive: true,
            config: {
              name: 'Burger Craft',
              tagline: 'Cocina artesanal de autor',
              primaryColor: '#E63946',
              primaryHoverColor: '#F25C69',
              bgTheme: 'dark-charcoal',
              cardStyle: 'elevated',
              cardRadius: 'md',
              fontFamily: 'sans',
              whatsappNumber: '3001234567',
              deliveryFee: 5000,
              estimatedDeliveryTime: '30-45 min',
              minOrderAmount: 20000,
              address: 'Calle 72 # 11-85',
              currencySymbol: '$',
            },
            categories: ['Hamburguesas', 'Acompañamientos', 'Bebidas'],
            products: [
              {
                id: 'prod-1',
                name: 'Hamburguesa Clásica Artesanal',
                description: 'Carne 180g con queso cheddar',
                price: 26000,
                category: 'Hamburguesas',
                src: '',
                inStock: true,
              },
            ],
            additions: [
              { id: 'add-1', name: 'Queso Cheddar Extra', price: 3000, available: true },
            ],
            inventory: [
              {
                id: 'inv-1',
                name: 'Pan Brioche Artesanal',
                category: 'ingredients',
                currentStock: 40,
                quantity: 40,
                minStockAlert: 10,
                unit: 'unidades',
                costPerUnit: 1500,
              },
            ],
            orders: [],
            customers: [],
            suppliers: [],
          },
        ],
      };
      localStorage.setItem('burger_page_platform_v2', JSON.stringify(envelope));
      localStorage.setItem('burger_page_active_rest_v2', 'rest-burger-craft');
    });

    await page.route('**/api/restaurants**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          json: [
            {
              id: 'rest-burger-craft',
              name: 'Burger Craft',
              slug: 'burger-craft',
              adminPassword: 'craft',
              isActive: true,
              config: {
                name: 'Burger Craft',
                tagline: 'Cocina artesanal de autor',
                primaryColor: '#E63946',
                primaryHoverColor: '#F25C69',
                bgTheme: 'dark-charcoal',
                cardStyle: 'elevated',
                cardRadius: 'md',
                fontFamily: 'sans',
                whatsappNumber: '3001234567',
                deliveryFee: 5000,
                estimatedDeliveryTime: '30-45 min',
                minOrderAmount: 20000,
                address: 'Calle 72 # 11-85',
                currencySymbol: '$',
              },
            },
          ],
        });
      } else {
        await route.continue();
      }
    });
  });

  test('JD-CONF-01: Storefront configuration update and reset trigger backend synchronization', async ({ page }) => {
    const capturedPutBodies: any[] = [];

    await page.route('**/api/restaurants/**', async (route) => {
      if (route.request().method() === 'PUT') {
        capturedPutBodies.push(route.request().postDataJSON());
        await route.fulfill({ status: 200, json: { message: 'Updated' } });
      } else {
        await route.continue();
      }
    });

    await page.goto('/admin/customizer');

    // Login
    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible({ timeout: 10000 });
    await userInput.fill('admin_craft');
    await page.locator('input[type="password"]').fill('craft');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // Verify Customizer page is loaded
    await expect(page.getByText('Personalizador Visual de Tienda')).toBeVisible({ timeout: 10000 });

    // Click Guardar & Publicar
    const saveBtn = page.getByRole('button', { name: /Guardar & Publicar/i });
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await saveBtn.click();

    await expect(page.getByText(/Diseño y configuración actualizados/i)).toBeVisible();
    expect(capturedPutBodies.length).toBeGreaterThan(0);
    expect(capturedPutBodies[0]).toHaveProperty('config');

    // Accept window.confirm when resetting
    page.on('dialog', (dialog) => dialog.accept());

    // Click Restablecer
    const resetBtn = page.getByRole('button', { name: /Restablecer/i });
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    await expect(page.getByText(/Diseño restablecido a los valores por defecto/i)).toBeVisible();
    expect(capturedPutBodies.length).toBeGreaterThan(1);
    expect(capturedPutBodies[1]?.config).toBeDefined();
  });

  test('JD-CONF-02: Inventory item update maps currentStock to quantity and coordinates calls', async ({ page }) => {
    let capturedInventoryPut: any = null;
    let stockEndpointCalled = false;

    await page.route('**/api/inventory**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          json: [
            {
              id: 'inv-1',
              name: 'Pan Brioche Artesanal',
              category: 'ingredients',
              currentStock: 40,
              quantity: 40,
              minStockAlert: 10,
              unit: 'unidades',
              costPerUnit: 1500,
            },
          ],
        });
      } else if (route.request().method() === 'PUT') {
        if (route.request().url().includes('/stock')) {
          stockEndpointCalled = true;
        } else {
          capturedInventoryPut = route.request().postDataJSON();
        }
        await route.fulfill({ status: 200, json: { message: 'Success' } });
      } else {
        await route.continue();
      }
    });

    await page.goto('/admin/inventory');

    // Login
    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible({ timeout: 10000 });
    await userInput.fill('admin_craft');
    await page.locator('input[type="password"]').fill('craft');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // Verify inventory table
    await expect(page.getByText('Pan Brioche Artesanal')).toBeVisible({ timeout: 10000 });

    // Open edit modal for Pan Brioche Artesanal
    const row = page.locator('tr').filter({ hasText: 'Pan Brioche Artesanal' });
    const editBtn = row.locator('button[title*="Editar" i], button:has-text("Editar")').first();
    await editBtn.click();

    const modal = page.locator('div.fixed').filter({ hasText: /Editar Insumo/i });
    await expect(modal).toBeVisible();

    // Edit stock
    const stockInput = modal.locator('input[type="number"]').first();
    await stockInput.fill('60');
    await modal.getByRole('button', { name: /Guardar Insumo/i }).click();

    await expect(modal).not.toBeVisible();
    await expect(page.getByText(/Insumo actualizado/i)).toBeVisible();

    // Verify payload mapping to quantity
    expect(capturedInventoryPut).toBeDefined();
    expect(capturedInventoryPut?.quantity).toBe(60);
    expect(stockEndpointCalled).toBe(false);
  });

  test('JD-CONF-03: Category addition triggers updateCategories and updates state optimistically', async ({ page }) => {
    let capturedCategories: string[] | null = null;

    await page.route('**/api/restaurant/**/categories', async (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON();
        capturedCategories = body?.categories || [];
        await route.fulfill({ status: 200, json: { categories: capturedCategories } });
      } else {
        await route.continue();
      }
    });

    await page.goto('/admin/menu');

    // Login
    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible({ timeout: 10000 });
    await userInput.fill('admin_craft');
    await page.locator('input[type="password"]').fill('craft');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // Open category modal
    const manageCatBtn = page.getByRole('button', { name: /Gestionar Categorías/i });
    await expect(manageCatBtn).toBeVisible({ timeout: 10000 });
    await manageCatBtn.click();

    const modal = page.locator('div.fixed').filter({ hasText: /Gestionar Categorías/i });
    await expect(modal).toBeVisible();

    // Add category "Pizzas Gourmet"
    const catInput = modal.getByPlaceholder(/Nueva categoría/i);
    await catInput.fill('Pizzas Gourmet');
    await modal.getByRole('button', { name: /Agregar/i }).click();

    await expect(modal.getByText('Pizzas Gourmet')).toBeVisible();
    expect(capturedCategories).toContain('Pizzas Gourmet');
  });

  test('JD-SUSP-01: Order creation with additions maps additionId and quantity conforming to backend schema', async ({ page }) => {
    let capturedOrderPayload: any = null;

    await page.route('**/api/orders**', async (route) => {
      if (route.request().method() === 'POST') {
        capturedOrderPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          json: {
            id: 'ord-backend-100',
            orderNumber: 101,
            total: capturedOrderPayload?.total || 29000,
            status: 'pending',
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/burger-craft');

    // Click on the product "Hamburguesa Clásica Artesanal"
    const productCard = page.locator('div[role="button"]').filter({ hasText: 'Hamburguesa Clásica Artesanal' }).first();
    await expect(productCard).toBeVisible({ timeout: 10000 });
    await productCard.click();

    // Additions modal opens
    const additionsModal = page.locator('div[role="dialog"]');
    await expect(additionsModal).toBeVisible({ timeout: 5000 });

    // Select the addition "Queso Cheddar Extra"
    const addAdditionBtn = additionsModal.getByRole('button', { name: /Agregar Queso Cheddar Extra/i });
    await expect(addAdditionBtn).toBeVisible();
    await addAdditionBtn.click();

    // Confirm product addition to cart
    const confirmAddBtn = additionsModal.getByRole('button', { name: /Agregar ·/i });
    await confirmAddBtn.click();
    await expect(additionsModal).not.toBeVisible();

    // Open cart via navbar cart button
    const cartBtn = page.locator('button[aria-label*="Ver orden" i]').first();
    await expect(cartBtn).toBeVisible();
    await cartBtn.click();

    // In Cart, click "Confirmar orden"
    const checkoutBtn = page.getByRole('button', { name: /Confirmar orden/i });
    await expect(checkoutBtn).toBeVisible();
    await checkoutBtn.click();

    // Fill customer form
    await page.getByPlaceholder(/Tu nombre/i).fill('Carlos Santana');
    await page.getByPlaceholder(/3001234567/i).fill('3101234567');
    await page.getByPlaceholder(/Calle 123 #45-67/i).fill('Calle 100 # 15-20');
    await page.getByPlaceholder(/Tu barrio/i).fill('Chicó');

    // Click "Registrar venta"
    const submitBtn = page.getByRole('button', { name: /Registrar venta/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    await expect(page.getByText(/¡Venta registrada con éxito!/i)).toBeVisible({ timeout: 10000 });

    // Verify backend payload structure
    expect(capturedOrderPayload).toBeDefined();
    expect(capturedOrderPayload.items).toBeDefined();
    expect(capturedOrderPayload.items.length).toBeGreaterThan(0);

    const firstItem = capturedOrderPayload.items[0];
    expect(firstItem.additions).toBeDefined();
    expect(Array.isArray(firstItem.additions)).toBe(true);
    expect(firstItem.additions.length).toBeGreaterThan(0);

    // Each addition MUST be an object with additionId and quantity (not a raw string)
    const firstAddition = firstItem.additions[0];
    expect(firstAddition).toHaveProperty('additionId');
    expect(firstAddition).toHaveProperty('quantity');
    expect(firstAddition.additionId).toBe('add-1');
    expect(firstAddition.quantity).toBe(1);
  });
});
