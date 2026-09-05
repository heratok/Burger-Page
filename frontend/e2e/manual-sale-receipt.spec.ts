import { test, expect } from '@playwright/test';

test.describe('Manual Sale Transfer Receipt - POS & Order History', () => {
  test.beforeEach(async ({ page }) => {
    const mockOrders: any[] = [];

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
          additions: []
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
          token: 'mock-token-receipt-pos',
          user: {
            id: 'usr-admin-craft',
            username: 'rosto',
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
        body: JSON.stringify([]),
      });
    });

    // Mock storage upload endpoint
    await page.route('**/api/storage/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'signed_url',
          uploadUrl: 'http://localhost:5173/mock-storage-upload',
          path: 'general/mock-receipt.webp',
          publicUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        }),
      });
    });

    await page.route('**/mock-storage-upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'OK',
      });
    });

    // Handle orders POST, PATCH, and GET
    await page.route('**/api/orders**', async (route) => {
      const request = route.request();
      const method = request.method();
      const url = request.url();

      if (method === 'POST') {
        const postData = request.postDataJSON() || {};
        const newOrder = {
          id: 'ord-' + Date.now(),
          orderNumber: mockOrders.length + 101,
          status: 'pending',
          fecha: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          restaurantId: 'rest-burger-craft',
          cliente: postData.cliente || { nombre: 'Cliente Test', telefono: '3001234567' },
          items: postData.items || [],
          total: postData.total || 25000,
          subtotal: postData.subtotal || 25000,
          finalTotal: postData.finalTotal || 25000,
          metodo: postData.metodo || 'Transferencia',
          pagoCon: postData.pagoCon || null,
          cambio: postData.cambio || null,
          receiptUrl: postData.receiptUrl || undefined,
          serviceType: postData.serviceType || 'mostrador',
        };
        mockOrders.unshift(newOrder);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(newOrder),
        });
      } else if (method === 'PATCH' && url.includes('/receipt')) {
        const patchData = request.postDataJSON() || {};
        const match = url.match(/\/orders\/([^/]+)\/receipt/);
        const orderId = match ? match[1] : '';
        const order = mockOrders.find(o => o.id === orderId);
        if (order) {
          order.receiptUrl = patchData.receiptUrl;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            id: orderId,
            receiptUrl: patchData.receiptUrl,
          }),
        });
      } else if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockOrders),
        });
      } else {
        await route.continue();
      }
    });
  });

  test('Desktop: Create sale with transfer receipt and inspect in order details lightbox', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/admin/orders');

    // Login
    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible();
    await userInput.fill('rosto');

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('rosto0502');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // Open Nueva Venta POS modal
    const nuevaVentaBtn = page.getByRole('button', { name: /Nueva Venta/i }).first();
    await expect(nuevaVentaBtn).toBeVisible({ timeout: 10000 });
    await nuevaVentaBtn.click();

    // Add product to sale
    const addProductBtn = page.getByRole('button', { name: /^Agregar$/i }).first();
    await expect(addProductBtn).toBeVisible();
    await addProductBtn.click();

    // Select Transferencia payment method
    const transferBtn = page.getByRole('button', { name: /Transferencia/i });
    await expect(transferBtn).toBeVisible();
    await transferBtn.click();

    // Verify transfer receipt upload area is visible
    await expect(page.getByText(/Comprobante de Transferencia \(Opcional\)/i)).toBeVisible();
    await expect(page.getByText(/Cargar comprobante/i)).toBeVisible();

    // Set file to input
    const fileInput = page.locator('input[type="file"][accept="image/*"]').first();
    await fileInput.setInputFiles({
      name: 'comprobante_bancolombia.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    });

    // Verify upload preview shows file name and status
    await expect(page.getByText(/comprobante_bancolombia\.png/i)).toBeVisible();
    await expect(page.getByText(/Listo para adjuntar/i)).toBeVisible();

    // Screenshot of POS with attached receipt
    await page.screenshot({ path: 'e2e/screenshots/pos-with-receipt.png' });

    // Register sale
    const submitBtn = page.getByRole('button', { name: /Registrar Venta/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Modal closes
    await expect(page.getByText(/Punto de Venta/i)).not.toBeVisible();

    // Verify Kanban card has "✓ Soporte" badge
    const soporteBadge = page.getByText(/✓ Soporte/i).first();
    await expect(soporteBadge).toBeVisible();

    // Open Order Details Modal
    const viewDetailsBtn = page.locator('button[title*="detalles"]').first();
    await expect(viewDetailsBtn).toBeVisible();
    await viewDetailsBtn.click();

    // Verify receipt in details modal
    await expect(page.getByText(/✓ Comprobante cargado/i)).toBeVisible();
    await expect(page.getByText(/Ver soporte/i)).toBeVisible();

    // Screenshot of order details with receipt
    await page.screenshot({ path: 'e2e/screenshots/order-detail-with-receipt.png' });

    // Click to view enlarged receipt (Lightbox)
    await page.getByText(/Ver soporte/i).click();

    // Lightbox modal should be open
    await expect(page.getByText(/Comprobante de Transferencia/i).first()).toBeVisible();
    await expect(page.locator('a[title="Abrir imagen en nueva pestaña"]')).toBeVisible();

    // Screenshot of receipt lightbox
    await page.screenshot({ path: 'e2e/screenshots/receipt-lightbox.png' });

    // Close lightbox modal
    const closeLightboxBtn = page.locator('button[aria-label="Cerrar comprobante"]');
    await closeLightboxBtn.click();

    // Close details modal
    const closeModalBtn = page.locator('button[aria-label="Cerrar detalles"]');
    await closeModalBtn.click();
  });

  test('Order History: Attach receipt post-sale to transfer order without receipt', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/admin/orders');

    // Login
    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible();
    await userInput.fill('rosto');

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('rosto0502');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // Open Nueva Venta POS modal
    const nuevaVentaBtn = page.getByRole('button', { name: /Nueva Venta/i }).first();
    await expect(nuevaVentaBtn).toBeVisible({ timeout: 10000 });
    await nuevaVentaBtn.click();

    // Add product to sale
    await page.getByRole('button', { name: /^Agregar$/i }).first().click();

    // Select Transferencia payment method WITHOUT uploading file
    await page.getByRole('button', { name: /Transferencia/i }).click();

    // Submit sale directly
    await page.getByRole('button', { name: /Registrar Venta/i }).click();
    await expect(page.getByText(/Punto de Venta/i)).not.toBeVisible();

    // In Kanban card, verify "! Sin soporte" badge is shown
    const noSoporteBadge = page.getByText(/! Sin soporte/i).first();
    await expect(noSoporteBadge).toBeVisible();

    // Screenshot Kanban showing "! Sin soporte"
    await page.screenshot({ path: 'e2e/screenshots/kanban-no-soporte.png' });

    // Open details
    const viewDetailsBtn = page.locator('button[title*="detalles"]').first();
    await viewDetailsBtn.click();

    // In modal, verify "! Sin soporte adjunto" and attach button
    await expect(page.getByText(/! Sin soporte adjunto/i)).toBeVisible();
    const attachLabel = page.getByText(/\+ Adjuntar Soporte de Transferencia/i);
    await expect(attachLabel).toBeVisible();

    // Screenshot details without receipt
    await page.screenshot({ path: 'e2e/screenshots/order-detail-no-receipt.png' });

    // Upload receipt post-sale
    const attachFileInput = page.locator('input[type="file"][accept="image/*"]').last();
    await attachFileInput.setInputFiles({
      name: 'soporte_nequi_posterior.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    });

    // Verify modal instantly updates to "✓ Comprobante cargado"
    await expect(page.getByText(/✓ Comprobante cargado/i)).toBeVisible();
    await expect(page.getByText(/Ver soporte/i)).toBeVisible();

    // Screenshot details after post-sale attachment
    await page.screenshot({ path: 'e2e/screenshots/order-detail-after-post-upload.png' });

    // Close details modal
    const closeModalBtn = page.locator('button[aria-label="Cerrar detalles"]');
    await closeModalBtn.click();

    // Verify Kanban badge updated to "✓ Soporte"
    await expect(page.getByText(/✓ Soporte/i).first()).toBeVisible();
  });

  test('Mobile (390x844 iPhone): Transfer receipt workflow in mobile layout', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/orders');

    // Login
    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible();
    await userInput.fill('rosto');

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('rosto0502');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // Open POS
    const nuevaVentaBtn = page.getByRole('button', { name: /Nueva Venta/i }).first();
    await expect(nuevaVentaBtn).toBeVisible({ timeout: 10000 });
    await nuevaVentaBtn.click({ force: true });

    // Add product
    await page.getByRole('button', { name: /^Agregar$/i }).first().click();

    // Switch to tab 2: Pedido & Cobro
    const cobroTabBtn = page.getByRole('button', { name: /2\. Pedido & Cobro/i });
    await expect(cobroTabBtn).toBeVisible();
    await cobroTabBtn.click();

    // Select Transferencia
    const transferBtn = page.getByRole('button', { name: /Transferencia/i });
    await expect(transferBtn).toBeVisible();
    await transferBtn.click();

    // Verify upload button on mobile
    await expect(page.getByText(/Cargar comprobante/i)).toBeVisible();

    // Screenshot mobile POS transfer section
    await page.screenshot({ path: 'e2e/screenshots/mobile-pos-transfer.png' });

    // Attach file on mobile
    const fileInput = page.locator('input[type="file"][accept="image/*"]').first();
    await fileInput.setInputFiles({
      name: 'transfer_mobile.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    });

    // Verify preview renders cleanly without overflow on mobile
    await expect(page.getByText(/transfer_mobile\.png/i)).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/mobile-pos-transfer-preview.png' });

    // Submit sale
    const submitBtn = page.getByRole('button', { name: /Registrar Venta/i });
    await submitBtn.click();

    // Verify modal closes
    await expect(page.getByText(/Punto de Venta/i)).not.toBeVisible();

    // Verify badge in mobile order list/card
    await expect(page.getByText(/✓ Soporte/i).first()).toBeVisible();
  });
});
