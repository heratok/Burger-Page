import { test, expect } from '@playwright/test';

test.describe('Super Admin User Lifecycle & Password Management E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  test('Password reset flow: Super Admin resets password -> login with temp password -> forced password change -> admin usable', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const testUsername = `reset_user_${Date.now()}`;
    const initialPassword = 'InitialSecurePass123';
    const newPassword = 'NewUpdatedPassword456';

    // 1. Log in as Super Admin
    await page.goto('/admin');
    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible();
    await userInput.fill('admin');

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill('admin');

    await page.getByRole('button', { name: /Acceder al Panel/i }).click();
    await expect(page).toHaveURL(/\/admin\/restaurants/);

    // 2. Navigate to Usuarios & Accesos (/admin/users)
    await page.getByRole('button', { name: /Usuarios & Accesos/i }).click();
    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(page.getByText(/Directorio Global de Usuarios/i)).toBeVisible();

    // 3. Create a dedicated Super Admin user for the test
    await page.getByRole('button', { name: /\+ Nuevo Usuario/i }).click();
    await expect(page.getByRole('heading', { name: /Crear Usuario/i })).toBeVisible();

    await page.getByPlaceholder(/Ej\. admin_local/i).fill(testUsername);
    await page.getByPlaceholder(/Contraseña segura/i).fill(initialPassword);

    // Select Super Admin role so no restaurant selection is needed
    await page.getByRole('button', { name: /Super Admin/i }).click();
    await page.getByRole('button', { name: /Crear Usuario/i }).click();

    // 4. Locate the newly created user row in the directory
    const userRow = page.locator('tr', { hasText: testUsername });
    await expect(userRow).toBeVisible();
    await expect(userRow.getByText('Activo')).toBeVisible();

    // 5. Super Admin resets the user's password
    const resetBtn = userRow.getByRole('button', { name: /Restablecer clave/i });
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // 6. Reset password modal appears showing the temporary password
    const resetModal = page.getByRole('dialog');
    await expect(resetModal).toBeVisible();
    await expect(resetModal.getByText(/Contraseña Restablecida/i)).toBeVisible();
    await expect(resetModal.getByText(/Esta contraseña solo se mostrará una vez/i)).toBeVisible();

    const tempPasswordCode = resetModal.locator('code');
    await expect(tempPasswordCode).toBeVisible();
    const temporaryPassword = (await tempPasswordCode.innerText()).trim();
    expect(temporaryPassword.length).toBeGreaterThan(0);

    // Close the reset modal
    await resetModal.getByRole('button', { name: /Entendido, cerrar/i }).click();
    await expect(resetModal).not.toBeVisible();

    // 7. Log out of Super Admin
    await page.getByRole('button', { name: /Cerrar Sesión/i }).click();
    await page.waitForTimeout(500);

    // 8. Log in as the user using the temporary password
    await page.goto('/admin');
    const loginUser = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(loginUser).toBeVisible();
    await loginUser.fill(testUsername);

    const loginPass = page.locator('input[type="password"]');
    await expect(loginPass).toBeVisible();
    await loginPass.fill(temporaryPassword);

    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // 9. Verify redirection to forced password change screen
    await expect(page.getByText(/Cambio de contraseña obligatorio/i)).toBeVisible();
    await expect(
      page.getByText(/Debes definir una nueva contraseña antes de continuar/i)
    ).toBeVisible();

    // 10. Fill the forced password change form
    const currentPassInput = page.locator('input#currentPassword');
    const newPassInput = page.locator('input#newPassword');
    const confirmPassInput = page.locator('input#confirmPassword');

    await currentPassInput.fill(temporaryPassword);
    await newPassInput.fill(newPassword);
    await confirmPassInput.fill(newPassword);

    // Submit forced password change
    await page.getByRole('button', { name: /Actualizar contraseña/i }).click();

    // Forced password change screen must lift
    await expect(page.getByText(/Cambio de contraseña obligatorio/i)).not.toBeVisible();

    // 11. Admin panel is now accessible and fully usable
    await expect(page).toHaveURL(/\/admin\/restaurants/);
    await expect(page.getByRole('button', { name: /Usuarios & Accesos/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Restaurantes/i })).toBeVisible();
  });

  test('User deactivation flow: Super Admin deactivates user -> login blocked (401) -> reactivate -> login succeeds', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const testUsername = `deact_user_${Date.now()}`;
    const userPassword = 'TestPassword123';

    // 1. Log in as Super Admin
    await page.goto('/admin');
    await page.getByPlaceholder(/Tu nombre de usuario/i).fill('admin');
    await page.locator('input[type="password"]').fill('admin');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();
    await expect(page).toHaveURL(/\/admin\/restaurants/);

    // 2. Go to /admin/users and create a new user
    await page.getByRole('button', { name: /Usuarios & Accesos/i }).click();
    await expect(page).toHaveURL(/\/admin\/users/);

    await page.getByRole('button', { name: /\+ Nuevo Usuario/i }).click();
    await page.getByPlaceholder(/Ej\. admin_local/i).fill(testUsername);
    await page.getByPlaceholder(/Contraseña segura/i).fill(userPassword);
    await page.getByRole('button', { name: /Super Admin/i }).click();
    await page.getByRole('button', { name: /Crear Usuario/i }).click();

    const userRow = page.locator('tr', { hasText: testUsername });
    await expect(userRow).toBeVisible();

    // 3. Deactivate the user
    const deactivateBtn = userRow.getByRole('button', { name: /^Desactivar$/i });
    await expect(deactivateBtn).toBeVisible();
    await deactivateBtn.click();

    // 4. Verify user status shows Inactivo
    await expect(userRow.getByText('Inactivo')).toBeVisible();

    // 5. Log out of Super Admin
    await page.getByRole('button', { name: /Cerrar Sesión/i }).click();
    await page.waitForTimeout(500);

    // 6. Try to log in as the deactivated user -> should fail
    await page.goto('/admin');
    await page.getByPlaceholder(/Tu nombre de usuario/i).fill(testUsername);
    await page.locator('input[type="password"]').fill(userPassword);
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // Verify error message appears and user remains on login page
    await expect(page.getByText(/Credenciales incorrectas/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/admin/);

    // 7. Log back in as Super Admin and reactivate the user
    await page.getByPlaceholder(/Tu nombre de usuario/i).fill('admin');
    await page.locator('input[type="password"]').fill('admin');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    await page.getByRole('button', { name: /Usuarios & Accesos/i }).click();
    const reactivateRow = page.locator('tr', { hasText: testUsername });
    const activateBtn = reactivateRow.getByRole('button', { name: /^Activar$/i });
    await expect(activateBtn).toBeVisible();
    await activateBtn.click();

    // Status is back to Activo
    await expect(reactivateRow.getByText('Activo')).toBeVisible();

    // 8. Log out again
    await page.getByRole('button', { name: /Cerrar Sesión/i }).click();
    await page.waitForTimeout(500);

    // 9. Log in as the reactivated user -> succeeds
    await page.goto('/admin');
    await page.getByPlaceholder(/Tu nombre de usuario/i).fill(testUsername);
    await page.locator('input[type="password"]').fill(userPassword);
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // Verify successful login
    await expect(page).toHaveURL(/\/admin\/restaurants/);
    await expect(page.getByRole('button', { name: /Usuarios & Accesos/i })).toBeVisible();
  });
});
