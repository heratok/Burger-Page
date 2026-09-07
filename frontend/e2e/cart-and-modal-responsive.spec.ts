import { test, expect } from '@playwright/test';
import path from 'node:path';

const ARTIFACT_DIR = 'C:/Users/hecto/.gemini/antigravity-cli/brain/dce1fd27-a78b-49ab-be07-793a91bddc9d';

test.describe('Cart and AdditionsModal Responsive at 320x568', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('handles 200-char observation without card overflow and edits cleanly in modal', async ({ page }) => {
    await page.goto('/rosto');

    // Wait for catalog to load
    const catalog = page.locator('#storefront-catalog');
    await expect(catalog).toBeVisible({ timeout: 15000 });

    // Open first product modal
    const firstProduct = catalog.locator('div[role="listitem"] [role="button"]').first();
    await expect(firstProduct).toBeVisible({ timeout: 10000 });
    await firstProduct.click();

    // Verify modal is open
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Type 200 continuous "s" characters in observaciones
    const longObservation = 's'.repeat(200);
    const textarea = modal.locator('textarea#observaciones');
    await expect(textarea).toBeVisible();
    await textarea.fill(longObservation);

    // Add to cart
    const addToCartBtn = modal.locator('button', { hasText: /Agregar/i });
    await expect(addToCartBtn).toBeVisible();
    await addToCartBtn.click();
    await expect(modal).toBeHidden();

    // Open cart via floating mobile bar
    const cartBtn = page.locator('button', { hasText: /Ver orden/i }).first();
    await expect(cartBtn).toBeVisible({ timeout: 10000 });
    await cartBtn.click();

    // Wait for cart view
    const cartHeader = page.getByRole('heading', { name: /Tu pedido/i });
    await expect(cartHeader).toBeVisible({ timeout: 10000 });

    // Verify no document horizontal scroll at 320px
    const docOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(docOverflow).toBeFalsy();

    // Verify cart card does not overflow its container
    const cartItem = page.locator('ul li').first();
    await expect(cartItem).toBeVisible();

    const itemOverflow = await cartItem.evaluate((el) => {
      return el.scrollWidth > el.clientWidth;
    });
    expect(itemOverflow).toBeFalsy();

    // Take screenshot of cart with 200 char note
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'cart-320px-200char-fixed.png'),
      fullPage: false,
    });

    // Click edit (pencil button) on cart item
    const editBtn = cartItem.locator('button[aria-label^="Editar"]');
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Verify AdditionsModal opens in edit mode
    await expect(modal).toBeVisible();
    const modalTitle = modal.locator('h2');
    await expect(modalTitle).toContainText(/Editar/i);

    // Verify modal content does not cause horizontal scroll
    const modalOverflow = await modal.evaluate((el) => {
      return el.scrollWidth > el.clientWidth;
    });
    expect(modalOverflow).toBeFalsy();

    // Verify the "Guardar cambios" button is visible and actionable
    const saveChangesBtn = modal.locator('button', { hasText: /Guardar cambios/i });
    await expect(saveChangesBtn).toBeVisible();

    // Wait for slide-up/fade-in animation to settle
    await page.waitForTimeout(400);

    // Take screenshot of modal top in edit mode at 320x568
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'modal-edit-320x568-fixed.png'),
      fullPage: false,
    });

    // Scroll to the observaciones textarea inside modal
    await textarea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    // Take screenshot showing the 200-char observation inside the modal
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'modal-edit-textarea-320x568.png'),
      fullPage: false,
    });

    // Click save changes
    await saveChangesBtn.click();
    await expect(modal).toBeHidden();

    // Verify cart item is still rendered cleanly
    await expect(cartItem).toBeVisible();
  });
});
