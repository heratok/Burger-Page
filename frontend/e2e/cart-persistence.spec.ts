import { test, expect } from '@playwright/test';

test.describe('Storefront Cart Persistence Across Page Reloads (CLI Suite)', () => {
  test.describe.configure({ mode: 'serial' });

  const viewports = [
    { name: 'mobile-narrow-320x568', width: 320, height: 568 },
    { name: 'mobile-375x667', width: 375, height: 667 },
    { name: 'desktop-1280x800', width: 1280, height: 800 },
  ];

  for (const vp of viewports) {
    test(`Persists cart, additions, and observations on reload at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/rosto');
      await page.waitForLoadState('domcontentloaded');

      // Clear any prior cart in this browser context
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      // 1. Select first product card
      const addBtn = page.getByRole('button', { name: /Agregar .* al carrito/i }).first();
      await expect(addBtn).toBeVisible({ timeout: 10000 });
      await addBtn.click();

      // 2. Customization modal opens
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible({ timeout: 10000 });

      // 3. Add an addition if available
      const additionAddBtn = modal.locator('ul').getByRole('button', { name: /^Agregar /i }).first();
      if (await additionAddBtn.count() > 0 && await additionAddBtn.isVisible()) {
        await additionAddBtn.click();
      }

      // 4. Fill observation / comment
      const textarea = modal.locator('textarea');
      const testObservation = `Sin cebolla, extra crujiente [${vp.name}]`;
      if (await textarea.isVisible()) {
        await textarea.fill(testObservation);
      }

      // 5. Confirm addition to cart
      const confirmAddBtn = modal.getByRole('button', { name: /Agregar · \$/i });
      await expect(confirmAddBtn).toBeVisible();
      await confirmAddBtn.click();

      // Wait for modal to dismiss
      await expect(modal).not.toBeVisible();

      // 6. Verify cart indicator shows 1 item
      const cartButton = page.getByRole('button', { name: /Ver orden/i }).first();
      await expect(cartButton).toBeVisible();
      await expect(cartButton).toContainText('1');

      // Open cart before reload and take screenshot
      await cartButton.click();
      await expect(page.getByRole('heading', { name: /Tu pedido/i })).toBeVisible();
      await expect(page.getByText(testObservation)).toBeVisible();

      await page.screenshot({
        path: `e2e/screenshots/cart-before-reload-${vp.name}.png`,
      });

      // Close cart and return to menu
      const backBtn = page.getByRole('button', { name: /Seguir comprando|Volver/i }).first();
      if (await backBtn.isVisible()) {
        await backBtn.click();
      }

      // 7. SIMULATE NETWORK DROP / ACCIDENTAL REFRESH (F5)
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      // 8. VERIFY: Cart is STILL hydrated with 1 item!
      const reloadedCartButton = page.getByRole('button', { name: /Ver orden/i }).first();
      await expect(reloadedCartButton).toBeVisible({ timeout: 10000 });
      await expect(reloadedCartButton).toContainText('1');

      // 9. Open cart after reload to assert contents
      await reloadedCartButton.click();
      await expect(page.getByRole('heading', { name: /Tu pedido/i })).toBeVisible();
      await expect(page.getByText(testObservation)).toBeVisible();

      await page.screenshot({
        path: `e2e/screenshots/cart-after-reload-${vp.name}.png`,
      });
    });
  }
});
