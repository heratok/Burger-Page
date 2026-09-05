import { test, expect } from '@playwright/test';

test.describe('Additions & DB Persistence Suite (admin & rosto)', () => {
  test.setTimeout(90000);

  test('Super Admin & Restaurant Admin can create, load, update, and delete additions with real DB persistence', async ({ browser }) => {
    // -----------------------------------------------------------------------
    // PART 1: RESTAURANT ADMIN (rosto / rosto0502)
    // -----------------------------------------------------------------------
    const restoContext = await browser.newContext({
      baseURL: 'http://localhost:5173',
      viewport: { width: 1440, height: 900 }
    });
    const restoPage = await restoContext.newPage();

    await restoPage.goto('http://localhost:5173/admin');
    await restoPage.waitForLoadState('networkidle');

    // Fill login form
    const userField = restoPage.locator('input[type="text"]').first();
    await expect(userField).toBeVisible({ timeout: 15000 });
    await userField.fill('rosto');

    const passField = restoPage.locator('input[type="password"]').first();
    await passField.fill('rosto0502');

    await Promise.all([
      restoPage.waitForResponse(resp => resp.url().includes('/api/users/login') && resp.status() === 200),
      restoPage.getByRole('button', { name: /Acceder al Panel/i }).click(),
    ]);

    // 1.2 Navigate to Menú & Carta
    const menuTabBtn = restoPage.getByRole('button', { name: /Menú & Carta/i });
    await expect(menuTabBtn).toBeVisible({ timeout: 15000 });
    await menuTabBtn.click();

    // 1.3 Click subtab "Adicionales & Extras"
    const additionsSubtab = restoPage.getByRole('button', { name: /Adicionales & Extras/i });
    await expect(additionsSubtab).toBeVisible({ timeout: 10000 });
    await additionsSubtab.click();

    // Verify existing additions are loaded from DB
    await expect(restoPage.getByText(/agua/i).first()).toBeVisible({ timeout: 15000 });

    // 1.4 Create a new addition as rosto
    const uniqueAdditionName = `Papas Rosto E2E ${Date.now().toString().slice(-4)}`;
    const addAdditionBtn = restoPage.getByRole('button', { name: /Añadir Adicional/i });
    await expect(addAdditionBtn).toBeVisible();
    await addAdditionBtn.click();

    // Modal
    const additionModal = restoPage.locator('div.fixed').filter({ hasText: /Nuevo Adicional/i });
    await expect(additionModal).toBeVisible();

    await additionModal.getByPlaceholder(/Tocineta ahumada/i).fill(uniqueAdditionName);
    const priceInput = additionModal.locator('input[type="number"]');
    await priceInput.fill('3500');

    const [createResponse] = await Promise.all([
      restoPage.waitForResponse(resp => resp.url().includes('/api/additions') && resp.request().method() === 'POST' && resp.status() === 201),
      additionModal.getByRole('button', { name: 'Guardar' }).click(),
    ]);

    const createdBody = await createResponse.json();
    expect(createdBody.name).toBe(uniqueAdditionName);
    expect(createdBody.price).toBe(3500);
    expect(createdBody.restaurantId).toBe('rest-1788579266608');

    // Check visible on page heading
    await expect(restoPage.getByRole('heading', { name: uniqueAdditionName })).toBeVisible({ timeout: 10000 });

    // 1.5 Reload page to verify additions persist from database across refresh
    await restoPage.reload();
    await restoPage.waitForLoadState('networkidle');
    const menuAfterReload = restoPage.getByRole('button', { name: /Menú & Carta/i });
    await expect(menuAfterReload).toBeVisible({ timeout: 15000 });
    await menuAfterReload.click();

    const additionsAfterReload = restoPage.getByRole('button', { name: /Adicionales & Extras/i });
    await expect(additionsAfterReload).toBeVisible();
    await additionsAfterReload.click();

    // Must be visible after refresh
    await expect(restoPage.getByRole('heading', { name: uniqueAdditionName })).toBeVisible({ timeout: 15000 });

    // 1.6 Delete the created addition
    const additionCard = restoPage.locator('div.rounded-xl').filter({ has: restoPage.getByRole('heading', { name: uniqueAdditionName }) }).first();
    const deleteBtn = additionCard.locator('button[title="Eliminar adicional"]');
    await deleteBtn.click();

    const confirmModal = restoPage.locator('div.fixed').filter({ hasText: /Eliminar adición/i });
    await expect(confirmModal).toBeVisible();

    await Promise.all([
      restoPage.waitForResponse(resp => resp.url().includes('/api/additions') && resp.request().method() === 'DELETE' && resp.status() === 204),
      confirmModal.getByRole('button', { name: /Eliminar adición/i }).click(),
    ]);

    await expect(restoPage.getByRole('heading', { name: uniqueAdditionName })).not.toBeVisible({ timeout: 5000 });

    // -----------------------------------------------------------------------
    // PART 2: SUPER ADMIN (admin / Test0502*)
    // -----------------------------------------------------------------------
    const superContext = await browser.newContext({
      baseURL: 'http://localhost:5173',
      viewport: { width: 1440, height: 900 }
    });
    const superPage = await superContext.newPage();

    await superPage.goto('http://localhost:5173/admin');
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

    // Super admin is redirected to /admin/restaurants
    await expect(superPage).toHaveURL(/\/admin\/restaurants/, { timeout: 15000 });

    // Manage 'rosto'
    const manageRostoBtn = superPage.getByRole('button', { name: /Administrar/i }).first();
    await expect(manageRostoBtn).toBeVisible({ timeout: 15000 });
    await manageRostoBtn.click();

    // Go to Menú & Carta tab
    const superMenuTab = superPage.getByRole('button', { name: /Menú & Carta/i });
    await expect(superMenuTab).toBeVisible({ timeout: 15000 });
    await superMenuTab.click();

    // Go to Adicionales & Extras
    const superAdditionsSubtab = superPage.getByRole('button', { name: /Adicionales & Extras/i });
    await expect(superAdditionsSubtab).toBeVisible({ timeout: 10000 });
    await superAdditionsSubtab.click();

    // Super admin creates another addition
    const superAdditionName = `Extra Salsa Super ${Date.now().toString().slice(-4)}`;
    const superAddBtn = superPage.getByRole('button', { name: /Añadir Adicional/i });
    await expect(superAddBtn).toBeVisible();
    await superAddBtn.click();

    const superModal = superPage.locator('div.fixed').filter({ hasText: /Nuevo Adicional/i });
    await expect(superModal).toBeVisible();
    await superModal.getByPlaceholder(/Tocineta ahumada/i).fill(superAdditionName);
    await superModal.locator('input[type="number"]').fill('2000');

    const [superCreateResponse] = await Promise.all([
      superPage.waitForResponse(resp => resp.url().includes('/api/additions') && resp.request().method() === 'POST' && resp.status() === 201),
      superModal.getByRole('button', { name: 'Guardar' }).click(),
    ]);

    const superCreatedBody = await superCreateResponse.json();
    expect(superCreatedBody.name).toBe(superAdditionName);
    expect(superCreatedBody.price).toBe(2000);
    expect(superCreatedBody.restaurantId).toBe('rest-1788579266608');

    await expect(superPage.getByRole('heading', { name: superAdditionName })).toBeVisible({ timeout: 10000 });

    // Reload and verify persistence for super admin as well
    await superPage.reload();
    await superPage.waitForLoadState('networkidle');

    const superMenuAfterReload = superPage.getByRole('button', { name: /Menú & Carta/i });
    await expect(superMenuAfterReload).toBeVisible({ timeout: 15000 });
    await superMenuAfterReload.click();

    const superAdditionsAfterReload = superPage.getByRole('button', { name: /Adicionales & Extras/i });
    await expect(superAdditionsAfterReload).toBeVisible();
    await superAdditionsAfterReload.click();

    await expect(superPage.getByRole('heading', { name: superAdditionName })).toBeVisible({ timeout: 15000 });

    // Cleanup super admin addition
    const superAdditionCard = superPage.locator('div.rounded-xl').filter({ has: superPage.getByRole('heading', { name: superAdditionName }) }).first();
    const superDeleteBtn = superAdditionCard.locator('button[title="Eliminar adicional"]');
    await superDeleteBtn.click();

    const superConfirmModal = superPage.locator('div.fixed').filter({ hasText: /Eliminar adición/i });
    await expect(superConfirmModal).toBeVisible();

    await Promise.all([
      superPage.waitForResponse(resp => resp.url().includes('/api/additions') && resp.request().method() === 'DELETE' && resp.status() === 204),
      superConfirmModal.getByRole('button', { name: /Eliminar adición/i }).click(),
    ]);

    await expect(superPage.getByRole('heading', { name: superAdditionName })).not.toBeVisible({ timeout: 5000 });

    await restoContext.close();
    await superContext.close();
  });
});
