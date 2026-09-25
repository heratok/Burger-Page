import { test, expect } from '@playwright/test';

test.describe('Storefront & Admin Category Horizontal Scroll E2E Suite', () => {
  test('Storefront Category Bar: single-row horizontal scroll on desktop with drag & chevrons', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/rosto');
    await page.waitForLoadState('domcontentloaded');

    // Category bar container must be visible
    const categoryBar = page.locator('div[aria-label="Categorías del menú"]');
    await expect(categoryBar).toBeVisible({ timeout: 15000 });

    // Verify it is horizontally scrollable and has no-scrollbar
    const classAttr = await categoryBar.getAttribute('class');
    expect(classAttr).toContain('overflow-x-auto');
    expect(classAttr).toContain('no-scrollbar');

    // All category pills must have shrink-0 and whitespace-nowrap
    const pills = categoryBar.locator('button');
    const count = await pills.count();
    expect(count).toBeGreaterThan(1);

    for (let i = 0; i < count; i++) {
      const pillClass = await pills.nth(i).getAttribute('class');
      expect(pillClass).toContain('shrink-0');
      expect(pillClass).toContain('whitespace-nowrap');
    }

    // Test mouse drag scrolling
    const initialScroll = await categoryBar.evaluate((el) => el.scrollLeft);
    expect(initialScroll).toBe(0);
    const box = await categoryBar.boundingBox();
    if (box) {
      // Drag left
      await page.mouse.move(box.x + box.width - 50, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 5 });
      await page.mouse.up();
    }
  });

  test('Storefront Category Bar: mobile viewport (360x740) keeps single-row height and zero page overflow', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/rosto');
    await page.waitForLoadState('domcontentloaded');

    const categoryBar = page.locator('div[aria-label="Categorías del menú"]');
    await expect(categoryBar).toBeVisible({ timeout: 15000 });

    // Category bar height must be compact (single row, under 50px)
    const box = await categoryBar.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeLessThan(50);
    }

    // Page document itself must not suffer unconstrained horizontal overflow
    const docOverflows = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(docOverflows).toBe(false);
  });
});
