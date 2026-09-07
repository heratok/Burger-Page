import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'Mobile Narrow (320px)', width: 320, height: 640 },
  { name: 'Mobile Standard (390px)', width: 390, height: 844 },
  { name: 'Tablet (768px)', width: 768, height: 1024 },
  { name: 'Desktop (1280px)', width: 1280, height: 800 },
];

for (const vp of VIEWPORTS) {
  test.describe(`Storefront Collapsible Sections - ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`verifies layout, no horizontal overflow, and collapse/expand at ${vp.width}px`, async ({ page }) => {
      // Navigate to active tenant storefront route
      await page.goto('/rosto');

      // Wait for catalog and products to load
      const catalog = page.locator('#storefront-catalog');
      await expect(catalog).toBeVisible({ timeout: 15000 });

      // Verify no horizontal document overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll).toBeFalsy();

      // Find all category section headers
      const sectionHeaderBtns = page.locator('#storefront-catalog section > button[aria-expanded]');
      const headerCount = await sectionHeaderBtns.count();
      expect(headerCount).toBeGreaterThan(0);

      const firstHeader = sectionHeaderBtns.first();
      await expect(firstHeader).toHaveAttribute('aria-expanded', 'true');

      // Get first section products container
      const firstSection = page.locator('#storefront-catalog section').first();
      const productsList = firstSection.locator('[role="list"]');
      await expect(productsList).toBeVisible();

      // Click to collapse
      await firstHeader.click();
      await expect(firstHeader).toHaveAttribute('aria-expanded', 'false');
      await expect(productsList).toBeHidden();

      // Click to expand again
      await firstHeader.click();
      await expect(firstHeader).toHaveAttribute('aria-expanded', 'true');
      await expect(productsList).toBeVisible();

      // Collapse again, then click the category pill to verify auto-expand
      await firstHeader.click();
      await expect(productsList).toBeHidden();

      const categoryName = (await firstHeader.locator('h2').textContent())?.trim() || '';
      if (categoryName) {
        const pill = page.locator('div[aria-label="Categorías del menú"] button').filter({ hasText: categoryName }).first();
        if (await pill.isVisible()) {
          await pill.click();
          await expect(firstHeader).toHaveAttribute('aria-expanded', 'true');
          await expect(productsList).toBeVisible();
        }
      }
    });
  });
}
