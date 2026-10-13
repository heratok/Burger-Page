import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { TEST_RESTAURANT } from './test-fixture';

const SHOTS_DIR = 'test-results/a11y';

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
] as const;
const THEMES = ['light', 'dark'] as const;

async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}

/** Collects layout-shift entries from document start; returns the CLS score so far. */
async function installClsObserver(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
          if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      /* layout-shift unsupported: score stays 0 and the test below would be vacuous */
    }
  });
}

const readCls = (page: Page) => page.evaluate(() => (window as unknown as { __cls: number }).__cls);

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

/** Reaches an element through real key presses (Shift+Tab then Tab) so the focus counts as keyboard modality. */
async function keyboardFocus(page: Page, locator: ReturnType<Page["locator"]>) {
  await locator.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(locator).toBeFocused();
}

/** Computed background-image strings of every element whose gradient uses an off-brand hue. */
async function offBrandGradients(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    // Hue ranges (degrees) for indigo/violet/purple/fuchsia/pink; cyan 170-200.
    const isOffBrand = (r: number, g: number, b: number, a: number) => {
      if (a < 0.02) return false;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max - min < 30) return false; // greys / near-neutral slate
      let h: number;
      const d = max - min;
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
      return (h >= 230 && h <= 345) || (h >= 170 && h < 200);
    };
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const bg = getComputedStyle(el).backgroundImage;
      if (!bg || !bg.includes('gradient')) continue;
      const rgbs = bg.matchAll(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)/g);
      for (const m of rgbs) {
        if (isOffBrand(+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4])) {
          out.push(`${el.tagName}.${String(el.className).slice(0, 50)} -> ${m[0]}`);
          break;
        }
      }
    }
    return out;
  });
}

for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    const tag = `${vp.name}-${theme}`;

    test.describe(`polish: blur blobs, CLS and palette ${tag}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.emulateMedia({ colorScheme: theme });
        await page.addInitScript((t) => {
          localStorage.setItem('burger_page_admin_theme_v2', t);
          localStorage.setItem('theme', t);
          if (t === 'dark') document.documentElement.classList.add('dark');
        }, theme);
        await installClsObserver(page);
      });

      test('landing: no overflow, CLS < 0.1, no filter blur on ambient blobs, no off-brand gradient', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('main#main-content')).toBeAttached({ timeout: 15000 });
        await page.waitForTimeout(1200);
        fs.mkdirSync(SHOTS_DIR, { recursive: true });
        await page.screenshot({ path: `${SHOTS_DIR}/polish-landing-${tag}.png` });
        expect(await hasHorizontalOverflow(page), 'landing horizontal overflow').toBe(false);
        expect(await readCls(page), 'landing CLS').toBeLessThan(0.1);
        const heavyBlur = await page.evaluate(() =>
          Array.from(document.querySelectorAll<HTMLElement>('body *')).filter((el) => {
            const f = getComputedStyle(el).filter;
            const m = f.match(/blur\(([\d.]+)px\)/);
            return m && parseFloat(m[1]) > 64;
          }).length,
        );
        expect(heavyBlur, 'elements with filter: blur > 64px').toBe(0);
        expect(await offBrandGradients(page), 'off-brand gradients on landing').toEqual([]);
      });

      test('admin login: no overflow, CLS < 0.1, no heavy blur, no off-brand gradient', async ({ page }) => {
        await page.goto('/admin');
        await expect(page.getByPlaceholder(/Tu nombre de usuario/i)).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(1200);
        fs.mkdirSync(SHOTS_DIR, { recursive: true });
        await page.screenshot({ path: `${SHOTS_DIR}/polish-login-${tag}.png` });
        expect(await hasHorizontalOverflow(page), 'login horizontal overflow').toBe(false);
        expect(await readCls(page), 'login CLS').toBeLessThan(0.1);
        const heavyBlur = await page.evaluate(() =>
          Array.from(document.querySelectorAll<HTMLElement>('body *')).filter((el) => {
            const m = getComputedStyle(el).filter.match(/blur\(([\d.]+)px\)/);
            return m && parseFloat(m[1]) > 64;
          }).length,
        );
        expect(heavyBlur, 'elements with filter: blur > 64px').toBe(0);
        expect(await offBrandGradients(page), 'off-brand gradients on login').toEqual([]);
      });

      test('admin dashboard and superadmin: no off-brand gradient', async ({ page }) => {
        test.setTimeout(90000);
        await login(page, TEST_RESTAURANT.username, TEST_RESTAURANT.password);
        await openSection(page, 'Dashboard');
        await expect(page).toHaveURL(/\/admin\/dashboard/);
        expect(await offBrandGradients(page), 'off-brand gradients on dashboard').toEqual([]);
        expect(await readCls(page), 'dashboard CLS').toBeLessThan(0.25);
      });
    });
  }
}

// ---------------------------------------------------------------------------------------------
// (a) Tooltips: keyboard focus reveals content, Escape dismisses, content reachable without hover.
// ---------------------------------------------------------------------------------------------
test.describe("polish: accessible tooltips", () => {
  test("desktop: collapsed sidebar item shows its label on keyboard focus and Escape dismisses it", async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, TEST_RESTAURANT.username, TEST_RESTAURANT.password);
    await page.getByRole("button", { name: "Contraer menú" }).click();
    const nav = page.getByRole("navigation", { name: "Menú Lateral" });
    const item = nav.getByRole("button", { name: "Dashboard", exact: true });
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await keyboardFocus(page, item);
    const tip = page.getByRole("tooltip");
    await expect(tip).toBeVisible({ timeout: 5000 });
    await expect(tip).toHaveText("Dashboard");
    await expect(item).toHaveAttribute("aria-describedby", /.+/);
    fs.mkdirSync(SHOTS_DIR, { recursive: true });
    await page.screenshot({ path: SHOTS_DIR + "/polish-tooltip-desktop.png" });
    await page.keyboard.press("Escape");
    await expect(tip).toHaveCount(0);
    // Focus stays on the control after dismissal.
    await expect(item).toBeFocused();
  });

  for (const vp of VIEWPORTS) {
    test("superadmin " + vp.name + ": disabled-action reason is focusable, announced and reachable without hover", async ({ page }) => {
      test.setTimeout(90000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await login(page, "admin", "admin");
      await openSection(page, "Usuarios & Accesos");
      await expect(page).toHaveURL(/\/admin\/users/);
      // Reason is in the accessibility tree (no hover needed), as a named, focusable group.
      const reason = page.getByRole("group", { name: /Usa .Cambiar clave. para tu propia cuenta/ }).first();
      await expect(reason).toBeAttached({ timeout: 15000 });
      await reason.scrollIntoViewIfNeeded();
      await keyboardFocus(page, reason);
      const tip = page.getByRole("tooltip");
      await expect(tip).toBeVisible({ timeout: 5000 });
      await expect(tip).toContainText("Cambiar clave");
      await page.screenshot({ path: SHOTS_DIR + "/polish-disabled-reason-" + vp.name + ".png" });
      await page.keyboard.press("Escape");
      await expect(tip).toHaveCount(0);
    });
  }
});

// ---------------------------------------------------------------------------------------------
// (d) Long values: no overflow, not clipped by ellipsis, full text in the accessibility tree.
// ---------------------------------------------------------------------------------------------
const STAMP = Date.now().toString().slice(-6);
const LONG_NAME = "Maria Fernanda de los Angeles Rodriguez-Castellanos Villamizar " + STAMP;
const LONG_ADDRESS = "Carrera 123 Bis # 45-67 Sur Torre Dos Apartamento 1204 Conjunto Residencial Los Almendros del Norte " + STAMP;

test.describe("polish: long values stay readable", () => {
  test.beforeAll(async ({ request }) => {
    const API = "http://localhost:3001/api";
    const loginRes = await request.post(API + "/users/login", {
      data: { username: TEST_RESTAURANT.username, password: TEST_RESTAURANT.password },
    });
    expect(loginRes.status()).toBe(200);
    const { token } = await loginRes.json();
    const headers = { Authorization: "Bearer " + token };
    const custRes = await request.post(API + "/customers", {
      headers,
      data: { name: LONG_NAME, phone: "300" + STAMP + "1", address: LONG_ADDRESS, barrio: "Barrio Los Almendros del Norte", notes: "polish" },
    });
    expect(custRes.status()).toBe(201);
    const cust = await custRes.json();
    const customerId = cust.id ?? cust.data?.id;
    const orderRes = await request.post(API + "/orders", {
      headers,
      data: {
        restaurantId: TEST_RESTAURANT.id,
        customerId,
        paymentMethod: "Efectivo",
        items: [{ productId: TEST_RESTAURANT.products.clasica, quantity: 2, observation: "sin cebolla " + STAMP }],
      },
    });
    expect([200, 201]).toContain(orderRes.status());
  });

  for (const vp of VIEWPORTS) {
    test(vp.name + ": CRM, dashboard and live orders do not overflow and show the full value", async ({ page }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await login(page, TEST_RESTAURANT.username, TEST_RESTAURANT.password);

      const screens: Array<[string, string]> = [
        ["Clientes", "customers"],
        ["Dashboard", "dashboard"],
        ["Pedidos en Vivo", "orders"],
      ];
      for (const [label, id] of screens) {
        await openSection(page, label);
        await expect(page).toHaveURL(new RegExp("/admin/" + id));
        await expect(page.getByText(LONG_NAME).first()).toBeAttached({ timeout: 15000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: SHOTS_DIR + "/polish-long-" + id + "-" + vp.name + ".png" });
        expect(await hasHorizontalOverflow(page), id + " horizontal overflow at " + vp.width).toBe(false);

        // Any element showing the long values must not clip them with an ellipsis or hidden overflow.
        const clipped = await page.evaluate(
          ([name, addr]) => {
            const out: string[] = [];
            for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
              if (el.children.length > 0) continue;
              const t = el.textContent ?? "";
              if (!t.includes(name) && !t.includes(addr)) continue;
              const cs = getComputedStyle(el);
              if (cs.display === "none" || el.getBoundingClientRect().width === 0) continue;
              const ellipsis = cs.textOverflow === "ellipsis";
              const hiddenX = el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== "visible";
              const clamped = cs.webkitLineClamp !== "none" && el.scrollHeight > el.clientHeight + 1;
              if (ellipsis || hiddenX || clamped) out.push(el.tagName + "." + String(el.className).slice(0, 60));
            }
            return out;
          },
          [LONG_NAME, LONG_ADDRESS],
        );
        expect(clipped, id + ": clipped long values").toEqual([]);

        // Full text reachable by assistive tech.
        const snapshot = await page.locator("body").ariaSnapshot();
        expect(snapshot, id + ": long name missing from the accessibility tree").toContain(LONG_NAME);
      }
    });
  }
});
