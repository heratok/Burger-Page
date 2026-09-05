import { test, expect } from '@playwright/test';

test.describe('Optimistic UI Updates (Zero-Reload), Skeletons & Real-Time Feedback', () => {
  test('Zero-Reload Lifecycle: Super Admin instant creation, status toggle, CRM menu mutation & instant deletion', async ({ page }) => {
    const timestamp = Date.now().toString().slice(-5);
    const testRestSlug = `e2e-optimistic-${timestamp}`;
    const testRestName = `Burger Optimistic ${timestamp}`;

    // 1. Log in as Super Admin
    await page.goto('/admin');
    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible({ timeout: 10000 });
    await userInput.fill('admin');

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('admin');

    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/users/login') && resp.status() === 200),
      page.getByRole('button', { name: /Acceder al Panel/i }).click(),
    ]);

    await expect(page).toHaveURL(/\/admin\/restaurants/, { timeout: 15000 });

    // 2. Open Create Restaurant Modal & Create
    const createBtn = page.getByRole('button', { name: /Nuevo Restaurante/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    const createModal = page.locator('div.fixed').filter({ hasText: /Dar de Alta Nuevo Restaurante/i });
    await expect(createModal).toBeVisible();

    await createModal.getByPlaceholder(/Sushi Master Bogotá/i).fill(testRestName);
    const slugInput = createModal.locator('input[placeholder="sushi-master"]');
    await slugInput.clear();
    await slugInput.fill(testRestSlug);
    await createModal.getByPlaceholder(/Rollos artesanales/i).fill('Optimistic UI Experience');

    // Submit creation
    await createModal.getByRole('button', { name: /Crear Restaurante/i }).click();
    await expect(createModal).not.toBeVisible({ timeout: 8000 });

    // Verify it appeared in Directory INSTANTLY (0 page reloads!)
    const searchRest = page.getByPlaceholder(/Buscar por nombre, slug/i);
    await searchRest.fill(testRestSlug);
    const targetRow = page.locator('tr').filter({ hasText: testRestSlug });
    await expect(targetRow).toBeVisible({ timeout: 10000 });
    await expect(targetRow.getByText(testRestName)).toBeVisible();

    // 3. Test Optimistic Status Toggle (Operando <-> Pausado)
    const statusBtn = targetRow.locator('button').filter({ hasText: /Operando|Pausado/i });
    await expect(statusBtn).toContainText('Operando');

    // Click toggle -> changes to Pausado instantly without reload
    await statusBtn.click();
    await expect(statusBtn).toContainText('Pausado', { timeout: 5000 });

    // Click toggle again -> changes to Operando instantly
    await statusBtn.click();
    await expect(statusBtn).toContainText('Operando', { timeout: 5000 });

    // 4. Manage Restaurant in CRM
    await targetRow.locator('button[title*="Administrar"]').click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });

    const menuTabBtn = page.getByRole('button', { name: /Menú & Carta/i });
    await expect(menuTabBtn).toBeVisible({ timeout: 10000 });
    await menuTabBtn.click();

    // 5. Create a new Product in Menu
    const newProductBtn = page.getByRole('button', { name: /Crear Producto/i }).first();
    await expect(newProductBtn).toBeVisible({ timeout: 8000 });
    await newProductBtn.click();

    const productModal = page.locator('div.fixed').filter({ hasText: /Nuevo Producto/i });
    await expect(productModal).toBeVisible();

    const testProductName = `Optimistic Burger ${timestamp}`;
    await productModal.locator('input[type="text"]').first().fill(testProductName);
    await productModal.locator('input[type="number"]').first().fill('28900');
    await productModal.locator('textarea').fill('Hamburguesa con reactividad instantánea');

    await productModal.getByRole('button', { name: /Guardar en Menú/i }).click();
    await expect(productModal).not.toBeVisible({ timeout: 8000 });

    // Verify product card appeared INSTANTLY without reload
    const productHeading = page.locator('h3').filter({ hasText: testProductName });
    await expect(productHeading).toBeVisible({ timeout: 8000 });

    // 6. Delete Product from Menu
    await page.waitForTimeout(500);
    const productCard = page.locator('div.group').filter({ has: productHeading }).first();
    const deleteProductBtn = productCard.locator('button[title="Eliminar plato"]');
    await deleteProductBtn.click();

    const deleteProdModal = page.getByRole('dialog').filter({ hasText: /¿Eliminar producto del menú\?/i });
    await expect(deleteProdModal).toBeVisible();
    await deleteProdModal.getByRole('button', { name: /Eliminar producto/i }).click();
    await expect(deleteProdModal).not.toBeVisible({ timeout: 8000 });

    // Verify product disappeared INSTANTLY
    await expect(productHeading).not.toBeVisible({ timeout: 5000 });

    // 7. Return to Super Admin Directory & Clean Up Safely
    const exitBtn = page.getByRole('button', { name: /Volver al Panel Super Admin/i }).first();
    await expect(exitBtn).toBeVisible({ timeout: 8000 });
    await exitBtn.click();
    await expect(page).toHaveURL(/\/admin\/restaurants/, { timeout: 10000 });

    // Safety assertion
    expect(testRestSlug).toMatch(/^e2e-optimistic-\d+$/);
    expect(testRestSlug).not.toBe('rosto');
    expect(testRestSlug).not.toBe('craft-staging');

    // Search and delete test restaurant
    const searchAgain = page.getByPlaceholder(/Buscar por nombre, slug/i);
    await searchAgain.fill(testRestSlug);
    const rowToDelete = page.locator('tr').filter({ hasText: testRestSlug });
    await expect(rowToDelete).toBeVisible({ timeout: 10000 });
    await rowToDelete.locator('button[title="Eliminar restaurante"]').click();

    const deleteRestModal = page.getByRole('dialog').filter({ hasText: /¿Eliminar restaurante\?/i });
    await expect(deleteRestModal).toBeVisible();
    
    const [deleteResp] = await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/restaurants') && resp.request().method() === 'DELETE'),
      deleteRestModal.getByRole('button', { name: /Eliminar restaurante/i }).click(),
    ]);
    expect(deleteResp.status()).toBe(200);

    await expect(deleteRestModal).not.toBeVisible({ timeout: 8000 });
    await expect(rowToDelete).not.toBeVisible({ timeout: 8000 });
  });
});
