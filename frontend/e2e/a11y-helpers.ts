import { expect, type Page } from "@playwright/test";
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
