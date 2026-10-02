import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { TEST_RESTAURANT } from './test-fixture';

const API_BASE = 'http://localhost:3001/api';
// Second seeded tenant, used only to prove tenant isolation. Never the real "rosto".
const OTHER_TENANT = { username: 'admin_craft', password: 'craft' };

async function apiLogin(request: APIRequestContext, username: string, password: string) {
  const res = await request.post(`${API_BASE}/users/login`, { data: { username, password } });
  expect(res.status()).toBe(200);
  const { token, user } = await res.json();
  return { token: token as string, restaurantId: user.restaurantId as string };
}

async function loginAsAdmin(page: Page) {
  await page.goto('/admin');
  const userInput = page.locator('input#username, input[placeholder*="usuario" i], input[type="text"]').first();
  const passInput = page.locator('input#password, input[type="password"]').first();
  await expect(userInput).toBeVisible({ timeout: 10000 });
  await userInput.fill(TEST_RESTAURANT.username);
  await passInput.fill(TEST_RESTAURANT.password);
  await page.locator('button[type="submit"]').first().click();
  await expect(page.locator('aside button, nav button').filter({ hasText: /Pedidos en Vivo/i }).first()).toBeVisible({
    timeout: 15000,
  });
}

test.describe.configure({ mode: 'serial' });

test.describe('Restaurant tables: Personalizar → Mesas and Mesa / Salón sales', () => {
  // Unique per run so the spec is repeatable inside one run and across runs.
  const suffix = Date.now().toString(36).slice(-6).toUpperCase();
  const tableA = `E2E ${suffix} A`;
  const tableB = `E2E ${suffix} B`;
  const createdOrderIds: string[] = [];
  let token = '';
  let restaurantId = '';

  test.beforeAll(async ({ request }) => {
    ({ token, restaurantId } = await apiLogin(request, TEST_RESTAURANT.username, TEST_RESTAURANT.password));
  });

  test.afterAll(async ({ request }) => {
    const headers = { Authorization: `Bearer ${token}` };
    for (const id of createdOrderIds) {
      await request.delete(`${API_BASE}/orders/${id}?restaurantId=${restaurantId}`, { headers });
    }
    const list = await request.get(`${API_BASE}/tables?restaurantId=${restaurantId}`, { headers });
    if (list.status() === 200) {
      for (const t of (await list.json()) as Array<{ id: string; name: string }>) {
        if (t.name.startsWith(`E2E ${suffix}`)) {
          await request.delete(`${API_BASE}/tables/${t.id}?restaurantId=${restaurantId}`, { headers });
        }
      }
    }
  });

  test('the owner creates tables in Personalizar → Mesas', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);

    await page.locator('aside button, nav button').filter({ hasText: /Personalizar/i }).first().click();
    await page.getByRole('tab', { name: /^Mesas$/ }).click();
    await expect(page.getByText('Mesas del salón')).toBeVisible();

    for (const name of [tableA, tableB]) {
      const created = page.waitForResponse(
        (res) => res.url().includes('/api/tables') && res.request().method() === 'POST' && res.status() === 201
      );
      await page.getByLabel('Nombre de la nueva mesa').fill(name);
      await page.getByRole('button', { name: 'Agregar mesa' }).click();
      await created;
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }

    // Rename the second table inline and keep it for the rest of the spec.
    await page.getByRole('button', { name: `Renombrar ${tableB}` }).click();
    await page.getByLabel(`Nuevo nombre de ${tableB}`).fill(`${tableB} renombrada`);
    await page.getByRole('button', { name: 'Guardar nombre' }).click();
    await expect(page.getByText(`${tableB} renombrada`, { exact: true })).toBeVisible();

    // The tables survive a reload (server-side data).
    await page.reload();
    await page.locator('aside button, nav button').filter({ hasText: /Personalizar/i }).first().click();
    await page.getByRole('tab', { name: /^Mesas$/ }).click();
    await expect(page.getByText(tableA, { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('a Mesa / Salón sale selects the table, shows it on the Kanban and marks it occupied', async ({ page }) => {
    test.setTimeout(90000);
    await loginAsAdmin(page);

    await page.locator('aside button, nav button').filter({ hasText: /Pedidos en Vivo/i }).first().click();
    await page.getByRole('button', { name: /Nueva Venta/i }).first().click();
    const modal = page.locator('div.fixed.inset-0').filter({ hasText: /Punto de Venta/i }).first();
    await expect(modal).toBeVisible();

    // Twice: the fixture restaurant requires a minimum subtotal of 20.000.
    const addProduct = modal.getByRole('button', { name: /Agregar/i }).first();
    await addProduct.click();
    await addProduct.click();
    await modal.getByRole('button', { name: /Mesa \/ Salón/i }).click();

    // No free-text table input any more: tables are picked from the grid.
    await expect(modal.getByText(/Número de Mesa/i)).toHaveCount(0);
    const tableButton = modal.getByRole('button', { name: new RegExp(`^${tableA}`) });
    await expect(tableButton).toBeVisible({ timeout: 10000 });
    await expect(tableButton).not.toContainText('Ocupada');
    await tableButton.click();
    await expect(tableButton).toHaveAttribute('aria-pressed', 'true');

    const orderResponse = page.waitForResponse(
      (res) => res.url().endsWith('/api/orders') && res.request().method() === 'POST'
    );
    await modal.getByRole('button', { name: /Registrar Venta/i }).click();
    const res = await orderResponse;
    expect(res.status()).toBe(201);
    const order = await res.json();
    createdOrderIds.push(order.id);
    expect(order.tableLabel).toBe(tableA);
    expect(order.tableId).toMatch(/^tbl_/);
    // The table no longer leaks into the customer fields.
    expect(JSON.stringify(order.customer ?? {})).not.toContain(tableA);

    // The Kanban shows the table label.
    await expect(page.getByText(`Salón · ${tableA}`).first()).toBeVisible({ timeout: 10000 });

    // A new sale shows that table as occupied (still selectable); the other one is free.
    await page.getByRole('button', { name: /Nueva Venta/i }).first().click();
    const second = page.locator('div.fixed.inset-0').filter({ hasText: /Punto de Venta/i }).first();
    await second.getByRole('button', { name: /Mesa \/ Salón/i }).click();
    await expect(second.getByRole('button', { name: new RegExp(`^${tableA}.*Ocupada`) })).toBeVisible({
      timeout: 10000,
    });
    await expect(second.getByRole('button', { name: new RegExp(`^${tableB}`) })).not.toContainText('Ocupada');
  });

  test('"+ Nueva mesa" in the sale modal creates the table inline (click and Enter) without leaving the modal', async ({
    page,
  }) => {
    test.setTimeout(90000);
    await loginAsAdmin(page);

    await page.locator('aside button, nav button').filter({ hasText: /Pedidos en Vivo/i }).first().click();
    await page.getByRole('button', { name: /Nueva Venta/i }).first().click();
    const modal = page.locator('div.fixed.inset-0').filter({ hasText: /Punto de Venta/i }).first();
    await expect(modal).toBeVisible();

    const addProduct = modal.getByRole('button', { name: /Agregar/i }).first();
    await addProduct.click();
    await addProduct.click();
    await modal.getByRole('button', { name: /Mesa \/ Salón/i }).click();

    const urlBefore = page.url();
    const postTable = () =>
      page.waitForResponse((res) => res.url().includes('/api/tables') && res.request().method() === 'POST');
    // A nested <form> used to navigate the page to /admin/orders? and lose the modal.
    expect(await modal.locator('form form').count()).toBe(0);

    const created: string[] = [];
    for (const variant of ['click', 'enter'] as const) {
      const name = `E2E ${suffix} inline ${variant}`;
      await modal.getByRole('button', { name: '+ Nueva mesa' }).click();
      const input = modal.getByLabel('Nombre de la nueva mesa');
      await input.fill(name);
      const response = postTable();
      if (variant === 'click') {
        await modal.getByRole('button', { name: 'Crear', exact: true }).click();
      } else {
        await input.press('Enter');
      }
      expect((await response).status()).toBe(201);
      created.push(name);

      expect(page.url()).toBe(urlBefore);
      await expect(modal).toBeVisible();
      await expect(modal.getByRole('button', { name: new RegExp(`^${name}`) })).toHaveAttribute('aria-pressed', 'true');
    }

    // Complete the sale with the last created table.
    const orderResponse = page.waitForResponse(
      (res) => res.url().endsWith('/api/orders') && res.request().method() === 'POST'
    );
    await modal.getByRole('button', { name: /Registrar Venta/i }).click();
    const res = await orderResponse;
    expect(res.status()).toBe(201);
    const order = await res.json();
    createdOrderIds.push(order.id);
    expect(order.tableLabel).toBe(created[1]);
    expect(order.tableId).toMatch(/^tbl_/);
  });

  test('the API rejects a table of another restaurant, a guest tableId and cross-tenant changes', async ({ request }) => {
    const headers = { Authorization: `Bearer ${token}` };
    const other = await apiLogin(request, OTHER_TENANT.username, OTHER_TENANT.password);
    const otherHeaders = { Authorization: `Bearer ${other.token}` };

    const foreign = await request.post(`${API_BASE}/tables`, {
      headers: otherHeaders,
      data: { name: `E2E ${suffix} foreign` },
    });
    expect(foreign.status()).toBe(201);
    const foreignTable = await foreign.json();

    try {
      const own = await request.get(`${API_BASE}/tables?restaurantId=${restaurantId}`, { headers });
      const ownTables = (await own.json()) as Array<{ id: string; name: string }>;
      const ownA = ownTables.find((t) => t.name === tableA)!;
      expect(ownTables.some((t) => t.id === foreignTable.id)).toBe(false);

      const products = await request.get(`${API_BASE}/products?restaurantId=${restaurantId}`, { headers });
      const productId = ((await products.json()) as Array<{ id: string }>)[0].id;
      const sale = (extra: Record<string, unknown>) => ({
        restaurantId,
        items: [{ productId, quantity: 1 }],
        paymentMethod: 'Efectivo',
        ...extra,
      });

      // Staff of this restaurant cannot use another restaurant's table.
      const crossTenant = await request.post(`${API_BASE}/orders`, {
        headers,
        data: sale({ tableId: foreignTable.id, clientOrderId: `tbl-x-${suffix}` }),
      });
      expect(crossTenant.status()).toBe(400);

      // The public storefront (no token) cannot send a tableId at all.
      const guest = await request.post(`${API_BASE}/orders`, {
        data: sale({ tableId: ownA.id, clientOrderId: `tbl-g-${suffix}` }),
      });
      expect(guest.status()).toBe(400);

      // The other tenant can neither rename nor delete this restaurant's table.
      const rename = await request.put(`${API_BASE}/tables/${ownA.id}`, { headers: otherHeaders, data: { name: 'hacked' } });
      expect(rename.status()).toBe(404);
      const del = await request.delete(`${API_BASE}/tables/${ownA.id}`, { headers: otherHeaders });
      expect(del.status()).toBe(404);

      // A deleted table keeps its name on the orders that used it.
      const orderId = createdOrderIds[0];
      const delOwn = await request.delete(`${API_BASE}/tables/${ownA.id}?restaurantId=${restaurantId}`, { headers });
      expect(delOwn.status()).toBe(204);
      const after = await request.get(`${API_BASE}/orders/${orderId}?restaurantId=${restaurantId}`, { headers });
      const body = await after.json();
      expect(body.tableLabel).toBe(tableA);
      expect(body.tableId).toBeUndefined();
    } finally {
      await request.delete(`${API_BASE}/tables/${foreignTable.id}`, { headers: otherHeaders });
    }
  });
});
