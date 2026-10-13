import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { TEST_RESTAURANT } from './test-fixture';

const SHOTS_DIR = 'test-results/a11y';
const MIN_FONT_PX = 12;

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
] as const;
const THEMES = ['light', 'dark'] as const;

type Offender = { text: string; fontSize: number; tag: string; cls: string };

/** Visible text nodes whose computed font size is below the readability floor. */
async function findTinyText(page: Page): Promise<Offender[]> {
  return page.evaluate((min) => {
    const found: { text: string; fontSize: number; tag: string; cls: string }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      const el = node.parentElement;
      if (!text || !el) continue;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'OPTION'].includes(el.tagName)) continue;
      if (el.closest('.sr-only, [hidden], [aria-hidden="true"]')) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) continue;
      const size = parseFloat(style.fontSize);
      if (size < min) {
        found.push({ text: text.slice(0, 40), fontSize: size, tag: el.tagName, cls: String(el.className).slice(0, 80) });
      }
    }
    return found;
  }, MIN_FONT_PX);
}

async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}

async function audit(page: Page, label: string, tag: string) {
  await page.waitForTimeout(400);
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: `${SHOTS_DIR}/${tag}-${label}.png` });
  expect(await findTinyText(page), `${label}: text below ${MIN_FONT_PX}px`).toEqual([]);
  expect(await hasHorizontalOverflow(page), `${label}: horizontal page overflow`).toBe(false);
}

async function login(page: Page, username: string, password: string) {
  await page.goto('/admin');
  const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
  await expect(userInput).toBeVisible({ timeout: 15000 });
  await userInput.fill(username);
  await page.locator('input[type="password"]').fill(password);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/users/login') && r.status() === 200),
    page.getByRole('button', { name: /Acceder al Panel/i }).click(),
  ]);
  await expect(page.getByRole('navigation', { name: 'Menú Lateral' })).toBeAttached({ timeout: 15000 });
}

async function openSection(page: Page, label: string) {
  const isMobile = (page.viewportSize()?.width ?? 1280) < 1024;
  if (isMobile) {
    const toggle = page.locator('button[aria-label="Abrir menú"]');
    if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) await toggle.click();
  }
  const item = page.getByRole('navigation', { name: 'Menú Lateral' }).getByRole('button', { name: label, exact: true });
  await expect(item).toBeVisible({ timeout: 10000 });
  await item.click({ timeout: 10000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

const RESTAURANT_SECTIONS: Array<[string, string]> = [
  ['Dashboard', 'dashboard'],
  ['Mesas & QR', 'tables'],
  ['Menú & Carta', 'menu'],
  ['Stock & Insumos', 'inventory'],
  ['Clientes', 'customers'],
  ['Reportes & Cierre', 'reports'],
  ['Equipo', 'equipo'],
  ['Roles', 'roles'],
  ['Personalizar', 'customizer'],
  ['Ajustes de Negocio', 'settings'],
];

const SUPERADMIN_SECTIONS: Array<[string, string]> = [
  ['Restaurantes', 'restaurants'],
  ['Usuarios & Accesos', 'users'],
  ['Métricas Globales', 'metrics'],
  ['Auditoría', 'audit'],
];

for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    const tag = `${vp.name}-${theme}`;

    test.describe(`typography floor ${tag}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.emulateMedia({ colorScheme: theme });
        await page.addInitScript((t) => {
          localStorage.setItem('burger_page_admin_theme_v2', t);
          if (t === 'dark') document.documentElement.classList.add('dark');
        }, theme);
      });

      test('storefront', async ({ page }) => {
        await page.goto(`/${TEST_RESTAURANT.slug}`);
        await expect(page.locator('body')).toContainText(/Tienda de Pruebas|Cl[aá]sica/i, { timeout: 15000 });
        await audit(page, 'storefront', tag);
      });

      test('restaurant admin screens', async ({ page }) => {
        test.setTimeout(150000);
        await login(page, TEST_RESTAURANT.username, TEST_RESTAURANT.password);

        await openSection(page, 'Pedidos en Vivo');
        await expect(page).toHaveURL(/\/admin\/orders/);
        await expect(page.getByRole('button', { name: /Nueva Venta/i }).first()).toBeVisible({ timeout: 15000 });
        await audit(page, 'orders', tag);

        await page.getByRole('button', { name: /Nueva Venta/i }).first().click();
        await expect(page.getByText(/Punto de Venta/i).first()).toBeVisible({ timeout: 10000 });
        await audit(page, 'manual-sale', tag);
        await page.getByRole('button', { name: 'Cerrar modal' }).first().click({ timeout: 5000 });
        await expect(page.getByText(/Punto de Venta/i).first()).toBeHidden({ timeout: 5000 });

        for (const [label, id] of RESTAURANT_SECTIONS) {
          await openSection(page, label);
          await expect(page).toHaveURL(new RegExp(`/admin/${id}`));
          await audit(page, id, tag);
        }
      });

      test('superadmin directories', async ({ page }) => {
        test.setTimeout(120000);
        await login(page, 'admin', 'admin');
        for (const [label, id] of SUPERADMIN_SECTIONS) {
          await openSection(page, label);
          await expect(page).toHaveURL(new RegExp(`/admin/${id}`));
          await audit(page, `super-${id}`, tag);
        }
      });
    });
  }
}
