import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { TEST_RESTAURANT } from './test-fixture';

/**
 * Live (no mocks) end-to-end flow for custom roles and staff permission gating:
 * customer edit/delete, roles CRUD, staff team management, a restricted staff
 * session (nav, deep links, amounts, kanban, API 403s) and finance masking.
 *
 * Runs against the seeded `tienda-pruebas` tenant. Every entity created here
 * carries a run-unique suffix so reruns never collide.
 */

const API = 'http://localhost:3001/api';
const SHOTS = process.env.E2E_SHOTS_DIR;
const RUN = Date.now().toString().slice(-6);
const MID_STAFF_PASSWORD = 'Staff!ChangedPw1';
const FINAL_STAFF_PASSWORD = 'Staff!ChangedPw2';

const ROLE_KITCHEN = `Cocina QA ${RUN}`;
const ROLE_CUSTOM = `Atencion QA ${RUN}`;
const ROLE_TEMP = `Temporal QA ${RUN}`;
const USER_KITCHEN = `cocina_qa_${RUN}`;
const USER_CUSTOM = `atencion_qa_${RUN}`;

const CUSTOMER_EDIT = `Cliente Editar ${RUN}`;
const CUSTOMER_EDITED = `Cliente Editado ${RUN}`;
const CUSTOMER_DELETE = `Cliente Borrar ${RUN}`;
const CUSTOMER_SPENDER = `Cliente Gasto ${RUN}`;
const phone = (suffix: number) => `31${RUN}${suffix}`.slice(0, 10);

const NAV_LABELS = {
  dashboard: 'Dashboard',
  orders: 'Pedidos en Vivo',
  customers: 'Clientes',
  reports: 'Reportes & Cierre',
  inventory: 'Stock & Insumos',
  settings: 'Ajustes de Negocio',
  roles: 'Roles',
  team: 'Equipo',
} as const;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function apiLogin(request: APIRequestContext, username: string, password: string) {
  const res = await request.post(`${API}/users/login`, { data: { username, password } });
  expect(res.status(), `login ${username}`).toBe(200);
  return (await res.json()) as { token: string; user: { mustChangePassword?: boolean } };
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
}

/** Completes the forced first-login password change; returns once the shell is shown. */
async function completeForcedPasswordChange(page: Page, current: string, next: string) {
  await expect(page.getByText(/Cambio de contraseña obligatorio/i)).toBeVisible({ timeout: 10000 });
  await page.locator('input#currentPassword').fill(current);
  await page.locator('input#newPassword').fill(next);
  await page.locator('input#confirmPassword').fill(next);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/users/me/password') && r.status() === 200),
    page.getByRole('button', { name: /Actualizar contraseña/i }).click(),
  ]);
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Menú Lateral' });

async function navLabels(page: Page): Promise<string[]> {
  await expect(nav(page).getByRole('button').first()).toBeVisible({ timeout: 15000 });
  return nav(page)
    .getByRole('button')
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
}

async function gotoTab(page: Page, label: string) {
  await nav(page).getByRole('button', { name: label, exact: true }).click();
}

async function adminLogin(page: Page) {
  await uiLogin(page, TEST_RESTAURANT.username, TEST_RESTAURANT.password);
  await expect(nav(page).getByRole('button', { name: NAV_LABELS.roles, exact: true })).toBeVisible({ timeout: 15000 });
}

const kanbanHeading = (page: Page) => page.getByRole('heading', { name: /Nuevos \/ Pendientes/i });

test.describe.configure({ mode: 'serial' });

test.describe('RBAC: customer CRUD, custom roles, staff team and permission gating', () => {
  let adminToken = '';
  const orderIds: string[] = [];
  let kitchenTempPassword = '';
  let customTempPassword = '';

  test.beforeAll(async ({ request }) => {
    const { token } = await apiLogin(request, TEST_RESTAURANT.username, TEST_RESTAURANT.password);
    adminToken = token;
    const headers = { Authorization: `Bearer ${adminToken}` };

    for (const [name, p] of [
      [CUSTOMER_EDIT, phone(1)],
      [CUSTOMER_DELETE, phone(2)],
    ] as const) {
      const res = await request.post(`${API}/customers`, {
        headers,
        data: { name, phone: p, address: 'Calle 1 # 2-3', barrio: 'Centro' },
      });
      expect(res.status(), `seed customer ${name}`).toBe(201);
    }

    // The spender customer is created by the orders themselves (reused by phone).
    for (let i = 0; i < 3; i += 1) {
      const res = await request.post(`${API}/orders`, {
        headers,
        data: {
          restaurantId: TEST_RESTAURANT.id,
          customer: { name: CUSTOMER_SPENDER, phone: phone(3), address: 'Carrera 9 # 8-7', barrio: 'Chico' },
          items: [{ productId: TEST_RESTAURANT.products.clasica, quantity: i + 2 }],
          deliveryFee: 0,
          paymentMethod: 'Efectivo',
          paymentAmount: 100000,
          changeAmount: 100000 - 12000 * (i + 2),
          clientOrderId: `rbac-${RUN}-${i}`,
        },
      });
      expect(res.status(), `seed order: ${await res.text()}`).toBe(201);
      orderIds.push((await res.json()).id);
    }

    // Deliver the first order so finance aggregates have revenue to show.
    for (const status of ['cooking', 'delivering', 'delivered']) {
      const res = await request.patch(`${API}/orders/${orderIds[0]}/status`, { headers, data: { status } });
      expect(res.status(), `order -> ${status}`).toBe(200);
    }
  });

  test('1. admin edits and deletes a customer; changes persist after reload', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await uiLogin(page, TEST_RESTAURANT.username, TEST_RESTAURANT.password);
    await gotoTab(page, NAV_LABELS.customers);

    const search = page.getByPlaceholder(/Buscar por nombre, teléfono o barrio/i);
    await expect(search).toBeVisible({ timeout: 15000 });
    await search.fill(`Cliente Editar ${RUN}`);
    await expect(page.locator('tbody tr').filter({ hasText: CUSTOMER_EDIT })).toBeVisible();
    await shot(page, '01-customers-before-edit');

    // Edit name / phone / address
    await page.getByRole('button', { name: `Editar ${CUSTOMER_EDIT}` }).click();
    const newPhone = phone(4);
    await page.getByLabel('Nombre', { exact: true }).fill(CUSTOMER_EDITED);
    await page.getByLabel('Teléfono', { exact: true }).fill(newPhone);
    await page.getByLabel('Dirección', { exact: true }).fill('Avenida Nueva # 99-11');
    await shot(page, '02-customer-edit-modal');
    const [putRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/customers/') && r.request().method() === 'PUT'),
      page.getByRole('button', { name: 'Guardar cambios' }).click(),
    ]);
    expect(putRes.status()).toBe(200);
    await page.getByRole('button', { name: 'Cerrar modal' }).click();

    await search.fill(`Cliente Editado ${RUN}`);
    const editedRow = page.locator('tbody tr').filter({ hasText: CUSTOMER_EDITED });
    await expect(editedRow).toBeVisible();
    await expect(editedRow).toContainText(newPhone);
    await expect(editedRow).toContainText('Avenida Nueva # 99-11');
    await shot(page, '03-customer-edited-in-list');

    // Delete the other customer through the confirm dialog
    await search.fill(`Cliente Borrar ${RUN}`);
    await expect(page.locator('tbody tr').filter({ hasText: CUSTOMER_DELETE })).toBeVisible();
    await page.getByRole('button', { name: `Eliminar ${CUSTOMER_DELETE}` }).click();
    const dialog = page.getByRole('dialog').filter({ hasText: /¿Eliminar cliente\?/i });
    await expect(dialog).toBeVisible();
    await shot(page, '04-customer-delete-confirm');
    const [delRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/customers/') && r.request().method() === 'DELETE'),
      dialog.getByRole('button', { name: 'Eliminar definitivamente' }).click(),
    ]);
    expect([200, 204]).toContain(delRes.status());
    await expect(page.locator('tbody tr').filter({ hasText: CUSTOMER_DELETE })).toHaveCount(0);

    // Persistence after reload
    await page.reload();
    await gotoTab(page, NAV_LABELS.customers);
    await expect(search).toBeVisible({ timeout: 15000 });
    await search.fill(`Cliente Editado ${RUN}`);
    const reloadedRow = page.locator('tbody tr').filter({ hasText: CUSTOMER_EDITED });
    await expect(reloadedRow).toBeVisible();
    await expect(reloadedRow).toContainText(newPhone);
    await expect(reloadedRow).toContainText('Avenida Nueva # 99-11');
    await search.fill(`Cliente Borrar ${RUN}`);
    await expect(page.locator('tbody tr').filter({ hasText: CUSTOMER_DELETE })).toHaveCount(0);
    await shot(page, '05-customers-persisted-after-reload');
  });

  test('2. admin creates roles (preset + custom), edits one and deletes an unused one', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await adminLogin(page);
    await gotoTab(page, NAV_LABELS.roles);
    await expect(page.getByRole('heading', { name: /Roles y Permisos/i })).toBeVisible();
    await shot(page, '06-roles-empty-or-list');

    // Role 1: "Cocina / Pedidos" preset
    await page.getByRole('button', { name: /Nuevo Rol/i }).first().click();
    await page.locator('#role-name-input').fill(ROLE_KITCHEN);
    await page.getByRole('button', { name: 'Cocina / Pedidos' }).click();
    await expect(page.locator('#perm-orders\\.view')).toBeChecked();
    await expect(page.locator('#perm-orders\\.manage')).toBeChecked();
    // The preset is exactly orders.view + orders.manage (no inventory).
    await expect(page.locator('#perm-inventory\\.manage')).not.toBeChecked();
    await expect(page.getByText('2 de 12').first()).toBeVisible();
    await shot(page, '07-role-create-preset');
    const [createRes] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/roles') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Guardar Rol' }).click(),
    ]);
    expect(createRes.status()).toBe(201);
    expect((await createRes.json()).permissions.sort()).toEqual(['orders.manage', 'orders.view']);
    await expect(page.getByRole('heading', { name: ROLE_KITCHEN })).toBeVisible();

    // Role 2: custom, manual ticks (orders.view + customers.view, no finance.view)
    await page.getByRole('button', { name: /Nuevo Rol/i }).first().click();
    await page.locator('#role-name-input').fill(ROLE_CUSTOM);
    await page.getByRole('button', { name: 'Limpiar' }).click();
    await page.locator('#perm-orders\\.view').check();
    await page.locator('#perm-customers\\.view').check();
    await page.locator('#role-description-input').fill('Atencion de clientes');
    const [customRes] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/roles') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Guardar Rol' }).click(),
    ]);
    expect(customRes.status()).toBe(201);
    await expect(page.getByRole('heading', { name: ROLE_CUSTOM })).toBeVisible();
    await shot(page, '08-roles-list-two-roles');

    // Edit the custom role: add orders.manage and change the description
    await page.getByRole('button', { name: `Editar rol ${ROLE_CUSTOM}` }).click();
    await expect(page.getByRole('heading', { name: 'Editar Rol' })).toBeVisible();
    await page.locator('#perm-orders\\.manage').check();
    await page.locator('#role-description-input').fill('Atencion de clientes y pedidos');
    const [editRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/roles/') && r.request().method() === 'PUT'),
      page.getByRole('button', { name: 'Guardar Rol' }).click(),
    ]);
    expect(editRes.status()).toBe(200);
    const edited = await editRes.json();
    expect(edited.permissions.sort()).toEqual(['customers.view', 'orders.manage', 'orders.view']);
    const customCard = page.locator('div.rounded-2xl').filter({ has: page.getByRole('heading', { name: ROLE_CUSTOM }) }).last();
    await expect(customCard).toContainText('3 de 12');
    await expect(customCard).toContainText('Atencion de clientes y pedidos');

    // A role without users can be deleted
    await page.getByRole('button', { name: /Nuevo Rol/i }).first().click();
    await page.locator('#role-name-input').fill(ROLE_TEMP);
    await page.getByRole('button', { name: 'Guardar Rol' }).click();
    await expect(page.getByRole('heading', { name: ROLE_TEMP })).toBeVisible();
    await page.getByRole('button', { name: `Eliminar rol ${ROLE_TEMP}` }).click();
    const dialog = page.getByRole('dialog').filter({ hasText: /¿Eliminar rol\?/i });
    const [delRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/roles/') && r.request().method() === 'DELETE'),
      dialog.getByRole('button', { name: 'Eliminar rol' }).click(),
    ]);
    expect([200, 204]).toContain(delRes.status());
    await expect(page.getByRole('heading', { name: ROLE_TEMP })).toHaveCount(0);
  });

  test('3. admin manages team: create staff with role, edit, reset password, role-in-use delete is refused', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await adminLogin(page);
    await gotoTab(page, NAV_LABELS.team);
    await expect(page.getByRole('heading', { name: /Gestión de Equipo/i })).toBeVisible();

    async function createStaff(username: string, roleName: string, permissionCount: number) {
      await page.getByRole('button', { name: /Nuevo Miembro/i }).first().click();
      await page.locator('#create-username-input').fill(username);
      const generated = await page.locator('#create-password-input').inputValue();
      expect(generated).toMatch(/^Staff!/);
      await page.locator('#create-role-select').selectOption({ label: `${roleName} (${permissionCount} permisos)` });
      await Promise.all([
        page.waitForResponse((r) => r.url().endsWith('/api/users') && r.request().method() === 'POST' && r.status() === 201),
        page.getByRole('button', { name: 'Crear Usuario' }).click(),
      ]);
      // The temporary password is revealed once: capture it from the modal.
      const reveal = page.locator('div.fixed').filter({ hasText: 'Credenciales de Acceso' });
      await expect(reveal).toBeVisible();
      await expect(reveal.getByText(generated, { exact: true })).toBeVisible();
      await expect(reveal.getByText(username, { exact: true })).toBeVisible();
      return { reveal, generated };
    }

    const kitchen = await createStaff(USER_KITCHEN, ROLE_KITCHEN, 2);
    kitchenTempPassword = kitchen.generated;
    await shot(page, '09-team-credentials-reveal');
    await kitchen.reveal.getByRole('button', { name: 'Cerrar' }).click();

    const custom = await createStaff(USER_CUSTOM, ROLE_CUSTOM, 3);
    customTempPassword = custom.generated;
    await custom.reveal.getByRole('button', { name: 'Cerrar' }).click();

    const kitchenRow = page.locator('tbody tr').filter({ hasText: USER_KITCHEN });
    await expect(kitchenRow).toContainText(ROLE_KITCHEN);
    await expect(kitchenRow).toContainText('Requiere cambio');
    await shot(page, '10-team-list');

    // Edit: move the kitchen user to the custom role and back
    await page.getByRole('button', { name: `Editar usuario ${USER_KITCHEN}` }).click();
    await page.locator('#edit-role-select').selectOption({ label: ROLE_CUSTOM });
    const [editRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/users/') && r.request().method() === 'PATCH'),
      page.getByRole('button', { name: 'Guardar Cambios' }).click(),
    ]);
    expect(editRes.status()).toBe(200);
    await expect(kitchenRow).toContainText(ROLE_CUSTOM);
    await page.getByRole('button', { name: `Editar usuario ${USER_KITCHEN}` }).click();
    await page.locator('#edit-role-select').selectOption({ label: ROLE_KITCHEN });
    await page.getByRole('button', { name: 'Guardar Cambios' }).click();
    await expect(kitchenRow).toContainText(ROLE_KITCHEN);

    // Reset password: new temporary password is shown once
    await page.getByRole('button', { name: `Restablecer clave ${USER_KITCHEN}` }).click();
    const resetDialog = page.getByRole('dialog').filter({ hasText: /¿Restablecer contraseña\?/i });
    await expect(resetDialog).toBeVisible();
    const [resetRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/reset-password') && r.request().method() === 'POST'),
      resetDialog.getByRole('button', { name: 'Restablecer clave' }).click(),
    ]);
    expect(resetRes.status()).toBe(200);
    const resetModal = page.locator('div.fixed').filter({ hasText: 'Nueva Clave Temporal' });
    await expect(resetModal).toBeVisible();
    kitchenTempPassword = (await resetModal.locator('div.select-all').innerText()).trim();
    expect(kitchenTempPassword.length).toBeGreaterThanOrEqual(8);
    expect(kitchenTempPassword).not.toBe(kitchen.generated);
    await shot(page, '11-team-reset-password');
    await resetModal.getByRole('button', { name: 'Cerrar' }).click();

    // Deleting a role that still has users is refused with the friendly message
    await gotoTab(page, NAV_LABELS.roles);
    await page.getByRole('button', { name: `Eliminar rol ${ROLE_KITCHEN}` }).click();
    const roleDialog = page.getByRole('dialog').filter({ hasText: /¿Eliminar rol\?/i });
    const [refusedRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/roles/') && r.request().method() === 'DELETE'),
      roleDialog.getByRole('button', { name: 'Eliminar rol' }).click(),
    ]);
    expect(refusedRes.status()).toBe(409);
    await expect(
      page.getByText('No se puede eliminar el rol porque tiene usuarios asignados. Reasigna los usuarios antes de eliminarlo.').first()
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: ROLE_KITCHEN })).toBeVisible();
    await shot(page, '12-role-delete-refused');
  });

  test('4. staff (orders-only role): nav, landing, deep links, amounts, kanban, API 403s', async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await uiLogin(page, USER_KITCHEN, kitchenTempPassword);
    await completeForcedPasswordChange(page, kitchenTempPassword, FINAL_STAFF_PASSWORD);

    // Landing tab is Orders and the nav carries ONLY the orders entry. The
    // orders must show WITHOUT a manual reload: reads made while the password
    // change was pending were refused (403) and have to be refetched.
    await expect(kanbanHeading(page).or(page.getByPlaceholder(/Buscar por # orden, cliente/i))).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(CUSTOMER_SPENDER).first()).toBeVisible({ timeout: 15000 });
    expect(await navLabels(page)).toEqual([NAV_LABELS.orders]);
    await shot(page, '13-staff-landing-orders');

    // Deep links to forbidden tabs fall back to Orders
    for (const route of ['dashboard', 'reports', 'roles', 'team', 'equipo', 'inventory', 'settings']) {
      await page.goto(`/admin/${route}`);
      await expect(nav(page).getByRole('button').first()).toBeVisible({ timeout: 15000 });
      expect(await navLabels(page), `nav after /admin/${route}`).toEqual([NAV_LABELS.orders]);
      await expect(page.getByRole('heading', { name: /Roles y Permisos|Gestión de Equipo/i })).toHaveCount(0);
      await expect(
        kanbanHeading(page).or(page.getByPlaceholder(/Buscar por # orden, cliente/i)),
        `orders content after /admin/${route}`
      ).toBeVisible({ timeout: 15000 });
    }
    await shot(page, '14-staff-deeplink-redirected');

    // Per-order amounts are visible; force the kanban view
    await page.evaluate(() => localStorage.setItem('burger_page_orders_view_mode', 'kanban'));
    await page.goto('/admin/orders');
    await expect(kanbanHeading(page)).toBeVisible({ timeout: 15000 });
    const card = page.locator('div.group.relative.rounded-xl').filter({ hasText: CUSTOMER_SPENDER }).first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card).toContainText(/\$\s?\d[\d.,]*/);
    await shot(page, '15-staff-kanban-amounts');
    await card.locator('button[title="Ver detalles completos del pedido"]').click();
    await expect(page.getByText(/Detalle del Pedido/i)).toBeVisible();
    await expect(page.getByText('Total a Pagar')).toBeVisible();
    await shot(page, '16-staff-order-detail-amounts');
    // Without orders.delete the order detail must not offer deletion.
    await expect(page.getByRole('button', { name: /Eliminar Orden/i })).toHaveCount(0);
    await page.getByRole('button', { name: 'Cerrar detalles' }).click();

    // Kanban: move a pending order to the kitchen (real PATCH)
    const [moveRes] = await Promise.all([
      page.waitForResponse((r) => /\/api\/orders\/[^/]+\/status/.test(r.url()) && r.request().method() === 'PATCH'),
      page.getByRole('button', { name: /A Cocina/i }).first().click(),
    ]);
    expect(moveRes.status()).toBe(200);
    expect((await moveRes.json()).status).toBe('cooking');
    await shot(page, '17-staff-kanban-moved');

    // Direct API calls outside the role's permissions are forbidden
    const { token } = await apiLogin(request, USER_KITCHEN, FINAL_STAFF_PASSWORD);
    const auth = { Authorization: `Bearer ${token}` };
    const denied: Array<[string, () => Promise<{ status(): number }>]> = [
      ['GET /roles', () => request.get(`${API}/roles`, { headers: auth })],
      ['POST /roles', () => request.post(`${API}/roles`, { headers: auth, data: { name: 'x', permissions: [] } })],
      ['GET /users', () => request.get(`${API}/users`, { headers: auth })],
      ['DELETE /orders/:id', () => request.delete(`${API}/orders/${orderIds[2]}`, { headers: auth })],
      ['GET /customers', () => request.get(`${API}/customers`, { headers: auth })],
    ];
    for (const [label, call] of denied) {
      expect((await call()).status(), label).toBe(403);
    }
    expect((await request.get(`${API}/orders`, { headers: auth })).status(), 'GET /orders allowed').toBe(200);
  });

  test('5. admin sees aggregate money; staff without finance.view sees no spend totals but keeps per-order amounts', async ({ page, browser }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await adminLogin(page);

    // Admin: dashboard and reports show aggregate money
    await gotoTab(page, NAV_LABELS.dashboard);
    await expect(page.getByRole('main').getByText(/\$\s?\d[\d.,]*/).first()).toBeVisible({ timeout: 15000 });
    await shot(page, '18-admin-dashboard');
    await gotoTab(page, NAV_LABELS.reports);
    await expect(page.getByRole('main').getByText(/\$\s?\d[\d.,]*/).first()).toBeVisible({ timeout: 15000 });
    await shot(page, '19-admin-reports');

    // Admin sees spend totals in the CRM
    await gotoTab(page, NAV_LABELS.customers);
    await expect(page.getByRole('columnheader', { name: 'Gasto Total' })).toBeVisible({ timeout: 15000 });
    await shot(page, '20-admin-customers-with-spend');

    // Staff with customers.view and no finance.view
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const staffPage = await ctx.newPage();
    await uiLogin(staffPage, USER_CUSTOM, customTempPassword);
    await completeForcedPasswordChange(staffPage, customTempPassword, MID_STAFF_PASSWORD);
    expect(await navLabels(staffPage)).toEqual([NAV_LABELS.orders, NAV_LABELS.customers]);

    await gotoTab(staffPage, NAV_LABELS.customers);
    const search = staffPage.getByPlaceholder(/Buscar por nombre, teléfono o barrio/i);
    await expect(search).toBeVisible({ timeout: 15000 });
    await search.fill(`Cliente Gasto ${RUN}`);
    const row = staffPage.locator('tbody tr').filter({ hasText: CUSTOMER_SPENDER });
    await expect(row).toBeVisible();
    await expect(staffPage.getByRole('columnheader', { name: 'Gasto Total' })).toHaveCount(0);
    await expect(row).not.toContainText(/\$\s?\d/);
    await expect(staffPage.getByText(/Gasto Total|Ingresos Totales|Gasto Acumulado/i)).toHaveCount(0);
    await shot(staffPage, '21-staff-customers-no-spend');

    // Customer profile: no "Inversión Total", but per-order amounts in the history stay visible
    await row.locator('button[title="Ficha del cliente"]').click();
    await expect(staffPage.getByText('Inversión Total')).toHaveCount(0);
    const history = staffPage.getByText(/Historial de Pedidos Registrados/i);
    await expect(history).toBeVisible();
    const historyBox = history.locator('xpath=..');
    await expect(historyBox).toContainText(/\$\s?\d[\d.,]*/);
    await shot(staffPage, '22-staff-customer-history-amounts');
    // Without customers.manage the modal offers no edit/delete/notes controls.
    await expect(staffPage.getByRole('button', { name: /Editar datos|Eliminar cliente|Guardar Notas/ })).toHaveCount(0);

    // Server-side: the customers API redacts spend totals for this staff user
    const { token } = await apiLogin(staffPage.request, USER_CUSTOM, MID_STAFF_PASSWORD);
    const res = await staffPage.request.get(`${API}/customers`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status()).toBe(200);
    const list = (await res.json()) as Array<Record<string, unknown>>;
    const spender = list.find((c) => c.name === CUSTOMER_SPENDER);
    expect(spender, 'spender customer in API list').toBeTruthy();
    expect(spender?.totalSpent ?? 0).toBe(0);

    // Without customers.manage the server refuses writes even if the UI offers them
    const write = await staffPage.request.put(`${API}/customers/${spender?.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Hacked' },
    });
    expect(write.status(), 'PUT /customers without customers.manage').toBe(403);
    await ctx.close();
  });
});
