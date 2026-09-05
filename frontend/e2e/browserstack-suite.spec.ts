/**
 * Burger-Page — Comprehensive BrowserStack suite.
 *
 * Covers: public landing, tenant storefront (menu + cart + WhatsApp checkout),
 * super admin SaaS modules, restaurant admin operational modules, mobile drawer
 * navigation, responsive overflow checks, and console-error hygiene.
 *
 * Credentials are read from environment variables so no secrets are committed:
 *   TEST_SUPER_USER / TEST_SUPER_PASS   (super admin)
 *   TEST_RESTO_USER  / TEST_RESTO_PASS  (restaurant admin)
 */
import { test as base, expect, type Browser, type Page } from '@playwright/test';

/**
 * Per-test BrowserStack page fixture.
 * Reads platform capabilities from the active project (bstackCaps) and opens a
 * fresh cloud browser per test, guaranteeing one context per session and clean
 * isolation after failures. Falls back to a local Chromium launch when the
 * project has no bstackCaps (plain local runs).
 */
const test = base.extend<{ bstackCaps: Record<string, string> | undefined; page: Page }>({
  bstackCaps: [undefined, { option: true }],
  page: async ({ bstackCaps }, use, testInfo) => {
    const { chromium, firefox, webkit } = await import('@playwright/test');
    const projectUse = testInfo.project.use as Record<string, unknown>;

    let browser: Browser;
    if (!bstackCaps) {
      browser = await chromium.launch();
    } else {
      const caps = { ...bstackCaps, name: `${bstackCaps.name} — ${testInfo.title}` };
      const wsEndpoint = `wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify(caps))}`;
      const browserType = bstackCaps.browser.includes('firefox')
        ? firefox
        : bstackCaps.browser.includes('webkit')
          ? webkit
          : chromium;
      browser = await browserType.connect(wsEndpoint, { timeout: 120_000 });
    }

    const context = await browser.newContext({
      baseURL: (projectUse.baseURL as string) ?? 'http://localhost:5173',
      viewport: (projectUse.viewport as { width: number; height: number } | undefined) ?? undefined,
    });
    const page = await context.newPage();
    await use(page);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  },
});

test.setTimeout(180_000);

const SUPER_USER = process.env.TEST_SUPER_USER;
const SUPER_PASS = process.env.TEST_SUPER_PASS;
const RESTO_USER = process.env.TEST_RESTO_USER;
const RESTO_PASS = process.env.TEST_RESTO_PASS;
const TENANT_SLUG = process.env.TEST_TENANT_SLUG ?? 'rosto';

test.beforeAll(() => {
  if (!SUPER_USER || !SUPER_PASS || !RESTO_USER || !RESTO_PASS) {
    throw new Error(
      'Missing test credentials. Set TEST_SUPER_USER, TEST_SUPER_PASS, TEST_RESTO_USER, TEST_RESTO_PASS env vars.'
    );
  }
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
});

// ---------- helpers ----------

async function loginAs(page: Page, username: string, password: string) {
  await page.goto('/admin');
  const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
  await expect(userInput).toBeVisible({ timeout: 30_000 });
  await userInput.fill(username);
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.fill(password);
  await page.getByRole('button', { name: /Acceder al Panel/i }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - window.innerWidth;
  });
  expect(overflow, `horizontal overflow of ${overflow}px detected`).toBeLessThanOrEqual(2);
}

async function shot(page: Page, testInfo: import('@playwright/test').TestInfo, step: string) {
  const dir = `e2e/screenshots/browserstack/${testInfo.project.name}/${testInfo.title.replace(/[^\w]+/g, '-')}`;
  await page.screenshot({ path: `${dir}/${step}.png`, fullPage: true }).catch(() => undefined);
}

function isMobileViewport(page: Page): Promise<boolean> {
  return page.evaluate(() => window.innerWidth < 768);
}

const RESTAURANT_MODULES: Array<[string, RegExp]> = [
  ['Dashboard', /\/admin\/dashboard/],
  ['Pedidos en Vivo', /\/admin\/orders/],
  ['Menú & Carta', /\/admin\/menu/],
  ['Stock & Insumos', /\/admin\/inventory/],
  ['Clientes CRM', /\/admin\/customers/],
  ['Reportes & Cierre', /\/admin\/reports/],
  ['Personalizar', /\/admin\/customizer/],
];

test.describe('BrowserStack Suite', () => {
// ---------- 1. Public landing ----------

async function openSidebarAndClick(page: Page, label: string) {
  const mobile = await isMobileViewport(page);
  if (mobile) {
    const openMenu = page.getByRole('button', { name: /Abrir menú/i });
    if (await openMenu.isVisible().catch(() => false)) await openMenu.click();
    await page.waitForTimeout(300);
  }
  const sidebar = page.locator('aside[aria-label="Sidebar de navegación"]').first();
  const target = sidebar.getByRole('button', { name: new RegExp(label, 'i') });
  await expect(target).toBeVisible({ timeout: 15_000 });
  await target.click();
}

// ---------- 1. Public landing ----------

test('Landing page renders, is responsive and links to tenants', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 30_000 });
  await expectNoHorizontalOverflow(page);

  const hasLandingText = await page
    .getByText(/Gestión Centralizada|Restaurantes Demo|FoodOS/i)
    .first()
    .isVisible()
    .catch(() => false);

  expect(hasLandingText).toBeTruthy();
  await shot(page, testInfo, 'landing');
});

// ---------- 2. Tenant storefront ----------

test('Tenant storefront loads with branding and menu', async ({ page }, testInfo) => {
  await page.goto(`/${TENANT_SLUG}`);

  // Storefront renders: cart trigger is the navbar signal (header/banner landmark, not <nav>)
  const cartTrigger = page.getByRole('button', { name: /Ver orden/i }).first();
  await expect(cartTrigger).toBeVisible({ timeout: 30_000 });
  await expectNoHorizontalOverflow(page);

  // Menu area renders (search UI or product list)
  const searchOrList = page.getByRole('searchbox').first();
  await expect(searchOrList).toBeVisible({ timeout: 30_000 });
  await shot(page, testInfo, 'storefront');
});

test('Storefront cart and WhatsApp checkout flow', async ({ page }, testInfo) => {
  await page.goto(`/${TENANT_SLUG}`);
  await expect(page.getByRole('button', { name: /Ver orden/i }).first()).toBeVisible({ timeout: 30_000 });

  const addButtons = page.locator('[role="button"][aria-label^="Agregar "]');
  await addButtons.first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => undefined);
  const addButton = addButtons.first();
  const productCount = await addButtons.count();

  if (productCount === 0) {
    await expectNoHorizontalOverflow(page);
    await shot(page, testInfo, 'storefront-empty');
    test.skip(true, 'Tenant has no products to add to cart on this platform');
    return;
  }

  // Add first product to cart: opens the product modal (quantity/observations), confirm there
  await addButton.click();
  const dialogConfirm = page.getByRole('button', { name: /^Agregar ·/ }).first();
  if (await dialogConfirm.isVisible().catch(() => false)) {
    await dialogConfirm.click();
  }

  // Toast confirmation ("agregada al carrito")
  const toast = page.locator('[data-sonner-toast]').first();
  await expect(toast).toBeVisible({ timeout: 15_000 });

  // Open cart from navbar
  await page.getByRole('button', { name: /Ver orden/i }).first().click();

  // Checkout button visible => cart has content
  const checkoutBtn = page.getByRole('button', { name: /Confirmar orden/i }).first();
  await expect(checkoutBtn).toBeVisible({ timeout: 15_000 });
  await shot(page, testInfo, 'cart');

  // Proceed to checkout form
  await checkoutBtn.click();
  const submitSale = page.getByRole('button', { name: /Registrar venta/i });
  await expect(submitSale).toBeVisible({ timeout: 15_000 });
  await shot(page, testInfo, 'checkout');

  // Fill customer info and submit (registers the order in the system)
  const nombre = page.getByPlaceholder(/Tu nombre/i).first();
  if (await nombre.isVisible().catch(() => false)) {
    await nombre.fill('QA BrowserStack');
    const telefono = page.getByPlaceholder(/3001234567/i).first();
    if (await telefono.isVisible().catch(() => false)) await telefono.fill('3001234567');
    const direccion = page.getByPlaceholder(/Calle 123/i).first();
    if (await direccion.isVisible().catch(() => false)) await direccion.fill('Calle QA 123 #45-67');
    const barrio = page.getByPlaceholder(/Tu barrio/i).first();
    if (await barrio.isVisible().catch(() => false)) await barrio.fill('Centro');
    await submitSale.click();
    await page.waitForTimeout(4000);
    await shot(page, testInfo, 'order-submitted');
  }
});

// ---------- 3. Super admin ----------

test('Super admin: login, SaaS modules (Restaurantes, Usuarios, Métricas)', async ({ page }, testInfo) => {
  await loginAs(page, SUPER_USER!, SUPER_PASS!);

  // Lands on global SaaS directory
  await expect(page).toHaveURL(/\/admin\/restaurants/, { timeout: 30_000 });
  await expect(page.getByRole('button', { name: /Nuevo Restaurante/i })).toBeVisible();
  await expect(page.getByText(/Super Admin/i).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, testInfo, 'restaurants');

  // Usuarios & Accesos
  await page.getByRole('button', { name: /Usuarios & Accesos/i }).click();
  await expect(page).toHaveURL(/\/admin\/users/);
  await expect(page.getByText(/Directorio Global de Usuarios/i)).toBeVisible();
  await shot(page, testInfo, 'users');

  // Métricas Globales
  await page.getByRole('button', { name: /Métricas Globales/i }).click();
  await expect(page).toHaveURL(/\/admin\/metrics/);
  await expect(page.getByText(/Métricas & Rendimiento Global/i)).toBeVisible();
  await shot(page, testInfo, 'metrics');

  // Back to Restaurantes
  await page.getByRole('button', { name: /Restaurantes/i }).click();
  await expect(page).toHaveURL(/\/admin\/restaurants/);
});

// ---------- 4. Restaurant admin ----------

test('Restaurant admin: login, dashboard and all operational modules', async ({ page }, testInfo) => {
  await loginAs(page, RESTO_USER!, RESTO_PASS!);

  // Lands on dashboard
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 30_000 });
  await expect(page.getByRole('button', { name: /Nueva Venta/i }).first()).toBeVisible({ timeout: 30_000 });
  await expectNoHorizontalOverflow(page);
  await shot(page, testInfo, 'dashboard');

  for (const [label, urlPattern] of RESTAURANT_MODULES) {
    await openSidebarAndClick(page, label);
    await expect(page).toHaveURL(urlPattern, { timeout: 20_000 });
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);
    await shot(page, testInfo, label.replace(/[^\w]+/g, '-'));
  }
});

test('Restaurant admin: storefront bridge (Ver Tienda) opens the tenant store', async ({ page }, testInfo) => {
  await loginAs(page, RESTO_USER!, RESTO_PASS!);
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 30_000 });

  await openSidebarAndClick(page, 'Ver Tienda');
  // Expected: the storefront of the tenant bound to this admin (rosto)
  await expect(page).toHaveURL(new RegExp(`/${TENANT_SLUG}`), { timeout: 20_000 });
  await expect(page.getByRole('button', { name: /Ver orden/i }).first()).toBeVisible({ timeout: 20_000 });
  await shot(page, testInfo, 'storefront-from-admin');
});

// ---------- 5. Mobile drawer (runs only on narrow viewports) ----------

test('Mobile: admin drawer shows all nav items and footer actions within viewport', async ({ page }, testInfo) => {
  const mobile = await isMobileViewport(page);
  test.skip(!mobile, 'Drawer test only applies to narrow viewports');

  await loginAs(page, RESTO_USER!, RESTO_PASS!);
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 30_000 });

  const openMenuBtn = page.getByRole('button', { name: /Abrir menú/i });
  await expect(openMenuBtn).toBeVisible();
  await openMenuBtn.click();
  await page.waitForTimeout(400);

  const sidebar = page.locator('aside[aria-label="Sidebar de navegación"]');
  await expect(sidebar).toBeVisible();

  // All operational modules reachable in the drawer
  for (const [label] of RESTAURANT_MODULES) {
    await expect(sidebar.getByRole('button', { name: new RegExp(label, 'i') })).toBeVisible();
  }

  // Footer actions fully inside viewport
  const verTiendaBtn = sidebar.getByRole('button', { name: /Ver Tienda/i });
  const logoutBtn = sidebar.getByRole('button', { name: /Cerrar Sesión/i });
  await expect(verTiendaBtn).toBeVisible();
  await expect(logoutBtn).toBeVisible();

  const viewportHeight = await page.evaluate(() => window.innerHeight);
  for (const btn of [verTiendaBtn, logoutBtn]) {
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    if (box) expect(box.y + box.height).toBeLessThanOrEqual(viewportHeight + 1);
  }

  await shot(page, testInfo, 'mobile-drawer');
});

// ---------- 6. Console-error hygiene ----------

test('Key pages load without JS errors or unexpected console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const apiFailures: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('/api/') && res.status() >= 400) {
      apiFailures.push(`${res.status()} ${url}`);
    }
  });

  const routes = ['/', `/${TENANT_SLUG}`, '/admin'];
  for (const route of routes) {
    await page.goto(route);
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).toBeVisible();
  }

  // Expected noise: browsers log network 401/404 as console errors, and the Vite
  // dev server HMR client can emit websocket/sendError noise through the cloud
  // tunnel. Capture those as evidence; assert no OTHER console errors and no JS exceptions.
  const realConsoleErrors = consoleErrors.filter(
    (e) =>
      !/Failed to load resource.*(401|404)/i.test(e) &&
      !/vite|websocket|sendeerror|@vite\/client/i.test(e)
  );
  console.log('API failures captured:', JSON.stringify(apiFailures, null, 2));

  expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  expect(realConsoleErrors, `console errors: ${realConsoleErrors.join(' | ')}`).toEqual([]);
});
});