import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const API = 'http://localhost:3001/api';
const SHOTS_DIR = '/tmp/claude-1000/-workspace-Burger-Page/46af97a1-cd3f-4783-b0fa-79ce83745cbe/scratchpad';
const RUN = Date.now().toString().slice(-6);

const REST_NAME = `Burger Default Roles ${RUN}`;
const REST_SLUG = `default-roles-${RUN}`;
const ADMIN_USER = `admin_roles_${RUN}`;
const ADMIN_INIT_PASS = `InitPass_${RUN}!123`;
const ADMIN_NEW_PASS = `NewPass_${RUN}!456`;
const STAFF_USER = `staff_cajero_${RUN}`;

test.describe.configure({ mode: 'serial' });

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function setAdminTheme(page: Page, target: 'light' | 'dark') {
  const toDarkBtn = page.locator('button[title="Cambiar a modo oscuro"]');
  const toLightBtn = page.locator('button[title="Cambiar a modo claro"]');

  if (target === 'dark') {
    if (await toDarkBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await toDarkBtn.click();
    }
  } else {
    if (await toLightBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await toLightBtn.click();
    }
  }
  await page.waitForTimeout(200);
}

async function navigateToTab(page: Page, tabLabel: 'Roles' | 'Equipo') {
  const isMobile = (page.viewportSize()?.width ?? 1440) < 1024;
  const nav = page.getByRole('navigation', { name: 'Menú Lateral' });
  const tabBtn = nav.getByRole('button', { name: tabLabel, exact: true });

  if (isMobile) {
    const mobileToggle = page.locator('button[aria-label="Abrir menú"]');
    if (await mobileToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await mobileToggle.click();
    }
  }

  await expect(tabBtn).toBeVisible({ timeout: 10000 });
  await tabBtn.click();
}

async function uiLogin(page: Page, username: string, password: string) {
  await page.goto('/admin');
  const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
  await expect(userInput).toBeVisible({ timeout: 15000 });
  await userInput.fill(username);
  await page.locator('input[type="password"]').fill(password);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/users/login') && r.status() === 200),
    page.getByRole('button', { name: /Acceder al Panel/i }).click(),
  ]);

  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });
  await expect(page.getByRole('navigation', { name: 'Menú Lateral' })).toBeVisible({ timeout: 15000 });
}

test.describe('E2E: Default Staff Roles & Empty State Flow', () => {
  let adminToken = '';

  test.beforeAll(async () => {
    await ensureDir(SHOTS_DIR);
  });

  test('(A) Super admin provisions restaurant, new admin logs in, verifies 4 default roles & creates staff user', async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1. Super Admin logs in
    await page.goto('/admin');
    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible({ timeout: 15000 });
    await userInput.fill('admin');
    await page.locator('input[type="password"]').fill('admin');

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/users/login') && r.status() === 200),
      page.getByRole('button', { name: /Acceder al Panel/i }).click(),
    ]);

    await expect(page).toHaveURL(/\/admin\/restaurants/, { timeout: 15000 });

    // 2. Super Admin creates a NEW restaurant
    const createRestBtn = page.getByRole('button', { name: /Nuevo Restaurante/i }).first();
    await expect(createRestBtn).toBeVisible({ timeout: 15000 });
    await createRestBtn.click();

    const restModal = page.locator('div.fixed').filter({ hasText: /Dar de Alta Nuevo Restaurante/i });
    await expect(restModal).toBeVisible({ timeout: 10000 });

    await restModal.getByPlaceholder(/Sushi Master Bogotá/i).fill(REST_NAME);
    const slugInput = restModal.locator('input[placeholder="sushi-master"]');
    await slugInput.clear();
    await slugInput.fill(REST_SLUG);

    const adminUserInput = restModal.locator('input#restaurant-admin-username');
    if (await adminUserInput.isVisible()) {
      await adminUserInput.fill(ADMIN_USER);
    }

    const adminPassInput = restModal.locator('input#restaurant-admin-password');
    if (await adminPassInput.isVisible()) {
      await adminPassInput.fill(ADMIN_INIT_PASS);
    }

    const [createRestResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/restaurants') && r.status() === 201),
      restModal.getByRole('button', { name: /Crear Restaurante/i }).click(),
    ]);
    expect(createRestResp.status()).toBe(201);

    // Dismiss credentials modal if shown
    const credsCloseBtn = page.getByRole('button', {
      name: /Ya copié las credenciales, cerrar|Entendido y Cerrar/i,
    });
    if (await credsCloseBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await credsCloseBtn.click();
    }

    // Clear session to log in as the newly created restaurant admin
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // 3. New restaurant_admin logs in
    await page.goto('/admin');
    const adminLoginInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(adminLoginInput).toBeVisible({ timeout: 15000 });
    await adminLoginInput.fill(ADMIN_USER);
    await page.locator('input[type="password"]').fill(ADMIN_INIT_PASS);

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/users/login') && r.status() === 200),
      page.getByRole('button', { name: /Acceder al Panel/i }).click(),
    ]);

    // Complete forced password change
    const forcedChange = page.getByText(/Cambio de contraseña obligatorio|Cambiar Contraseña/i);
    await expect(forcedChange).toBeVisible({ timeout: 15000 });
    await page.locator('input#currentPassword').fill(ADMIN_INIT_PASS);
    await page.locator('input#newPassword').fill(ADMIN_NEW_PASS);
    await page.locator('input#confirmPassword').fill(ADMIN_NEW_PASS);

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/users/me/password') && r.status() === 200),
      page.getByRole('button', { name: /Actualizar contraseña|Guardar/i }).click(),
    ]);

    // Verify dashboard landing
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Store admin token via api login for step B
    const apiLoginRes = await request.post(`${API}/users/login`, {
      data: { username: ADMIN_USER, password: ADMIN_NEW_PASS },
    });
    expect(apiLoginRes.status()).toBe(200);
    const loginJson = await apiLoginRes.json();
    adminToken = loginJson.token;

    // 4. Verify Roles screen has Cajero, Mesero, Cocina, Gerente seeded
    await navigateToTab(page, 'Roles');
    await expect(page.getByRole('heading', { name: 'Cajero', exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Mesero', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cocina', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gerente', exact: true })).toBeVisible();

    // Verify Cajero does NOT have finance.view
    const editCajeroBtn = page.getByRole('button', { name: 'Editar rol Cajero' });
    await expect(editCajeroBtn).toBeVisible();
    await editCajeroBtn.click();

    const editModal = page.locator('div.fixed').filter({ hasText: /Editar Rol/i });
    await expect(editModal).toBeVisible();
    const financeCheckbox = editModal.locator('input[id="perm-finance.view"]');
    await expect(financeCheckbox).not.toBeChecked();

    await editModal.getByRole('button', { name: /Cancelar/i }).click();
    await expect(editModal).not.toBeVisible();

    // 5. Verify Team screen create-user modal shows role descriptions
    await navigateToTab(page, 'Equipo');
    const newMemberBtn = page.getByRole('button', { name: /Nuevo Miembro/i });
    await expect(newMemberBtn).toBeVisible({ timeout: 10000 });
    await newMemberBtn.click();

    const createMemberModal = page.locator('div.fixed').filter({ hasText: /Registrar Nuevo Miembro/i });
    await expect(createMemberModal).toBeVisible();

    const roleSelect = createMemberModal.locator('select#create-role-select');
    await expect(roleSelect).toBeVisible();
    const selectContent = await roleSelect.textContent();
    expect(selectContent).toContain('Cajero — Toma pedidos, cobra y atiende clientes. No ve ventas ni configuración.');
    expect(selectContent).toContain('Mesero — Toma pedidos y atiende las mesas. Puede consultar clientes.');
    expect(selectContent).toContain('Cocina — Ve los pedidos y actualiza su preparación.');
    expect(selectContent).toContain('Gerente — Administra el negocio día a día. No gestiona usuarios ni roles.');

    // Default or selected description visible in caption below select
    await expect(
      createMemberModal.locator('p').filter({ hasText: 'Toma pedidos, cobra y atiende clientes' })
    ).toBeVisible();

    // Create staff user with Cajero role
    await createMemberModal.locator('input#create-username-input').fill(STAFF_USER);
    await createMemberModal.getByRole('button', { name: /Crear Usuario/i }).click();

    const credsModal = page.locator('div.fixed').filter({ hasText: /Credenciales de Acceso/i });
    await expect(credsModal).toBeVisible({ timeout: 10000 });
    await expect(credsModal.getByText(STAFF_USER)).toBeVisible();
    await credsModal.getByRole('button', { name: /Cerrar/i }).click();

    // Verify user appears in Team list
    await expect(page.locator('table').getByText(STAFF_USER)).toBeVisible({ timeout: 10000 });
  });

  test('(B) Existing tenant with deleted roles: empty state, screenshots, seed recommended roles & Team tab update', async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);
    const headers = { Authorization: `Bearer ${adminToken}` };

    // 1. Delete created staff user first to avoid role deletion foreign key conflict
    const usersRes = await request.get(`${API}/users`, { headers });
    expect(usersRes.status()).toBe(200);
    const usersList = await usersRes.json();
    const createdStaff = usersList.find((u: any) => u.username === STAFF_USER);
    if (createdStaff) {
      const delUserRes = await request.delete(`${API}/users/${createdStaff.id}`, { headers });
      expect(delUserRes.status()).toBe(204);
    }

    // 2. Delete all roles of the tenant via API
    const rolesRes = await request.get(`${API}/roles`, { headers });
    expect(rolesRes.status()).toBe(200);
    const rolesList = await rolesRes.json();
    for (const r of rolesList) {
      const delRoleRes = await request.delete(`${API}/roles/${r.id}`, { headers });
      expect(delRoleRes.status()).toBe(204);
    }

    // 3. Open Roles screen in browser and verify empty state
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.context().clearCookies();
    await uiLogin(page, ADMIN_USER, ADMIN_NEW_PASS);
    await navigateToTab(page, 'Roles');

    await expect(page.getByText('No hay roles configurados')).toBeVisible({ timeout: 15000 });
    const seedCtaBtn = page.getByRole('button', { name: /Crear roles recomendados/i });
    await expect(seedCtaBtn).toBeVisible();

    // 4. Capture Screenshots of Roles Empty State (Desktop Light & Dark, Mobile Light & Dark)
    // Desktop Light
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAdminTheme(page, 'light');
    await page.screenshot({ path: path.join(SHOTS_DIR, 'roles-empty-desktop-light.png') });

    // Desktop Dark
    await setAdminTheme(page, 'dark');
    await page.screenshot({ path: path.join(SHOTS_DIR, 'roles-empty-desktop-dark.png') });

    // Mobile Light (~390px)
    await page.setViewportSize({ width: 390, height: 844 });
    await setAdminTheme(page, 'light');
    await page.screenshot({ path: path.join(SHOTS_DIR, 'roles-empty-mobile-light.png') });

    // Mobile Dark (~390px)
    await setAdminTheme(page, 'dark');
    await page.screenshot({ path: path.join(SHOTS_DIR, 'roles-empty-mobile-dark.png') });

    // 5. Open Team tab and capture Screenshots of Team Modal (empty roles hint)
    await navigateToTab(page, 'Equipo');
    const newMemberBtn = page.getByRole('button', { name: /Nuevo Miembro/i });
    await expect(newMemberBtn).toBeVisible({ timeout: 10000 });
    await newMemberBtn.click();

    const teamModal = page.locator('div.fixed').filter({ hasText: /Registrar Nuevo Miembro/i });
    await expect(teamModal).toBeVisible();
    await expect(teamModal.getByText(/No hay roles creados todavía/i)).toBeVisible();
    await expect(teamModal.getByRole('button', { name: /Ir a configurar roles/i })).toBeVisible();

    // Mobile Dark Team Modal
    await page.screenshot({ path: path.join(SHOTS_DIR, 'team-modal-empty-roles-mobile-dark.png') });

    // Close and reopen in Light for Mobile Light Team Modal
    await teamModal.getByRole('button', { name: /Cancelar/i }).click();
    await setAdminTheme(page, 'light');
    await newMemberBtn.click();
    await expect(teamModal).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS_DIR, 'team-modal-empty-roles-mobile-light.png') });
    await teamModal.getByRole('button', { name: /Cancelar/i }).click();

    // Desktop Light Team Modal
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAdminTheme(page, 'light');
    await newMemberBtn.click();
    await expect(teamModal).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS_DIR, 'team-modal-empty-roles-desktop-light.png') });
    await teamModal.getByRole('button', { name: /Cancelar/i }).click();

    // Desktop Dark Team Modal
    await setAdminTheme(page, 'dark');
    await newMemberBtn.click();
    await expect(teamModal).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS_DIR, 'team-modal-empty-roles-desktop-dark.png') });

    // 6. Click 'Ir a configurar roles' from inside the Team modal
    await teamModal.getByRole('button', { name: /Ir a configurar roles/i }).click();
    await expect(teamModal).not.toBeVisible();

    // Verifies navigation back to Roles screen in empty state
    await expect(page.getByText('No hay roles configurados')).toBeVisible({ timeout: 10000 });

    // 7. Click 'Crear roles recomendados'
    const createRecommendedBtn = page.getByRole('button', { name: /Crear roles recomendados/i });
    await expect(createRecommendedBtn).toBeVisible();
    await createRecommendedBtn.click();

    // The 4 roles appear
    await expect(page.getByRole('heading', { name: 'Cajero', exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Mesero', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cocina', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gerente', exact: true })).toBeVisible();

    // 8. Go back to Team tab and verify empty-roles hint is gone
    await navigateToTab(page, 'Equipo');
    await newMemberBtn.click();
    await expect(teamModal).toBeVisible();
    await expect(teamModal.getByText(/No hay roles creados todavía/i)).not.toBeVisible();
    await expect(teamModal.locator('select#create-role-select')).toBeVisible();

    await teamModal.getByRole('button', { name: /Cancelar/i }).click();
  });
});
