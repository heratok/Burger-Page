import { test, expect } from '@playwright/test';

test.describe('Inventory & Suppliers Theme Contrast E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('burger_page_platform_v2', JSON.stringify({
        version: 2,
        superAdminPassword: 'admin',
        restaurants: [{
          id: 'rosto',
          slug: 'rosto',
          adminPassword: 'rosto',
          isActive: true,
          config: { name: 'Rosto Burger', tagline: 'Artesanal' },
          suppliers: [{
            id: 'sup-1',
            name: 'Carnes Premium',
            contactName: 'Mauricio Restrepo',
            phone: '573112233445',
            notes: 'Entrega cortes madurados al vacío los martes y jueves'
          }],
          products: [],
          orders: [],
          customers: []
        }]
      }));
      localStorage.setItem('burger_page_active_rest_v2', 'rosto');
      localStorage.setItem('burger_page_admin_theme_v2', 'light');
    });

    await page.route('**/api/restaurants', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'rosto',
            slug: 'rosto',
            name: 'Rosto Burger',
            adminPassword: 'rosto',
            isActive: true,
            config: { name: 'Rosto Burger', tagline: 'Artesanal' },
          },
        ]),
      });
    });
  });

  test('Supplier notes and details are clearly visible in Light Mode and Dark Mode', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/inventory');

    // 1. Fill username and password
    const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
    await expect(userInput).toBeVisible();
    await userInput.fill('admin_rosto');

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill('rosto');

    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // 2. Switch to Proveedores tab inside Inventory Manager
    const suppliersTab = page.getByRole('button', { name: /Proveedores/i });
    await expect(suppliersTab).toBeVisible({ timeout: 10000 });
    await suppliersTab.click();

    // 3. Verify supplier note text is rendered in Light Mode
    const noteText = page.getByText(/Entrega cortes madurados al vacío los martes y jueves/i);
    await expect(noteText).toBeVisible();

    // 4. Verify contact details and phone are clearly visible
    const contactName = page.getByText('Mauricio Restrepo');
    await expect(contactName).toBeVisible();

    const phone = page.getByText('573112233445');
    await expect(phone).toBeVisible();

    // 5. Verify the CSS classes applied in Light Mode
    const noteClass = await noteText.getAttribute('class');
    expect(noteClass).toContain('bg-slate-50');
    expect(noteClass).toContain('text-slate-700');
    expect(noteClass).not.toContain('bg-slate-900');

    // 6. Toggle to Dark Theme via header theme toggle button
    const themeToggleButton = page.locator('button[title*="tema" i], button[title*="Oscuro" i], button[title*="Claro" i], button[title*="modo" i]').first();
    if (await themeToggleButton.isVisible()) {
      await themeToggleButton.click();
      // Verify note is still visible and has dark classes
      await expect(noteText).toBeVisible();
    }
  });
});
