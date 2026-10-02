import { test, expect } from '@playwright/test';

test.describe('Super Admin Support Mode Banner and Restaurant Edit Modal E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  test('super admin edits a restaurant name, enters it as support, sees banner, and returns', async ({
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

    // 2. Arrive at /admin/restaurants
    await expect(page).toHaveURL(/\/admin\/restaurants/);

    // Target the first restaurant in the table
    const targetRow = page.locator('tbody tr').first();
    const editBtn = targetRow.getByRole('button', { name: /^Editar restaurante/i });
    await expect(editBtn).toBeVisible();

    // 3. Open Edit Modal
    await editBtn.click();
    await expect(page.getByRole('heading', { name: /Editar Restaurante/i })).toBeVisible();

    const nameInput = page.getByLabel(/Nombre del Restaurante \*/i);
    await expect(nameInput).toBeVisible();
    const originalName = await nameInput.inputValue();
    const updatedName = `${originalName} E2E`;

    await nameInput.fill(updatedName);
    await page.getByRole('button', { name: /Guardar Cambios/i }).click();

    // Verify modal closes and updated name appears in table
    await expect(page.getByRole('heading', { name: /Editar Restaurante/i })).not.toBeVisible();
    const updatedRow = page.locator('tbody tr').filter({ hasText: updatedName });
    await expect(updatedRow).toBeVisible();

    // 4. Enter that specific restaurant as support ("Administrar")
    const manageBtn = updatedRow.getByRole('button', { name: /Administrar/i });
    await expect(manageBtn).toBeVisible();
    await manageBtn.click();

    // 5. Verify /admin/dashboard and Support-Mode Banner
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    const supportBanner = page.getByRole('status', { name: /Modo soporte/i });
    await expect(supportBanner).toBeVisible();
    await expect(supportBanner).toContainText(`Modo soporte: estás viendo «${updatedName}»`);
    await expect(supportBanner.getByRole('button', { name: /Volver al panel/i })).toBeVisible();

    // 6. Return to panel via banner
    await supportBanner.getByRole('button', { name: /Volver al panel/i }).click();

    // 7. Verify back at /admin/restaurants and banner is hidden
    await expect(page).toHaveURL(/\/admin\/restaurants/);
    await expect(page.getByRole('status', { name: /Modo soporte/i })).not.toBeVisible();

    // 8. Revert restaurant name back to clean state
    const revertRow = page.locator('tbody tr').filter({ hasText: updatedName });
    await revertRow.getByRole('button', { name: /^Editar restaurante/i }).click();

    await expect(page.getByRole('heading', { name: /Editar Restaurante/i })).toBeVisible();
    const revertNameInput = page.getByLabel(/Nombre del Restaurante \*/i);
    await revertNameInput.fill(originalName);
    await page.getByRole('button', { name: /Guardar Cambios/i }).click();

    await expect(page.getByRole('heading', { name: /Editar Restaurante/i })).not.toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: originalName })).toBeVisible();
  });
});
