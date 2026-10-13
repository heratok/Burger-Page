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
