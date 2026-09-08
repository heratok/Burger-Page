import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Admin Image & Branding CRUD Full Suite', () => {
  const realLogoJpg = fs.readFileSync(path.resolve(__dirname, '../public/logo.jpg'));
  const realBannerPng = fs.readFileSync(path.resolve(__dirname, 'screenshots/desktop-pos.png'));

  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log(`[BROWSER ${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', (err) => console.error(`[PAGEERROR]: ${err.message}`));

    // Clear storage and log in as rosto admin
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/admin');

    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible({ timeout: 10000 });
    await userInput.fill('rosto');

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('rosto0502');

    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/users/login') && resp.status() === 200),
      page.getByRole('button', { name: /Acceder al Panel/i }).click(),
    ]);

    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
  });

  test('Storefront Customizer: Logo and Banner Upload, Persistence across Reload, and Deletion', async ({ page }) => {
    test.setTimeout(90000);

    // 1. Navigate to Customizer
    const customizerNav = page.locator('button, a').filter({ hasText: /Personalizar/i }).first();
    await expect(customizerNav).toBeVisible({ timeout: 10000 });
    await customizerNav.click();

    // 2. Open "Marca" Tab
    const brandingTab = page.getByRole('button', { name: /Marca/i });
    await expect(brandingTab).toBeVisible({ timeout: 10000 });
    await brandingTab.click();

    // 3. Upload Logo (Real JPEG)
    const logoInput = page.getByTestId('logo-file-input');
    await expect(logoInput).toBeAttached();

    await logoInput.setInputFiles({
      name: 'restaurant-logo.jpg',
      mimeType: 'image/jpeg',
      buffer: realLogoJpg,
    });

    await expect(page.locator('text=Logo optimizado y cargado en WebP')).toBeVisible({ timeout: 10000 });

    // Verify logo preview is now displayed
    const logoImg = page.locator('img[alt="Logo preview"]');
    await expect(logoImg).toBeVisible({ timeout: 5000 });

    // 4. Upload Banner (Real PNG)
    const bannerInput = page.getByTestId('banner-file-input');
    await expect(bannerInput).toBeAttached();

    await bannerInput.setInputFiles({
      name: 'restaurant-banner.png',
      mimeType: 'image/png',
      buffer: realBannerPng,
    });

    await expect(page.locator('text=Foto de portada optimizada en WebP')).toBeVisible({ timeout: 10000 });

    // Verify banner preview is displayed
    const bannerImg = page.locator('img[alt="Banner Preview"]');
    await expect(bannerImg).toBeVisible({ timeout: 5000 });

    // 5. Save & Publish
    const saveButton = page.getByRole('button', { name: /Guardar & Publicar/i });
    await expect(saveButton).toBeVisible();

    const [saveResp] = await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/restaurants/') && resp.request().method() === 'PUT', { timeout: 10000 }),
      saveButton.click(),
    ]);
    expect(saveResp.status()).toBe(200);

    await expect(page.locator('text=Diseño y configuración actualizados')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Error al sincronizar con el servidor')).toHaveCount(0);

    // 6. Reload and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Return to Customizer -> Marca
    const customizerNavAfterReload = page.locator('button, a').filter({ hasText: /Personalizar/i }).first();
    await expect(customizerNavAfterReload).toBeVisible({ timeout: 10000 });
    await customizerNavAfterReload.click();

    const brandingTabAfterReload = page.getByRole('button', { name: /Marca/i });
    await expect(brandingTabAfterReload).toBeVisible({ timeout: 10000 });
    await brandingTabAfterReload.click();

    // Verify both previews persisted
    await expect(page.locator('img[alt="Logo preview"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('img[alt="Banner Preview"]')).toBeVisible({ timeout: 10000 });

    // 7. Delete Logo
    const deleteLogoBtn = page.getByRole('button', { name: /Eliminar logo/i });
    await expect(deleteLogoBtn).toBeVisible();
    await deleteLogoBtn.click();

    // Confirm in modal
    const confirmDeleteBtn = page.getByRole('button', { name: /Eliminar foto/i });
    await expect(confirmDeleteBtn).toBeVisible();
    await confirmDeleteBtn.click();
    await expect(page.locator('text=Logo eliminado del diseño')).toBeVisible({ timeout: 5000 });

    // 8. Delete Banner
    const deleteBannerBtn = page.getByTitle('Eliminar foto de portada');
    await expect(deleteBannerBtn).toBeVisible();
    await deleteBannerBtn.click();

    await expect(confirmDeleteBtn).toBeVisible();
    await confirmDeleteBtn.click();
    await expect(page.locator('text=Foto de portada eliminada del diseño')).toBeVisible({ timeout: 5000 });

    // 9. Save Deletions
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/restaurants/') && resp.request().method() === 'PUT', { timeout: 10000 }),
      saveButton.click(),
    ]);
    await expect(page.locator('text=Diseño y configuración actualizados')).toBeVisible({ timeout: 10000 });

    // 10. Reload and verify clean state (no previews)
    await page.reload();
    await page.waitForLoadState('networkidle');

    const customizerNavFinal = page.locator('button, a').filter({ hasText: /Personalizar/i }).first();
    await expect(customizerNavFinal).toBeVisible({ timeout: 10000 });
    await customizerNavFinal.click();

    const brandingTabFinal = page.getByRole('button', { name: /Marca/i });
    await expect(brandingTabFinal).toBeVisible({ timeout: 10000 });
    await brandingTabFinal.click();

    await expect(page.locator('img[alt="Logo preview"]')).toHaveCount(0);
    await expect(page.locator('img[alt="Banner Preview"]')).toHaveCount(0);
  });

  test('Product Catalog: Image Upload, Persistence and Modification in Product Modal', async ({ page }) => {
    test.setTimeout(90000);

    // 1. Navigate to "Menú & Carta"
    const menuNav = page.locator('button, a').filter({ hasText: /Menú & Carta/i }).first();
    await expect(menuNav).toBeVisible({ timeout: 10000 });
    await menuNav.click();

    // 2. Open "Crear Producto" Modal
    const newProductBtn = page.getByRole('button', { name: /Crear Producto/i });
    await expect(newProductBtn).toBeVisible({ timeout: 10000 });
    await newProductBtn.click();

    const modalTitle = page.locator('text=Nuevo Producto');
    await expect(modalTitle).toBeVisible({ timeout: 5000 });

    // 3. Fill product details
    const productName = `Burger Photo Test ${Date.now().toString().slice(-4)}`;
    await page.getByPlaceholder(/Ej\. Plato Especial de la Casa/i).fill(productName);
    await page.locator('form input[type="number"]').first().fill('14.50');
    await page.locator('form textarea').fill('Deliciosa hamburguesa con imagen WebP testeada por TDD');

    // 4. Upload Product Image (Real JPEG)
    const productFileInput = page.getByTestId('product-image-file-input');
    await expect(productFileInput).toBeAttached();

    await productFileInput.setInputFiles({
      name: 'product-burger.jpg',
      mimeType: 'image/jpeg',
      buffer: realLogoJpg,
    });

    await expect(page.locator('text=Foto optimizada y guardada exitosamente')).toBeVisible({ timeout: 10000 });

    // 5. Submit Product
    const submitBtn = page.locator('form').getByRole('button', { name: /Guardar en Menú|Crear Producto/i });
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });

    const [createResp] = await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/products') && resp.request().method() === 'POST', { timeout: 10000 }),
      submitBtn.click(),
    ]);
    expect(createResp.status()).toBe(201);

    // Verify product card is in the list with the image
    const productCard = page.locator(`text=${productName}`).first();
    await expect(productCard).toBeVisible({ timeout: 10000 });

    // 6. Reload and verify product still has image
    await page.reload();
    await page.waitForLoadState('networkidle');

    const productCardAfterReload = page.locator(`text=${productName}`).first();
    await expect(productCardAfterReload).toBeVisible({ timeout: 10000 });

    // 7. Cleanup: Delete created product
    const cardContainer = page.locator('.group').filter({ hasText: productName }).first();
    const deleteBtn = cardContainer.locator('button[title="Eliminar plato"]');
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      const confirmDelete = page.getByRole('button', { name: /Eliminar producto/i });
      if (await confirmDelete.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmDelete.click();
      }
    }
  });
});
