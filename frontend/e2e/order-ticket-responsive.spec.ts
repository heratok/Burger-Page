import { test, expect } from '@playwright/test';

test.describe('Order Ticket and Comanda Responsive Verification (Mobile, Tablet, Desktop)', () => {
  const initialOrder101 = {
    id: 'ord-101',
    orderNumber: 101,
    customer: {
      name: 'Carlos Gómez',
      phone: '3001234567',
      address: 'Calle 10 # 4-20',
      barrio: 'El Poblado',
    },
    items: [
      {
        id: 'p1',
        productName: 'Hamburguesa Doble Queso',
        unitPrice: 25000,
        quantity: 2,
        observation: 'Término medio',
        additions: [{ additionName: 'Tocineta', unitPrice: 4000, quantity: 1 }],
      },
    ],
    subtotal: 54000,
    deliveryFee: 5000,
    finalTotal: 59000,
    paymentMethod: 'Efectivo',
    paymentAmount: 60000,
    changeAmount: 1000,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const productsList = [
    {
      id: 'p1',
      name: 'Hamburguesa Doble Queso',
      price: 25000,
      category: 'Hamburguesas',
      src: '',
      description: 'Carne y doble queso cheddar',
      inStock: true,
    },
    {
      id: 'p2',
      name: 'Papas Rústicas',
      price: 12000,
      category: 'Acompañamientos',
      src: '',
      description: 'Crujientes con paprika',
      inStock: true,
    },
  ];

  let serverOrders: any[] = [];

  test.beforeEach(async ({ page }) => {
    serverOrders = [{ ...initialOrder101 }];

    await page.addInitScript(() => {
      localStorage.setItem(
        'burger_page_platform_v2',
        JSON.stringify({
          version: 2,
          superAdminPassword: 'admin',
          restaurants: [
            {
              id: 'rest-burger-craft',
              slug: 'burger-craft',
              adminPassword: 'craft',
              isActive: true,
              config: { name: 'Burger Craft', tagline: 'Artesanal', deliveryFee: 5000 },
              products: [
                {
                  id: 'p1',
                  name: 'Hamburguesa Doble Queso',
                  price: 25000,
                  category: 'Hamburguesas',
                  src: '',
                  description: 'Carne y doble queso cheddar',
                  inStock: true,
                },
                {
                  id: 'p2',
                  name: 'Papas Rústicas',
                  price: 12000,
                  category: 'Acompañamientos',
                  src: '',
                  description: 'Crujientes con paprika',
                  inStock: true,
                },
              ],
              categories: ['Hamburguesas', 'Acompañamientos'],
              orders: [
                {
                  id: 'ord-101',
                  orderNumber: 101,
                  customer: {
                    nombre: 'Carlos Gómez',
                    telefono: '3001234567',
                    direccion: 'Calle 10 # 4-20',
                    barrio: 'El Poblado',
                  },
                  items: [
                    {
                      id: 'p1',
                      name: 'Hamburguesa Doble Queso',
                      price: 25000,
                      cantidad: 2,
                      total: 50000,
                      observacion: 'Término medio',
                      adiciones: [{ name: 'Tocineta', price: 4000, cantidad: 1 }],
                    },
                  ],
                  total: 54000,
                  deliveryFee: 5000,
                  finalTotal: 59000,
                  metodo: 'Efectivo',
                  pagoCon: '60000',
                  cambio: 1000,
                  status: 'pending',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
              customers: [
                {
                  id: 'cust-1',
                  nombre: 'Carlos Gómez',
                  telefono: '3001234567',
                  direccion: 'Calle 10 # 4-20',
                  barrio: 'El Poblado',
                  totalOrders: 1,
                  totalSpent: 59000,
                  lastOrderDate: new Date().toISOString(),
                  loyaltyTier: 'bronze',
                },
              ],
              additions: [
                { id: 'add-1', name: 'Tocineta', price: 4000 },
                { id: 'add-2', name: 'Queso Extra', price: 3000 },
              ],
            },
          ],
        })
      );
      localStorage.setItem('burger_page_active_rest_v2', 'rest-burger-craft');
      localStorage.setItem('burger_page_orders_view_mode', 'feed');
    });

    await page.route('**/api/users/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: 'mock-token-ticket',
          user: {
            id: 'usr-admin-craft',
            username: 'admin_craft',
            role: 'restaurant_admin',
            restaurantId: 'rest-burger-craft',
          },
        }),
      });
    });

    await page.route('**/api/restaurants**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'rest-burger-craft',
            slug: 'burger-craft',
            name: 'Burger Craft',
            isActive: true,
            config: { name: 'Burger Craft', tagline: 'Artesanal', deliveryFee: 5000 },
          },
        ]),
      });
    });

    await page.route('**/api/products*', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(productsList),
      });
    });

    await page.route('**/api/orders?*', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(serverOrders),
      });
    });

    await page.route('**/api/orders', async (route) => {
      if (route.request().method() === 'POST') {
        const payload = route.request().postDataJSON?.() ?? {};
        const newOrder = {
          id: `ord-${Date.now()}`,
          orderNumber: 102,
          customer: payload.customer ?? { name: 'Cliente Mostrador' },
          items: payload.items ?? [
            {
              id: 'p1',
              productName: 'Hamburguesa Doble Queso',
              unitPrice: 25000,
              quantity: 1,
            },
          ],
          subtotal: payload.subtotal ?? 25000,
          deliveryFee: payload.deliveryFee ?? 0,
          finalTotal: payload.finalTotal ?? 25000,
          paymentMethod: payload.paymentMethod ?? 'Efectivo',
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        serverOrders.push(newOrder);
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(newOrder),
        });
      }
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(serverOrders),
      });
    });

    await page.route('**/api/orders/stream-token', (route) => {
      return route.fulfill({ status: 200, json: { token: 'mock-stream-token' } });
    });
    await page.route('**/api/orders/stream*', (route) => {
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' });
    });
    await page.route('**/api/customers*', (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ status: 200, json: [] });
    });
    await page.route('**/api/inventory*', (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ status: 200, json: [] });
    });
    await page.route('**/api/suppliers*', (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ status: 200, json: [] });
    });
    await page.route('**/api/tables*', (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ status: 200, json: [] });
    });
  });

  const testViewports = [
    { name: 'desktop-1280x800', width: 1280, height: 800, category: 'desktop' },
    { name: 'desktop-1440x900', width: 1440, height: 900, category: 'desktop' },
    { name: 'tablet-portrait-768x1024', width: 768, height: 1024, category: 'tablet' },
    { name: 'tablet-landscape-1024x768', width: 1024, height: 768, category: 'tablet' },
    { name: 'mobile-390x844', width: 390, height: 844, category: 'mobile' },
    { name: 'mobile-360x740', width: 360, height: 740, category: 'mobile' },
  ];

  for (const vp of testViewports) {
    test(`Viewport ${vp.name} (${vp.category}): Ticket & POS Comanda Flow Verification`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/admin/orders');

      // Login
      const userInput = page.getByPlaceholder(/Tu nombre de usuario/i);
      await expect(userInput).toBeVisible({ timeout: 10000 });
      await userInput.fill('admin_craft');
      await page.locator('input[type="password"]').fill('craft');
      await page.getByRole('button', { name: /Acceder al Panel/i }).click();

      // Ensure orders board is loaded
      const orderCardHeader = page.getByText('#101').first();
      await expect(orderCardHeader).toBeVisible({ timeout: 10000 });

      // Verify no horizontal overflow on initial board load
      const boardOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(boardOverflow).toBe(false);

      // =================================================================
      // 1. Quick print from card -> OrderTicketModal
      // =================================================================
      const printBtn = page.getByRole('button', { name: 'Imprimir ticket / comanda' }).first();
      await expect(printBtn).toBeVisible();
      await printBtn.click();

      // Modal dialog must be open
      const ticketModal = page.getByRole('dialog', { name: /Imprimir Comanda \/ Ticket/i });
      await expect(ticketModal).toBeVisible();
      await expect(page.locator('#printable-ticket')).toBeVisible();

      // Verify Full Ticket contains order number and store name
      await expect(page.locator('#printable-ticket')).toContainText('TICKET DE VENTA / DESPACHO');
      await expect(page.locator('#printable-ticket')).toContainText('ORDEN #101');

      // Tablet and Desktop verification: Left panel with quick overview card must be present
      if (vp.category === 'desktop' || vp.category === 'tablet') {
        await expect(ticketModal.getByText(/Cant\. Ítems:/i)).toBeVisible();
        await expect(ticketModal.getByText(/Registro:/i)).toBeVisible();
      }

      // Verify no horizontal scroll in ticket modal
      const ticketModalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(ticketModalOverflow).toBe(false);

      // Screenshot 1: Full Ticket Preview
      await page.screenshot({
        path: `frontend/e2e/screenshots/ticket-responsive/${vp.name}-ticket-full.png`,
      });

      // =================================================================
      // 2. Tab switcher: Kitchen Comanda (KOT)
      // =================================================================
      const kitchenTab = page.getByRole('tab', { name: /Comanda Cocina/i });
      await expect(kitchenTab).toBeVisible();
      await kitchenTab.click();

      // Thermal paper preview must update to Kitchen ticket format
      await expect(page.locator('#printable-ticket')).toContainText('*** COMANDA COCINA (KOT) ***');
      await expect(page.locator('#printable-ticket')).toContainText('--- ENVIADO A COCINA ---');

      // Screenshot 2: Kitchen Comanda Preview
      await page.screenshot({
        path: `frontend/e2e/screenshots/ticket-responsive/${vp.name}-ticket-kitchen.png`,
      });

      // Switch back to Full Ticket
      const fullTab = page.getByRole('tab', { name: /Ticket Completo/i });
      await fullTab.click();
      await expect(page.locator('#printable-ticket')).toContainText('TICKET DE VENTA / DESPACHO');

      // Close ticket modal
      const closeTicketBtn = page.getByRole('button', { name: 'Cerrar vista previa' });
      await closeTicketBtn.click();
      await expect(ticketModal).not.toBeVisible();

      // =================================================================
      // 3. OrderDetailModal -> Print Button Flow
      // =================================================================
      const detailsBtn = page.getByTitle(/Ver detalles completos de la orden/i).first();
      await expect(detailsBtn).toBeVisible();
      await detailsBtn.click();

      // OrderDetailModal is visible
      const detailModal = page.getByRole('dialog', { name: /Detalles de la Orden #101/i });
      await expect(detailModal).toBeVisible();

      // Detail modal print button
      const detailPrintBtn = page.getByRole('button', { name: 'Imprimir comanda / ticket' });
      await expect(detailPrintBtn).toBeVisible();
      await detailPrintBtn.click();

      // OrderTicketModal should now open over/from OrderDetailModal
      await expect(ticketModal).toBeVisible();
      await expect(page.locator('#printable-ticket')).toBeVisible();

      // Close ticket modal, then close detail modal
      await page.getByRole('button', { name: 'Cerrar vista previa' }).click();
      await expect(ticketModal).not.toBeVisible();
      await page.getByRole('button', { name: 'Cerrar detalles' }).click();
      await expect(detailModal).not.toBeVisible();

      // =================================================================
      // 4. POS (Nueva Venta): Responsive Catalog & Cart + Print On Save
      // =================================================================
      const nuevaVentaBtn = page.getByRole('button', { name: 'Nueva Venta' }).first();
      await expect(nuevaVentaBtn).toBeVisible();
      await nuevaVentaBtn.click();

      // POS Modal is visible
      await expect(page.getByText('Punto de Venta — Nueva Venta')).toBeVisible();

      if (vp.category === 'desktop' || vp.category === 'tablet') {
        // On tablet and desktop, both catalog and cart register MUST be simultaneously visible side-by-side
        await expect(page.getByPlaceholder('Buscar producto por nombre...')).toBeVisible();
        await expect(page.getByText('Tipo de Servicio')).toBeVisible();
        // The mobile tab switcher (1. Catálogo / 2. Pedido & Cobro) must be hidden on md+
        await expect(page.getByRole('button', { name: /1\. Catálogo/i })).not.toBeVisible();
      } else {
        // On mobile, the step navigation tabs must be visible
        await expect(page.getByRole('button', { name: /1\. Catálogo/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /2\. Pedido & Cobro/i })).toBeVisible();
      }

      // Add product to cart
      const addProductBtn = page.getByTitle('Agregar 1 unidad rápida sin modificadores').first();
      await expect(addProductBtn).toBeVisible();
      await addProductBtn.click();

      // If mobile, navigate to cart tab to complete checkout
      if (vp.category === 'mobile') {
        const cartTab = page.getByRole('button', { name: /2\. Pedido & Cobro/i });
        await cartTab.click();
      }

      // Verify cart has item and "Imprimir comanda al guardar" checkbox is checked by default
      await expect(page.getByText('Tipo de Servicio')).toBeVisible();
      const printCheckbox = page.getByLabel('Imprimir comanda al guardar');
      await expect(printCheckbox).toBeVisible();
      await expect(printCheckbox).toBeChecked();

      // Select "Mostrador" service mode
      const mostradorBtn = page.getByRole('button', { name: /Mostrador/i }).first();
      await mostradorBtn.click();

      // Screenshot 3: POS Modal layout
      await page.screenshot({
        path: `frontend/e2e/screenshots/ticket-responsive/${vp.name}-pos-modal.png`,
      });

      // Submit sale
      const submitSaleBtn = page.getByRole('button', { name: /Registrar Venta/i });
      await expect(submitSaleBtn).toBeVisible();
      await submitSaleBtn.click();

      // The simulated kitchen comanda ticket modal should open immediately upon save!
      await expect(ticketModal).toBeVisible({ timeout: 5000 });
      await expect(page.locator('#printable-ticket')).toBeVisible();
      await expect(page.locator('#printable-ticket')).toContainText('*** COMANDA COCINA (KOT) ***');
      await expect(page.locator('#printable-ticket')).toContainText(/Hamburguesa Doble Queso/i);

      // Screenshot 4: Ticket modal opened automatically from POS submission
      await page.screenshot({
        path: `frontend/e2e/screenshots/ticket-responsive/${vp.name}-pos-printed-ticket.png`,
      });

      // Close ticket modal
      await page.getByRole('button', { name: 'Cerrar vista previa' }).click();
      await expect(ticketModal).not.toBeVisible();

      // Final overflow assertion
      const finalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(finalOverflow).toBe(false);
    });
  }
});
