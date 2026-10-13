import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { TEST_RESTAURANT } from "./test-fixture";

const SHOTS_DIR = "test-results/a11y";
const MAX_STOPS = 40;

const RUNS = [
  { name: "desktop-light", width: 1280, height: 800, theme: "light" },
  { name: "mobile-light", width: 390, height: 844, theme: "light" },
  { name: "desktop-dark", width: 1280, height: 800, theme: "dark" },
  { name: "mobile-dark", width: 390, height: 844, theme: "dark" },
] as const;

type Stop = {
  desc: string;
  ok: boolean;
  reasons: string[];
};

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
  await page.waitForTimeout(600);
}

/**
 * Inspects document.activeElement: does it paint a keyboard-focus indicator, and is it
 * actually reachable (inside the viewport and not covered by sticky UI)?
 */
async function inspectFocused(page: Page): Promise<Stop & { tag: string }> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body || el === document.documentElement)
      return { desc: "body", tag: "BODY", ok: true, reasons: [] };
    const w = window as unknown as { __visited?: WeakSet<Element> };
    w.__visited ??= new WeakSet();
    if (w.__visited.has(el)) return { desc: "revisit", tag: "BODY", ok: true, reasons: [] };
    w.__visited.add(el);

    const parse = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/) ?? c.match(/color\(srgb ([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      const scale = c.startsWith("color(") ? 255 : 1;
      return { r: p[0] * scale, g: p[1] * scale, b: p[2] * scale, a: p[3] ?? 1 };
    };
    const lum = (c: { r: number; g: number; b: number }) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const contrast = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const snap = (n: HTMLElement) => {
      const s = getComputedStyle(n);
      return {
        outlineStyle: s.outlineStyle,
        outlineWidth: parseFloat(s.outlineWidth),
        outlineColor: s.outlineColor,
        boxShadow: s.boxShadow,
        borderColor: s.borderTopColor + s.borderRightColor + s.borderBottomColor + s.borderLeftColor,
        bg: s.backgroundColor,
      };
    };
    const chain: HTMLElement[] = [];
    for (let n: HTMLElement | null = el, i = 0; n && i < 4; n = n.parentElement, i++) chain.push(n);
    const focused = chain.map(snap);

    // Effective opaque background for contrast of the outline.
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    for (let n: HTMLElement | null = el.parentElement; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a >= 0.9) {
        bg = c;
        break;
      }
    }

    // Compare with the unfocused state (briefly blur, then restore focus).
    const rect0 = el.getBoundingClientRect();
    el.blur();
    const blurred = chain.map(snap);
    el.focus({ preventScroll: true });

    const reasons: string[] = [];
    const f0 = focused[0];
    let indicator = false;
    const outline = parse(f0.outlineColor);
    if (f0.outlineStyle !== "none" && f0.outlineWidth >= 2 && outline && outline.a > 0.5) {
      indicator = true;
      const ratio = contrast(outline, bg);
      if (ratio < 3 && !(f0.boxShadow !== "none" && f0.boxShadow !== blurred[0].boxShadow))
        reasons.push(`outline contrast ${ratio.toFixed(2)}:1 < 3:1`);
    }
    for (let i = 0; i < focused.length && !indicator; i++) {
      const a = focused[i];
      const b = blurred[i];
      if (a.boxShadow !== b.boxShadow && a.boxShadow !== "none") indicator = true;
      else if (a.borderColor !== b.borderColor) indicator = true;
      else if (i > 0 && a.outlineStyle !== "none" && a.outlineWidth >= 2 && a.outlineStyle !== b.outlineStyle) indicator = true;
    }
    if (!indicator) reasons.push("no visible focus indicator");

    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const visible = r.width > 0 && r.height > 0;
    if (visible) {
      // WCAG 2.4.11 (minimum): the focused element must not be entirely hidden. Sample three points
      // across it (clamped to the viewport); at least one must hit the element itself.
      const onScreen = r.right > 0 && r.left < vw && r.bottom > 0 && r.top < vh;
      if (!onScreen) {
        reasons.push(`outside viewport (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}) vs ${vw}x${vh}`);
      } else {
        const clampX = (x: number) => Math.min(Math.max(x, 1), vw - 1);
        const clampY = (y: number) => Math.min(Math.max(y, 1), vh - 1);
        const hits = [0.5, 0.15, 0.85].map((fx) => {
          const top = document.elementFromPoint(clampX(r.left + r.width * fx), clampY(r.top + r.height / 2));
          const lbl = top?.closest("label");
          return { top, ok: !!top && (el === top || el.contains(top) || (!!lbl && lbl.contains(el))) };
        });
        if (!hits.some((h) => h.ok)) {
          const t = hits[0].top;
          reasons.push(`covered by <${t?.tagName.toLowerCase()} class="${(t?.className?.toString() ?? "").slice(0, 60)}">`);
        }
      }
    } else {
      reasons.push("focused element has no box");
    }
    void rect0;
    const desc = `<${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} ${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}>`;
    return { desc, tag: el.tagName, ok: reasons.length === 0, reasons };
  });
}

/** Tabs through up to MAX_STOPS stops and returns the failing ones. */
async function tabAudit(page: Page, label: string, tag: string, shotAt = -1) {
  const failures: string[] = [];
  const seen = new Set<string>();
  let stops = 0;
  for (let i = 0; i < MAX_STOPS; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(80); // let focus-driven scroll and React state settle
    const s = await inspectFocused(page);
    if (s.tag === "BODY") break;
    const key = `${s.desc}#${i}`;
    if (seen.has(key)) break;
    seen.add(key);
    stops++;
    if (!s.ok) failures.push(`${s.desc}: ${s.reasons.join("; ")}`);
    if (i === shotAt) {
      fs.mkdirSync(SHOTS_DIR, { recursive: true });
      await page.screenshot({ path: `${SHOTS_DIR}/focus-${tag}-${label}.png` });
    }
  }
  expect.soft(stops, `${label} (${tag}): should reach several tab stops`).toBeGreaterThan(2);
  expect.soft(failures, `${label} (${tag}): focus failures`).toEqual([]);
}

/** Moves the sequential-focus start point to the top of <main>. */
async function startFromMain(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __visited?: WeakSet<Element> }).__visited = new WeakSet();
    window.scrollTo(0, 0);
    (document.getElementById("main-content") as HTMLElement | null)?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  });
}

for (const run of RUNS) {
  const tag = run.name;

  test.describe(`focus ${tag}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: run.width, height: run.height });
      await page.emulateMedia({ colorScheme: run.theme });
      // Freeze transitions so computed styles are read in their settled state (outline-color is transitioned).
      await page.addInitScript(() => {
        const inject = () => {
          const style = document.createElement("style");
          style.textContent =
            "*,*::before,*::after{transition:none !important}*{scroll-behavior:auto !important}";
          document.documentElement.appendChild(style);
        };
        if (document.documentElement) inject();
        else document.addEventListener("DOMContentLoaded", inject);
      });
      await page.addInitScript((t) => {
        localStorage.setItem("burger_page_admin_theme_v2", t);
        if (t === "dark") document.documentElement.classList.add("dark");
      }, run.theme);
    });

    test("storefront", async ({ page }) => {
      test.setTimeout(120000);
      await page.goto(`/${TEST_RESTAURANT.slug}`);
      await expect(page.locator("body")).toContainText(
        /Tienda de Pruebas|Cl[aá]sica/i,
        { timeout: 15000 },
      );
      await page.waitForTimeout(500);
      await tabAudit(page, "storefront", tag, 3);

      // Skip link does not collide with the brand/logo button when focused.
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.reload();
      await expect(page.locator("body")).toContainText(/Tienda de Pruebas|Cl[aá]sica/i, { timeout: 15000 });
      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: "Saltar al contenido" });
      await expect(skip).toBeFocused();
      const sb = (await skip.boundingBox())!;
      const logo = (await page.getByRole("button", { name: "Ir al inicio del menú" }).boundingBox())!;
      const overlap =
        sb.x < logo.x + logo.width && sb.x + sb.width > logo.x && sb.y < logo.y + logo.height && sb.y + sb.height > logo.y;
      expect(overlap, "skip link must not cover the logo").toBe(false);
      fs.mkdirSync(SHOTS_DIR, { recursive: true });
      await page.screenshot({ path: `${SHOTS_DIR}/focus-${tag}-storefront-skiplink.png` });
    });

    test("restaurant admin screens", async ({ page }) => {
      test.setTimeout(240000);
      await login(page, TEST_RESTAURANT.username, TEST_RESTAURANT.password);

      // Skip link: first Tab, clear of the sidebar logo.
      await page.reload();
      await expect(page.getByRole("navigation", { name: "Menú Lateral" })).toBeAttached({ timeout: 15000 });
      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: "Saltar al contenido" });
      await expect(skip).toBeFocused();
      const sb = (await skip.boundingBox())!;
      const logoBox = await page.evaluate(() => {
        const aside = document.querySelector('aside[aria-label="Sidebar de navegación"]');
        const hdr = aside?.firstElementChild as HTMLElement | null;
        const r = hdr?.getBoundingClientRect();
        return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
      });
      if (logoBox && logoBox.x + logoBox.width > 0 && logoBox.x < (page.viewportSize()?.width ?? 0)) {
        const overlap =
          sb.x < logoBox.x + logoBox.width && sb.x + sb.width > logoBox.x && sb.y < logoBox.y + logoBox.height && sb.y + sb.height > logoBox.y;
        expect(overlap, "skip link must not cover the sidebar logo").toBe(false);
      }
      fs.mkdirSync(SHOTS_DIR, { recursive: true });
      await page.screenshot({ path: `${SHOTS_DIR}/focus-${tag}-admin-skiplink.png` });

      for (const [sec, id] of [
        ["Pedidos en Vivo", "orders"],
        ["Menú & Carta", "menu"],
        ["Clientes", "customers"],
        ["Ajustes de Negocio", "settings"],
      ] as const) {
        await openSection(page, sec);
        await expect(page).toHaveURL(new RegExp(`/admin/${id}`));
        if (id === "settings") {
          // Expand every collapsed settings section so the textarea/number/JSON-like fields are reachable.
          for (const closed of await page.locator('main button[aria-expanded="false"]').all()) {
            await closed.click().catch(() => undefined);
          }
        }
        await startFromMain(page);
        await tabAudit(page, id, tag, id === "menu" ? 4 : -1);
      }

      // Personalizar: design tabs (selects, sliders, colour inputs).
      await openSection(page, "Personalizar");
      await startFromMain(page);
      await tabAudit(page, "customizer", tag, 12);
      await page.getByRole("tab", { name: "Diseño" }).click();
      await startFromMain(page);
      await tabAudit(page, "customizer-uiux", tag);
    });

    test("superadmin screens and dialog focus management", async ({ page }) => {
      test.setTimeout(240000);
      await login(page, "admin", "admin");
      for (const [sec, id] of [
        ["Restaurantes", "restaurants"],
        ["Usuarios & Accesos", "users"],
      ] as const) {
        await openSection(page, sec);
        await expect(page).toHaveURL(new RegExp(`/admin/${id}`));
        await startFromMain(page);
        await tabAudit(page, `super-${id}`, tag, 5);
      }

      // base-ui Dialog: trap, and Escape restores focus to the trigger.
      await openSection(page, "Usuarios & Accesos");
      const trigger = page.getByRole("button", { name: /^Editar usuario /i }).first();
      await expect(trigger).toBeVisible({ timeout: 15000 });
      await trigger.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(300);
      const inside = () =>
        page.evaluate(() => {
          const d = document.querySelector('[role="dialog"]');
          return !!d && !!document.activeElement && d.contains(document.activeElement);
        });
      expect(await inside(), "focus moves into the dialog on open").toBe(true);
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press("Tab");
        await page.waitForTimeout(60); // base-ui focus guards hand focus back on the next task
        const trapped = await inside();
        const where = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.outerHTML.slice(0, 160));
        expect(trapped, `Tab ${i + 1} stays trapped in the dialog (active: ${where})`).toBe(true);
        const s = await inspectFocused(page);
        expect.soft(s.ok, `dialog stop ${s.desc}: ${s.reasons.join("; ")}`).toBe(true);
      }
      await page.screenshot({ path: `${SHOTS_DIR}/focus-${tag}-dialog.png` });
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden({ timeout: 5000 });
      await expect(trigger).toBeFocused({ timeout: 3000 });
    });
  });
}
