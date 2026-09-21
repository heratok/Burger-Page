import { test, expect } from '@playwright/test';

test.describe('Order Deletion & Persistence E2E Suite', () => {
  test.describe.configure({ mode: 'serial' });
  let seededProductName: string

  test.beforeAll(async ({ request }) => {
    const API_BASE = 'http://localhost:3001/api'
    const loginRes = await request.post(`${API_BASE}/users/login`, {
      data: { username: 'rosto', password: 'rosto0502' },
    })
    expect(loginRes.status()).toBe(200)
    const { token, user } = await loginRes.json()
    // Run-unique customer phone: create_order_atomic reuses customers by
    // phone, so each run gets a private customer row and never collides
    // with order-edit-verified.spec.ts (family '3008').
    const seedPhone = `3015${Date.now().toString().slice(-6)}`

    // Purge stale seeded customers from previous runs (their orders were
    // deleted by this spec's tests) so each run starts with a private
    // customer row for this spec's phone family.
    const custRes = await request.get(`${API_BASE}/customers?restaurantId=${user.restaurantId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (custRes.status() === 200) {
      const custs = await custRes.json()
      for (const c of Array.isArray(custs) ? custs : []) {
        if (c?.phone && String(c.phone).startsWith('3015')) {
          await request.delete(`${API_BASE}/customers/${c.id}?restaurantId=${user.restaurantId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        }
      }
    }

    const productRes = await request.post(`${API_BASE}/products`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: `E2E Delete Seed ${Date.now().toString().slice(-6)}`,
        price: 20000,
        category: 'Hamburguesas',
        isAvailable: true,
      },
    })
    expect(productRes.status()).toBe(201)
    const product = await productRes.json()
    seededProductName = product.name

    const orderPayload = {
      restaurantId: user.restaurantId,
      items: [{ productId: product.id, quantity: 1 }],
      customer: { name: 'Seed Cliente', phone: seedPhone, barrio: 'Centro' },
      deliveryFee: 0,
      paymentMethod: 'Efectivo',
      paymentAmount: 20000,
      changeAmount: 0,
      comment: 'seeded-for-delete-verified',
      clientOrderId: `delete-seed-a-${Date.now()}`,
    }
    const orderARes = await request.post(`${API_BASE}/orders`, {
      headers: { Authorization: `Bearer ${token}` },
      data: orderPayload,
    })
    expect(orderARes.status()).toBe(201)

    orderPayload.clientOrderId = `delete-seed-b-${Date.now()}`
    const orderBRes = await request.post(`${API_BASE}/orders`, {
      headers: { Authorization: `Bearer ${token}` },
      data: orderPayload,
    })
    expect(orderBRes.status()).toBe(201)
  })

  test('logs in as rosto admin, deletes an order via modal, verifies DB deletion and persistence after reload', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Navigate to /admin
    await page.goto('/admin');

    // 2. Fill login credentials as rosto / rosto0502
    const userInput = page.locator('input#username, input[placeholder*="usuario" i], input[type="text"]').first();
    const passInput = page.locator('input#password, input[type="password"]').first();
    await expect(userInput).toBeVisible({ timeout: 10000 });
    await userInput.fill('rosto');
    await passInput.fill('rosto0502');

    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // 3. Wait for authenticated view
    const heading = page.locator('h1, h2, h3').first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    // 4. Click 'Pedidos en Vivo' button in sidebar and wait for orders API response
    const ordersBtn = page.locator('aside button, nav button').filter({ hasText: /Pedidos en Vivo/i }).first();
    await expect(ordersBtn).toBeVisible({ timeout: 5000 });
    
    const ordersResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/orders') && !res.url().includes('/stream') && res.status() === 200,
      { timeout: 15000 }
    ).catch(() => null);

    await ordersBtn.click();
    await ordersResponsePromise;

    // 5. Locate THIS run's seeded card (unique product name) and its eye button
    const seededCard = page
      .locator('div')
      .filter({ hasText: seededProductName })
      .filter({ has: page.locator('button[title*="Ver detalles completos"]') })
      .first();
    await expect(seededCard).toBeVisible({ timeout: 10000 });
    const firstEyeBtn = seededCard.locator('button[title*="Ver detalles completos de la orden"]').first();

    // Get order number from the card
    const firstOrderCard = seededCard;
    const cardText = await firstOrderCard.innerText();
    const orderNumberMatch = cardText.match(/#(\d+)/);
    const orderNumber = orderNumberMatch ? orderNumberMatch[1] : null;
    console.log(`Targeting Order #${orderNumber} for deletion...`);

    // 6. Click eye icon to open OrderDetailModal
    await firstEyeBtn.click();

    // 7. Click "Eliminar Orden" button in detail modal
    const deleteBtnInModal = page.locator('button[title*="Eliminar orden definitivamente"], button:has-text("Eliminar Orden")').first();
    await expect(deleteBtnInModal).toBeVisible({ timeout: 5000 });
    await deleteBtnInModal.click();

    // 8. Confirm in ConfirmDeleteModal
    const confirmModal = page.locator('div[role="dialog"]').filter({ hasText: /¿Eliminar orden permanentemente\?|¿Confirmar eliminación\?/i });
    await expect(confirmModal).toBeVisible({ timeout: 5000 });

    const confirmBtn = confirmModal.locator('button:has-text("Eliminar orden"), button:has-text("Eliminar definitivamente")').first();
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });

    // Wait for the DELETE API request to complete
    const deleteResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/orders/') && res.request().method() === 'DELETE' && res.status() === 200,
      { timeout: 15000 }
    );

    await confirmBtn.click();
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBe(200);
    const deleteBody = await deleteResponse.json();
    console.log('Server DELETE response:', deleteBody);
    expect(deleteBody).toHaveProperty('success', true);

    // 9. Toast appeared
    const toastElem = page.locator('li[data-sonner-toast], div[role="status"]').filter({ hasText: /Orden eliminada/i });
    await expect(toastElem).toBeVisible({ timeout: 5000 });

    // Wait a brief moment to let UI settle
    await page.waitForTimeout(1000);

    // 10. Reload the page to test persistence from database
    console.log('Reloading page to test persistence...');
    await page.reload();
    await page.waitForTimeout(2000);

    // If on dashboard, navigate to Pedidos en Vivo
    const ordersBtnAfterReload = page.locator('aside button, nav button').filter({ hasText: /Pedidos en Vivo/i }).first();
    if (await ordersBtnAfterReload.isVisible()) {
      const reloadOrdersPromise = page.waitForResponse(
        (res) => res.url().includes('/api/orders') && !res.url().includes('/stream') && res.status() === 200,
        { timeout: 15000 }
      ).catch(() => null);
      await ordersBtnAfterReload.click();
      await reloadOrdersPromise;
      await page.waitForTimeout(1500);
    }

    // 11. Assert that the deleted order number is NOT in the cards
    if (orderNumber) {
      const deletedCard = page.locator(`span:has-text("#${orderNumber}")`);
      const isStillPresent = await deletedCard.isVisible();
      console.log(`Is order #${orderNumber} still present after reload?`, isStillPresent);
      expect(isStillPresent).toBe(false);
    }

    // Take final proof screenshot
    await page.screenshot({ path: 'test-results/order-deleted-and-persisted.png' });
    console.log('Successfully verified order deletion in UI, server, and database!');
  });

  test('deletes an order from Kanban view, verifies DB deletion and persistence after reload', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Navigate to /admin
    await page.goto('/admin');

    // 2. Fill login credentials
    const userInput = page.locator('input#username, input[placeholder*="usuario" i], input[type="text"]').first();
    const passInput = page.locator('input#password, input[type="password"]').first();
    await expect(userInput).toBeVisible({ timeout: 10000 });
    await userInput.fill('rosto');
    await passInput.fill('rosto0502');

    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // 3. Wait for authenticated view
    const heading = page.locator('h1, h2, h3').first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    // 4. Click 'Pedidos en Vivo' button in sidebar and wait for orders API response
    const ordersBtn = page.locator('aside button, nav button').filter({ hasText: /Pedidos en Vivo/i }).first();
    await expect(ordersBtn).toBeVisible({ timeout: 5000 });
    
    const ordersResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/orders') && !res.url().includes('/stream') && res.status() === 200,
      { timeout: 15000 }
    ).catch(() => null);

    await ordersBtn.click();
    await ordersResponsePromise;

    // 5. Switch to Kanban view
    const kanbanModeBtn = page.locator('button[title*="Tablero Kanban"], button:has-text("Kanban")').first();
    if (await kanbanModeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await kanbanModeBtn.click();
      await page.waitForTimeout(500);
    }

    // 6. Locate THIS run's seeded card (unique product name) and its eye button
    const seededCard = page
      .locator('div')
      .filter({ hasText: seededProductName })
      .filter({ has: page.locator('button[title*="Ver detalles completos"]') })
      .first();
    await expect(seededCard).toBeVisible({ timeout: 10000 });
    const eyeBtn = seededCard.locator('button[title*="Ver detalles completos del pedido"], button[title*="Ver detalles completos de la orden"]').first();

    const card = seededCard;
    const cardText = await card.innerText();
    const orderNumberMatch = cardText.match(/#(\d+)/);
    const orderNumber = orderNumberMatch ? orderNumberMatch[1] : null;
    console.log(`Targeting Kanban Order #${orderNumber} for deletion...`);

    // 7. Click eye icon to open OrderDetailModal
    await eyeBtn.click();

    // 8. Click "Eliminar Orden" button in detail modal
    const deleteBtnInModal = page.locator('button[title*="Eliminar orden definitivamente"], button:has-text("Eliminar Orden")').first();
    await expect(deleteBtnInModal).toBeVisible({ timeout: 5000 });
    await deleteBtnInModal.click();

    // 9. Confirm in ConfirmDeleteModal
    const confirmModal = page.locator('div[role="dialog"]').filter({ hasText: /¿Eliminar orden permanentemente\?|¿Confirmar eliminación\?/i });
    await expect(confirmModal).toBeVisible({ timeout: 5000 });

    const confirmBtn = confirmModal.locator('button:has-text("Eliminar orden"), button:has-text("Eliminar definitivamente")').first();
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });

    const deleteResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/orders/') && res.request().method() === 'DELETE' && res.status() === 200,
      { timeout: 15000 }
    );

    await confirmBtn.click();
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBe(200);
    const deleteBody = await deleteResponse.json();
    console.log('Server DELETE response for Kanban order:', deleteBody);
    expect(deleteBody).toHaveProperty('success', true);

    // 10. Toast appeared
    const toastElem = page.locator('li[data-sonner-toast], div[role="status"]').filter({ hasText: /Orden eliminada/i });
    await expect(toastElem).toBeVisible({ timeout: 5000 });

    // Wait a brief moment to let UI settle
    await page.waitForTimeout(1000);

    // 11. Reload page to test persistence from database
    console.log('Reloading page to test persistence in Kanban...');
    await page.reload();
    await page.waitForTimeout(2000);

    const ordersBtnAfterReload = page.locator('aside button, nav button').filter({ hasText: /Pedidos en Vivo/i }).first();
    if (await ordersBtnAfterReload.isVisible()) {
      const reloadOrdersPromise = page.waitForResponse(
        (res) => res.url().includes('/api/orders') && !res.url().includes('/stream') && res.status() === 200,
        { timeout: 15000 }
      ).catch(() => null);
      await ordersBtnAfterReload.click();
      await reloadOrdersPromise;
      await page.waitForTimeout(1000);
    }

    // 12. Assert that the deleted order number is NOT in the cards
    if (orderNumber) {
      const deletedCard = page.locator(`span:has-text("#${orderNumber}")`);
      const isStillPresent = await deletedCard.isVisible();
      console.log(`Is Kanban order #${orderNumber} still present after reload?`, isStillPresent);
      expect(isStillPresent).toBe(false);
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/kanban-order-deleted-and-persisted.png' });
    console.log('Successfully verified Kanban order deletion in UI, server, and database!');
  });
});
