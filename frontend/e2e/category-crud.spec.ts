import { test, expect } from '@playwright/test';

test.describe('Menu & Categories Full CRUD & Customization E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Setup initial multi-tenant store with categories and products
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
              announcementText: "¡Bienvenidos a la mejor cocina artesanal!",
              enableDelivery: true,
              enablePickup: true,
            },
            products: [
              {
                id: "prod-1",
                name: "Hamburguesa Clásica Artesanal",
                description: "Carne 180g con queso cheddar y vegetales",
                price: 26000,
                category: "Hamburguesas",
                src: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800",
                inStock: true,
                isPopular: true,
                isNew: false,
              },
              {
                id: "prod-2",
                name: "Papas Rústicas al Romero",
                description: "Papas en gajos con sal marina y romero",
                price: 9000,
                category: "Acompañamientos",
                src: "https://images.unsplash.com/photo-1576107232684-1279f3908594?w=800",
                inStock: true,
                isPopular: false,
                isNew: true,
              }
            ],
            categories: ["Hamburguesas", "Acompañamientos", "Bebidas"],
            additions: [
              { id: "add-1", name: "Queso Cheddar Extra", price: 3000, available: true }
            ],
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
          }
        ]
      };
      localStorage.setItem('burger_page_platform_v2', JSON.stringify(envelope));
      localStorage.setItem('burger_page_active_rest_v2', 'rest-burger-craft');
    });
  });

  test('Owner can perform complete CRUD lifecycle on categories with product cascades and UI updates', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/menu');

    // 1. Authenticate
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill('craft');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // 2. Verify Menu Manager is rendered with categories and products
    await expect(page.getByRole('button', { name: /Gestionar Categorías/i })).toBeVisible();
    await expect(page.getByText('Hamburguesa Clásica Artesanal')).toBeVisible();

    // 3. Open Category Management Modal
    await page.getByRole('button', { name: /Gestionar Categorías/i }).click();
    const modal = page.locator('div.fixed').filter({ hasText: 'Gestionar Categorías del Menú' });
    await expect(modal).toBeVisible();

    // Verify existing categories inside modal
    await expect(modal.getByText('Hamburguesas', { exact: true })).toBeVisible();
    await expect(modal.getByText('Acompañamientos', { exact: true })).toBeVisible();
    await expect(modal.getByText('Bebidas', { exact: true })).toBeVisible();

    // 4. CREATE: Add new category "Postres Artesanales"
    const newCategoryInput = modal.getByPlaceholder(/Nueva categoría/i);
    await newCategoryInput.fill('Postres Artesanales');
    await modal.getByRole('button', { name: /Agregar/i }).click();

    // Verify it appears in active list
    await expect(modal.getByText('Postres Artesanales', { exact: true })).toBeVisible();

    // 5. UPDATE: Rename "Hamburguesas" to "Burgers Gourmet"
    const hamburguesasRow = modal.locator('div').filter({ hasText: /^Hamburguesas1 producto/ }).first();
    const editBtn = hamburguesasRow.locator('button[title="Renombrar categoría"]');
    await editBtn.click();

    const editInput = modal.locator('input[value="Hamburguesas"]');
    await expect(editInput).toBeVisible();
    await editInput.fill('Burgers Gourmet');
    await modal.getByRole('button', { name: 'Guardar', exact: true }).click();

    // Verify updated name in modal list
    await expect(modal.getByText('Burgers Gourmet', { exact: true })).toBeVisible();

    // 6. DELETE: Delete category "Bebidas"
    const bebidasRow = modal.locator('div').filter({ hasText: /^Bebidas0 productos/ }).first();
    const deleteBtn = bebidasRow.locator('button[title="Eliminar categoría"]');
    await deleteBtn.click();

    // Confirm deletion modal
    await expect(page.getByRole('heading', { name: /¿Eliminar categoría\?/i })).toBeVisible();
    await page.getByRole('button', { name: 'Eliminar categoría', exact: true }).click();

    // Verify "Bebidas" is gone from modal list
    await expect(modal.getByText('Bebidas', { exact: true })).not.toBeVisible();

    // Close Category Modal
    await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();

    // 7. Verify main Menu Manager pills & product cards reflect the new/renamed categories
    await expect(page.getByRole('button', { name: 'Burgers Gourmet', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Postres Artesanales', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bebidas', exact: true })).not.toBeVisible();

    // Product was cascaded to "Burgers Gourmet"
    const productCategoryBadge = page.locator('span:has-text("Burgers Gourmet")').first();
    await expect(productCategoryBadge).toBeVisible();

    // 8. Create a new product under the newly created category "Postres Artesanales"
    await page.getByRole('button', { name: /Crear Producto/i }).click();
    const productModal = page.locator('div.fixed').filter({ hasText: 'Nuevo Producto' });
    await expect(productModal).toBeVisible();

    await productModal.locator('input[placeholder*="Plato Especial"]').fill('Volcán de Chocolate y Arequipe');
    await productModal.locator('input[type="number"][min="1000"]').fill('16000');
    
    // Select category "Postres Artesanales" in product modal
    const categorySelect = productModal.locator('select');
    await categorySelect.selectOption('Postres Artesanales');

    await productModal.locator('textarea').fill('Delicioso volcán con centro líquido y helado de vainilla');
    await productModal.getByRole('button', { name: /Guardar en Menú/i }).click();

    // Verify new product is listed under "Postres Artesanales"
    await expect(page.getByText('Volcán de Chocolate y Arequipe')).toBeVisible();

    // 9. Navigate to public Storefront using client-side navigation and verify owner changes appear live
    await page.getByRole('button', { name: /Ver Tienda|Tienda Pública/i }).first().click();
    await expect(page.getByRole('button', { name: 'Burgers Gourmet', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Postres Artesanales', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Volcán de Chocolate y Arequipe' })).toBeVisible();
  });
});
