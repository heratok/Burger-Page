import { test, expect, type Page } from "@playwright/test";
import { TEST_RESTAURANT } from "./test-fixture";

type Rec = { name: string; target: string; props: string[] };

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

/** Records every CSS animation that starts, with the properties its keyframes touch. */
async function recordAnimations(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __anims: Rec[] };
    w.__anims = [];
    document.addEventListener(
      "animationstart",
      (e) => {
        const t = e.target as HTMLElement;
        const anim = t
          .getAnimations()
          .find((a) => (a as CSSAnimation).animationName === e.animationName);
        const props = new Set<string>();
        const frames = (anim?.effect as KeyframeEffect | undefined)?.getKeyframes() ?? [];
        for (const f of frames)
          for (const k of Object.keys(f))
            if (!["offset", "easing", "composite", "computedOffset"].includes(k))
              props.add(k);
        w.__anims.push({
          name: e.animationName,
          target: t.getAttribute("role") ?? t.tagName,
          props: [...props],
        });
      },
      true,
    );
  });
}

const readAnims = (page: Page) =>
  page.evaluate(() => (window as unknown as { __anims: Rec[] }).__anims);

/** Opens a base-ui Dialog (EditUserModal) from the superadmin users directory. */
async function openEditUserDialog(page: Page) {
  await login(page, "admin", "admin");
  await page.goto("/admin/users");
  const edit = page.getByRole("button", { name: /^Editar usuario /i }).first();
  await expect(edit).toBeVisible({ timeout: 15000 });
  await recordAnimations(page);
  await edit.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 5000 });
  return dialog;
}

for (const mode of ["reduce", "no-preference"] as const) {
  test.describe(`motion: ${mode}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.emulateMedia({ reducedMotion: mode });
    });

    test("dialog opens and closes with the expected animation profile", async ({ page }) => {
      test.setTimeout(90000);
      const dialog = await openEditUserDialog(page);
      await page.waitForTimeout(300);
      const opened = await readAnims(page);
      expect(opened.length, "dialog should animate in").toBeGreaterThan(0);

      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden({ timeout: 5000 });
      await page.waitForTimeout(300);
      const all = await readAnims(page);
      // EditUserModal unmounts with its parent, so an exit animation is optional; any that ran is checked below.

      if (mode === "reduce") {
        expect(all.map((x) => x.name)).toContain("rm-fade-in");
        for (const x of all) {
          expect(x.name, `${x.name} must be an intentional reduced-motion keyframe`).toMatch(/^rm-/);
          const spatial = x.props.filter((p) => /transform|scale|translate|rotate/.test(p));
          expect(spatial, `${x.name} must not move or scale`).toEqual([]);
        }
      } else {
        // Over-removal guard: the default experience still scales/translates in.
        expect(all.map((x) => x.name)).toContain("enter");
        const props = new Set(all.flatMap((x) => x.props));
        expect(props.has("transform") || props.has("scale")).toBe(true);
      }
    });

    test("loop animations and scroll behavior follow the preference", async ({ page }) => {
      await page.goto(`/${TEST_RESTAURANT.slug}`);
      await expect(page.locator("body")).toContainText(
        /Tienda de Pruebas|Cl[aá]sica/i,
        { timeout: 15000 },
      );
      const probe = await page.evaluate(() => {
        const host = document.createElement("div");
        host.innerHTML = `
          <div id="p-pulse" class="animate-pulse">a</div>
          <div id="p-skel" class="skeleton">b</div>
          <div id="p-ping" class="animate-ping">c</div>
          <div id="p-spin" class="animate-spin">d</div>
          <div id="p-smooth" class="scroll-smooth">e</div>`;
        document.body.appendChild(host);
        const cs = (id: string) => getComputedStyle(document.getElementById(id)!);
        return {
          pulse: cs("p-pulse").animationName,
          skel: cs("p-skel").animationName,
          ping: cs("p-ping").animationName,
          spin: cs("p-spin").animationName,
          smooth: cs("p-smooth").scrollBehavior,
        };
      });
      if (mode === "reduce") {
        expect(probe).toEqual({
          pulse: "none",
          skel: "none",
          ping: "none",
          spin: "rm-breathe",
          smooth: "auto",
        });
      } else {
        expect(probe.pulse).toBe("pulse");
        expect(probe.skel).toBe("pulse-soft");
        expect(probe.ping).toBe("ping");
        expect(probe.spin).toBe("spin");
        expect(probe.smooth).toBe("smooth");
      }
    });

    test("only declared progress spinners loop forever on live screens", async ({ page }) => {
      await page.goto(`/${TEST_RESTAURANT.slug}`);
      await expect(page.locator("body")).toContainText(
        /Tienda de Pruebas|Cl[aá]sica/i,
        { timeout: 15000 },
      );
      await page.waitForTimeout(500);
      const loops = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => (a.effect?.getComputedTiming().iterations ?? 1) === Infinity)
          .map((a) => {
            const t = (a.effect as KeyframeEffect).target as HTMLElement | null;
            return {
              name: (a as CSSAnimation).animationName,
              spinner: !!t?.closest(".animate-spin"),
              cls: t?.className?.toString().slice(0, 60) ?? "",
            };
          }),
      );
      if (mode === "reduce") {
        const bad = loops.filter((l) => !l.spinner);
        expect(bad, "non-spinner infinite animations under reduce").toEqual([]);
      }
    });
  });
}
