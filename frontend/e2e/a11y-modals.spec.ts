import { test, expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { TEST_RESTAURANT } from "./test-fixture";

/**
 * WCAG 2.1.2 / 2.4.3 / 4.1.2 for every modal reachable with the tienda-pruebas fixture (and the
 * seeded super admin): keyboard open, focus moves in, Tab/Shift+Tab never leave, Escape closes and
 * returns focus to the exact trigger, role/aria-modal/name, background unreachable, scroll lock,
 * and axe (wcag A/AA incl. color-contrast) with the modal OPEN.
 */

const API_BASE = "http://localhost:3001/api";
const SHOTS_DIR = "test-results/a11y";
const BRAND_COLORS = new Set(["#e63946", "#ff7a21"]);

async function login(page: Page, username: string, password: string) {
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

async function openSection(page: Page, label: string) {
  if ((page.viewportSize()?.width ?? 1280) < 1024) {
    const toggle = page.locator('button[aria-label="Abrir menú"]');
    if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) await toggle.click();
  }
  const item = page.getByRole("navigation", { name: "Menú Lateral" }).getByRole("button", { name: label, exact: true });
  await expect(item).toBeVisible({ timeout: 10000 });
  await item.click({ timeout: 10000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

const focusIsInside = (dialog: Locator) => dialog.evaluate((d) => d.contains(document.activeElement));

/** Axe on the open dialog only: A/AA tags, brand-colour contrast reported but not asserted. */
async function axeOpenDialog(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .include('[role="dialog"]')
    .analyze();
  const real: string[] = [];
  const brand: string[] = [];
  for (const v of results.violations) {
    for (const n of v.nodes) {
      const data = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; contrastRatio?: number };
      const line = `${v.id}: ${n.target.join(" ")} fg=${data.fgColor} bg=${data.bgColor} ratio=${data.contrastRatio} html=${n.html.slice(0, 140)}`;
      const isBrand =
        v.id === "color-contrast" &&
        (BRAND_COLORS.has((data.fgColor ?? "").toLowerCase()) || BRAND_COLORS.has((data.bgColor ?? "").toLowerCase()));
      (isBrand ? brand : real).push(line);
    }
  }
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  fs.appendFileSync(`${SHOTS_DIR}/modals-axe-report.jsonl`, `${JSON.stringify({ label, violations: real, brand })}\n`);
  expect.soft(real, `${label}: axe violations with the modal open`).toEqual([]);
}

/**
 * Opens `trigger` with the keyboard and verifies the full modal contract.
 * `nested` is an optional callback run while the modal is open (before the Tab sweep).
 */
async function exerciseModal(
  page: Page,
  label: string,
  trigger: Locator,
  name: string | RegExp,
  opts: { inertBackground?: boolean; shot?: boolean; whileOpen?: (dialog: Locator) => Promise<void> } = {},
) {
  await test.step(label, async () => {
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name }).last();
    await expect(dialog, `${label}: dialog visible`).toBeVisible({ timeout: 10000 });
    await expect(dialog).toHaveAttribute("aria-modal", "true");

    // Focus moves inside on open.
    await expect.poll(() => focusIsInside(dialog), { message: `${label}: focus moves in` }).toBe(true);

    // Body does not scroll behind.
    const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    expect(overflow, `${label}: body scroll locked`).toBe("hidden");

    // Background is not reachable by assistive tech (inert) for the shared shell.
    if (opts.inertBackground !== false) {
      const inert = await trigger.evaluate((el) => !!el.closest("[inert]") || !!el.closest('[aria-hidden="true"]'));
      expect(inert, `${label}: background inert/aria-hidden`).toBe(true);
    }

    if (opts.shot) {
      fs.mkdirSync(SHOTS_DIR, { recursive: true });
      await page.screenshot({ path: `${SHOTS_DIR}/modal-${label.replace(/\W+/g, "-")}.png` });
    }

    await axeOpenDialog(page, label);
    if (opts.whileOpen) await opts.whileOpen(dialog);

    // Tab x30 never leaves the dialog.
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      expect(await focusIsInside(dialog), `${label}: Tab #${i + 1} stayed inside`).toBe(true);
    }
    // Shift+Tab wraps backwards and stays inside.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(await focusIsInside(dialog), `${label}: Shift+Tab #${i + 1} stayed inside`).toBe(true);
    }

    // Escape closes and restores focus to the exact trigger.
    await page.keyboard.press("Escape");
    await expect(dialog, `${label}: Escape closes`).toBeHidden({ timeout: 5000 });
    await expect(trigger, `${label}: focus returns to trigger`).toBeFocused();
    const overflowAfter = await page.evaluate(() => getComputedStyle(document.body).overflow);
    expect(overflowAfter, `${label}: scroll lock released`).not.toBe("hidden");
  });
}

test.describe("modals: keyboard, focus and semantics (desktop)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("restaurant admin modals", async ({ page, request }) => {
    test.setTimeout(240000);

    // Seed one order on tienda-pruebas so the order modals can be opened.
    const loginRes = await request.post(`${API_BASE}/users/login`, {
      data: { username: TEST_RESTAURANT.username, password: TEST_RESTAURANT.password },
    });
    expect(loginRes.status()).toBe(200);
    const { token, user } = await loginRes.json();
    const phone = `3077${Date.now().toString().slice(-6)}`;
    const orderRes = await request.post(`${API_BASE}/orders`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        restaurantId: user.restaurantId,
        items: [{ productId: TEST_RESTAURANT.products.clasica, quantity: 2 }],
        customer: { name: "Modal A11y Cliente", phone, barrio: "Centro" },
        deliveryFee: 5000,
        paymentMethod: "Efectivo",
        paymentAmount: 100000,
        changeAmount: 0,
        comment: "seeded-for-a11y-modals",
        clientOrderId: `a11y-modals-${Date.now()}`,
      },
    });
    expect(orderRes.status()).toBe(201);
    const seededOrder = await orderRes.json();

    try {
      await login(page, TEST_RESTAURANT.username, TEST_RESTAURANT.password);

      // --- Orders ---------------------------------------------------------------------------
      await openSection(page, "Pedidos en Vivo");
      await expect(page.getByRole("button", { name: /Nueva Venta/i }).first()).toBeVisible({ timeout: 15000 });
      await exerciseModal(page, "ManualSale", page.getByRole("button", { name: /Nueva Venta/i }).first(), /Venta|Punto/i, {
        shot: true,
      });

      const detailTrigger = page.getByRole("button", { name: /Ver detalles completos/i }).first();
      await expect(detailTrigger).toBeVisible({ timeout: 15000 });
      await exerciseModal(page, "OrderDetail", detailTrigger, /Detalles de la Orden/i, {
        shot: true,
        whileOpen: async (dialog) => {
          // Nested ticket modal: Escape closes only the topmost modal.
          const ticketTrigger = dialog.getByRole("button", { name: /Imprimir|Ticket|Comanda/i }).first();
          {
            await expect(ticketTrigger).toBeVisible();
            await ticketTrigger.focus();
            await page.keyboard.press("Enter");
            const ticket = page.getByRole("dialog", { name: /ticket|comanda|recibo/i }).last();
            await expect(ticket).toBeVisible();
            await page.keyboard.press("Escape");
            await expect(ticket).toBeHidden();
            await expect(dialog).toBeVisible();
            await expect(ticketTrigger).toBeFocused();
          }
        },
      });

      await exerciseModal(
        page,
        "OrderTicket",
        page.getByRole("button", { name: /Imprimir ticket/i }).first(),
        /ticket|comanda|recibo/i,
        { shot: true },
      );

      // --- Menu -----------------------------------------------------------------------------
      await openSection(page, "Menú & Carta");
      await exerciseModal(page, "Product", page.getByRole("button", { name: /Crear Producto/i }), /Nuevo Producto|Editar/i);
      await exerciseModal(
        page,
        "Category",
        page.getByRole("button", { name: /Gestionar Categorías/i }),
        /Gestionar Categor/i,
        {
          whileOpen: async (dialog) => {
            // ConfirmDelete (base-ui Dialog) on top of a custom modal: focus lands on Cancel,
            // Escape closes only the confirm, focus returns to the delete button.
            const del = dialog.getByRole("button", { name: /Eliminar categoría/i }).first();
            {
              await expect(del).toBeVisible();
              await del.focus();
              await page.keyboard.press("Enter");
              const confirm = page.getByRole("dialog", { name: /Eliminar categoría\?/i });
              await expect(confirm).toBeVisible();
              await expect(confirm.getByRole("button", { name: "Cancelar" })).toBeFocused();
              await page.keyboard.press("Escape");
              await expect(confirm).toBeHidden();
              await expect(dialog).toBeVisible();
              await expect(del).toBeFocused();
            }
          },
        },
      );
      await page.getByRole("button", { name: /Adicionales & Extras/i }).click();
      await exerciseModal(page, "Addition", page.getByRole("button", { name: /Añadir Adicional/i }), /Nuevo Adicional|Editar/i);

      // --- Inventory ------------------------------------------------------------------------
      await openSection(page, "Stock & Insumos");
      await exerciseModal(page, "InventoryItem", page.getByRole("button", { name: /Nuevo Insumo/i }), /Insumo/i);
      await page.getByRole("button", { name: /Proveedores/i }).click();
      await exerciseModal(page, "Supplier", page.getByRole("button", { name: /Registrar Proveedor/i }), /Proveedor/i);

      // --- Customers ------------------------------------------------------------------------
      await openSection(page, "Clientes");
      await exerciseModal(page, "CreateCustomer", page.getByRole("button", { name: /Nuevo cliente/i }), /Nuevo Cliente/i);

      // --- Team & roles ---------------------------------------------------------------------
      await openSection(page, "Equipo");
      await exerciseModal(page, "TeamCreate", page.getByRole("button", { name: "Nuevo Miembro" }), /Registrar nuevo miembro/i);
      await openSection(page, "Roles");
      await exerciseModal(page, "RoleCreate", page.getByRole("button", { name: "Nuevo Rol" }), /Nuevo Rol|Editar Rol/i);
    } finally {
      await request
        .delete(`${API_BASE}/orders/${seededOrder.id}?restaurantId=${user.restaurantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch(() => undefined);
      const custRes = await request.get(`${API_BASE}/customers?restaurantId=${user.restaurantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (custRes.status() === 200) {
        for (const c of (await custRes.json()) as Array<{ id: string; phone?: string }>) {
          if (c?.phone === phone) {
            await request.delete(`${API_BASE}/customers/${c.id}?restaurantId=${user.restaurantId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
          }
        }
      }
    }
  });

  test("super admin modals", async ({ page }) => {
    test.setTimeout(120000);
    await login(page, "admin", "admin");
    await openSection(page, "Restaurantes");
    await exerciseModal(
      page,
      "CreateRestaurant",
      page.getByRole("button", { name: /Nuevo Restaurante/i }).first(),
      /Dar de Alta Nuevo Restaurante/i,
      { shot: true },
    );
    await openSection(page, "Usuarios & Accesos");
    await exerciseModal(page, "CreateUser", page.getByRole("button", { name: /Nuevo Usuario/i }), /Crear Usuario/i, {
      shot: true,
    });
  });
});

test.describe("mobile admin drawer (390px)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("closed drawer is not focusable; opens by keyboard, Escape closes and returns focus", async ({ page }) => {
    test.setTimeout(90000);
    await login(page, TEST_RESTAURANT.username, TEST_RESTAURANT.password);
    await page.waitForLoadState("networkidle").catch(() => undefined);

    const drawer = page.locator("#admin-sidebar");
    await expect(drawer).toHaveAttribute("inert", "");

    // Tab 60 times from the top of the page: focus never lands inside the closed drawer.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab");
      const inDrawer = await page.evaluate(() => !!document.activeElement?.closest("#admin-sidebar"));
      expect(inDrawer, `Tab #${i + 1} must not enter the closed drawer`).toBe(false);
    }

    const toggle = page.locator('button[aria-label="Abrir menú"]');
    await toggle.scrollIntoViewIfNeeded();
    await toggle.focus();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAttribute("aria-controls", "admin-sidebar");
    await page.keyboard.press("Enter");

    await expect(drawer).not.toHaveAttribute("inert", "");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect.poll(() => focusIsInside(drawer)).toBe(true);
    // Wait for the slide-in transition to finish (drawer fully on screen).
    await expect.poll(async () => (await drawer.boundingBox())?.x ?? -999, { timeout: 3000 }).toBeGreaterThanOrEqual(0);
    fs.mkdirSync(SHOTS_DIR, { recursive: true });
    await page.screenshot({ path: `${SHOTS_DIR}/modal-mobile-drawer-open.png` });

    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      expect(await focusIsInside(drawer), `drawer Tab #${i + 1} stayed inside`).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(drawer).toHaveAttribute("inert", "");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
  });
});
