import { expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { TEST_RESTAURANT } from "./test-fixture";
import { mockBackendGets, mockOrderStatusTransitions, type MockedOrder } from "./mock-backend";

/** Shared helpers for the a11y specs that need real data or deep UI states (tienda-pruebas only). */

export async function login(page: Page, username: string, password: string) {
  await page.goto("/admin");
  const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
  await expect(userInput).toBeVisible({ timeout: 15000 });
  await userInput.fill(username);
  await page.locator('input[type="password"]').fill(password);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/users/login") && r.status() === 200),
    page.getByRole("button", { name: /Acceder al Panel/i }).click(),
  ]);
  await expect(page.getByRole("navigation", { name: "Menú Lateral" })).toBeAttached({ timeout: 15000 });
}

export async function openSection(page: Page, label: string) {
  if ((page.viewportSize()?.width ?? 1280) < 1024) {
    const toggle = page.locator('button[aria-label="Abrir menú"]');
    if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) await toggle.click();
  }
  const item = page.getByRole("navigation", { name: "Menú Lateral" }).getByRole("button", { name: label, exact: true });
  await expect(item).toBeVisible({ timeout: 10000 });
  await item.click({ timeout: 10000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

/** One mocked order per status, in the authoritative backend shape. */
export function mockedOrders(): MockedOrder[] {
  const statuses = ["pending", "cooking", "delivering", "delivered", "cancelled"] as const;
  return statuses.map((status, i) => ({
    id: `ord-a11y-${i + 1}`,
    orderNumber: 9001 + i,
    customer: {
      name: `Cliente A11y ${i + 1}`,
      phone: "3001234567",
      address: `Calle ${10 + i} # 20-30`,
      barrio: "Centro",
    },
    items: [
      {
        id: `item-a11y-${i}`,
        productId: TEST_RESTAURANT.products.clasica,
        productName: "Hamburguesa Clásica",
        unitPrice: 18000,
        quantity: i + 1,
        observation: i === 0 ? "Sin cebolla por favor" : undefined,
        additions: [],
      },
    ],
    subtotal: 18000 * (i + 1),
    deliveryFee: 5000,
    finalTotal: 18000 * (i + 1) + 5000,
    paymentMethod: i % 2 === 0 ? "Efectivo" : "Transferencia",
    comment: i === 1 ? "Tocar timbre fuerte" : undefined,
    status,
    createdAt: new Date(Date.now() - i * 180000).toISOString(),
  }));
}

/** Serves mocked orders (all statuses) through the GETs the admin sync performs. */
export async function mockOrdersFeed(page: Page): Promise<MockedOrder[]> {
  const orders = mockedOrders();
  await mockBackendGets(page, { orders });
  await mockOrderStatusTransitions(page, orders);
  return orders;
}

export function forceOrdersViewMode(page: Page, mode: "feed" | "kanban") {
  return page.addInitScript((m) => localStorage.setItem("burger_page_orders_view_mode", m), mode);
}

/** Storefront: opens the first product, adds it to the cart (repeats until the minimum order is met). */
export async function addProductsToCart(page: Page, count = 4) {
  await page.goto(`/${TEST_RESTAURANT.slug}`);
  const catalog = page.locator("#storefront-catalog");
  await expect(catalog).toBeVisible({ timeout: 15000 });
  for (let i = 0; i < count; i++) {
    const product = catalog.locator('div[role="listitem"] [role="button"]').first();
    await expect(product).toBeVisible({ timeout: 10000 });
    await product.click();
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await modal.locator("button", { hasText: /Agregar/i }).click();
    await expect(modal).toBeHidden();
  }
}

export async function openCart(page: Page) {
  const cartBtn = page.getByRole("button", { name: /Ver orden/i }).first();
  await expect(cartBtn).toBeVisible({ timeout: 10000 });
  await cartBtn.click();
  await expect(page.getByRole("heading", { name: /Tu pedido/i })).toBeVisible({ timeout: 10000 });
}

export async function openCheckout(page: Page) {
  const confirm = page.getByRole("button", { name: /Confirmar orden/i });
  await expect(confirm).toBeEnabled({ timeout: 10000 });
  await confirm.click();
  await expect(page.getByRole("heading", { name: /Finalizar pedido/i })).toBeVisible({ timeout: 10000 });
}

// ---------------------------------------------------------------------------------------------
// axe + modal contract helpers (states spec)
// ---------------------------------------------------------------------------------------------

export const REPORT_DIR = "test-results/a11y";

/** Best-practice rules treated as blocking (the same structural set a11y-structure.spec.ts enforces). */
const ENFORCED_BEST_PRACTICE = [
  /^label$/,
  /^button-name$/,
  /^link-name$/,
  /^select-name$/,
  /^image-alt$/,
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
  /^tabindex$/,
  /^focus-order-semantics$/,
];
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
/** Page-level rules that cannot hold for a single dialog subtree. */
const PAGE_LEVEL_RULES = ["region", "landmark-one-main", "page-has-heading-one", "bypass", "landmark-unique"];

/**
 * axe over the WCAG A/AA set + best-practice, color-contrast INCLUDED. Returns the blocking
 * violations (any WCAG-tagged rule, or an enforced structural best-practice rule); the remaining
 * best-practice findings go to the JSONL report only.
 */
export async function axeBlocking(page: Page, label: string, opts: { dialog?: boolean } = {}): Promise<string[]> {
  let builder = new AxeBuilder({ page }).withTags([...WCAG_TAGS, "best-practice"]);
  if (opts.dialog) builder = builder.include('[role="dialog"]').disableRules(PAGE_LEVEL_RULES);
  const results = await builder.analyze();
  const blocking: string[] = [];
  const reported: string[] = [];
  for (const v of results.violations) {
    const isBlocking = v.tags.some((t) => WCAG_TAGS.includes(t)) || ENFORCED_BEST_PRACTICE.some((re) => re.test(v.id));
    for (const n of v.nodes) {
      const data = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; contrastRatio?: number };
      const extra = v.id === "color-contrast" ? ` fg=${data.fgColor} bg=${data.bgColor} ratio=${data.contrastRatio}` : "";
      const line = `[${v.id}] ${n.target.join(" ")}${extra} :: ${n.html.slice(0, 140).replace(/\s+/g, " ")}`;
      (isBlocking ? blocking : reported).push(line);
    }
  }
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.appendFileSync(`${REPORT_DIR}/states-report.jsonl`, `${JSON.stringify({ label, blocking, reported })}\n`);
  return blocking;
}

export const focusIsInside = (dialog: Locator) => dialog.evaluate((d) => d.contains(document.activeElement));

const describeActive = (page: Page) =>
  page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    return `${a?.tagName ?? "none"} "${a?.getAttribute("aria-label") ?? (a?.textContent ?? "").trim().slice(0, 30)}" ${String(a?.className ?? "").slice(0, 50)}`;
  });

/** Tab x30 / Shift+Tab x6 never leave `dialog`. */
export async function assertFocusTrapped(page: Page, dialog: Locator, label: string) {
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    // base-ui parks focus on its sentinel spans for a tick before bouncing it back inside: settle first.
    await expect.poll(() => focusIsInside(dialog), { timeout: 1500, intervals: [25, 50, 100, 250] }).toBe(true).catch(() => undefined);
    const inside = await focusIsInside(dialog);
    expect(inside, `${label}: Tab #${i + 1} stayed inside (focus on ${inside ? "-" : await describeActive(page)})`).toBe(true);
  }
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Shift+Tab");
    await expect.poll(() => focusIsInside(dialog), { timeout: 1500, intervals: [25, 50, 100, 250] }).toBe(true).catch(() => undefined);
    const inside = await focusIsInside(dialog);
    expect(inside, `${label}: Shift+Tab #${i + 1} stayed inside (focus on ${inside ? "-" : await describeActive(page)})`).toBe(true);
  }
}

/** Tenant response patch (public GET only) to render the storefront in a dark/light store theme. */
function patchTenant(node: unknown, bgTheme: string): void {
  if (Array.isArray(node)) {
    node.forEach((n) => patchTenant(n, bgTheme));
  } else if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (obj.config && typeof obj.config === "object") {
      Object.assign(obj.config, { bgTheme });
      obj.theme = bgTheme;
    }
    Object.values(obj).forEach((v) => patchTenant(v, bgTheme));
  }
}

export async function setStorefrontTheme(page: Page, theme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript((t) => {
    localStorage.setItem("burger_page_admin_theme_v2", t);
    if (t === "dark") document.documentElement.classList.add("dark");
  }, theme);
  if (theme === "dark") {
    await page.route("**/api/restaurants/**", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const response = await route.fetch();
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return route.fulfill({ response });
      }
      patchTenant(body, "dark-charcoal");
      return route.fulfill({ response, json: body });
    });
  }
}
