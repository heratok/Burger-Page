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
  // Tables are structured (zone + number [+ alias]); the stored name is derived as "<zone> <number>".
  // Every zone starts with `E2E <suffix>` so afterAll can find and delete what this run created.
  const zone = `E2E ${suffix}`;
  const tableA = `${zone} 1`;
  const tableB = `${zone} 2`;
  const tableBEdited = `${zone} 7 · Ventana`;
  const rangeZone = `${zone} R`;
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  test('the owner creates tables in Mesas & QR', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);

    await page.locator('aside button, nav button').filter({ hasText: /Mesas & QR/i }).first().click();
    await expect(page.getByText('Mesas del salón')).toBeVisible();

    for (const [number, name] of [
      ['1', tableA],
      ['2', tableB],
    ]) {
      const created = page.waitForResponse(
        (res) => res.url().includes('/api/tables') && res.request().method() === 'POST' && res.status() === 201
      );
      // Changing the zone resets the suggested number, so the number is filled last.
      await page.getByLabel('Zona de la nueva mesa').fill(zone);
      await page.getByLabel('Número de la nueva mesa').fill(number);
      await expect(page.getByText(`Se creará: ${name}`)).toBeVisible();
      await page.getByRole('button', { name: 'Agregar mesa' }).click();
      await created;
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }

    // Edit the second table inline (number + alias) and keep it for the rest of the spec.
    await page.getByRole('button', { name: `Editar ${tableB}` }).click();
    await page.getByLabel(`Número de ${tableB}`).fill('7');
    await page.getByLabel(`Alias de ${tableB}`).fill('Ventana');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText(tableBEdited, { exact: true })).toBeVisible();

    // The tables survive a reload (server-side data).
    await page.reload();
    await page.locator('aside button, nav button').filter({ hasText: /Mesas & QR/i }).first().click();
    await expect(page.getByText(tableA, { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('"Crear varias" creates a range grouped under its zone and skips numbers that already exist', async ({
    page,
  }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await page.locator('aside button, nav button').filter({ hasText: /Mesas & QR/i }).first().click();
    await expect(page.getByText('Mesas del salón')).toBeVisible();

    const zoneSection = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { level: 4, name: rangeZone }) });
    const createRange = async (from: string, to: string) => {
      const created = page.waitForResponse(
        (res) => new URL(res.url()).pathname === '/api/tables/bulk' && res.request().method() === 'POST' && res.status() === 201
      );
      await page.getByLabel('Zona de las nuevas mesas').fill(rangeZone);
      await page.getByLabel('Desde el número').fill(from);
      await page.getByLabel('Hasta el número').fill(to);
      await page.getByRole('button', { name: 'Crear mesas' }).click();
      await created;
    };

    await page.getByRole('button', { name: 'Crear varias' }).click();
    await createRange('1', '3');
    await expect(page.getByRole('status')).toHaveText('Se crearon 3 mesas.');
    // One group for the zone holding exactly the three created tables.
    await expect(page.getByRole('heading', { level: 4, name: rangeZone })).toHaveCount(1);
    await expect(zoneSection.getByRole('listitem')).toHaveCount(3);
    for (const n of [1, 2, 3]) {
      await expect(zoneSection.getByText(`${rangeZone} ${n}`, { exact: true })).toBeVisible();
    }

    // Overlapping range: 2 and 3 already exist, only 4 is created.
    await createRange('2', '4');
    await expect(page.getByRole('status')).toHaveText('Se crearon 1 mesa. Se omitieron 2 que ya existían: 2, 3.');
    await expect(zoneSection.getByRole('listitem')).toHaveCount(4);
    await expect(zoneSection.getByText(`${rangeZone} 4`, { exact: true })).toBeVisible();
  });

  test('creating a duplicate (same zone and number) shows the conflict and creates nothing', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await page.locator('aside button, nav button').filter({ hasText: /Mesas & QR/i }).first().click();
    await expect(page.getByText('Mesas del salón')).toBeVisible();

    const zoneSection = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { level: 4, name: rangeZone }) });
    await expect(zoneSection.getByRole('listitem')).toHaveCount(4);

    const conflict = page.waitForResponse(
      (res) => new URL(res.url()).pathname === '/api/tables' && res.request().method() === 'POST' && res.status() === 409
    );
    // Same table with different casing/spacing: the zone is normalized before comparing.
    await page.getByLabel('Zona de la nueva mesa').fill(`  ${rangeZone.toLowerCase()} `);
    await page.getByLabel('Número de la nueva mesa').fill('1');
    await page.getByRole('button', { name: 'Agregar mesa' }).click();
    await conflict;

    await expect(page.getByText(`Ya existe la mesa '${rangeZone} 1'`)).toBeVisible();
    await expect(zoneSection.getByRole('listitem')).toHaveCount(4);
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
    const tableButton = modal.getByRole('button', { name: new RegExp(`^${escapeRegExp(tableA)}(?!\\d)`) });
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

    // Saving a sale opens the kitchen ticket preview; close it before continuing.
    await page.getByRole('button', { name: 'Cerrar vista previa' }).click();

    // The Kanban shows the table label.
    await expect(page.getByText(`Salón · ${tableA}`).first()).toBeVisible({ timeout: 10000 });

    // A new sale shows that table as occupied (still selectable); the other one is free.
    await page.getByRole('button', { name: /Nueva Venta/i }).first().click();
    const second = page.locator('div.fixed.inset-0').filter({ hasText: /Punto de Venta/i }).first();
    await second.getByRole('button', { name: /Mesa \/ Salón/i }).click();
    await expect(second.getByRole('button', { name: new RegExp(`^${escapeRegExp(tableA)}(?!\\d).*Ocupada`) })).toBeVisible({
      timeout: 10000,
    });
    await expect(second.getByRole('button', { name: new RegExp(`^${escapeRegExp(tableBEdited)}`) })).not.toContainText('Ocupada');
  });

  test('"+ Nueva mesa" in the sale modal creates the table inline (click and Enter in either field) without leaving the modal', async ({
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
    for (const [variant, number] of [
      ['click', '31'],
      ['enter-number', '32'],
      ['enter-zone', '33'],
    ] as const) {
      const name = `${zone} ${number}`;
      await modal.getByRole('button', { name: '+ Nueva mesa' }).click();
      const zoneInput = modal.getByLabel('Zona de la nueva mesa');
      const input = modal.getByLabel('Número de la nueva mesa');
      // Changing the zone resets the suggested number, so the number is filled last.
      await zoneInput.fill(zone);
      await input.fill(number);
      const response = postTable();
      if (variant === 'click') {
        await modal.getByRole('button', { name: 'Crear', exact: true }).click();
      } else {
        // Enter submits from either field.
        await (variant === 'enter-zone' ? zoneInput : input).press('Enter');
      }
      expect((await response).status()).toBe(201);
      created.push(name);

      expect(page.url()).toBe(urlBefore);
      await expect(modal).toBeVisible();
      await expect(modal.getByRole('button', { name: new RegExp(`^${escapeRegExp(name)}`) })).toHaveAttribute('aria-pressed', 'true');
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
    expect(order.tableLabel).toBe(created[2]);
    expect(order.tableId).toMatch(/^tbl_/);
  });

  test('the API rejects a table of another restaurant, a guest tableId and cross-tenant changes', async ({ request }) => {
    const headers = { Authorization: `Bearer ${token}` };
    const other = await apiLogin(request, OTHER_TENANT.username, OTHER_TENANT.password);
    const otherHeaders = { Authorization: `Bearer ${other.token}` };

    const foreign = await request.post(`${API_BASE}/tables`, {
      headers: otherHeaders,
      data: { zone: `E2E ${suffix} foreign`, number: 1 },
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

      // The other tenant can neither edit nor delete this restaurant's table.
      const rename = await request.put(`${API_BASE}/tables/${ownA.id}`, { headers: otherHeaders, data: { zone: 'X' } });
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
