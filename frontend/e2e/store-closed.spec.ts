import { test, expect, type APIRequestContext } from '@playwright/test';
import { TEST_RESTAURANT } from './test-fixture';

/**
 * Closed-store behaviour (store-opening-hours). These tests mutate the shared
 * seed test restaurant, which every other spec assumes is open 24/7, so:
 *  - the suite runs serially (the project already uses workers: 1; serial mode
 *    additionally guards against local `--workers` overrides and fullyParallel),
 *  - afterEach ALWAYS restores open 24/7, unpaused, America/Bogota.
 */
test.describe.configure({ mode: 'serial' });

const API_BASE = 'http://localhost:3001/api';
const SLUG = TEST_RESTAURANT.slug;
const TIMEZONE = 'America/Bogota';
const ALWAYS_OPEN = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, open: '00:00', close: '00:00' }));

async function login(request: APIRequestContext) {
  const res = await request.post(`${API_BASE}/users/login`, {
    data: { username: TEST_RESTAURANT.username, password: TEST_RESTAURANT.password },
  });
  expect(res.status()).toBe(200);
  const { token, user } = await res.json();
  return { token: token as string, restaurantId: user.restaurantId as string };
}

async function configureStore(
  request: APIRequestContext,
  patch: { schedule?: unknown; ordersPaused?: boolean; timezone?: string }
) {
  const { token, restaurantId } = await login(request);
  const res = await request.put(`${API_BASE}/restaurants/${restaurantId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: patch,
  });
  expect(res.status()).toBe(200);
}

/** Day of week (0 = Sunday) of "now + offsetDays" in the restaurant timezone. */
function dayOfWeekInTimezone(offsetDays: number): number {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'short' }).format(new Date());
  const today = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  return (today + offsetDays + 7) % 7;
}

/** Public order of `quantity` Clásicas (12.000 each; the seed minimum order is 20.000). */
async function publicOrder(request: APIRequestContext, quantity = 2) {
  return request.post(`${API_BASE}/orders`, {
    data: {
      restaurantId: SLUG,
      items: [{ productId: TEST_RESTAURANT.products.clasica, quantity, additions: [] }],
    },
  });
}

async function expectBrowseOnlyStorefront(page: import('@playwright/test').Page) {
  await page.goto(`/${SLUG}`);
  const status = page.getByRole('status');
  await expect(status.getByText('Cerrado', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/no puedes agregar productos al carrito/i)).toBeVisible();

  // Product cards: the add control is replaced by a "Cerrado" pill.
  await expect(page.getByRole('button', { name: /Agregar .* al carrito/i })).toHaveCount(0);
  const cards = page.getByRole('button', { name: /Cerrado, no se puede agregar al carrito/i });
  await expect(cards.first()).toBeVisible();
  await expect(cards.first().getByText('Cerrado', { exact: true })).toBeVisible();

  // Product modal can be opened to browse, but its add button is disabled.
  await cards.first().click();
  const modalAdd = page.getByRole('button', { name: 'Cerrado', exact: true });
  await expect(modalAdd).toBeVisible();
  await expect(modalAdd).toBeDisabled();
  await page.keyboard.press('Escape');
}

test.describe('Store closed or paused', () => {
  test.afterEach(async ({ request }) => {
    await configureStore(request, { schedule: ALWAYS_OPEN, timezone: TIMEZONE, ordersPaused: false });
  });

  test('outside the weekly schedule: Cerrado + next opening, add buttons disabled, public order 400', async ({
    page,
    request,
  }) => {
    // Open only tomorrow 00:00-01:00 (restaurant timezone): "now" is always outside.
    await configureStore(request, {
      timezone: TIMEZONE,
      ordersPaused: false,
      schedule: [{ dayOfWeek: dayOfWeekInTimezone(1), open: '00:00', close: '01:00' }],
    });

    await expectBrowseOnlyStorefront(page);
    await expect(page.getByRole('status').getByText('Abrimos mañana a las 00:00')).toBeVisible();

    const res = await publicOrder(request);
    expect(res.status()).toBe(400);
    expect((await res.json()).detail).toMatch(/fuera del horario de atención/i);
  });

  test('closed every day (empty schedule): Cerrado without a next opening, public order 400', async ({
    page,
    request,
  }) => {
    await configureStore(request, { schedule: [], ordersPaused: false });

    await expectBrowseOnlyStorefront(page);
    await expect(page.getByRole('status').getByText(/Abrimos/)).toHaveCount(0);

    const res = await publicOrder(request);
    expect(res.status()).toBe(400);
    expect((await res.json()).detail).toMatch(/fuera del horario de atención/i);
  });

  test('orders paused while the schedule is open: Cerrado + "Pedidos en pausa", public order 400', async ({
    page,
    request,
  }) => {
    await configureStore(request, { schedule: ALWAYS_OPEN, ordersPaused: true });

    await expectBrowseOnlyStorefront(page);
    await expect(page.getByRole('status').getByText('Pedidos en pausa')).toBeVisible();

    const res = await publicOrder(request);
    expect(res.status()).toBe(400);
    expect((await res.json()).detail).toMatch(/pedidos en pausa/i);
  });

  test('reopening restores Abierto and the opening guard lets orders through again', async ({ page, request }) => {
    await configureStore(request, { schedule: ALWAYS_OPEN, ordersPaused: true });
    await configureStore(request, { schedule: ALWAYS_OPEN, ordersPaused: false });

    await page.goto(`/${SLUG}`);
    await expect(page.getByRole('status').getByText('Abierto', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Agregar .* al carrito/i }).first()).toBeVisible();
    // Below the minimum on purpose: a 400 about the minimum (not about hours or
    // pause) proves the opening guard let the order through without creating data.
    const res = await publicOrder(request, 1);
    expect(res.status()).toBe(400);
    expect((await res.json()).detail).toMatch(/inferior al mínimo/i);
  });
});
