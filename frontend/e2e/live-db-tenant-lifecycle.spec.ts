import { test, expect } from '@playwright/test';

test.describe('Live DB Multi-Tenant Lifecycle, Mobile Storefront & CRM Persistence', () => {
  const timestamp = Date.now().toString().slice(-5);
  const testRestName = `Burger E2E ${timestamp}`;
  const testRestSlug = `e2e-fusion-${timestamp}`;
  const testUsername = `e2e_admin_${timestamp}`;
  const testPassword = `PassFusion_${timestamp}!`;

  test('Full Multi-Tenant Lifecycle: Super Admin Provisioning -> Tenant Setup -> Mobile Storefront Ordering -> Kanban & DB Persistence -> Safe Cleanup', async ({ browser }) => {
    test.setTimeout(60000);

    // =========================================================================
    // STEP 1: SUPER ADMIN (Desktop 1440x900)
    // =========================================================================
    const superAdminContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const superPage = await superAdminContext.newPage();

    // 1.1 Login as Super Admin
    await superPage.goto('/admin');
    const userInput = superPage.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible({ timeout: 10000 });
    await userInput.fill('admin');

    const passwordInput = superPage.locator('input[type="password"]');
    await passwordInput.fill('admin');
    
    await Promise.all([
      superPage.waitForResponse(resp => resp.url().includes('/api/users/login') && resp.status() === 200),
      superPage.getByRole('button', { name: /Acceder al Panel/i }).click(),
    ]);

    // 1.2 Verify Super Admin Directory & Action
    await expect(superPage).toHaveURL(/\/admin\/restaurants/, { timeout: 15000 });
    const createRestBtn = superPage.getByRole('button', { name: /Nuevo Restaurante/i }).first();
    await expect(createRestBtn).toBeVisible({ timeout: 15000 });
    await createRestBtn.click();

    // Fill Create Restaurant Form
    const restModal = superPage.locator('div.fixed').filter({ hasText: /Dar de Alta Nuevo Restaurante/i });
    await expect(restModal).toBeVisible();
    await restModal.getByPlaceholder(/Sushi Master Bogotá/i).fill(testRestName);
    
    const slugInput = restModal.locator('input[placeholder="sushi-master"]');
    await slugInput.clear();
    await slugInput.fill(testRestSlug);

    await restModal.getByPlaceholder(/Rollos artesanales/i).fill('Hamburguesas y fusión artesanal');
    
    // Select Template (Burger)
    const burgerTemplateBtn = restModal.getByRole('button', { name: /Hamburguesería/i });
    if (await burgerTemplateBtn.isVisible()) {
      await burgerTemplateBtn.click();
    }

    const [createRestResponse] = await Promise.all([
      superPage.waitForResponse(resp => resp.url().includes('/api/restaurants') && resp.status() === 201),
      restModal.getByRole('button', { name: /Crear Restaurante/i }).click(),
    ]);
    expect(createRestResponse.status()).toBe(201);
    await expect(restModal).not.toBeVisible({ timeout: 10000 });

    // Verify restaurant is created and listed in directory table
    const searchRestInput = superPage.getByPlaceholder(/Buscar por nombre, slug/i);
    await expect(searchRestInput).toBeVisible({ timeout: 10000 });
    await searchRestInput.fill(testRestName);
    await expect(superPage.locator('table').getByText(testRestName).first()).toBeVisible({ timeout: 10000 });

    // 1.4 Create Restaurant Admin User in Users Directory
    await superPage.getByRole('button', { name: /Usuarios & Accesos/i }).click();
    await expect(superPage).toHaveURL(/\/admin\/users/);
    await expect(superPage.getByText(/Directorio Global de Usuarios/i)).toBeVisible();

    const createUserBtn = superPage.getByRole('button', { name: /Nuevo Usuario/i }).first();
    await expect(createUserBtn).toBeVisible();
    await createUserBtn.click();

    const userModal = superPage.locator('div.fixed').filter({ hasText: /Asigna credenciales de acceso/i });
    await expect(userModal).toBeVisible();

    // Fill Create User Form
    await userModal.locator('input[placeholder*="admin_rosto" i]').fill(testUsername);
    await userModal.locator('input[type="password"]').fill(testPassword);

    // Select restaurant in modal dropdown
    const modalSelect = userModal.locator('select');
    await expect(modalSelect).toBeVisible();
    const targetOption = modalSelect.locator('option').filter({ hasText: testRestSlug });
    await expect(targetOption).toBeAttached({ timeout: 5000 });
    const optionValue = await targetOption.getAttribute('value');
    if (optionValue) {
      await modalSelect.selectOption(optionValue);
    }

    const [createUserResponse] = await Promise.all([
      superPage.waitForResponse(resp => resp.url().includes('/api/users') && resp.status() === 201),
      userModal.getByRole('button', { name: /Crear Usuario/i }).click(),
    ]);
    expect(createUserResponse.status()).toBe(201);
    await expect(userModal).not.toBeVisible({ timeout: 10000 });
    
    // Verify user appears in directory table
    const searchUserInput = superPage.getByPlaceholder(/Buscar por nombre de usuario/i);
    await expect(searchUserInput).toBeVisible({ timeout: 10000 });
    await searchUserInput.fill(testUsername);
    await expect(superPage.locator('table').getByText(testUsername).first()).toBeVisible({ timeout: 10000 });

    // =========================================================================
    // STEP 2: TENANT ADMIN (Mobile Viewport: 390x844 iPhone 13/14/15)
    // =========================================================================
    const tenantContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const tenantPage = await tenantContext.newPage();

    // 2.1 Login with newly created Tenant Admin credentials
    await tenantPage.goto('/admin');
    const tenantUserField = tenantPage.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(tenantUserField).toBeVisible({ timeout: 10000 });
    await tenantUserField.fill(testUsername);

    const tenantPassField = tenantPage.locator('input[type="password"]');
    await tenantPassField.fill(testPassword);
    
    await Promise.all([
      tenantPage.waitForResponse(resp => resp.url().includes('/api/users/login') && resp.status() === 200),
      tenantPage.getByRole('button', { name: /Acceder al Panel/i }).click(),
    ]);

    // 2.2 Verify Tenant CRM landing
    await expect(tenantPage).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // 2.3 Mobile Navigation: Open hamburger drawer & go to Menú & Carta
    await tenantPage.getByRole('button', { name: 'Abrir menú' }).click();
    await tenantPage.getByRole('button', { name: 'Menú & Carta' }).click();
    await expect(tenantPage.getByText(/Platos & Productos/i).first()).toBeVisible({ timeout: 10000 });

    // 2.4 Create a New Custom Product in CRM
    const newProductBtn = tenantPage.getByRole('button', { name: /Crear Producto/i }).first();
    await expect(newProductBtn).toBeVisible({ timeout: 10000 });
    await newProductBtn.click();

    // Fill Product Modal
    const prodModal = tenantPage.locator('div.fixed').filter({ hasText: /Nuevo Producto/i });
    await expect(prodModal).toBeVisible();
    await prodModal.locator('input[placeholder*="Plato Especial" i]').fill('Trufa Monster Burger');
    await prodModal.locator('input[type="number"]').first().fill('35000');
    await prodModal.locator('textarea').fill('Carne angus seleccionada, queso brie y salsa trufada especial');
    
    await prodModal.getByRole('button', { name: /Guardar en Menú/i }).click();
    await expect(prodModal).not.toBeVisible({ timeout: 10000 });
    await expect(tenantPage.getByText('Trufa Monster Burger').first()).toBeVisible({ timeout: 10000 });

    // 2.5 Create an Addition in CRM
    await tenantPage.getByRole('button', { name: /Adicionales & Extras/i }).click();
    const newAdditionBtn = tenantPage.getByRole('button', { name: /Añadir Adicional/i }).first();
    await expect(newAdditionBtn).toBeVisible();
    await newAdditionBtn.click();

    const addModal = tenantPage.locator('div.fixed').filter({ hasText: /Adicional/i });
    await expect(addModal).toBeVisible();
    await addModal.locator('input[placeholder*="Tocineta ahumada" i], input[type="text"]').first().fill('Salsa Trufada Extra');
    await addModal.locator('input[type="number"]').first().fill('4000');
    await addModal.getByRole('button', { name: /Guardar/i }).last().click();
    await expect(addModal).not.toBeVisible({ timeout: 10000 });

    await expect(tenantPage.getByText('Salsa Trufada Extra').first()).toBeVisible({ timeout: 10000 });

    // =========================================================================
    // STEP 3: CUSTOMER MOBILE STOREFRONT ORDERING (New Tab in Mobile Viewport)
    // =========================================================================
    const customerPage = await tenantContext.newPage();

    // 3.1 Navigate to public restaurant storefront
    await customerPage.goto(`/${testRestSlug}`);
    await expect(customerPage.getByText(testRestName).first()).toBeVisible({ timeout: 15000 });

    // 3.2 Select Product to open Customizer modal
    const productCard = customerPage.locator('div[role="button"]').filter({ hasText: /Trufa Monster Burger/i }).first();
    await expect(productCard).toBeVisible({ timeout: 10000 });
    await productCard.click();

    // In Additions / Customizer modal, select addition and add to cart
    const addExtraBtn = customerPage.getByRole('button', { name: /Agregar Salsa Trufada Extra/i }).first();
    if (await addExtraBtn.isVisible()) {
      await addExtraBtn.click();
    }

    const addToCartModalBtn = customerPage.locator('footer button').filter({ hasText: /Agregar/i }).last();
    await expect(addToCartModalBtn).toBeVisible({ timeout: 10000 });
    await addToCartModalBtn.click();

    // 3.3 Open Cart Drawer (Mobile Floating Cart Bar)
    const viewCartBtn = customerPage.getByRole('button', { name: /Ver orden|Ver Pedido|Carrito|Mi Pedido/i }).or(customerPage.locator('button:has(svg.lucide-shopping-bag)'));
    await expect(viewCartBtn.first()).toBeVisible({ timeout: 10000 });
    await viewCartBtn.first().click({ force: true });

    // 3.4 Proceed to Checkout from Cart
    const proceedCheckoutBtn = customerPage.getByRole('button', { name: /Confirmar orden/i }).first();
    await expect(proceedCheckoutBtn).toBeVisible({ timeout: 10000 });
    await proceedCheckoutBtn.click();

    // 3.5 Fill Checkout Form Details
    const nameField = customerPage.locator('input[id*="nombre" i], input[placeholder*="nombre" i], input[placeholder*="Juan" i]').first();
    if (await nameField.isVisible()) {
      await nameField.fill('Carlos E2E Tester');
    }

    const phoneField = customerPage.locator('input[id*="telefono" i], input[placeholder*="300" i], input[placeholder*="WhatsApp" i]').first();
    if (await phoneField.isVisible()) {
      await phoneField.fill('3001112233');
    }

    const dirField = customerPage.locator('input[id*="dir" i], input[placeholder*="Calle" i], input[placeholder*="Dirección" i]').first();
    if (await dirField.isVisible()) {
      await dirField.fill('Avenida 19 # 104-50');
    }

    const barrioField = customerPage.locator('input[id*="barrio" i], input[placeholder*="Barrio" i]').first();
    if (await barrioField.isVisible()) {
      await barrioField.fill('Chicó Norte');
    }

    const pagoConField = customerPage.locator('input[id*="pagoCon" i], input[placeholder*="50.000" i]').first();
    if (await pagoConField.isVisible()) {
      await pagoConField.fill('50000');
    }

    // 3.6 Submit Order
    const submitOrderBtn = customerPage.getByRole('button', { name: /Registrar venta|Enviar Pedido/i }).first();
    await expect(submitOrderBtn).toBeVisible({ timeout: 10000 });
    await submitOrderBtn.click();

    // =========================================================================
    // STEP 4: KANBAN & REAL-TIME CRM VERIFICATION (Tenant Admin Mobile Tab)
    // =========================================================================
    await tenantPage.bringToFront();
    await tenantPage.getByRole('button', { name: 'Abrir menú' }).click();
    await tenantPage.getByRole('button', { name: 'Pedidos en Vivo' }).click();
    await expect(tenantPage.getByRole('heading', { name: /Nuevos \/ Pendientes|Pedidos/i }).first()).toBeVisible({ timeout: 10000 });

    // Verify order is present in Kanban
    await expect(tenantPage.getByText('Carlos E2E Tester').first()).toBeVisible({ timeout: 10000 });

    // 4.1 Perform a POS Manual Sale from Mobile CRM
    const nuevaVentaBtn = tenantPage.getByRole('button', { name: /Nueva Venta/i }).first();
    if (await nuevaVentaBtn.isVisible()) {
      await nuevaVentaBtn.click();
      await expect(tenantPage.getByText(/Punto de Venta/i)).toBeVisible();

      // Add item in POS
      const posItem = tenantPage.locator('button').filter({ hasText: /\$|Agregar|Añadir|Trufa/i }).first();
      if (await posItem.isVisible()) {
        await posItem.click();
      }

      // Step 2: Pedido & Cobro
      const step2Btn = tenantPage.getByRole('button', { name: /2. Pedido & Cobro/i });
      if (await step2Btn.isVisible()) {
        await step2Btn.click();
        
        const posCustomerInput = tenantPage.locator('input[placeholder*="Mesa" i], input[placeholder*="Nombre" i]').first();
        if (await posCustomerInput.isVisible()) {
          await posCustomerInput.fill('Mesa 4 POS');
        }

        const completeSaleBtn = tenantPage.getByRole('button', { name: /Registrar Venta|Confirmar Venta/i }).first();
        if (await completeSaleBtn.isVisible()) {
          await completeSaleBtn.click();
        }
      }
    }

    // 4.2 Verify Database Persistence across Page Reload
    await tenantPage.reload();
    await expect(tenantPage.getByRole('heading', { name: /Nuevos \/ Pendientes|Pedidos/i }).first()).toBeVisible({ timeout: 10000 });
    await expect(tenantPage.getByText('Carlos E2E Tester').first()).toBeVisible({ timeout: 10000 });

    // =========================================================================
    // STEP 5: SAFE ISOLATED CLEANUP (Deletes ONLY the test tenant created in this run)
    // =========================================================================
    await superPage.bringToFront();
    await superPage.getByRole('button', { name: /Directorio|Restaurantes/i }).first().click();
    await expect(superPage).toHaveURL(/\/admin\/restaurants/);

    // Strict safety check: Never delete default or production tenants
    expect(testRestSlug).toMatch(/^e2e-fusion-\d+$/);
    expect(testRestSlug).not.toBe('rosto');
    expect(testRestSlug).not.toBe('craft-staging');
    expect(testRestSlug).not.toBe('burger-craft');

    // Search specifically for the test restaurant
    const searchRest = superPage.getByPlaceholder(/Buscar por nombre, slug/i);
    await searchRest.fill(testRestSlug);
    
    // Target the specific row and click Delete
    const targetRow = superPage.locator('tr').filter({ hasText: testRestSlug });
    await expect(targetRow).toBeVisible({ timeout: 10000 });
    await targetRow.locator('button[title="Eliminar restaurante"]').click();

    // Confirm Delete in Modal
    const deleteModal = superPage.getByRole('dialog').filter({ hasText: /¿Eliminar restaurante\?/i });
    await expect(deleteModal).toBeVisible();
    const confirmDeleteBtn = deleteModal.getByRole('button', { name: /Eliminar restaurante/i });
    await expect(confirmDeleteBtn).toBeVisible();
    
    const [deleteResp] = await Promise.all([
      superPage.waitForResponse((resp) => resp.url().includes('/api/restaurants') && resp.request().method() === 'DELETE'),
      confirmDeleteBtn.click(),
    ]);
    console.log('Delete response URL:', deleteResp.url(), 'status:', deleteResp.status(), 'body:', await deleteResp.text());
    expect(deleteResp.status()).toBe(200);

    await expect(deleteModal).not.toBeVisible({ timeout: 10000 });

    // Verify it is gone from UI and directory
    await expect(targetRow).not.toBeVisible({ timeout: 10000 });

    // Clean close
    await customerPage.close();
    await tenantPage.close();
    await tenantContext.close();
    await superPage.close();
    await superAdminContext.close();
  });
});
