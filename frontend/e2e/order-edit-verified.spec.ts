import { test, expect } from '@playwright/test';

test.describe('Order Editing & Persistence E2E Suite', () => {
  let seededProductName: string

  test.beforeAll(async ({ request }) => {
    const API_BASE = 'http://localhost:3001/api'
    const loginRes = await request.post(`${API_BASE}/users/login`, {
      data: { username: 'rosto', password: 'rosto0502' },
    })
    expect(loginRes.status()).toBe(200)
    const { token, user } = await loginRes.json()
    // Run-unique customer phone: create_order_atomic reuses customers by
    // phone, so each run gets a private customer row and never collides
    // with order-delete-verified.spec.ts (family '3015').
    const seedPhone = `3008${Date.now().toString().slice(-6)}`

    // Purge stale seeded orders from previous runs so the first "Editar
    // venta" card in the feed is THIS run's order, not a leftover.
    const existingOrders = await request.get(`${API_BASE}/orders?restaurantId=${user.restaurantId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (existingOrders.status() === 200) {
      const list = await existingOrders.json()
      for (const o of Array.isArray(list) ? list : []) {
        if (o?.comment === 'seeded-for-edit-verified') {
          await request.delete(`${API_BASE}/orders/${o.id}?restaurantId=${user.restaurantId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        }
      }
    }

    // Purge stale seeded customers from previous runs (their orders were
    // deleted above) so each run starts with a private customer row.
    if (existingOrders.status() === 200) {
      const list = await existingOrders.json()
      const stalePhones = new Set<string>()
      for (const o of Array.isArray(list) ? list : []) {
        if (o?.comment === 'seeded-for-edit-verified' && o?.customer?.phone) {
          stalePhones.add(String(o.customer.phone))
        }
      }
      const custRes = await request.get(`${API_BASE}/customers?restaurantId=${user.restaurantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (custRes.status() === 200) {
        const custs = await custRes.json()
        for (const c of Array.isArray(custs) ? custs : []) {
          if (c?.phone && String(c.phone).startsWith('3008')) {
            await request.delete(`${API_BASE}/customers/${c.id}?restaurantId=${user.restaurantId}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
          }
        }
      }
    }

    const productRes = await request.post(`${API_BASE}/products`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: `E2E Edit Seed ${Date.now().toString().slice(-6)}`,
        price: 20000,
        category: 'Hamburguesas',
        isAvailable: true,
      },
    })
    expect(productRes.status()).toBe(201)
    const product = await productRes.json()
    seededProductName = product.name

    const orderRes = await request.post(`${API_BASE}/orders`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        restaurantId: user.restaurantId,
        items: [{ productId: product.id, quantity: 1 }],
        customer: { name: 'Seed Cliente', phone: seedPhone, barrio: 'Centro' },
        // The edit modal rebuilds finalTotal with the tenant delivery fee
        // (5000): seed the payment to cover it so the PUT passes pricing.
        deliveryFee: 5000,
        paymentMethod: 'Efectivo',
        paymentAmount: 25000,
        changeAmount: 0,
        comment: 'seeded-for-edit-verified',
        clientOrderId: `edit-seed-${Date.now()}`,
      },
    })
    expect(orderRes.status()).toBe(201)
  })

  test('logs in as rosto admin, edits an active order via ManualSaleModal, verifies DB persistence after reload', async ({ page }) => {
    test.setTimeout(60000);

    page.on('console', (msg) => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', (err) => console.log(`[BROWSER ERROR] ${err.message}`));
    page.on('request', (req) => {
      if (req.url().includes('/api/')) console.log(`[REQ] ${req.method()} ${req.url()}`);
    });
    page.on('response', (res) => {
      if (res.url().includes('/api/') && !res.url().includes('/stream')) console.log(`[RES] ${res.status()} ${res.url()}`);
    });

    // 1. Navigate to /admin
    await page.goto('/admin');

    // 2. Fill login credentials
    const userInput = page.locator('input#username, input[placeholder*="usuario" i], input[type="text"]').first();
    const passInput = page.locator('input#password, input[type="password"]').first();
    await expect(userInput).toBeVisible({ timeout: 10000 });
    await userInput.fill('rosto');
    await passInput.fill('rosto0502');

    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // 3. Wait for authenticated view
    const heading = page.locator('h1, h2, h3').first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    // 4. Click 'Pedidos en Vivo' button in sidebar and wait for orders API response
    const ordersBtn = page.locator('aside button, nav button').filter({ hasText: /Pedidos en Vivo/i }).first();
    await expect(ordersBtn).toBeVisible({ timeout: 5000 });
    
    const ordersResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/orders') && !res.url().includes('/stream') && res.status() === 200,
      { timeout: 15000 }
    ).catch(() => null);

    await ordersBtn.click();
    await ordersResponsePromise;

    // 5. Locate THIS run's seeded card (unique product name) and its edit
    const seededCard = page
      .locator('div')
      .filter({ hasText: seededProductName })
      .filter({ has: page.locator('button[title*="Editar venta"]') })
      .first();
    await expect(seededCard).toBeVisible({ timeout: 10000 });
    const editBtn = seededCard.locator('button[title*="Editar venta"]').first();

    // Get order number from the card
    const card = seededCard;
    const cardText = await card.innerText();
    const orderNumberMatch = cardText.match(/#(\d+)/);
    const orderNumber = orderNumberMatch ? orderNumberMatch[1] : null;
    console.log(`Targeting Order #${orderNumber} for editing...`);

    // 6. Click edit button to open ManualSaleModal
    await editBtn.click();

    // 7. Verify modal is visible and scope locators within it
    const modalHeading = page.locator('h3:has-text("Editar Venta"), h2:has-text("Editar Venta")').first();
    await expect(modalHeading).toBeVisible({ timeout: 5000 });
    const modal = page.locator('div.fixed.inset-0').filter({ hasText: /Editar Venta/i }).first();

    // 8. Modify customer name, address, barrio and notes
    const editedName = `Cliente Editado #${Date.now().toString().slice(-4)}`;
    const editedNote = `Nota editada con persistencia real ${Date.now()}`;

    const nameInput = modal.locator('input[placeholder="Nombre completo"], input[placeholder="Cliente Mostrador"], input[placeholder="Nombre del cliente"]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(editedName);

    const editedPhone = `300${Date.now().toString().slice(-7)}`;
    const phoneInput = modal.locator('input[placeholder="300 123 4567"], input[placeholder="Para fidelización"]').first();
    if (await phoneInput.isVisible()) {
      await phoneInput.fill(editedPhone);
    }

    const addressInput = modal.locator('input[placeholder="Calle 10 # 4-20"]').first();
    if (await addressInput.isVisible()) {
      await addressInput.fill('Carrera 50 # 10-25');
    }

    const barrioInput = modal.locator('input[placeholder="Barrio o sector"]').first();
    if (await barrioInput.isVisible()) {
      await barrioInput.fill('Barrio Central');
    }

    const notesTextarea = modal.locator('textarea').first();
    if (await notesTextarea.isVisible()) {
      await notesTextarea.fill(editedNote);
    }

    // 9. Save changes
    const saveBtn = modal.locator('button:has-text("Guardar cambios"), button:has-text("Actualizar Venta")').first();
    await expect(saveBtn).toBeVisible({ timeout: 5000 });

    const updateResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/orders/') && res.request().method() === 'PUT' && res.status() === 200,
      { timeout: 15000 }
    );

    await saveBtn.click();
    const updateResponse = await updateResponsePromise;
    expect(updateResponse.status()).toBe(200);
    const updateBody = await updateResponse.json();
    console.log('Server PUT response:', updateBody);
    expect(updateBody.customer.nombre).toBe(editedName);

    // 10. Reload page to test persistence from database
    console.log('Reloading page to test persistence from database...');
    await page.reload();
    await page.waitForTimeout(2000);

    const ordersBtnAfterReload = page.locator('aside button, nav button').filter({ hasText: /Pedidos en Vivo/i }).first();
    if (await ordersBtnAfterReload.isVisible()) {
      const reloadOrdersPromise = page.waitForResponse(
        (res) => res.url().includes('/api/orders') && !res.url().includes('/stream') && res.status() === 200,
        { timeout: 15000 }
      ).catch(() => null);
      await ordersBtnAfterReload.click();
      await reloadOrdersPromise;
      await page.waitForTimeout(1000);
    }

    // 12. Wait for the backend sync to land: the feed must render the edited
    // customer name (proves GET /orders + /customers rebuilt the card from the
    // DB) before we open the details modal — the modal reads the same order.
    await expect(page.getByText(editedName).first()).toBeVisible({ timeout: 15000 });

    // 13. Open the edited order details to verify persisted content
    const targetCard = page
      .locator('div')
      .filter({ hasText: seededProductName })
      .filter({ has: page.locator('button[title*="Ver detalles completos"]') })
      .first();
    await expect(targetCard).toBeVisible({ timeout: 5000 });

    const eyeBtn = targetCard.locator('button[title*="Ver detalles completos de la orden"]').first();
    await eyeBtn.click();

    // 13. Assert that the edited customer name is present in the modal
    const modalCustomerName = page.locator(`span:has-text("${editedName}"), p:has-text("${editedName}"), h3:has-text("${editedName}")`).first();
    await expect(modalCustomerName).toBeVisible({ timeout: 5000 });

    // Take final proof screenshot
    await page.screenshot({ path: 'test-results/order-edited-and-persisted.png' });
    console.log('Successfully verified order editing and database persistence!');
  });
});
