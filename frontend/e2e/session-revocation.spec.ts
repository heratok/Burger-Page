import { test, expect } from '@playwright/test';

test.describe('Session Revocation & Expiration Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  test('admin session revoked server-side redirects to login modal and shows session expired toast', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const testUsername = `revoked_user_${Date.now()}`;
    const testPassword = 'InitialPass123!';
    const updatedPassword = 'UpdatedPass123!';

    // 1. Super admin logs in via API to create a test user
    const superLogin = await request.post('http://localhost:3001/api/users/login', {
      data: { username: 'admin', password: 'admin' },
    });
    expect(superLogin.status()).toBe(200);
    const { token: superToken } = await superLogin.json();

    // 2. Create a dedicated super_admin user
    const createUserRes = await request.post('http://localhost:3001/api/users', {
      headers: { Authorization: `Bearer ${superToken}` },
      data: {
        username: testUsername,
        password: testPassword,
        role: 'super_admin',
      },
    });
    expect(createUserRes.status()).toBe(201);
    const createdUser = await createUserRes.json();

    // 3. Log in as the newly created user in the browser
    await page.goto('/admin');
    await page.getByPlaceholder(/Tu nombre de usuario/i).fill(testUsername);
    await page.locator('input[type="password"]').fill(testPassword);
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // 4. Complete forced password change on first login
    await expect(page.getByText(/Cambio de contraseña obligatorio/i)).toBeVisible({ timeout: 10000 });
    await page.locator('input#currentPassword').fill(testPassword);
    await page.locator('input#newPassword').fill(updatedPassword);
    await page.locator('input#confirmPassword').fill(updatedPassword);
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/users/me/password') && resp.status() === 200),
      page.getByRole('button', { name: /Actualizar contraseña/i }).click(),
    ]);

    // 5. Land on admin panel and ensure page has stabilized
    await expect(page).toHaveURL(/\/admin\/restaurants/);
    await expect(page.getByRole('heading', { name: /Directorio Global de Restaurantes/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Buscar por nombre, slug o tipo\.\.\./i)).toBeVisible();
    const usersNavButton = page.locator('aside').getByRole('button', { name: /Usuarios & Accesos/i });
    await expect(usersNavButton).toBeVisible();

    // 6. In the background, revoke the user's session by deactivating the account
    const deactRes = await request.patch(`http://localhost:3001/api/users/${createdUser.id}`, {
      headers: { Authorization: `Bearer ${superToken}` },
      data: { isActive: false },
    });
    expect(deactRes.status()).toBe(200);

    // 7. Perform an action in the admin UI that makes an authenticated API call
    // Re-query the navigation button from aside to ensure no stale element handles, then click
    await expect(usersNavButton).toBeVisible();
    await usersNavButton.click();

    // 8. Assert user is logged out, redirected to admin login, and sees the session expired message
    await expect(page.getByText(/Tu sesión expiró\. Iniciá sesión de nuevo\./i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder(/Tu nombre de usuario/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Acceder al Panel/i })).toBeVisible({ timeout: 10000 });
  });
});
