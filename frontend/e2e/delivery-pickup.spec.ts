import { test, expect, type Page } from '@playwright/test';
import { TEST_RESTAURANT } from './test-fixture';

/**
 * T3 (S1-S3) — browser-level coverage for the Domicilio / Recoger en el local
 * checkout. The implementation is already present (T2), so there is no RED
 * phase: these specs prove the shipped behavior instead of driving it.
 *
 * Nothing here reaches an external service:
 *  - POST /api/orders is intercepted and answered locally, so the payload is
 *    asserted without persisting an order against the live database.
 *  - Every https://wa.me navigation is intercepted and fulfilled with a stub,
 *    so the WhatsApp handoff URL/message is asserted with no real message sent.
 * The storefront itself is public: no credentials are used.
 */

/**
 * 2 × Hamburguesa Clásica ($12.000) = $24.000, above the $20.000 order minimum
 * seeded in database/02_seed.sql. The product is selected by name on purpose:
 * the catalog renders categories in display order, so the first card belongs to
 * "General" (Yuca Frita, $5.100) and 2× it would only reach $10.200, which is
 * below the minimum and keeps `Confirmar orden` disabled.
 */
const ITEMS = 2;
const PRODUCT_NAME = /Hamburguesa Clásica/i;
const SUBTOTAL = '$24.000';
const DELIVERY_FEE = '$5.000';
const DELIVERY_TOTAL = '$29.000';
const SERVER_ORDER_NUMBER = 987654;

const CUSTOMER = {
  nombre: 'Carlos Santana',
  telefono: '3101234567',
  dir: 'Calle 100 # 15-20',
  barrio: 'Chicó',
};

type OrderPayload = {
  orderType?: string;
  deliveryFee?: number;
  customer?: { name?: string; phone?: string; address?: string; barrio?: string };
  items?: unknown[];
  clientOrderId?: string;
};

interface Harness {
  /** Every POST /api/orders body observed by the browser. */
  payloads: OrderPayload[];
  /** The intercepted https://wa.me URL, once the checkout hands off. */
  whatsAppUrl: () => string | undefined;
}

/**
 * Installs the two network intercepts the assertions depend on. Both are
 * registered before the checkout is opened, so no real order is persisted and
 * no real WhatsApp navigation can escape.
 */
async function installHarness(page: Page): Promise<Harness> {
  const payloads: OrderPayload[] = [];
  let whatsAppUrl: string | undefined;

  await page.route('**/api/orders**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (request.method() !== 'POST' || !pathname.endsWith('/api/orders')) {
      // Order reads / streams are unrelated to this spec.
      await route.continue();
      return;
    }

    payloads.push((request.postDataJSON() ?? {}) as OrderPayload);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'srv-e2e-delivery-pickup',
        orderNumber: SERVER_ORDER_NUMBER,
        orderType: payloads[payloads.length - 1]?.orderType,
      }),
    });
  });

  await page.context().route('https://wa.me/**', async (route) => {
    whatsAppUrl = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html><head><title>WhatsApp interceptado</title></head><body><p>No message was sent.</p></body></html>',
    });
  });

  return { payloads, whatsAppUrl: () => whatsAppUrl };
}

/** Decodes the `text` query param of the intercepted wa.me handoff. */
function decodeWhatsAppMessage(url: string): string {
  return new URL(url).searchParams.get('text') ?? '';
}

async function addItemsToCart(page: Page, count = ITEMS) {
  await page.goto(`/${TEST_RESTAURANT.slug}`);
  const catalog = page.locator('#storefront-catalog');
  await expect(catalog).toBeVisible({ timeout: 15000 });

  for (let i = 0; i < count; i++) {
    const product = catalog.getByRole('button', { name: PRODUCT_NAME }).first();
    await expect(product).toBeVisible({ timeout: 10000 });
    await product.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await modal.getByRole('button', { name: /^Agregar ·/ }).click();
    await expect(modal).toBeHidden({ timeout: 10000 });
  }

  const cartButton = page.getByRole('button', { name: /Ver orden/i }).first();
  await expect(cartButton).toContainText(String(count), { timeout: 10000 });
}

async function openCart(page: Page) {
  const cartButton = page.getByRole('button', { name: /Ver orden/i }).first();
  await expect(cartButton).toBeVisible({ timeout: 10000 });
  await cartButton.click();
  await expect(page.getByRole('heading', { name: /Tu pedido/i })).toBeVisible({ timeout: 10000 });
}

async function openCheckout(page: Page) {
  // Guard the fixture contract: the cart must clear the restaurant minimum,
  // otherwise `Confirmar orden` stays disabled and no order path is exercised.
  await expect(page.getByText(/El pedido mínimo es de/i)).toBeHidden({ timeout: 10000 });
  const confirm = page.getByRole('button', { name: /Confirmar orden/i });
  await expect(confirm).toBeEnabled({ timeout: 10000 });
  await confirm.click();
  await expect(page.getByRole('heading', { name: /Finalizar pedido/i })).toBeVisible({
    timeout: 10000,
  });
}

async function fillContactDetails(page: Page) {
  await page.getByPlaceholder(/Tu nombre/i).fill(CUSTOMER.nombre);
  await page.getByPlaceholder(/3001234567/i).fill(CUSTOMER.telefono);
}

/** The checkout summary list, which carries the delivery/pickup fee line. */
function summary(page: Page) {
  return page.locator('#order-summary');
}

test.describe('Checkout: Domicilio and Recoger en el local (S1-S3)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('Domicilio stays the default, requires address and barrio, and still charges delivery', async ({
    page,
  }) => {
    const harness = await installHarness(page);

    await addItemsToCart(page);
    await openCart(page);
    await openCheckout(page);

    // Domicilio is pre-selected and the delivery inputs are visible.
    await expect(page.locator('#orderType-domicilio')).toBeChecked();
    await expect(page.locator('#orderType-recoger')).not.toBeChecked();
    await expect(page.locator('#dir')).toBeVisible();
    await expect(page.locator('#barrio')).toBeVisible();

    const deliverySummary = summary(page);
    await expect(deliverySummary).toContainText('Subtotal');
    await expect(deliverySummary).toContainText(SUBTOTAL);
    await expect(deliverySummary).toContainText('Domicilio / Envío');
    await expect(deliverySummary).toContainText(DELIVERY_FEE);
    await expect(deliverySummary).toContainText(DELIVERY_TOTAL);

    // Address and barrio are mandatory for delivery: an empty submit reports
    // both and never reaches the order endpoint.
    await fillContactDetails(page);
    await page.getByRole('button', { name: /Enviar pedido por WhatsApp/i }).click();
    await expect(page.getByText('La dirección es obligatoria.')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Indícanos tu barrio.')).toBeVisible({ timeout: 5000 });
    expect(harness.payloads).toHaveLength(0);

    // Completing them lets the delivery order through with delivery behavior.
    await page.getByPlaceholder(/Calle 123 #45-67/i).fill(CUSTOMER.dir);
    await page.getByPlaceholder(/Tu barrio/i).fill(CUSTOMER.barrio);
    await expect(page.getByText('La dirección es obligatoria.')).toBeHidden({ timeout: 5000 });

    // Armed before the click so the handoff tab can never be missed.
    const nextTab = page.context().waitForEvent('page');
    await page.getByRole('button', { name: /Enviar pedido por WhatsApp/i }).click();
    await expect(page.getByText(new RegExp(`Orden #${SERVER_ORDER_NUMBER} registrada`))).toBeVisible(
      { timeout: 10000 }
    );

    // 1. The order request keeps delivery semantics.
    expect(harness.payloads).toHaveLength(1);
    const payload = harness.payloads[0];
    expect(payload.orderType).toBe('domicilio');
    expect(payload.deliveryFee).toBe(5000);
    expect(payload.customer?.name).toBe(CUSTOMER.nombre);
    expect(payload.customer?.address).toBe(CUSTOMER.dir);
    expect(payload.customer?.barrio).toBe(CUSTOMER.barrio);
    expect(payload.items?.length).toBe(ITEMS);

    // 2. The WhatsApp handoff keeps the delivery wording and the fee.
    await expect.poll(() => harness.whatsAppUrl(), { timeout: 15000 }).toBeTruthy();
    const whatsAppMessage = decodeWhatsAppMessage(harness.whatsAppUrl()!);
    expect(harness.whatsAppUrl()!).toContain('https://wa.me/573001234567?text=');
    expect(whatsAppMessage).toContain(`Orden: #${SERVER_ORDER_NUMBER}`);
    expect(whatsAppMessage).toContain(`Dirección: ${CUSTOMER.dir}`);
    expect(whatsAppMessage).toContain(`Barrio: ${CUSTOMER.barrio}`);
    expect(whatsAppMessage).toContain(`Domicilio: ${DELIVERY_FEE}`);
    expect(whatsAppMessage).toContain(`*TOTAL: ${DELIVERY_TOTAL}*`);
    expect(whatsAppMessage).not.toContain('RECOGER EN EL LOCAL');

    // 3. The delivery handoff also opened a tab, and it was intercepted.
    const whatsAppTab = await nextTab;
    await expect(whatsAppTab).toHaveTitle('WhatsApp interceptado', { timeout: 15000 });
  });

  test('Recoger en el local hides delivery inputs, waives the fee, sends orderType recoger and a pickup-only WhatsApp message', async ({
    page,
  }) => {
    const harness = await installHarness(page);

    await addItemsToCart(page);
    await openCart(page);
    await openCheckout(page);

    // Start from the default delivery layout to prove the switch does the work.
    await expect(page.locator('#orderType-domicilio')).toBeChecked();
    await expect(page.locator('#dir')).toBeVisible();

    await page.getByText('Recoger en el local', { exact: true }).click();

    // Delivery inputs disappear, the pickup hint replaces them.
    await expect(page.getByText('Recoges tu pedido directamente en el local.')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator('#orderType-recoger')).toBeChecked();
    await expect(page.locator('#dir')).toHaveCount(0);
    await expect(page.locator('#barrio')).toHaveCount(0);

    // The total is fee-free: pickup row says Gratis, no delivery row, and the
    // summary total equals the subtotal.
    const pickupSummary = summary(page);
    await expect(pickupSummary).toContainText(SUBTOTAL);
    await expect(pickupSummary).toContainText('Retiro en local');
    await expect(pickupSummary).toContainText('Gratis');
    await expect(pickupSummary).not.toContainText('Domicilio / Envío');
    await expect(pickupSummary).not.toContainText(DELIVERY_FEE);

    // The selection is reversible: going back to Domicilio restores the fields
    // and the fee, and pickup again clears both.
    await page.getByText('Domicilio', { exact: true }).click();
    await expect(page.locator('#dir')).toBeVisible();
    await expect(summary(page)).toContainText('Domicilio / Envío');
    await page.getByText('Recoger en el local', { exact: true }).click();
    await expect(page.locator('#dir')).toHaveCount(0);
    await expect(summary(page)).not.toContainText('Domicilio / Envío');

    // No address/barrio is typed: pickup must submit without them.
    await fillContactDetails(page);
    // Armed before the click so the handoff tab can never be missed.
    const nextTab = page.context().waitForEvent('page');
    await page.getByRole('button', { name: /Enviar pedido por WhatsApp/i }).click();
    await expect(page.getByText(new RegExp(`Orden #${SERVER_ORDER_NUMBER} registrada`))).toBeVisible(
      { timeout: 10000 }
    );

    // 1. The order request is a first-class pickup order with no delivery fee.
    expect(harness.payloads).toHaveLength(1);
    const payload = harness.payloads[0];
    expect(payload.orderType).toBe('recoger');
    expect(payload.deliveryFee).toBe(0);
    expect(payload.customer?.name).toBe(CUSTOMER.nombre);
    expect(payload.customer?.address).toBe('');
    expect(payload.customer?.barrio).toBe('');
    expect(payload.items?.length).toBe(ITEMS);

    // 2. The WhatsApp handoff uses pickup wording only.
    await expect.poll(() => harness.whatsAppUrl(), { timeout: 15000 }).toBeTruthy();
    const whatsAppMessage = decodeWhatsAppMessage(harness.whatsAppUrl()!);
    expect(harness.whatsAppUrl()!).toContain('https://wa.me/573001234567?text=');
    expect(whatsAppMessage).toContain(`Orden: #${SERVER_ORDER_NUMBER}`);
    expect(whatsAppMessage).toContain('Modalidad: RECOGER EN EL LOCAL');
    expect(whatsAppMessage).toContain(`*TOTAL: ${SUBTOTAL}*`);
    expect(whatsAppMessage).not.toContain('Dirección:');
    expect(whatsAppMessage).not.toContain('Barrio:');
    expect(whatsAppMessage).not.toContain('Domicilio:');
    expect(whatsAppMessage).not.toContain(CUSTOMER.barrio);

    // 3. The handoff opened a tab, and it was intercepted (never real WhatsApp).
    const whatsAppTab = await nextTab;
    await expect(whatsAppTab).toHaveTitle('WhatsApp interceptado', { timeout: 15000 });
  });
});
