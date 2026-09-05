import { test, expect } from '@playwright/test';

test.describe('Exhaustive Platform E2E Suite - Real DB Persistence (admin & rosto)', () => {
  test.setTimeout(180000);

  const timestamp = Date.now().toString().slice(-4);
  const testProductName = `Burger Gourmet E2E ${timestamp}`;
  const testAdditionName = `Papas Crunch E2E ${timestamp}`;
  const testCategoryName = `Especiales E2E ${timestamp}`;
  const testInventoryName = `Pan Brioche E2E ${timestamp}`;

  test('Exhaustive validation: Products, Additions, Categories, Inventory, Orders and SuperAdmin persistence', async ({ browser }) => {
    // -----------------------------------------------------------------------
    // PART 1: RESTAURANT ADMIN (rosto / rosto0502)
    // -----------------------------------------------------------------------
    const restoContext = await browser.newContext({
      baseURL: 'http://localhost:5173',
      viewport: { width: 1440, height: 900 }
    });
    const restoPage = await restoContext.newPage();

    // 1.1 Login as rosto
    await restoPage.goto('/admin');
    await restoPage.waitForLoadState('networkidle');

    const userField = restoPage.locator('input[type="text"]').first();
    await expect(userField).toBeVisible({ timeout: 15000 });
    await userField.fill('rosto');

    const passField = restoPage.locator('input[type="password"]').first();
    await passField.fill('rosto0502');

    await Promise.all([
      restoPage.waitForResponse(resp => resp.url().includes('/api/users/login') && resp.status() === 200),
      restoPage.getByRole('button', { name: /Acceder al Panel/i }).click(),
    ]);

    await expect(restoPage).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });
    await expect(restoPage.locator('aside').getByText(/rosto/i).first()).toBeVisible({ timeout: 15000 });
    await restoPage.waitForLoadState('networkidle');

    // =======================================================================
    // 1.2 MODULE: PRODUCTS (Platos & Productos) CRUD & DB PERSISTENCE
    // =======================================================================
    await restoPage.getByRole('button', { name: /Menú & Carta/i }).click();
    await restoPage.waitForLoadState('networkidle');
    await expect(restoPage.getByText(/Platos & Productos/i).first()).toBeVisible({ timeout: 15000 });

    // Ensure subtab is active
    const dishesSubtab = restoPage.getByRole('button', { name: /Platos & Productos/i });
    await dishesSubtab.click();

    // Create Product
    const createProductBtn = restoPage.getByRole('button', { name: /Crear Producto/i });
    await expect(createProductBtn).toBeVisible({ timeout: 10000 });
    await createProductBtn.click();

    const productModal = restoPage.locator('div.fixed').filter({ hasText: /Nuevo Producto/i });
    await expect(productModal).toBeVisible({ timeout: 10000 });

    await productModal.locator('input[placeholder*="Plato Especial" i]').fill(testProductName);
    await productModal.locator('input[type="number"]').first().fill('32000');
    await productModal.locator('textarea').fill('Carne angus seleccionada, salsa especial y pan brioche artesanal');

    const [createProductResp] = await Promise.all([
      restoPage.waitForResponse(resp => resp.url().includes('/api/products') && resp.request().method() === 'POST' && resp.status() === 201),
      productModal.getByRole('button', { name: /Guardar en Menú/i }).click(),
    ]);
    const createdProduct = await createProductResp.json();
    expect(createdProduct.name).toBe(testProductName);
    expect(createdProduct.restaurantId).toBe('rest-1788579266608');

    await expect(productModal).not.toBeVisible({ timeout: 10000 });
    await expect(restoPage.getByText(testProductName).first()).toBeVisible({ timeout: 10000 });

    // Verify persistence across reload (PostgreSQL hydration)
    await restoPage.reload();
    await restoPage.waitForLoadState('networkidle');
    await restoPage.getByRole('button', { name: /Menú & Carta/i }).click();
    await expect(restoPage.getByText(testProductName).first()).toBeVisible({ timeout: 15000 });

    // =======================================================================
    // 1.3 MODULE: ADDITIONS (Adicionales & Extras) CRUD & DB PERSISTENCE
    // =======================================================================
    const additionsSubtab = restoPage.getByRole('button', { name: /Adicionales & Extras/i });
    await expect(additionsSubtab).toBeVisible({ timeout: 10000 });
    await additionsSubtab.click();

    const addAdditionBtn = restoPage.getByRole('button', { name: /Añadir Adicional/i });
    await expect(addAdditionBtn).toBeVisible({ timeout: 10000 });
    await addAdditionBtn.click();

    const additionModal = restoPage.locator('div.fixed').filter({ hasText: /Nuevo Adicional/i });
    await expect(additionModal).toBeVisible({ timeout: 10000 });

    await additionModal.getByPlaceholder(/Tocineta ahumada/i).fill(testAdditionName);
    await additionModal.locator('input[type="number"]').fill('4500');

    const [createAdditionResp] = await Promise.all([
      restoPage.waitForResponse(resp => resp.url().includes('/api/additions') && resp.request().method() === 'POST' && resp.status() === 201),
      additionModal.getByRole('button', { name: 'Guardar' }).click(),
    ]);
    const createdAddition = await createAdditionResp.json();
    expect(createdAddition.name).toBe(testAdditionName);
    expect(createdAddition.restaurantId).toBe('rest-1788579266608');

    await expect(restoPage.getByRole('heading', { name: testAdditionName })).toBeVisible({ timeout: 10000 });

    // Verify persistence across reload
    await restoPage.reload();
    await restoPage.waitForLoadState('networkidle');
    await restoPage.getByRole('button', { name: /Menú & Carta/i }).click();
    await restoPage.getByRole('button', { name: /Adicionales & Extras/i }).click();
    await expect(restoPage.getByRole('heading', { name: testAdditionName })).toBeVisible({ timeout: 15000 });

    // =======================================================================
    // 1.4 MODULE: CATEGORIES CRUD & DB PERSISTENCE
    // =======================================================================
    await restoPage.getByRole('button', { name: /Platos & Productos/i }).click();
    const manageCategoriesBtn = restoPage.getByRole('button', { name: /Gestionar Categorías/i });
    await expect(manageCategoriesBtn).toBeVisible({ timeout: 10000 });
    await manageCategoriesBtn.click();

    const categoryModal = restoPage.locator('div.fixed').filter({ hasText: /Gestionar Categorías del Menú/i });
    await expect(categoryModal).toBeVisible({ timeout: 10000 });

    const categoryInput = categoryModal.locator('input[placeholder*="Nueva categoría" i]');
    await categoryInput.fill(testCategoryName);

    const [catResponse] = await Promise.all([
      restoPage.waitForResponse(resp => resp.url().includes('/categories') && resp.request().method() === 'PUT' && resp.status() === 200),
      categoryModal.getByRole('button', { name: /Agregar/i }).click(),
    ]);
    const catBody = await catResponse.json();
    expect(catBody.categories).toContain(testCategoryName);

    await expect(categoryModal.getByText(testCategoryName)).toBeVisible({ timeout: 10000 });
    await categoryModal.locator('button:has(svg.lucide-x)').first().click();

    // Verify category persistence across reload
    await restoPage.reload();
    await restoPage.waitForLoadState('networkidle');
    await restoPage.getByRole('button', { name: /Menú & Carta/i }).click();
    await restoPage.getByRole('button', { name: /Gestionar Categorías/i }).click();
    const categoryModalAfterReload = restoPage.locator('div.fixed').filter({ hasText: /Gestionar Categorías del Menú/i });
    await expect(categoryModalAfterReload.getByText(testCategoryName)).toBeVisible({ timeout: 15000 });
    await categoryModalAfterReload.locator('button:has(svg.lucide-x)').first().click();

    // =======================================================================
    // 1.5 MODULE: INVENTORY (Stock & Insumos) CRUD, STOCK ADJUSTMENT & DB PERSISTENCE
    // =======================================================================
    await restoPage.getByRole('button', { name: /Stock & Insumos/i }).click();
    await restoPage.waitForLoadState('networkidle');
    await expect(restoPage.getByText(/Control de Stock/i).first()).toBeVisible({ timeout: 15000 });

    const newInventoryBtn = restoPage.getByRole('button', { name: /Nuevo Insumo/i });
    await expect(newInventoryBtn).toBeVisible({ timeout: 10000 });
    await newInventoryBtn.click();

    const inventoryModal = restoPage.locator('div.fixed').filter({ hasText: /Nuevo Insumo en Inventario/i });
    await expect(inventoryModal).toBeVisible({ timeout: 10000 });

    await inventoryModal.locator('input[placeholder*="Pan Brioche" i]').fill(testInventoryName);
    await inventoryModal.locator('input[type="number"]').nth(0).fill('50'); // Stock actual
    await inventoryModal.locator('input[type="number"]').nth(1).fill('10'); // Alerta mínima
    await inventoryModal.locator('input[type="number"]').nth(2).fill('1200'); // Costo unitario

    const [createInvResp] = await Promise.all([
      restoPage.waitForResponse(resp => resp.url().includes('/api/inventory') && resp.request().method() === 'POST' && resp.status() === 201),
      inventoryModal.getByRole('button', { name: /Guardar Insumo/i }).click(),
    ]);
    const createdInv = await createInvResp.json();
    expect(createdInv.name).toBe(testInventoryName);
    expect(createdInv.currentStock).toBe(50);
    expect(createdInv.restaurantId).toBe('rest-1788579266608');

    await expect(inventoryModal).not.toBeVisible({ timeout: 10000 });

    // Item must be in table with stock 50
    const inventoryRow = restoPage.locator('tr').filter({ hasText: testInventoryName });
    await expect(inventoryRow).toBeVisible({ timeout: 10000 });
    await expect(inventoryRow).toContainText('50');

    // Quick adjust stock: +5 (now executed exactly once!)
    const [adjustResp] = await Promise.all([
      restoPage.waitForResponse(resp => resp.url().includes('/api/inventory') && resp.url().includes('/stock') && resp.status() === 200),
      inventoryRow.getByRole('button', { name: '+5' }).click(),
    ]);
    const adjustedInv = await adjustResp.json();
    expect(adjustedInv.currentStock).toBe(55);

    // Verify persistence across reload (should show 55 in PostgreSQL)
    await restoPage.reload();
    await restoPage.waitForLoadState('networkidle');
    await restoPage.getByRole('button', { name: /Stock & Insumos/i }).click();
    const inventoryRowAfterReload = restoPage.locator('tr').filter({ hasText: testInventoryName });
    await expect(inventoryRowAfterReload).toBeVisible({ timeout: 15000 });
    await expect(inventoryRowAfterReload).toContainText('55');

    // Delete inventory item
    await inventoryRowAfterReload.locator('button[title="Eliminar insumo"]').click();
    const confirmDeleteInvModal = restoPage.locator('div.fixed').filter({ hasText: /¿Eliminar insumo del inventario\?/i });
    await expect(confirmDeleteInvModal).toBeVisible();

    await Promise.all([
      restoPage.waitForResponse(resp => resp.url().includes('/api/inventory') && resp.request().method() === 'DELETE' && resp.status() === 204),
      confirmDeleteInvModal.getByRole('button', { name: /Eliminar insumo/i }).click(),
    ]);
    await expect(inventoryRowAfterReload).not.toBeVisible({ timeout: 5000 });

    // =======================================================================
    // PART 2: STOREFRONT ORDERING & LIVE KANBAN (Customer -> Restaurant Admin)
    // =======================================================================
    const customerContext = await browser.newContext({
      baseURL: 'http://localhost:5173',
      viewport: { width: 390, height: 844 }
    });
    const customerPage = await customerContext.newPage();

    // 2.1 Navigate to rosto storefront
    await customerPage.goto('/rosto');
    await customerPage.waitForLoadState('networkidle');
    await expect(customerPage.getByText(/Rosto/i).first()).toBeVisible({ timeout: 15000 });

    // 2.2 Select the newly created product
    const productCard = customerPage.locator('div[role="button"]').filter({ hasText: testProductName }).first();
    await expect(productCard).toBeVisible({ timeout: 10000 });
    await productCard.click();

    // In customizer modal, add to cart
    const addToCartModalBtn = customerPage.locator('footer button').filter({ hasText: /Agregar/i }).last();
    await expect(addToCartModalBtn).toBeVisible({ timeout: 10000 });
    await addToCartModalBtn.click();

    // Open Cart & Checkout
    const viewCartBtn = customerPage.getByRole('button', { name: /Ver orden|Ver Pedido|Carrito|Mi Pedido/i }).or(customerPage.locator('button:has(svg.lucide-shopping-bag)'));
    await expect(viewCartBtn.first()).toBeVisible({ timeout: 10000 });
    await viewCartBtn.first().click({ force: true });

    const proceedCheckoutBtn = customerPage.getByRole('button', { name: /Confirmar orden/i }).first();
    await expect(proceedCheckoutBtn).toBeVisible({ timeout: 10000 });
    await proceedCheckoutBtn.click();

    // Fill customer checkout details
    const nameField = customerPage.locator('input#nombre, input[id*="nombre" i]').first();
    await expect(nameField).toBeVisible({ timeout: 10000 });
    await nameField.fill('Cliente E2E Exhaustivo');

    const phoneField = customerPage.locator('input#telefono, input[id*="telefono" i]').first();
    await phoneField.fill('3101234567');

    const dirField = customerPage.locator('input#dir, input[id*="dir" i]').first();
    await dirField.fill('Carrera 7 # 72-41');

    const barrioField = customerPage.locator('input#barrio, input[id*="barrio" i]').first();
    await barrioField.fill('Rosales');

    // Submit order -> Expect 201 Created in DB
    const submitOrderBtn = customerPage.locator('button[type="submit"]').filter({ hasText: /Registrar venta/i }).first();
    await expect(submitOrderBtn).toBeVisible({ timeout: 10000 });

    const [orderResponse] = await Promise.all([
      customerPage.waitForResponse(resp => resp.url().includes('/api/orders') && resp.request().method() === 'POST' && resp.status() === 201),
      submitOrderBtn.click(),
    ]);
    const createdOrder = await orderResponse.json();
    expect(createdOrder.restaurantId).toBe('rest-1788579266608');
    expect(createdOrder.status).toBe('pending');

    // 2.3 Verify in Restaurant Admin Kanban & Advance Status
    await restoPage.bringToFront();
    await restoPage.getByRole('button', { name: /Pedidos en Vivo/i }).click();
    await restoPage.waitForLoadState('networkidle');
    await expect(restoPage.getByText('Cliente E2E Exhaustivo').first()).toBeVisible({ timeout: 15000 });

    // Transition order status: Click "A Cocina"
    const advanceStatusBtn = restoPage.getByRole('button', { name: /A Cocina/i }).first();
    await expect(advanceStatusBtn).toBeVisible({ timeout: 10000 });

    const [statusResp] = await Promise.all([
      restoPage.waitForResponse(resp => resp.url().includes('/api/orders') && resp.url().includes('/status') && resp.status() === 200),
      advanceStatusBtn.click(),
    ]);
    const statusBody = await statusResp.json();
    expect(statusBody.status).toBe('cooking');

    // Verify order persistence across reload
    await restoPage.reload();
    await restoPage.waitForLoadState('networkidle');
    await restoPage.getByRole('button', { name: /Pedidos en Vivo/i }).click();
    await expect(restoPage.getByText('Cliente E2E Exhaustivo').first()).toBeVisible({ timeout: 15000 });

    // =======================================================================
    // 1.6 CLEANUP: Delete the test product and addition created in this test
    // =======================================================================
    await restoPage.getByRole('button', { name: /Menú & Carta/i }).click();
    await restoPage.waitForLoadState('networkidle');
    
    // Delete product
    const prodCardToDelete = restoPage.locator('div.group').filter({ hasText: testProductName }).first();
    if (await prodCardToDelete.isVisible()) {
      await prodCardToDelete.locator('button[title="Eliminar plato"]').click();
      const confirmProdModal = restoPage.locator('div.fixed').filter({ hasText: /¿Eliminar plato del menú\?/i });
      await expect(confirmProdModal).toBeVisible();

      await Promise.all([
        restoPage.waitForResponse(resp => resp.url().includes('/api/products') && resp.request().method() === 'DELETE' && (resp.status() === 204 || resp.status() === 200)),
        confirmProdModal.getByRole('button', { name: /Eliminar plato/i }).click(),
      ]);
      await expect(restoPage.getByText(testProductName)).not.toBeVisible({ timeout: 5000 });
    }

    // Delete addition
    await restoPage.getByRole('button', { name: /Adicionales & Extras/i }).click();
    const addCardToDelete = restoPage.locator('div.rounded-xl').filter({ has: restoPage.getByRole('heading', { name: testAdditionName }) }).first();
    if (await addCardToDelete.isVisible()) {
      await addCardToDelete.locator('button[title="Eliminar adicional"]').click();
      const confirmAddModal = restoPage.locator('div.fixed').filter({ hasText: /Eliminar adición/i });
      await expect(confirmAddModal).toBeVisible();

      await Promise.all([
        restoPage.waitForResponse(resp => resp.url().includes('/api/additions') && resp.request().method() === 'DELETE' && resp.status() === 204),
        confirmAddModal.getByRole('button', { name: /Eliminar adición/i }).click(),
      ]);
      await expect(restoPage.getByRole('heading', { name: testAdditionName })).not.toBeVisible({ timeout: 5000 });
    }

    // =======================================================================
    // PART 3: SUPER ADMIN ACCESS & CROSS-TENANT OVERSIGHT (admin / Test0502*)
    // =======================================================================
    const superAdminContext = await browser.newContext({
      baseURL: 'http://localhost:5173',
      viewport: { width: 1440, height: 900 }
    });
    const superPage = await superAdminContext.newPage();

    await superPage.goto('/admin');
    await superPage.waitForLoadState('networkidle');

    const superUserField = superPage.locator('input[type="text"]').first();
    await expect(superUserField).toBeVisible({ timeout: 15000 });
    await superUserField.fill('admin');

    const superPassField = superPage.locator('input[type="password"]').first();
    await superPassField.fill('Test0502*');

    await Promise.all([
      superPage.waitForResponse(resp => resp.url().includes('/api/users/login') && resp.status() === 200),
      superPage.getByRole('button', { name: /Acceder al Panel/i }).click(),
    ]);

    // Super Admin directory
    await expect(superPage).toHaveURL(/\/admin\/restaurants/, { timeout: 15000 });
    const rostoRow = superPage.locator('tr').filter({ hasText: 'rosto' }).first();
    await expect(rostoRow).toBeVisible({ timeout: 15000 });

    // Click "Administrar" to manage rosto
    await rostoRow.getByRole('button', { name: /Administrar/i }).click();
    await expect(superPage).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Verify Super Admin can view orders, products, inventory for rosto with zero 401 Unauthorized errors
    const [ordersResp] = await Promise.all([
      superPage.waitForResponse(resp => resp.url().includes('/api/orders') && resp.status() === 200),
      superPage.getByRole('button', { name: /Pedidos en Vivo/i }).click(),
    ]);
    expect(ordersResp.status()).toBe(200);

    const [productsResp] = await Promise.all([
      superPage.waitForResponse(resp => resp.url().includes('/api/products') && resp.status() === 200),
      superPage.getByRole('button', { name: /Menú & Carta/i }).click(),
    ]);
    expect(productsResp.status()).toBe(200);

    const [inventoryResp] = await Promise.all([
      superPage.waitForResponse(resp => resp.url().includes('/api/inventory') && resp.status() === 200),
      superPage.getByRole('button', { name: /Stock & Insumos/i }).click(),
    ]);
    expect(inventoryResp.status()).toBe(200);

    // Close all contexts
    await customerPage.close();
    await customerContext.close();
    await restoPage.close();
    await restoContext.close();
    await superPage.close();
    await superAdminContext.close();
  });
});
