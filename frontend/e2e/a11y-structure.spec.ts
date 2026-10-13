import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { TEST_RESTAURANT } from "./test-fixture";

const SHOTS_DIR = "test-results/a11y";

const RUNS = [
  { name: "desktop-light", width: 1280, height: 800, theme: "light" },
  { name: "mobile-light", width: 390, height: 844, theme: "light" },
  { name: "desktop-dark", width: 1280, height: 800, theme: "dark" },
] as const;

/**
 * Structural WCAG rules asserted to have zero violations. color-contrast is excluded because
 * a11y-contrast.spec.ts already owns it.
 */
const ENFORCED = [
  /^label$/,
  /^button-name$/,
  /^link-name$/,
  /^select-name$/,
  /^input-image-alt$/,
  /^image-alt$/,
  /^bypass$/,
  /^landmark-one-main$/,
  /^region$/,
  /^aria-/,
  /^duplicate-id/,
  /^heading-order$/,
  /^page-has-heading-one$/,
  /^landmark-/,
  /^form-field-multiple-labels$/,
  /^nested-interactive$/,
  /^scrollable-region-focusable$/,
];

const isEnforced = (id: string) => ENFORCED.some((re) => re.test(id));

async function audit(page: Page, label: string, tag: string) {
  await page.waitForTimeout(500);
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: `${SHOTS_DIR}/structure-${tag}-${label}.png` });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .disableRules(["color-contrast"])
    .analyze();
  const enforced: string[] = [];
  const reported: string[] = [];
  for (const v of results.violations) {
    for (const n of v.nodes) {
      const line = `[${v.id}] ${n.target.join(" ")} :: ${n.html.slice(0, 140).replace(/\s+/g, " ")}`;
      (isEnforced(v.id) ? enforced : reported).push(line);
    }
  }
  fs.appendFileSync(
    `${SHOTS_DIR}/structure-report.jsonl`,
    `${JSON.stringify({ tag, label, enforced, reported })}\n`,
  );
  expect.soft(enforced, `${label} (${tag}): structural a11y violations`).toEqual([]);
}

async function login(page: Page, username: string, password: string) {
  await page.goto("/admin");
  const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
  await expect(userInput).toBeVisible({ timeout: 15000 });
  await userInput.fill(username);
  await page.locator('input[type="password"]').fill(password);
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/users/login") && r.status() === 200,
    ),
    page.getByRole("button", { name: /Acceder al Panel/i }).click(),
  ]);
  await expect(
    page.getByRole("navigation", { name: "Menú Lateral" }),
  ).toBeAttached({ timeout: 15000 });
}

async function openSection(page: Page, label: string) {
  const isMobile = (page.viewportSize()?.width ?? 1280) < 1024;
  if (isMobile) {
    const toggle = page.locator('button[aria-label="Abrir menú"]');
    if (await toggle.isVisible({ timeout: 2000 }).catch(() => false))
      await toggle.click();
  }
  const item = page
    .getByRole("navigation", { name: "Menú Lateral" })
    .getByRole("button", { name: label, exact: true });
  await expect(item).toBeVisible({ timeout: 10000 });
  await item.click({ timeout: 10000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

const RESTAURANT_SECTIONS: Array<[string, string]> = [
  ["Dashboard", "dashboard"],
  ["Mesas & QR", "tables"],
  ["Menú & Carta", "menu"],
  ["Stock & Insumos", "inventory"],
  ["Clientes", "customers"],
  ["Reportes & Cierre", "reports"],
  ["Equipo", "equipo"],
  ["Roles", "roles"],
  ["Personalizar", "customizer"],
  ["Ajustes de Negocio", "settings"],
];

const SUPERADMIN_SECTIONS: Array<[string, string]> = [
  ["Restaurantes", "restaurants"],
  ["Usuarios & Accesos", "users"],
  ["Métricas Globales", "metrics"],
  ["Auditoría", "audit"],
];

for (const run of RUNS) {
  const tag = run.name;

  test.describe(`structure ${tag}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: run.width, height: run.height });
      await page.emulateMedia({ colorScheme: run.theme });
      await page.addInitScript((t) => {
        localStorage.setItem("burger_page_admin_theme_v2", t);
        if (t === "dark") document.documentElement.classList.add("dark");
      }, run.theme);
    });

    test("storefront", async ({ page }) => {
      await page.goto(`/${TEST_RESTAURANT.slug}`);
      await expect(page.locator("body")).toContainText(
        /Tienda de Pruebas|Cl[aá]sica/i,
        { timeout: 15000 },
      );
      await audit(page, "storefront", tag);
    });

    test("restaurant admin screens", async ({ page }) => {
      test.setTimeout(180000);
      await login(page, TEST_RESTAURANT.username, TEST_RESTAURANT.password);

      await openSection(page, "Pedidos en Vivo");
      await expect(page).toHaveURL(/\/admin\/orders/);
      await expect(
        page.getByRole("button", { name: /Nueva Venta/i }).first(),
      ).toBeVisible({ timeout: 15000 });
      await audit(page, "orders", tag);

      await page.getByRole("button", { name: /Nueva Venta/i }).first().click();
      await expect(page.getByText(/Punto de Venta/i).first()).toBeVisible({
        timeout: 10000,
      });
      await audit(page, "manual-sale", tag);
      await page
        .getByRole("button", { name: "Cerrar modal" })
        .first()
        .click({ timeout: 5000 });
      await expect(page.getByText(/Punto de Venta/i).first()).toBeHidden({
        timeout: 5000,
      });

      for (const [label, id] of RESTAURANT_SECTIONS) {
        await openSection(page, label);
        await expect(page).toHaveURL(new RegExp(`/admin/${id}`));
        await audit(page, id, tag);
      }
    });

    test("superadmin directories", async ({ page }) => {
      test.setTimeout(150000);
      await login(page, "admin", "admin");
      for (const [label, id] of SUPERADMIN_SECTIONS) {
        await openSection(page, label);
        await expect(page).toHaveURL(new RegExp(`/admin/${id}`));
        await audit(page, `super-${id}`, tag);
      }
      // Form modal: create user (labels, role picker, close button).
      await openSection(page, "Usuarios & Accesos");
      const create = page.getByRole("button", { name: /Nuevo Usuario|Crear Usuario|Crear Acceso/i }).first();
      if (await create.isVisible({ timeout: 3000 }).catch(() => false)) {
        await create.click();
        await expect(page.getByLabel(/Nombre de Usuario/i)).toBeVisible({ timeout: 5000 });
        await audit(page, "super-create-user-modal", tag);
      }
    });
  });
}

test.describe("skip link keyboard behavior", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  async function assertSkipLinkFlow(page: Page, shot: string) {
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    const box = await skip.boundingBox();
    const vp = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height);
    fs.mkdirSync(SHOTS_DIR, { recursive: true });
    await page.screenshot({ path: `${SHOTS_DIR}/structure-skiplink-${shot}.png` });

    await page.keyboard.press("Enter");
    const landed = await page.evaluate(() => {
      const main = document.getElementById("main-content");
      const active = document.activeElement;
      return {
        hasMain: !!main,
        inMain: !!main && !!active && (active === main || main.contains(active)),
        mainCount: document.querySelectorAll("main").length,
      };
    });
    expect(landed.hasMain).toBe(true);
    expect(landed.mainCount).toBe(1);
    expect(landed.inMain).toBe(true);
  }

  test("storefront: first Tab shows the skip link and Enter moves focus into main", async ({ page }) => {
    await page.goto(`/${TEST_RESTAURANT.slug}`);
    await expect(page.locator("body")).toContainText(
      /Tienda de Pruebas|Cl[aá]sica/i,
      { timeout: 15000 },
    );
    await assertSkipLinkFlow(page, "storefront");
  });

  test("restaurant admin: first Tab shows the skip link and Enter moves focus into main", async ({ page }) => {
    await login(page, TEST_RESTAURANT.username, TEST_RESTAURANT.password);
    await page.reload();
    await expect(
      page.getByRole("navigation", { name: "Menú Lateral" }),
    ).toBeAttached({ timeout: 15000 });
    await assertSkipLinkFlow(page, "admin");
  });

  test("superadmin: first Tab shows the skip link and Enter moves focus into main", async ({ page }) => {
    await login(page, "admin", "admin");
    await page.reload();
    await expect(
      page.getByRole("navigation", { name: "Menú Lateral" }),
    ).toBeAttached({ timeout: 15000 });
    await assertSkipLinkFlow(page, "superadmin");
  });
});
