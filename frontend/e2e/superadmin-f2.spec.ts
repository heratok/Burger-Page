import { test, expect } from '@playwright/test';

test.describe.serial('Super Admin F2 Capabilities E2E Suite', () => {
  const timestamp = Date.now();
  const pizzaRestName = `Pizza Palace ${timestamp}`;
  const pizzaRestSlug = `pizza-palace-${timestamp}`;

  const deleteRestName = `To Delete ${timestamp}`;
  const deleteRestSlug = `to-delete-${timestamp}`;

  const testUsername = `user_edit_${timestamp}`;
  const testPassword = 'Password123!';

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  test('Flow 1: Create restaurant with pizza template & non-default currency (USD), then verify storefront sample pizzas', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1. Authenticate as Super Admin
    await page.goto('/admin');
    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible();
    await userInput.fill('admin');

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill('admin');

    await page.getByRole('button', { name: /Acceder al Panel/i }).click();
    await expect(page).toHaveURL(/\/admin\/restaurants/);

    // 2. Open Create Restaurant Modal
    const createBtn = page.getByRole('button', { name: /Nuevo Restaurante/i }).first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    const modal = page.locator('div.fixed').filter({ hasText: /Dar de Alta Nuevo Restaurante/i });
    await expect(modal).toBeVisible();

    // 3. Fill restaurant name and slug
    await modal.getByPlaceholder(/Sushi Master Bogotá/i).fill(pizzaRestName);
    const slugInput = modal.locator('input[placeholder="sushi-master"]');
    await slugInput.clear();
    await slugInput.fill(pizzaRestSlug);

    // 4. Select Currency: USD ($)
    const currencySelect = modal.getByLabel('Moneda');
    await currencySelect.selectOption('USD');

    // Verify symbol updated to $
    const symbolInput = modal.getByLabel('Símbolo');
    await expect(symbolInput).toHaveValue('$');

    // 5. Select Pizza Template
    const pizzaTplBtn = modal.getByRole('button', { name: /Pizzería/i });
    await expect(pizzaTplBtn).toBeVisible();
    await pizzaTplBtn.click();

    // 6. Submit creation
    const [createResponse] = await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/restaurants') && resp.status() === 201),
      modal.getByRole('button', { name: /Crear Restaurante/i }).click(),
    ]);
    expect(createResponse.status()).toBe(201);

    // Dismiss one-time credentials modal
    const credsCloseBtn = page.getByRole('button', { name: /Ya copié las credenciales, cerrar/i });
    await expect(credsCloseBtn).toBeVisible({ timeout: 10000 });
    await credsCloseBtn.click();
    await expect(credsCloseBtn).not.toBeVisible({ timeout: 5000 });

    // 7. Verify the new restaurant appears in the table
    const createdRow = page.locator('tbody tr').filter({ hasText: pizzaRestName });
    await expect(createdRow).toBeVisible();

    // 8. Open Public Storefront and verify sample pizzas render
    await page.goto(`/${pizzaRestSlug}`);
    // Check that sample pizzas from the pizza template are visible
    await expect(page.getByRole('heading', { name: 'Margarita', exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Pepperoni', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cuatro Quesos', exact: true })).toBeVisible();
  });

  test('Flow 2: Delete a restaurant, restore it from Eliminados view, and reactivate it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1. Authenticate as Super Admin
    await page.goto('/admin');
    await page.getByPlaceholder(/Tu nombre de usuario/i).fill('admin');
    await page.locator('input[type="password"]').fill('admin');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();
    await expect(page).toHaveURL(/\/admin\/restaurants/);

    // 2. Create a restaurant specifically to test delete and restore
    const createBtn = page.getByRole('button', { name: /Nuevo Restaurante/i }).first();
    await createBtn.click();

    const modal = page.locator('div.fixed').filter({ hasText: /Dar de Alta Nuevo Restaurante/i });
    await modal.getByPlaceholder(/Sushi Master Bogotá/i).fill(deleteRestName);
    const slugInput = modal.locator('input[placeholder="sushi-master"]');
    await slugInput.clear();
    await slugInput.fill(deleteRestSlug);

    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/restaurants') && resp.status() === 201),
      modal.getByRole('button', { name: /Crear Restaurante/i }).click(),
    ]);

    const credsCloseBtn = page.getByRole('button', { name: /Ya copié las credenciales, cerrar/i });
    await expect(credsCloseBtn).toBeVisible({ timeout: 10000 });
    await credsCloseBtn.click();
    await expect(credsCloseBtn).not.toBeVisible({ timeout: 5000 });

    const targetRow = page.locator('tbody tr').filter({ hasText: deleteRestName });
    await expect(targetRow).toBeVisible();

    // 3. Delete the restaurant (NEVER touch rosto)
    const deleteBtn = targetRow.locator('button[title="Eliminar restaurante"]');
    await deleteBtn.click();

    const deleteModal = page.getByRole('dialog').filter({ hasText: /¿Eliminar restaurante\?/i });
    await expect(deleteModal).toBeVisible();
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/restaurants/') && resp.request().method() === 'DELETE'),
      deleteModal.getByRole('button', { name: /Eliminar restaurante/i }).click(),
    ]);
    await expect(deleteModal).not.toBeVisible();

    // Verify it is gone from the active list
    await expect(page.locator('tbody tr').filter({ hasText: deleteRestName })).not.toBeVisible();

    // 4. Switch to "Eliminados" tab
    const deletedTabBtn = page.getByRole('button', { name: /Eliminados/i });
    await deletedTabBtn.click();

    // Locate the restaurant in the deleted list
    const deletedRow = page.locator('tbody tr').filter({ hasText: deleteRestName });
    await expect(deletedRow).toBeVisible();

    // 5. Click "Restaurar"
    const restoreBtn = deletedRow.getByRole('button', { name: /Restaurar/i });
    await restoreBtn.click();

    const restoreModal = page.getByRole('dialog').filter({ hasText: /¿Restaurar restaurante\?/i });
    await expect(restoreModal).toBeVisible();
    await expect(restoreModal).toContainText(/PAUSADO/i);

    // Confirm restore
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/restore') && resp.status() === 200),
      restoreModal.getByRole('button', { name: /Confirmar Restauración/i }).click(),
    ]);
    await expect(restoreModal).not.toBeVisible();

    // 6. Switch back to "Activos" tab
    const activeTabBtn = page.getByRole('button', { name: /Activos/i });
    await activeTabBtn.click();

    // Verify it returned in PAUSADO state
    const restoredRow = page.locator('tbody tr').filter({ hasText: deleteRestName });
    await expect(restoredRow).toBeVisible();
    const statusBtn = restoredRow.locator('button', { hasText: /Pausado/i });
    await expect(statusBtn).toBeVisible();

    // 7. Reactivate the restaurant
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/restaurants/') && ['PUT', 'PATCH'].includes(resp.request().method()) && resp.status() === 200),
      statusBtn.click(),
    ]);

    // Verify status changed to Operando
    await expect(restoredRow.locator('button', { hasText: /Operando/i })).toBeVisible();
  });

  test('Flow 3: Edit a user role or assigned restaurant via EditUserModal', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1. Authenticate as Super Admin
    await page.goto('/admin');
    await page.getByPlaceholder(/Tu nombre de usuario/i).fill('admin');
    await page.locator('input[type="password"]').fill('admin');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();
    await expect(page).toHaveURL(/\/admin\/restaurants/);

    // 2. Navigate to Usuarios & Accesos
    await page.getByRole('button', { name: /Usuarios & Accesos/i }).click();
    await expect(page).toHaveURL(/\/admin\/users/);

    // 3. Create a test restaurant admin user to edit
    await page.getByRole('button', { name: /\+ Nuevo Usuario/i }).click();
    const createModal = page.getByRole('dialog');
    await expect(createModal).toBeVisible();

    await createModal.getByPlaceholder(/Ej\. admin_local/i).fill(testUsername);
    await createModal.getByPlaceholder(/Contraseña segura/i).fill(testPassword);
    
    // Select a restaurant from dropdown for restaurant_admin
    const restSelectInCreate = createModal.locator('select');
    await restSelectInCreate.selectOption({ index: 1 });

    await createModal.getByRole('button', { name: /Crear Usuario/i }).click();
    await expect(createModal).not.toBeVisible();

    // 4. Locate the newly created user row
    const userRow = page.locator('tr', { hasText: testUsername });
    await expect(userRow).toBeVisible();

    // 5. Open EditUserModal
    const editBtn = userRow.getByRole('button', { name: /Editar/i });
    await editBtn.click();

    const editModal = page.getByRole('dialog').filter({ hasText: /Editar Usuario/i });
    await expect(editModal).toBeVisible();

    // Change role to Super Admin (which should disable/clear restaurant selection)
    const roleSelect = editModal.getByLabel(/Rol en la plataforma/i);
    await roleSelect.selectOption('super_admin');

    // Verify restaurant select is disabled
    const restSelectInEdit = editModal.getByLabel(/Restaurante asignado/i);
    await expect(restSelectInEdit).toBeDisabled();

    // Save changes
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/users/') && resp.request().method() === 'PATCH'),
      editModal.getByRole('button', { name: /Guardar Cambios/i }).click(),
    ]);

    await expect(editModal).not.toBeVisible();

    // 6. Verify user row reflects updated role
    await expect(userRow).toContainText('Super Admin');
  });

  test('Flow 4: Open audit log screen and verify recorded operations with filters', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1. Authenticate as Super Admin
    await page.goto('/admin');
    await page.getByPlaceholder(/Tu nombre de usuario/i).fill('admin');
    await page.locator('input[type="password"]').fill('admin');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();
    await expect(page).toHaveURL(/\/admin\/restaurants/);

    // 2. Click "Auditoría" sidebar link
    const auditNavBtn = page.getByRole('button', { name: /Auditoría/i });
    await expect(auditNavBtn).toBeVisible();
    await auditNavBtn.click();

    await expect(page).toHaveURL(/\/admin\/audit/);
    await expect(page.getByRole('heading', { name: /Registro de Auditoría/i })).toBeVisible();

    // 3. Verify audit log table rendered entries
    const tableRows = page.locator('tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });

    // 4. Verify formatted actions appear (e.g. Creación de restaurante or Actualización de usuario)
    // and verify raw JSON is not exposed
    const tableText = await page.locator('tbody').innerText();
    expect(tableText).not.toContain('{"');
    expect(tableText).not.toContain('"changedFields"');

    // 5. Test Filter: Action filter
    const actionSelect = page.getByLabel(/Filtrar por acción/i);
    await expect(actionSelect).toBeVisible();
    await actionSelect.selectOption('user.update');

    // Verify that the table updates with filtered action
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await expect(page.locator('tbody').getByText('Actualización de usuario').first()).toBeVisible();
  });
});
