import { test, expect } from '@playwright/test';

test.describe('ProductModal Responsive & Dark/Light Mode Audit', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const envelope = {
        version: 2,
        superAdminPassword: "admin",
        restaurants: [
          {
            id: "rest-burger-craft",
            name: "Burger Craft",
            slug: "burger-craft",
            adminPassword: "craft",
            isActive: true,
            config: {
              name: "Burger Craft",
              tagline: "Cocina artesanal de autor",
              primaryColor: "#E63946",
              primaryHoverColor: "#F25C69",
              bgTheme: "dark-charcoal",
              cardStyle: "elevated",
              cardRadius: "md",
              fontFamily: "sans",
              whatsappNumber: "3001234567",
              deliveryFee: 5000,
              estimatedDeliveryTime: "30-45 min",
              minOrderAmount: 20000,
              address: "Calle 72 # 11-85",
              schedule: "Lun - Dom: 12:00 PM - 11:00 PM",
              currencySymbol: "$",
              logoUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=150&auto=format&fit=crop&q=80",
              bannerUrl: "https://images.unsplash.com/photo-1586816001966-79b736744398?w=1200&auto=format&fit=crop&q=80",
              showBanner: true,
              showAnnouncement: true,
              announcementText: "¡Bienvenidos!",
              enableDelivery: true,
              enablePickup: true,
            },
            products: [
              {
                id: "prod-1",
                name: "Hamburguesa Clásica Artesanal",
                description: "Carne 180g con queso cheddar y vegetales frescos en pan brioche",
                price: 26000,
                category: "Hamburguesas",
                src: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800",
                inStock: true,
                isPopular: true,
                isNew: false,
                preparationTimeMinutes: 15,
              },
            ],
            categories: ["Hamburguesas", "Acompañamientos", "Bebidas"],
            additions: [],
            orders: [],
            inventory: [],
            suppliers: [],
            customers: [],
            settings: {
              enableOnlineOrders: true,
              enableSoundNotifications: true,
              autoConfirmOrders: false,
              taxRate: 0.08,
            },
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      };
      localStorage.setItem('burger_page_platform_v2', JSON.stringify(envelope));
      localStorage.setItem('burger_page_active_rest_v2', 'rest-burger-craft');
    });
  });

  const viewports = [
    { name: '320x568', width: 320, height: 568 },
    { name: '375x667', width: 375, height: 667 },
    { name: '768x1024', width: 768, height: 1024 },
  ];

  for (const vp of viewports) {
    for (const theme of ['light', 'dark']) {
      test(`Audit ProductModal at ${vp.name} in ${theme} mode`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/admin/menu');

        // Authenticate
        const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
        await expect(userInput).toBeVisible({ timeout: 10000 });
        await userInput.fill('admin_craft');
        const passwordInput = page.locator('input[type="password"]');
        await expect(passwordInput).toBeVisible();
        await passwordInput.fill('craft');
        await page.getByRole('button', { name: /Acceder al Panel/i }).click();

        // Wait for MenuManager to load
        await expect(page.getByRole('button', { name: /Gestionar Categorías/i })).toBeVisible({ timeout: 10000 });

        // Check theme and toggle if needed
        const currentThemeIsDark = await page.evaluate(() => {
          return document.querySelector('.min-h-screen')?.classList.contains('dark') || false;
        });

        if (theme === 'dark' && !currentThemeIsDark) {
          const darkBtn = page.locator('button[title="Cambiar a modo oscuro"]');
          if (await darkBtn.count() > 0) await darkBtn.click();
        } else if (theme === 'light' && currentThemeIsDark) {
          const lightBtn = page.locator('button[title="Cambiar a modo claro"]');
          if (await lightBtn.count() > 0) await lightBtn.click();
        }

        // Open edit product modal for the existing product
        const editBtn = page.getByTitle('Editar plato').or(page.getByRole('button', { name: /editar/i }));
        await expect(editBtn.first()).toBeVisible();
        await editBtn.first().click();

        // Verify modal visible
        const modal = page.locator('div.fixed.inset-0').filter({ hasText: /Editar |Nuevo Producto/i });
        await expect(modal).toBeVisible();

        // Check photo section visibility
        const photoSection = modal.locator('label:has-text("Foto del Producto") ~ div.relative.overflow-hidden').first();
        await expect(photoSection).toBeVisible();

        const box = await photoSection.boundingBox();
        console.log(`[${vp.name} - ${theme}] Photo section bounding box:`, box);

        // Screenshot modal top
        await page.screenshot({
          path: `e2e/screenshots/modal-${vp.name}-${theme}-top.png`,
        });

        // Scroll modal down to inspect photo actions and footer
        const modalContainer = modal.locator('> div');
        await modalContainer.evaluate((el) => { el.scrollTop = el.scrollHeight / 2; });
        await page.waitForTimeout(200);
        await page.screenshot({
          path: `e2e/screenshots/modal-${vp.name}-${theme}-mid.png`,
        });

        await modalContainer.evaluate((el) => { el.scrollTop = el.scrollHeight; });
        await page.waitForTimeout(200);
        await page.screenshot({
          path: `e2e/screenshots/modal-${vp.name}-${theme}-bottom.png`,
        });

        // Check if there is horizontal overflow in modal content
        const scrollWidth = await modalContainer.evaluate((el) => el.scrollWidth);
        const clientWidth = await modalContainer.evaluate((el) => el.clientWidth);
        console.log(`[${vp.name} - ${theme}] Modal scrollWidth: ${scrollWidth}, clientWidth: ${clientWidth}`);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
      });
    }
  }
});
