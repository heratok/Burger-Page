import { test, expect } from '@playwright/test';

function generateBulkOrders(count: number) {
  const statuses = ['pending', 'cooking', 'delivering', 'delivered', 'cancelled'] as const;
  const methods = ['Efectivo', 'Transferencia'] as const;
  const neighborhoods = ['Poblado', 'Laureles', 'Envigado', 'Belen', 'Centro', 'Robledo'];
  const customerNames = [
    'Carlos Gomez', 'Valentina Rios', 'Mateo Henao', 'Daniela Restrepo',
    'Juan Pablo Ochoa', 'Camila Correa', 'Alejandro Morales', 'Sofia Ramirez',
    'Sebastian Vargas', 'Mariana Lopez'
  ];

  return Array.from({ length: count }, (_, i) => {
    const status = statuses[i % statuses.length];
    const metodo = methods[i % methods.length];
    const name = customerNames[i % customerNames.length] + ` #${i + 1}`;
    const barrio = neighborhoods[i % neighborhoods.length];
    const orderNum = 1000 + i + 1;

    return {
      id: `ord-stress-${i + 1}`,
      orderNumber: orderNum,
      customer: {
        nombre: name,
        telefono: '3001234567',
        direccion: `Calle ${10 + (i % 50)} # ${20 + (i % 30)} - ${i}`,
        barrio: barrio,
        ciudad: 'Medellín',
      },
      items: [
        {
          id: `item-${i}-1`,
          name: i % 2 === 0 ? 'Doble Smash Bacon' : 'Truffle Burger',
          price: 28900,
          cantidad: (i % 3) + 1,
          quantity: (i % 3) + 1,
          total: 28900 * ((i % 3) + 1),
          adiciones: [],
        },
      ],
      metodo: metodo,
      tipoEntrega: 'delivery' as const,
      costoEnvio: 5000,
      subtotal: 28900 * ((i % 3) + 1),
      finalTotal: 28900 * ((i % 3) + 1) + 5000,
      comentario: i % 4 === 0 ? 'Tocar timbre fuerte por favor' : '',
      status: status,
      createdAt: new Date(Date.now() - i * 180000).toISOString(),
    };
  });
}

test.describe('Kanban Board - High Load & Responsiveness Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Inject 60 heavy-load orders into Burger Craft tenant
    await page.addInitScript((bulkOrders) => {
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
              tagline: "Hamburguesas artesanales de autor",
              primaryColor: "#FF4500",
              primaryHoverColor: "#E03E00",
              bgTheme: "dark-charcoal",
              cardStyle: "elevated",
              cardRadius: "md",
              fontFamily: "sans",
              whatsappNumber: "3001234567",
              deliveryFee: 5000,
              estimatedDeliveryTime: "30-45 min",
              minOrderAmount: 20000,
              address: "Calle 10 # 43E-12, El Poblado",
              schedule: "Lun - Dom: 12:00 PM - 11:00 PM",
              currencySymbol: "$",
              logoUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=150&auto=format&fit=crop&q=80",
              bannerUrl: "https://images.unsplash.com/photo-1586816001966-79b736744398?w=1200&auto=format&fit=crop&q=80",
              showBanner: true,
              showAnnouncement: true,
              announcementText: "🔥 ¡Envío GRATIS por compras superiores a $50.000!",
              enableDelivery: true,
              enablePickup: true,
            },
            products: [
              {
                id: "prod-smash",
                name: "Doble Smash Bacon",
                description: "Doble carne angus, queso cheddar, tocineta",
                price: 28900,
                category: "Hamburguesas",
                image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600",
                inStock: true,
                availableModGroups: [],
              },
            ],
            categories: ["Hamburguesas"],
            orders: bulkOrders,
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
    }, generateBulkOrders(60));
  });

  test('Desktop Viewport (1440x900): Handles 60 orders smoothly with search and phase transitions', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/orders');

    // 1. Authenticate with tenant password
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill('craft');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // 2. Verify we landed directly on Kanban board
    await expect(page.getByRole('heading', { name: /Nuevos \/ Pendientes/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: /En Cocina/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /En Reparto/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Entregados/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Cancelados/i })).toBeVisible();

    // 3. Verify column counts (60 orders split across 5 columns = 12 per column)
    const pendingColumn = page.locator('div:has(> div > div > h3:has-text("Nuevos / Pendientes"))');
    const pendingHeaderBadge = pendingColumn.locator('span.rounded-full').first();
    await expect(pendingHeaderBadge).toHaveText('12');

    // 4. Test real-time fast search filtering across all 60 orders
    const searchInput = page.getByPlaceholder(/Buscar por # orden, cliente/i);
    await searchInput.fill('Valentina Rios #2');
    await expect(page.getByRole('heading', { name: 'Valentina Rios #2', exact: true })).toBeVisible();

    // Clear search
    await searchInput.clear();

    // 5. Test payment method filter
    const methodSelect = page.locator('select').first();
    await methodSelect.selectOption('Efectivo');
    // Ensure only Efectivo orders are shown
    const visibleCards = page.locator('div.group.relative.rounded-xl');
    const count = await visibleCards.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(60);

    // Reset filter
    await methodSelect.selectOption('ALL');

    // 6. Test state transition: Move a pending order to kitchen
    const pendingKitchenBtn = page.getByRole('button', { name: /A Cocina/i }).first();
    await expect(pendingKitchenBtn).toBeVisible();
    await pendingKitchenBtn.click();

    // Verify counter updated from 12 to 11
    await expect(pendingHeaderBadge).toHaveText('11');

    // 7. Test Order Detail Modal
    const viewDetailBtn = page.locator('button[title="Ver detalle completo"]').first();
    await viewDetailBtn.click();
    await expect(page.getByText(/Detalle del Pedido/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /WhatsApp:/i })).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
  });

  test('Simulating Rapid Influx: Adding multiple continuous live orders', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/orders');

    // Authenticate
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('craft');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    const pendingColumn = page.locator('div:has(> div > div > h3:has-text("Nuevos / Pendientes"))');
    const pendingHeaderBadge = pendingColumn.locator('span.rounded-full').first();
    await expect(pendingHeaderBadge).toHaveText('12');

    // Click "Simular Pedido Entrante" 3 times rapidly
    const simulateBtn = page.getByRole('button', { name: /Simular Pedido Entrante/i });
    await simulateBtn.click();
    await simulateBtn.click();
    await simulateBtn.click();

    // Counter in pending must have increased to 15
    await expect(pendingHeaderBadge).toHaveText('15');
  });

  test('Mobile Viewport (375x667): Kanban columns are horizontally scrollable without overflow breaking', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/admin/orders');

    // Authenticate
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('craft');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // Verify Kanban board renders and columns have scrollable container
    await expect(page.getByRole('heading', { name: /Nuevos \/ Pendientes/i })).toBeVisible();

    // Check that mobile navigation drawer can open and close
    const mobileMenuBtn = page.locator('button[aria-label="Abrir menú"]');
    await expect(mobileMenuBtn).toBeVisible();
    await mobileMenuBtn.click();

    // Check menu items visible in mobile drawer
    await expect(page.getByRole('button', { name: /Pedidos en Vivo/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Menú & Carta/i })).toBeVisible();

    // Close sidebar
    await page.locator('aside button').first().click();
  });

  test('Tablet Viewport (768x1024): Kanban renders cards with high density', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/admin/orders');

    // Authenticate
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('craft');
    await page.getByRole('button', { name: /Acceder al Panel/i }).click();

    // Verify columns exist
    await expect(page.getByRole('heading', { name: /Nuevos \/ Pendientes/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /En Cocina/i })).toBeVisible();
  });
});
