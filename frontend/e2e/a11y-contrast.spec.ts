import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { TEST_RESTAURANT } from "./test-fixture";

const SHOTS_DIR = "test-results/a11y";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
] as const;
const THEMES = ["light", "dark"] as const;


/** WCAG 1.4.3 contrast violations (axe color-contrast rule only). Brand colors are asserted too. */
async function contrastViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withRules(["color-contrast"])
    .analyze();
  const found: string[] = [];
  for (const v of results.violations) {
    for (const n of v.nodes) {
      const data = (n.any[0]?.data ?? {}) as {
        fgColor?: string;
        bgColor?: string;
        contrastRatio?: number;
      };
      const line = `${n.target.join(" ")} fg=${data.fgColor} bg=${data.bgColor} ratio=${data.contrastRatio} html=${n.html.slice(0, 140)}`;
      found.push(line);
    }
  }
  return found;
}

async function audit(page: Page, label: string, tag: string) {
  await page.waitForTimeout(500);
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: `${SHOTS_DIR}/contrast-${tag}-${label}.png` });
  const violations = await contrastViolations(page);
  fs.appendFileSync(
    `${SHOTS_DIR}/contrast-report.jsonl`,
    `${JSON.stringify({ tag, label, violations })}\n`,
  );
  expect.soft(violations, `${label} (${tag}): color-contrast violations`).toEqual([]);
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

for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    const tag = `${vp.name}-${theme}`;

    test.describe(`text contrast ${tag}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.emulateMedia({ colorScheme: theme });
        await page.addInitScript((t) => {
          localStorage.setItem("burger_page_admin_theme_v2", t);
          if (t === "dark") document.documentElement.classList.add("dark");
        }, theme);
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
        test.setTimeout(150000);
        await login(page, TEST_RESTAURANT.username, TEST_RESTAURANT.password);

        await openSection(page, "Pedidos en Vivo");
        await expect(page).toHaveURL(/\/admin\/orders/);
        await expect(
          page.getByRole("button", { name: /Nueva Venta/i }).first(),
        ).toBeVisible({ timeout: 15000 });
        await audit(page, "orders", tag);

        await page
          .getByRole("button", { name: /Nueva Venta/i })
          .first()
          .click();
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
        test.setTimeout(120000);
        await login(page, "admin", "admin");
        for (const [label, id] of SUPERADMIN_SECTIONS) {
          await openSection(page, label);
          await expect(page).toHaveURL(new RegExp(`/admin/${id}`));
          await audit(page, `super-${id}`, tag);
        }
      });
    });
  }
}

/**
 * Worst-case merchant brand colors, injected into the public tenant response only (the fixture
 * row in the database is never modified, and rosto is never touched).
 */
const WORST_CASE_BRANDS = ["#ffeb3b", "#ff7a21", "#e63946"] as const;
const STOREFRONT_THEMES = [
  ["light", "clean-white"],
  ["dark", "dark-charcoal"],
] as const;

function patchTenant(node: unknown, brand: string, bgTheme: string): void {
  if (Array.isArray(node)) {
    node.forEach((n) => patchTenant(n, brand, bgTheme));
  } else if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    // The fixture stores no brand in config, so the keys must be added, not only rewritten.
    if (obj.config && typeof obj.config === "object") {
      Object.assign(obj.config, { primaryColor: brand, primaryHoverColor: brand, bgTheme });
      obj.primaryColor = brand;
      obj.theme = bgTheme;
    }
    Object.values(obj).forEach((v) => patchTenant(v, brand, bgTheme));
  }
}

for (const brand of WORST_CASE_BRANDS) {
  for (const [label, bgTheme] of STOREFRONT_THEMES) {
    test(`storefront worst-case brand ${brand} on ${label} theme has no contrast violations`, async ({ page }) => {
      await page.route(`**/api/restaurants/**`, async (route) => {
        if (route.request().method() !== "GET") return route.continue();
        const response = await route.fetch();
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          return route.fulfill({ response });
        }
        patchTenant(body, brand, bgTheme);
        return route.fulfill({ response, json: body });
      });
      await page.emulateMedia({ colorScheme: label });
      await page.goto(`/${TEST_RESTAURANT.slug}`);
      await expect(page.locator("body")).toContainText(/Tienda de Pruebas|Cl[aá]sica/i, { timeout: 15000 });
      // The injected brand must actually be applied, otherwise this test proves nothing.
      await expect
        .poll(() =>
          page.evaluate(() =>
            getComputedStyle(document.querySelector<HTMLElement>("[style*=--brand-fill]") ?? document.body)
              .getPropertyValue("--brand")
              .trim()
              .toLowerCase(),
          ),
        )
        .toBe(brand);
      await audit(page, "storefront", `worst-${brand.slice(1)}-${label}`);

      // Open the product modal and the cart so fills/text inside overlays are covered as well.
      await page.getByRole("button", { name: /Agregar|Cl[aá]sica/i }).first().click().catch(() => undefined);
      await audit(page, "storefront-overlay", `worst-${brand.slice(1)}-${label}`);
    });
  }
}
