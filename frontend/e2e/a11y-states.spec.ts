import { test, expect, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import { TEST_RESTAURANT } from "./test-fixture";
import {
  REPORT_DIR,
  addProductsToCart,
  assertFocusTrapped,
  axeBlocking,
  focusIsInside,
  forceOrdersViewMode,
  login,
  mockOrdersFeed,
  openCart,
  openCheckout,
  openSection,
  setStorefrontTheme,
} from "./a11y-helpers";

/**
 * States earlier a11y specs never exercised in a browser (tienda-pruebas fixture only):
 * checkout form with validation errors, MobileOrderBar with a cart, below-minimum cart, the order
 * feed and kanban with every status, and the remaining modals (validation, nesting, credentials,
 * lightbox, superadmin dialogs). axe: WCAG A/AA + best-practice, color-contrast included.
 */

const API_BASE = "http://localhost:3001/api";

const RUNS = [
  { name: "desktop-light", width: 1280, height: 800, theme: "light" },
  { name: "mobile-light", width: 390, height: 844, theme: "light" },
  { name: "desktop-dark", width: 1280, height: 800, theme: "dark" },
  { name: "mobile-dark", width: 390, height: 844, theme: "dark" },
] as const;

async function shot(page: Page, name: string) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  await page.screenshot({ path: `${REPORT_DIR}/states-${name}.png` });
}

async function expectAxeClean(page: Page, label: string, opts: { dialog?: boolean } = {}) {
  await page.waitForTimeout(400);
  expect.soft(await axeBlocking(page, label, opts), `${label}: axe violations`).toEqual([]);
}

/** Every aria-invalid control must be linked (aria-describedby) to a visible, non-empty error. */
async function assertErrorsLinked(page: Page, label: string) {
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    const invalid = Array.from(document.querySelectorAll<HTMLElement>('[aria-invalid="true"]'));
    if (invalid.length === 0) out.push("no aria-invalid control found");
    for (const el of invalid) {
      const name = el.id || el.getAttribute("name") || el.tagName;
      const ids = (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
      const described = ids.map((id) => document.getElementById(id)).filter((n): n is HTMLElement => !!n);
      const hasError = described.some((n) => (n.textContent ?? "").trim().length > 0 && !!n.closest("[role=alert],[aria-live]"));
      if (!hasError) out.push(`${name}: aria-invalid without aria-describedby pointing at an announced error`);
    }
    return out;
  });
  expect(problems, `${label}: errors announced and linked`).toEqual([]);
}

for (const run of RUNS) {
  test.describe(`storefront states ${run.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: run.width, height: run.height });
      await setStorefrontTheme(page, run.theme);
    });

    test("MobileOrderBar with a cart, cart, checkout with validation errors", async ({ page }) => {
      test.setTimeout(120000);
      await addProductsToCart(page);
      await expect(page.getByRole("button", { name: /Ver orden, 4 productos/i }).first()).toBeVisible();
      await shot(page, `${run.name}-order-bar`);
      await expectAxeClean(page, `${run.name}: storefront with non-empty cart / order bar`);

      await openCart(page);
      await expectAxeClean(page, `${run.name}: cart`);

      await openCheckout(page);
      await expectAxeClean(page, `${run.name}: checkout pristine`);

      // Submit empty: every required field reports its error, focus moves to the first one.
      await page.getByRole("button", { name: /Enviar pedido por WhatsApp/i }).click();
      await expect(page.locator('[data-slot="field-error"]').first()).toBeVisible({ timeout: 5000 });
      expect(await page.locator('[data-slot="field-error"]').count()).toBeGreaterThanOrEqual(4);
      await expect(page.locator("#nombre")).toBeFocused();
      await assertErrorsLinked(page, `${run.name}: checkout empty submit`);
      await shot(page, `${run.name}-checkout-errors`);
      await expectAxeClean(page, `${run.name}: checkout with validation errors`);

      // Fixing one field clears its error and its aria-invalid.
      await page.locator("#nombre").fill("Cliente Accesible");
      await expect(page.locator("#nombre")).not.toHaveAttribute("aria-invalid", "true");
      await assertErrorsLinked(page, `${run.name}: checkout partial fix`);
    });

    test("below the minimum order: cart and checkout announce it", async ({ page }) => {
      test.setTimeout(90000);
      await addProductsToCart(page, 1);
      await openCart(page);
      const alert = page.getByRole("alert").filter({ hasText: /pedido m[ií]nimo/i });
      await expect(alert).toBeVisible();
      await expect(page.getByRole("button", { name: /Confirmar orden/i })).toBeDisabled();
      await expectAxeClean(page, `${run.name}: cart below minimum`);
    });
  });
}

for (const run of RUNS) {
  test.describe(`order feed states ${run.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: run.width, height: run.height });
      await page.emulateMedia({ colorScheme: run.theme });
      await page.addInitScript((t) => {
        localStorage.setItem("burger_page_admin_theme_v2", t);
        if (t === "dark") document.documentElement.classList.add("dark");
      }, run.theme);
    });

    for (const mode of ["feed", "kanban"] as const) {
      test(`LiveOrderCard / KanbanOrderCard ${mode} with every status`, async ({ page }) => {
        test.setTimeout(120000);
        await forceOrdersViewMode(page, mode);
        await mockOrdersFeed(page);
        await login(page, TEST_RESTAURANT.username, TEST_RESTAURANT.password);
        await openSection(page, "Pedidos en Vivo");
        for (let i = 1; i <= 5; i++) {
          if (mode === "feed" && i > 3) break; // delivered/cancelled live in the history tab
          await expect(page.getByText(`Cliente A11y ${i}`).first()).toBeVisible({ timeout: 15000 });
        }
        await shot(page, `${run.name}-orders-${mode}`);
        await expectAxeClean(page, `${run.name}: orders ${mode}`);

        if (mode === "feed") {
          await page.getByRole("button", { name: /Historial/i }).click();
          await expect(page.getByText("Cliente A11y 4").first()).toBeVisible({ timeout: 10000 });
          await shot(page, `${run.name}-orders-feed-history`);
          await expectAxeClean(page, `${run.name}: orders feed history (delivered/cancelled)`);
        }
      });
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Modals: validation states, nesting, credentials, lightbox, superadmin dialogs
// ---------------------------------------------------------------------------------------------

const MODAL_RUNS = [
  { name: "desktop-light", width: 1280, height: 800, theme: "light" },
  { name: "mobile-dark", width: 390, height: 844, theme: "dark" },
] as const;

type DialogOpts = {
  /** Put the dialog in its error state (runs before axe). */
  validate?: (dialog: Locator) => Promise<void>;
  /** Extra checks while open (nested dialogs, extra states). */
  whileOpen?: (dialog: Locator) => Promise<void>;
  /** Escape does not dismiss (by design): close through the visible button instead. */
  closeWith?: Locator;
};

/**
 * Keyboard-opens `trigger`, then: focus moves in, optional error state, axe on the open dialog,
 * Tab/Shift+Tab never leave it, and closing (Escape, or the named button) restores focus to the trigger.
 */
async function exerciseDialog(page: Page, label: string, trigger: Locator, name: string | RegExp, opts: DialogOpts = {}) {
  await test.step(label, async () => {
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name }).last();
    await expect(dialog, `${label}: dialog visible`).toBeVisible({ timeout: 10000 });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect.poll(() => focusIsInside(dialog), { message: `${label}: focus moves in` }).toBe(true);

    if (opts.validate) await opts.validate(dialog);
    await shot(page, `modal-${label.replace(/\W+/g, "-")}`);
    await expectAxeClean(page, label, { dialog: true });
    if (opts.whileOpen) await opts.whileOpen(dialog);

    await assertFocusTrapped(page, dialog, label);

    if (opts.closeWith) {
      await opts.closeWith.focus();
      await page.keyboard.press("Enter");
    } else {
      // A tooltip opened by keyboard focus consumes the first Escape (WCAG 1.4.13: dismissible), so allow
      // one extra press; the dialog must be closed by the second at the latest.
      for (let presses = 0; presses < 2; presses++) {
        await page.keyboard.press("Escape");
        if (await dialog.waitFor({ state: "hidden", timeout: 1200 }).then(() => true, () => false)) break;
      }
    }
    await expect(dialog, `${label}: closes`).toBeHidden({ timeout: 5000 });
    await expect(trigger, `${label}: focus returns to trigger`).toBeFocused();
  });
}

/** Submits the open form empty: it must stay open and surface the error (native :invalid focus or an alert/toast). */
async function submitEmptyAndExpectError(page: Page, dialog: Locator) {
  const submit = dialog.locator('button[type="submit"]').first();
  await expect(submit).toBeVisible();
  await submit.click();
  await expect(dialog).toBeVisible();
  const state = await dialog.evaluate((d) => ({
    invalid: d.querySelectorAll(":invalid").length,
    focusedInvalid: !!document.activeElement?.matches(":invalid"),
  }));
  const toast = await page.locator('[data-sonner-toast][data-type="error"], [role="alert"]').count();
  expect(
    state.invalid > 0 ? state.focusedInvalid : toast > 0,
    "error state surfaced (focused :invalid field or alert/toast)",
  ).toBe(true);
}

for (const run of MODAL_RUNS) {
  test.describe(`modal states ${run.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: run.width, height: run.height });
      await page.emulateMedia({ colorScheme: run.theme });
      await page.addInitScript((t) => {
        localStorage.setItem("burger_page_admin_theme_v2", t);
        if (t === "dark") document.documentElement.classList.add("dark");
      }, run.theme);
    });

    test("manual sale (items + customize nesting), product, category, addition, inventory, supplier, role", async ({ page }) => {
      test.setTimeout(300000);
      await forceOrdersViewMode(page, "feed");
      await mockOrdersFeed(page);
      await login(page, TEST_RESTAURANT.username, TEST_RESTAURANT.password);

      await openSection(page, "Pedidos en Vivo");
      await expect(page.getByRole("button", { name: /Nueva Venta/i }).first()).toBeVisible({ timeout: 15000 });
      await exerciseDialog(page, `${run.name} ManualSale`, page.getByRole("button", { name: /Nueva Venta/i }).first(), /Venta|Punto/i, {
        whileOpen: async (dialog) => {
          // Add an item so the order/payment state is rendered, then audit again.
          await dialog.getByRole("button", { name: /^Agregar/ }).first().click();
          await expectAxeClean(page, `${run.name} ManualSale with an item`, { dialog: true });

          // Customize ("+ Extras") nests a second modal: Escape closes only the top one.
          const extras = dialog.getByRole("button", { name: /Extras/i }).first();
          await extras.scrollIntoViewIfNeeded();
          await extras.focus();
          await page.keyboard.press("Enter");
          await expect.poll(async () => await page.getByRole("dialog").count()).toBeGreaterThanOrEqual(2);
          const top = page.getByRole("dialog").last();
          await expect(top).toBeVisible();
          await expect.poll(() => focusIsInside(top)).toBe(true);
          await expectAxeClean(page, `${run.name} ManualSale customize (nested)`, { dialog: true });
          await assertFocusTrapped(page, top, `${run.name} ManualSale customize`);
          for (let presses = 0; presses < 2 && (await page.getByRole("dialog").count()) > 1; presses++) {
            await page.keyboard.press("Escape");
            await page.waitForTimeout(500);
          }
          await expect(page.getByRole("dialog")).toHaveCount(1);
          await expect(dialog).toBeVisible();
          await expect(extras).toBeFocused();
        },
      });

      await openSection(page, "Menú & Carta");
      await exerciseDialog(page, `${run.name} Product (validation)`, page.getByRole("button", { name: /Crear Producto/i }), /Nuevo Producto|Editar/i, {
        validate: (d) => submitEmptyAndExpectError(page, d),
      });
      await exerciseDialog(page, `${run.name} Category`, page.getByRole("button", { name: /Gestionar Categorías/i }), /Gestionar Categor/i);
      await page.getByRole("button", { name: /Adicionales & Extras/i }).click();
      await exerciseDialog(page, `${run.name} Addition (validation)`, page.getByRole("button", { name: /Añadir Adicional/i }), /Nuevo Adicional|Editar/i, {
        validate: (d) => submitEmptyAndExpectError(page, d),
      });

      await openSection(page, "Stock & Insumos");
      await exerciseDialog(page, `${run.name} InventoryItem (validation)`, page.getByRole("button", { name: /Nuevo Insumo/i }), /Insumo/i, {
        validate: (d) => submitEmptyAndExpectError(page, d),
      });
      await page.getByRole("button", { name: /Proveedores/i }).click();
      await exerciseDialog(page, `${run.name} Supplier (validation)`, page.getByRole("button", { name: /Registrar Proveedor/i }), /Proveedor/i, {
        validate: (d) => submitEmptyAndExpectError(page, d),
      });

      await openSection(page, "Roles");
      await exerciseDialog(page, `${run.name} Role (validation)`, page.getByRole("button", { name: "Nuevo Rol" }), /Nuevo Rol|Editar Rol/i, {
        validate: (d) => submitEmptyAndExpectError(page, d),
      });
    });

    test("team: create (validation), credentials reveal, temp password", async ({ page, request }) => {
      test.setTimeout(240000);
      const username = `a11y-team-${Date.now().toString().slice(-8)}`;
      const loginRes = await request.post(`${API_BASE}/users/login`, {
        data: { username: TEST_RESTAURANT.username, password: TEST_RESTAURANT.password },
      });
      expect(loginRes.status()).toBe(200);
      const { token, user } = await loginRes.json();
      // The fixture ships no roles and "Crear Usuario" needs one: create (and later remove) a scratch role.
      const roleRes = await request.post(`${API_BASE}/roles`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { restaurantId: user.restaurantId, name: `a11y-role-${Date.now().toString().slice(-6)}`, permissions: ["orders.view"] },
      });
      expect(roleRes.status()).toBeLessThan(300);
      const scratchRole = (await roleRes.json()) as { id: string };
      try {
        await login(page, TEST_RESTAURANT.username, TEST_RESTAURANT.password);
        await openSection(page, "Equipo");
        const create = page.getByRole("button", { name: "Nuevo Miembro" });
        await exerciseDialog(page, `${run.name} TeamCreate (validation)`, create, /Registrar nuevo miembro/i, {
          validate: (d) => submitEmptyAndExpectError(page, d),
        });

        // Real create: username is the only required input (a password is pre-generated).
        await create.click();
        const dialog = page.getByRole("dialog", { name: /Registrar nuevo miembro/i });
        await expect(dialog).toBeVisible();
        await dialog.locator("input[required]").first().fill(username);
        await dialog.locator('button[type="submit"]').click();

        const credentials = page.getByRole("dialog", { name: /Credenciales de acceso/i });
        await expect(credentials).toBeVisible({ timeout: 15000 });
        await expect(credentials.getByText(username).first()).toBeVisible();
        await expectAxeClean(page, `${run.name} credentials reveal`, { dialog: true });
        await assertFocusTrapped(page, credentials, `${run.name} credentials reveal`);
        await page.keyboard.press("Escape");
        await expect(credentials).toBeHidden();

        // Reset password -> confirm -> temporary password modal.
        const reset = page.getByRole("button", { name: `Restablecer clave ${username}` });
        await reset.scrollIntoViewIfNeeded();
        await reset.focus();
        await page.keyboard.press("Enter");
        const confirm = page.getByRole("dialog", { name: /Restablecer contraseña/i });
        await expect(confirm).toBeVisible();
        await confirm.getByRole("button", { name: /Restablecer clave/i }).click();
        const temp = page.getByRole("dialog", { name: /Nueva clave temporal/i });
        await expect(temp).toBeVisible({ timeout: 15000 });
        await expectAxeClean(page, `${run.name} temp password`, { dialog: true });
        await assertFocusTrapped(page, temp, `${run.name} temp password`);
        await page.keyboard.press("Escape");
        await expect(temp).toBeHidden();
      } finally {
        const list = await request.get(`${API_BASE}/users?restaurantId=${user.restaurantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (list.status() === 200) {
          for (const u of (await list.json()) as Array<{ id: string; username: string }>) {
            if (u.username === username) {
              await request.delete(`${API_BASE}/users/${u.id}`, { headers: { Authorization: `Bearer ${token}` } });
            }
          }
        }
        await request.delete(`${API_BASE}/roles/${scratchRole.id}?restaurantId=${user.restaurantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    });

    test("superadmin: edit restaurant and reset-password dialogs (mocked, nothing persisted)", async ({ page }) => {
      test.setTimeout(150000);
      // The reset endpoint is mocked so no real credential changes.
      await page.route("**/api/users/*/reset-password", (route) =>
        route.fulfill({ status: 200, json: { temporaryPassword: "Temp-A11y-12345" } }),
      );
      await login(page, "admin", "admin");
      await openSection(page, "Restaurantes");
      await exerciseDialog(
        page,
        `${run.name} EditRestaurant`,
        page.getByRole("button", { name: /Editar restaurante Tienda de Pruebas/i }),
        /Editar|Restaurante/i,
      );

      await openSection(page, "Usuarios & Accesos");
      const resetTrigger = page.getByRole("button", { name: "Restablecer clave" }).and(page.locator(":enabled")).first();
      await exerciseDialog(page, `${run.name} ResetPassword (temp password)`, resetTrigger, /Contraseña Restablecida/i, {
        closeWith: page.getByRole("button", { name: /Ya la copié, cerrar/i }),
      });
    });
  });
}

test.describe("AdditionsModal photo lightbox", () => {
  for (const run of MODAL_RUNS) {
    test(`Tab is trapped, Escape closes only the lightbox and focus returns (${run.name})`, async ({ page }) => {
      test.setTimeout(90000);
      await page.setViewportSize({ width: run.width, height: run.height });
      // Offline-safe: the fixture product photo is served locally.
      await page.route("**/images.unsplash.com/**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#d97706"/></svg>',
        }),
      );
      await setStorefrontTheme(page, run.theme);
      await page.goto(`/${TEST_RESTAURANT.slug}`);
      await expect(page.locator("#storefront-catalog")).toBeVisible({ timeout: 15000 });
      await page
        .locator('#storefront-catalog div[role="listitem"]')
        .filter({ hasText: /Cl[aá]sica/ })
        .locator('[role="button"]')
        .first()
        .click();
      const productDialog = page.locator('div[role="dialog"]').first();
      await expect(productDialog).toBeVisible();

      const trigger = page.getByRole("button", { name: "Ampliar imagen" });
      await trigger.focus();
      await page.keyboard.press("Enter");
      const lightbox = page.getByRole("dialog", { name: /Foto ampliada/i });
      await expect(lightbox).toBeVisible();
      await expect.poll(() => focusIsInside(lightbox)).toBe(true);
      await expectAxeClean(page, `${run.name} photo lightbox`, { dialog: true });
      await assertFocusTrapped(page, lightbox, `${run.name} photo lightbox`);

      await page.keyboard.press("Escape");
      await expect(lightbox).toBeHidden();
      await expect(productDialog).toBeVisible();
      await expect(trigger).toBeFocused();
    });
  }
});
