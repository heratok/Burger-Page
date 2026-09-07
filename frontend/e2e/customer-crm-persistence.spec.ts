import { test, expect } from '@playwright/test';

test.describe('CRM Customer Editing & Backend Persistence Suite', () => {
  test('logs in as restaurant admin, edits customer notes via CRM modal, verifies backend PUT and persistence after reload', async ({ page }) => {
    test.setTimeout(60000);

    page.on('console', (msg) => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', (err) => console.log(`[BROWSER ERROR] ${err.message}`));
    page.on('request', (req) => {
      if (req.url().includes('/api/customers')) {
        console.log(`[REQ] ${req.method()} ${req.url()} - Body: ${req.postData()}`);
      }
    });
    page.on('response', (res) => {
      if (res.url().includes('/api/customers')) {
        console.log(`[RES] ${res.status()} ${res.url()}`);
      }
    });

    // 1. Navigate directly to /admin/customers
    await page.goto('/admin/customers');

    // 2. Fill login credentials
    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible({ timeout: 15000 });
    await userInput.fill('admin_craft');

    const passInput = page.locator('input[type="password"]');
    await expect(passInput).toBeVisible({ timeout: 5000 });
    await passInput.fill('craft');

    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/users/login') && resp.status() === 200),
      page.getByRole('button', { name: /Acceder al Panel/i }).click(),
    ]);

    // 3. Verify customer table is rendered and locate the first customer
    const firstCustomerRow = page.locator('tbody tr').first();
    await expect(firstCustomerRow).toBeVisible({ timeout: 15000 });

    // Extract customer name to re-identify after reload
    const customerName = (await firstCustomerRow.locator('td').first().locator('.font-bold').first().innerText()).trim();
    console.log(`[TEST] Editing customer: "${customerName}"`);

    // 4. Click 'Ficha del cliente' button to open Customer Profile Modal
    const profileBtn = firstCustomerRow.locator('button[title*="Ficha del cliente"]').first();
    await expect(profileBtn).toBeVisible({ timeout: 5000 });
    await profileBtn.click();

    // 5. Verify modal is visible
    const modalHeading = page.locator('h3').filter({ hasText: customerName }).first();
    await expect(modalHeading).toBeVisible({ timeout: 5000 });

    // 6. Edit customer notes
    const newNote = `Cliente VIP - Notas actualizadas ${Date.now()}`;
    const textarea = page.locator('textarea[placeholder*="Prefiere la carne" i]').first();
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill(newNote);

    // 7. Save notes and intercept backend PUT /api/customers/:id call
    const saveBtn = page.locator('button:has-text("Guardar Notas")').first();
    await expect(saveBtn).toBeVisible({ timeout: 5000 });

    const updateResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/customers/') &&
        res.request().method() === 'PUT' &&
        res.status() === 200,
      { timeout: 15000 }
    );

    await saveBtn.click();
    const updateResponse = await updateResponsePromise;
    expect(updateResponse.status()).toBe(200);

    const updateBody = await updateResponse.json();
    console.log('[SERVER CUSTOMER PUT RESPONSE]', updateBody);
    expect(updateBody.notes).toBe(newNote);

    // Verify success toast notification
    const toast = page.locator('text="Ficha del cliente actualizada"').first();
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Close the modal
    const closeBtn = page.getByRole('button', { name: 'Cerrar modal' }).first();
    await closeBtn.click();
    await expect(page.locator('h3').filter({ hasText: customerName })).not.toBeVisible({ timeout: 5000 });

    // 8. Reload the page to test database persistence
    console.log('Reloading page to verify database persistence...');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 9. If navigated away or sidebar rendered, ensure we are on Clientes CRM
    const customersNavBtnAfterReload = page.locator('aside button, nav button').filter({ hasText: /Clientes CRM/i }).first();
    if (await customersNavBtnAfterReload.isVisible().catch(() => false)) {
      const reloadFetchPromise = page.waitForResponse(
        (res) => res.url().includes('/api/customers') && res.request().method() === 'GET' && res.status() === 200,
        { timeout: 15000 }
      ).catch(() => null);
      await customersNavBtnAfterReload.click();
      await reloadFetchPromise;
    }

    // 10. Locate the same customer and open their profile modal again
    const customerRowAfterReload = page.locator('tbody tr').filter({ hasText: customerName }).first();
    await expect(customerRowAfterReload).toBeVisible({ timeout: 10000 });

    const profileBtnAfterReload = customerRowAfterReload.locator('button[title*="Ficha del cliente"]').first();
    await profileBtnAfterReload.click();

    // 11. Verify the notes persisted in the backend database
    const textareaAfterReload = page.locator('textarea[placeholder*="Prefiere la carne" i]').first();
    await expect(textareaAfterReload).toBeVisible({ timeout: 5000 });
    await expect(textareaAfterReload).toHaveValue(newNote);

    console.log('Customer notes successfully verified persisted after reload!');
  });
});
