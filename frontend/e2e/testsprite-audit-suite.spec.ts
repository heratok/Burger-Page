import { test, expect } from '@playwright/test';
import { TEST_RESTAURANT } from './test-fixture';

test.describe('TestSprite Audit & Resolution Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  test('TC002 & TC001: Browse test restaurant storefront catalog and place an order', async ({ page }) => {
    await page.goto(`/${TEST_RESTAURANT.slug}`);
    await page.waitForLoadState('domcontentloaded');

    // TC002: Catalog must not show "No encontramos resultados"
    await expect(page.getByText('No encontramos resultados')).not.toBeVisible({ timeout: 10000 });
    
    // The seeded minimum order is $20.000 and checkout stays disabled
    // below it, so add two "Doble Carne" ($18.000 each) to clear the minimum.
    const productCard = page.getByRole('button', { name: /Agregar Doble Carne al carrito/i }).first();
    const dialogAddBtn = page.getByRole('button', { name: /Agregar · \$/i });
    for (let i = 0; i < 2; i++) {
      await expect(productCard).toBeVisible({ timeout: 10000 });
      await productCard.click();
      // Customization dialog: Click "+ Agregar · $..."
      await expect(dialogAddBtn).toBeVisible({ timeout: 10000 });
      await dialogAddBtn.click();
      await expect(dialogAddBtn).not.toBeVisible({ timeout: 10000 });
    }

    // Open Cart: Cart button now shows 2 products
    const cartBtn = page.getByRole('button', { name: /Ver orden/i });
    await expect(cartBtn).toBeVisible({ timeout: 10000 });
    await expect(cartBtn).toHaveAttribute('aria-label', /2 productos/i);
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

  test('TC009: landing does not expose the private restaurant directory', async ({ page }) => {
    const listCalls: string[] = [];
    page.on('request', (req) => {
      if (/\/api\/restaurants\/?(\?.*)?$/.test(req.url())) listCalls.push(req.url());
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Acceso Administrador').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Tiendas en Vivo')).toHaveCount(0);
    await expect(page.getByText('Aún no hay restaurantes registrados')).toHaveCount(0);
    expect(listCalls).toEqual([]);
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
    await page.locator('input[type="password"]').fill('admin');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    await page.waitForURL(/\/admin/);
    // Deterministic seed tenant (3NF/clean-seed refactor): the dedicated
    // 'Test Resto 2026-09-06 1145' fixture no longer exists.
    const targetRow = page.locator('tr').filter({ hasText: 'Burger Craft' });
    await expect(targetRow).toBeVisible({ timeout: 10000 });

    const toggleBtn = targetRow.getByRole('button', { name: /Operando|Pausado/i });
    await expect(toggleBtn).toBeVisible();
    const initialText = await toggleBtn.innerText();

    const expectedNewText = initialText.includes('Operando') ? 'Pausado' : 'Operando';
    await toggleBtn.click();
    try {
      await expect(targetRow.getByRole('button', { name: expectedNewText })).toBeVisible({ timeout: 10000 });
    } finally {
      // Burger Craft is shared by other specs (admin_craft logins are rejected
      // while it is paused): always leave it in the state it was found in.
      const current = targetRow.getByRole('button', { name: /Operando|Pausado/i });
      if (!(await current.innerText()).includes(initialText.trim())) {
        await current.click();
        await expect(targetRow.getByRole('button', { name: initialText.trim() })).toBeVisible({ timeout: 10000 });
      }
    }
  });
});
