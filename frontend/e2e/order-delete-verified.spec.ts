import { test, expect } from '@playwright/test';

test.describe('Order Deletion & Persistence E2E Suite', () => {
  test('logs in as rosto admin, deletes an order via modal, verifies DB deletion and persistence after reload', async ({ page }) => {
    test.setTimeout(60000);
    const consoleLogs: Array<{ type: string; text: string }> = [];
    const pageErrors: string[] = [];
    const failedRequests: Array<{ url: string; status: number | null; errorText?: string }> = [];

    page.on('console', (msg) => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    page.on('requestfailed', (req) => {
      failedRequests.push({
        url: req.url(),
        status: null,
        errorText: req.failure()?.errorText,
      });
    });

    page.on('response', async (res) => {
      if (res.url().includes('/api/') && !res.url().includes('/stream')) {
        if (res.status() >= 400) {
          failedRequests.push({
            url: res.url(),
            status: res.status(),
          });
        }
      }
    });

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

    // 5. Look for first order card
    const firstEyeBtn = page.locator('button[title*="Ver detalles completos de la orden"]').first();
    await expect(firstEyeBtn).toBeVisible({ timeout: 10000 });

    // Get order number from the card
    const firstOrderCard = page.locator('article, div').filter({ has: firstEyeBtn }).first();
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

  test('deletes an order from the Historial tab, verifies DB deletion and persistence after reload', async ({ page }) => {
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

    // 5. Click "Historial" tab
    const historyTabBtn = page.locator('button').filter({ hasText: /Historial/i }).first();
    await expect(historyTabBtn).toBeVisible({ timeout: 5000 });
    await historyTabBtn.click();
    await page.waitForTimeout(1000);

    // If there are no orders in history, deliver one from active orders first
    const historyCards = page.locator('button[title*="Ver detalles completos de la orden"]');
    if ((await historyCards.count()) === 0) {
      console.log('No orders in Historial yet, moving an active order to delivered...');
      const activeTabBtn = page.locator('button').filter({ hasText: /Comandas/i }).first();
      await activeTabBtn.click();
      await page.waitForTimeout(500);

      const completeBtn = page.locator('button:has-text("Completar (1 Clic)")').first();
      if (await completeBtn.isVisible()) {
        await completeBtn.click();
        await page.waitForTimeout(1500);
      }
      await historyTabBtn.click();
      await page.waitForTimeout(1000);
    }

    const firstEyeBtn = page.locator('button[title*="Ver detalles completos de la orden"]').first();
    await expect(firstEyeBtn).toBeVisible({ timeout: 10000 });

    // Get order number from the card
    const firstOrderCard = page.locator('article, div').filter({ has: firstEyeBtn }).first();
    const cardText = await firstOrderCard.innerText();
    const orderNumberMatch = cardText.match(/#(\d+)/);
    const orderNumber = orderNumberMatch ? orderNumberMatch[1] : null;
    console.log(`Targeting Historial Order #${orderNumber} for deletion...`);

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

    const deleteResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/orders/') && res.request().method() === 'DELETE' && res.status() === 200,
      { timeout: 15000 }
    );

    await confirmBtn.click();
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBe(200);
    const deleteBody = await deleteResponse.json();
    console.log('Server DELETE response for Historial order:', deleteBody);
    expect(deleteBody).toHaveProperty('success', true);

    // 9. Toast appeared
    const toastElem = page.locator('li[data-sonner-toast], div[role="status"]').filter({ hasText: /Orden eliminada/i });
    await expect(toastElem).toBeVisible({ timeout: 5000 });

    // 10. Reload the page to test persistence from database
    console.log('Reloading page to test persistence in Historial...');
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

    // Click Historial tab again
    const historyTabBtnReloaded = page.locator('button').filter({ hasText: /Historial/i }).first();
    if (await historyTabBtnReloaded.isVisible()) {
      await historyTabBtnReloaded.click();
      await page.waitForTimeout(1000);
    }

    // 11. Assert that the deleted order number is NOT in the cards
    if (orderNumber) {
      const deletedCard = page.locator(`span:has-text("#${orderNumber}")`);
      const isStillPresent = await deletedCard.isVisible();
      console.log(`Is Historial order #${orderNumber} still present after reload?`, isStillPresent);
      expect(isStillPresent).toBe(false);
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/historial-order-deleted-and-persisted.png' });
    console.log('Successfully verified Historial order deletion in UI, server, and database!');
  });
});

