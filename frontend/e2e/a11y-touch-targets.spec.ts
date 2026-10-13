import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { TEST_RESTAURANT } from "./test-fixture";
import {
  addProductsToCart,
  forceOrdersViewMode,
  login,
  mockOrdersFeed,
  openCart,
  openCheckout,
  openSection,
} from "./a11y-helpers";

/**
 * WCAG 2.5.8 (Target Size, Minimum, AA): every pointer target is at least 24x24 CSS px, or has
 * enough clear spacing around it. Project goal on touch devices: 44x44 for primary controls.
 *
 *  - FAIL: below 24px in either dimension without a 24px clear circle around it.
 *  - WARN: below 44px in either dimension (touch goal).
 *
 * The hit area counts the wrapping <label> (checkbox/radio/switch) and `::before/::after`
 * hit-area expansions. Inline links inside a sentence and hidden/sr-only elements are exempt.
 * The JSON report lands in test-results/a11y/touch-targets.json.
 */

const REPORT = "test-results/a11y/touch-targets.json";
const MIN_AA = 24;
const GOAL = 44;

type Entry = {
  level: "FAIL" | "WARN";
  area: string;
  viewport: string;
  target: string;
  w: number;
  h: number;
};

type Measurement = { entries: Omit<Entry, "area" | "viewport">[]; total: number };

async function measure(page: Page): Promise<Measurement> {
  return page.evaluate(
    ({ minAA, goal }) => {
      const SELECTOR = [
        "button",
        "a[href]",
        "input:not([type=hidden])",
        "select",
        "textarea",
        "[role=button]",
        "[role=tab]",
        "[role=switch]",
        "[role=checkbox]",
        "[role=radio]",
        "[role=menuitem]",
        "[role=combobox]",
        "[role=option]",
      ].join(",");
      type Box = { l: number; t: number; r: number; b: number };
      const box = (r: DOMRect): Box => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
      const union = (a: Box, b: Box): Box => ({
        l: Math.min(a.l, b.l),
        t: Math.min(a.t, b.t),
        r: Math.max(a.r, b.r),
        b: Math.max(a.b, b.b),
      });

      const hidden = (el: Element) => {
        if (el.closest("[inert], [hidden], [aria-hidden='true']")) return true;
        const cs = getComputedStyle(el);
        return cs.display === "none" || cs.visibility === "hidden";
      };

      /** Hit area of a pseudo-element used to enlarge the target (absolute ::before/::after). */
      const pseudoBox = (el: Element, r: DOMRect): Box | null => {
        let out: Box | null = null;
        const own = getComputedStyle(el);
        if (own.overflowX !== "visible" || own.overflowY !== "visible") return null; // would clip it
        for (const p of ["::before", "::after"]) {
          const cs = getComputedStyle(el, p);
          if (cs.content === "none" || cs.position !== "absolute" || cs.pointerEvents === "none") continue;
          const w = parseFloat(cs.width);
          const h = parseFloat(cs.height);
          const left = parseFloat(cs.left);
          const top = parseFloat(cs.top);
          if ([w, h, left, top].some(Number.isNaN)) continue;
          const b = { l: r.left + left, t: r.top + top, r: r.left + left + w, b: r.top + top + h };
          out = out ? union(out, b) : b;
        }
        return out;
      };

      const sentenceLink = (el: Element) => {
        if (el.tagName !== "A" || getComputedStyle(el).display !== "inline") return false;
        const parent = el.parentElement;
        if (!parent) return false;
        const around = Array.from(parent.childNodes)
          .filter((n) => n !== el && n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent?.trim() ?? "")
          .join("");
        return around.length > 8;
      };

      const nameOf = (el: Element) => {
        const text = (el.getAttribute("aria-label") || el.textContent || (el as HTMLInputElement).placeholder || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 36);
        const cls = String(el.getAttribute("class") ?? "")
          .split(/\s+/)
          .filter((c) => /^(max-sm:|sm:|pointer-coarse:)?(size|h|w|p|px|py|min-h|min-w)-/.test(c))
          .slice(0, 6)
          .join(" ");
        const type = (el as HTMLInputElement).type ? `[${(el as HTMLInputElement).type}]` : "";
        return `${el.tagName.toLowerCase()}${type}${el.getAttribute("role") ? `[role=${el.getAttribute("role")}]` : ""} "${text}" {${cls}}`;
      };

      type Target = { el: Element; box: Box; w: number; h: number };
      const targets: Target[] = [];
      for (const el of Array.from(document.querySelectorAll(SELECTOR))) {
        if (hidden(el)) continue;
        if ((el as HTMLButtonElement).disabled && el.tagName !== "BUTTON") continue;
        if (sentenceLink(el)) continue;
        const r = el.getBoundingClientRect();
        let b = box(r);
        const control = el as HTMLInputElement;
        const role = el.getAttribute("role");
        const isChoice =
          (el instanceof HTMLInputElement && ["checkbox", "radio"].includes(control.type)) ||
          role === "switch" ||
          role === "checkbox" ||
          role === "radio";
        // Hit area of choice controls is their label (wrapping or for=).
        const label = isChoice ? ((el as HTMLInputElement).labels?.[0] ?? el.closest("label")) : null;
        if (label && !hidden(label)) b = box(label.getBoundingClientRect());
        else if (el.closest(".sr-only")) continue;
        const ps = pseudoBox(el, r);
        if (ps) {
          // The expansion only counts where this control really receives the pointer (not covered
          // by a neighbour): sample the middle of every edge strip the pseudo-element adds.
          const hit = (x: number, y: number) => {
            if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return true; // not testable
            const top = document.elementFromPoint(x, y);
            return !!top && (el === top || el.contains(top));
          };
          const cx = (r.left + r.right) / 2;
          const cy = (r.top + r.bottom) / 2;
          const samples: Array<[number, number]> = [];
          if (ps.t < r.top - 1) samples.push([cx, (ps.t + r.top) / 2]);
          if (ps.b > r.bottom + 1) samples.push([cx, (ps.b + r.bottom) / 2]);
          if (ps.l < r.left - 1) samples.push([(ps.l + r.left) / 2, cy]);
          if (ps.r > r.right + 1) samples.push([(ps.r + r.right) / 2, cy]);
          if (samples.every(([x, y]) => hit(x, y))) b = union(b, ps);
        }
        const w = b.r - b.l;
        const h = b.b - b.t;
        if (w <= 1 || h <= 1) continue; // sr-only / collapsed
        // Fully off-screen (closed drawers etc.) is not a pointer target.
        if (b.r < 0 || b.b < 0 || b.l > innerWidth * 3) continue;
        // opacity-0 native inputs stretched over a label: measured through the label above.
        targets.push({ el, box: b, w, h });
      }

      const circleHitsBox = (cx: number, cy: number, rad: number, b: Box) => {
        const nx = Math.max(b.l, Math.min(cx, b.r));
        const ny = Math.max(b.t, Math.min(cy, b.b));
        return (cx - nx) ** 2 + (cy - ny) ** 2 < rad ** 2;
      };

      const hasSpacing = (t: Target) => {
        const cx = (t.box.l + t.box.r) / 2;
        const cy = (t.box.t + t.box.b) / 2;
        const rad = minAA / 2;
        for (const o of targets) {
          if (o === t || o.el.contains(t.el) || t.el.contains(o.el)) continue;
          if (o.el.closest("label") && o.el.closest("label") === t.el.closest("label")) continue;
          if (o.w < minAA || o.h < minAA) {
            const ox = (o.box.l + o.box.r) / 2;
            const oy = (o.box.t + o.box.b) / 2;
            if ((cx - ox) ** 2 + (cy - oy) ** 2 < minAA ** 2) return false;
          } else if (circleHitsBox(cx, cy, rad, o.box)) {
            return false;
          }
        }
        return true;
      };

      const entries: { level: "FAIL" | "WARN"; target: string; w: number; h: number }[] = [];
      for (const t of targets) {
        const w = Math.round(t.w * 10) / 10;
        const h = Math.round(t.h * 10) / 10;
        if ((t.w < minAA - 0.5 || t.h < minAA - 0.5) && !hasSpacing(t)) {
          entries.push({ level: "FAIL", target: nameOf(t.el), w, h });
        } else if ((t.w < goal - 0.5 || t.h < goal - 0.5) && !t.el.matches("[data-sonner-toast] [data-close-button]")) {
          entries.push({ level: "WARN", target: nameOf(t.el), w, h });
        }
      }
      return { entries, total: targets.length };
    },
    { minAA: MIN_AA, goal: GOAL },
  );
}

const results: Entry[] = [];
const totals: Record<string, number> = {};

function persist() {
  fs.mkdirSync("test-results/a11y", { recursive: true });
  // Merge with entries from earlier worker lifetimes so a re-run of one test keeps the rest.
  let previous: { entries: Entry[]; totals: Record<string, number> } = { entries: [], totals: {} };
  try {
    previous = JSON.parse(fs.readFileSync(REPORT, "utf8"));
  } catch {
    // first run
  }
  const keys = new Set(Object.keys(totals));
  const kept = previous.entries.filter((e) => !keys.has(`${e.viewport}/${e.area}`));
  const entries = [...kept, ...results];
  const allTotals = { ...previous.totals, ...totals };
  const summary: Record<string, { fail: number; warn: number }> = {};
  for (const e of entries) {
    const k = `${e.viewport}/${e.area}`;
    summary[k] ??= { fail: 0, warn: 0 };
    if (e.level === "FAIL") summary[k].fail++;
    else summary[k].warn++;
  }
  fs.writeFileSync(REPORT, JSON.stringify({ summary, totals: allTotals, entries }, null, 2));
}

async function scan(page: Page, viewport: string, area: string, opts: { assertNoWarn?: boolean } = {}) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/a11y/touch-${viewport}-${area}.png` });
  const m = await measure(page);
  const fresh = m.entries.map((e) => ({ ...e, area, viewport }));
  results.push(...fresh);
  totals[`${viewport}/${area}`] = m.total;
  persist();
  const fails = fresh.filter((e) => e.level === "FAIL");
  expect.soft(fails, `${viewport}/${area}: targets below ${MIN_AA}px (WCAG 2.5.8)`).toEqual([]);
  if (opts.assertNoWarn) {
    const warns = fresh.filter((e) => e.level === "WARN");
    expect.soft(warns, `${viewport}/${area}: primary controls below ${GOAL}px`).toEqual([]);
  }
}

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
] as const;

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
  test.describe(`touch targets ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: true });

    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: "light" });
      await page.addInitScript(() => localStorage.setItem("burger_page_admin_theme_v2", "light"));
    });

    test("storefront: home, product modal, cart, checkout, order bar", async ({ page }) => {
      test.setTimeout(120000);
      const strict = vp.name === "mobile";
      await page.goto(`/${TEST_RESTAURANT.slug}`);
      await expect(page.locator("#storefront-catalog")).toBeVisible({ timeout: 15000 });
      await scan(page, vp.name, "storefront-home", { assertNoWarn: strict });

      const product = page.locator('#storefront-catalog div[role="listitem"] [role="button"]').first();
      await product.click();
      await expect(page.locator('div[role="dialog"]')).toBeVisible();
      await scan(page, vp.name, "storefront-product-modal", { assertNoWarn: strict });
      await page.keyboard.press("Escape");

      await addProductsToCart(page);
      await scan(page, vp.name, "storefront-order-bar", { assertNoWarn: strict });

      await openCart(page);
      await scan(page, vp.name, "storefront-cart", { assertNoWarn: strict });

      await openCheckout(page);
      await scan(page, vp.name, "storefront-checkout", { assertNoWarn: strict });
    });

    for (const mode of ["feed", "kanban"] as const) {
      test(`admin orders ${mode} with mocked orders and manual sale`, async ({ page }) => {
        test.setTimeout(120000);
        await forceOrdersViewMode(page, mode);
        await mockOrdersFeed(page);
        await login(page, TEST_RESTAURANT.username, TEST_RESTAURANT.password);
        await openSection(page, "Pedidos en Vivo");
        await expect(page.getByRole("button", { name: /Nueva Venta/i }).first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByText(/Cliente A11y 1/).first()).toBeVisible({ timeout: 15000 });
        await scan(page, vp.name, `admin-orders-${mode}`);
        if (mode === "feed") {
          await page.getByRole("button", { name: /Nueva Venta/i }).first().click();
          await expect(page.getByText(/Punto de Venta/i).first()).toBeVisible({ timeout: 10000 });
          await scan(page, vp.name, "admin-manual-sale");
        }
      });
    }

    test("admin sections", async ({ page }) => {
      test.setTimeout(180000);
      await login(page, TEST_RESTAURANT.username, TEST_RESTAURANT.password);
      for (const [label, id] of RESTAURANT_SECTIONS) {
        await openSection(page, label);
        await expect(page).toHaveURL(new RegExp(`/admin/${id}`));
        await scan(page, vp.name, `admin-${id}`);
      }
    });

    test("superadmin directories", async ({ page }) => {
      test.setTimeout(120000);
      await login(page, "admin", "admin");
      for (const [label, id] of SUPERADMIN_SECTIONS) {
        await openSection(page, label);
        await expect(page).toHaveURL(new RegExp(`/admin/${id}`));
        await scan(page, vp.name, `super-${id}`);
      }
    });
  });
}
