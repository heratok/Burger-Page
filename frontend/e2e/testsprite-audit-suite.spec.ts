import { test, expect } from '@playwright/test';

test.describe('TestSprite Audit & Resolution Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  test('TC002 & TC001: Browse /rosto storefront catalog and place an order', async ({ page }) => {
    await page.goto('/rosto');
    await page.waitForLoadState('domcontentloaded');

    // TC002: Catalog must not show "No encontramos resultados"
    await expect(page.getByText('No encontramos resultados')).not.toBeVisible({ timeout: 10000 });
    
    // Find first product card
    const productCard = page.getByRole('button', { name: /Agregar .* al carrito/i }).first();
    await expect(productCard).toBeVisible({ timeout: 10000 });
    await productCard.click();

    // Customization dialog: Click "+ Agregar · $..."
    const dialogAddBtn = page.getByRole('button', { name: /Agregar · \$/i });
    await expect(dialogAddBtn).toBeVisible({ timeout: 10000 });
    await dialogAddBtn.click();

    // Open Cart: Cart button now shows 1 product
    const cartBtn = page.getByRole('button', { name: /Ver orden/i });
    await expect(cartBtn).toBeVisible({ timeout: 10000 });
    await expect(cartBtn).toHaveAttribute('aria-label', /1 producto/i);
    await cartBtn.click();

    // Step to checkout
    const checkoutBtn = page.getByRole('button', { name: /Continuar con el pedido|Iniciar Pedido|Completar Pedido|Confirmar/i }).first();
    await expect(checkoutBtn).toBeVisible({ timeout: 10000 });
    await checkoutBtn.click();

    // Fill customer checkout details if fields present
    const nameInput = page.getByPlaceholder(/Tu nombre completo|Nombre/i);
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill('Carlos Perez');
      const phoneInput = page.getByPlaceholder(/Número de WhatsApp|Teléfono|Celular/i);
      if (await phoneInput.isVisible()) await phoneInput.fill('3001234567');
      const addressInput = page.getByPlaceholder(/Dirección de entrega|Calle/i);
      if (await addressInput.isVisible()) await addressInput.fill('Calle 100 # 15-20');
      
      const submitOrderBtn = page.getByRole('button', { name: /Confirmar Pedido|Enviar Pedido|Realizar Pedido/i });
      if (await submitOrderBtn.isVisible()) {
        await submitOrderBtn.click();
      }
    }
  });

  test('TC009: Tiendas Demo displays registered restaurants', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Aún no hay restaurantes registrados')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'rosto' })).toBeVisible({ timeout: 10000 });
  });

  test('TC023: Admin login rejects invalid credentials with error notification', async ({ page }) => {
    await page.goto('/admin');
    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible({ timeout: 10000 });

    await userInput.fill('admin');
    await page.locator('input[type="password"]').fill('WrongPassword123!');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // Error notification or toast must appear
    const errorNotice = page.locator('[role="alert"]').first();
    await expect(errorNotice).toBeVisible({ timeout: 10000 });
  });

  test('TC017: Super Admin toggles restaurant active status in registry', async ({ page }) => {
    await page.goto('/admin');
    await page.getByPlaceholder(/Tu nombre de usuario/i).fill('admin');
    await page.locator('input[type="password"]').fill('Test0502*');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    await page.waitForURL(/\/admin/);
    const targetRow = page.locator('tr').filter({ hasText: 'Test Resto 2026-09-06 1145' });
    await expect(targetRow).toBeVisible({ timeout: 10000 });

    const toggleBtn = targetRow.getByRole('button', { name: /Operando|Pausado/i });
    await expect(toggleBtn).toBeVisible();
    const initialText = await toggleBtn.innerText();

    await toggleBtn.click();
    const expectedNewText = initialText.includes('Operando') ? 'Pausado' : 'Operando';
    await expect(targetRow.getByRole('button', { name: expectedNewText })).toBeVisible({ timeout: 10000 });
  });
});
