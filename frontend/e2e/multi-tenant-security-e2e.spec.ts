import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:3001/api';

test.describe('Playwright Full Multi-Tenant & Security E2E Suite', () => {
  let tokenTenantA: string;
  let tokenTenantB: string;
  let tenantAId: string;
  let tenantBId: string;
  let _superAdminToken: string;

  test.beforeAll(async ({ request }) => {
    // 1. Authenticate as Tenant A admin (Burger Craft)
    const loginA = await request.post(`${API_BASE}/users/login`, {
      data: { username: 'admin_craft', password: 'craft' }
    });
    expect(loginA.status()).toBe(200);
    const bodyA = await loginA.json();
    tokenTenantA = bodyA.token;
    tenantAId = bodyA.user.restaurantId;

    // 2. Authenticate as Tenant B admin (Rosto)
    const loginB = await request.post(`${API_BASE}/users/login`, {
      data: { username: 'admin_rosto', password: 'rosto' }
    });
    expect(loginB.status()).toBe(200);
    const bodyB = await loginB.json();
    tokenTenantB = bodyB.token;
    tenantBId = bodyB.user.restaurantId;

    // 3. Authenticate as Super Admin
    const loginSuper = await request.post(`${API_BASE}/users/login`, {
      data: { username: 'admin', password: 'admin' }
    });
    expect(loginSuper.status()).toBe(200);
    const bodySuper = await loginSuper.json();
    _superAdminToken = bodySuper.token;
  });

  // ==========================================================================
  // 1. CUSTOMER FLOWS & LOYALTY PURGE
  // ==========================================================================
  test.describe('1. Customer Domain & Isolation Flows', () => {
    test.describe.configure({ mode: 'serial' });
    let customerAId: string;

    test('1.1 Create buyer profile without email and verify no loyalty tier properties exist', async ({ request }) => {
      const res = await request.post(`${API_BASE}/customers`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: {
          name: 'Mateo Restrepo',
          phone: '+57 311 555 7788',
          address: 'Calle 10 # 40-20 Apto 502',
          barrio: 'El Poblado',
          notes: 'Timbre 502, dejar en portería',
          // email is omitted
        }
      });

      expect(res.status()).toBe(201);
      const customer = await res.json();
      customerAId = customer.id;

      expect(customer.name).toBe('Mateo Restrepo');
      expect(customer.phone).toBe('+57 311 555 7788');
      expect(customer.address).toBe('Calle 10 # 40-20 Apto 502');
      expect(customer.barrio).toBe('El Poblado');
      expect(customer.notes).toBe('Timbre 502, dejar en portería');
      expect(customer.email).toBe('');
      expect(customer.restaurantId).toBe(tenantAId);

      // CRITICAL: verify loyalty tiers, totalSpent, totalOrders are NEVER returned
      expect(customer).not.toHaveProperty('loyaltyTier');
      expect(customer).not.toHaveProperty('loyalty_tier');
      expect(customer).not.toHaveProperty('totalSpent');
      expect(customer).not.toHaveProperty('totalOrders');
      expect(customer).not.toHaveProperty('bronze');
    });

    test('1.2 Edit buyer profile within Tenant A', async ({ request }) => {
      const res = await request.put(`${API_BASE}/customers/${customerAId}`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: {
          address: 'Carrera 43A # 1-50',
          barrio: 'Milla de Oro',
          notes: 'Llamar antes de entregar'
        }
      });

      expect(res.status()).toBe(200);
      const updated = await res.json();
      expect(updated.address).toBe('Carrera 43A # 1-50');
      expect(updated.barrio).toBe('Milla de Oro');
      expect(updated.notes).toBe('Llamar antes de entregar');
    });

    test('1.3 Cross-Tenant Attack: Tenant B cannot access or modify customer of Tenant A', async ({ request }) => {
      // 1. Tenant B attempts reading Tenant A's customer -> 404 (or 403)
      const readRes = await request.get(`${API_BASE}/customers/${customerAId}`, {
        headers: { Authorization: `Bearer ${tokenTenantB}` }
      });
      expect([403, 404]).toContain(readRes.status());

      // 2. Tenant B attempts mutating Tenant A's customer -> 404 (or 403)
      const mutateRes = await request.put(`${API_BASE}/customers/${customerAId}`, {
        headers: { Authorization: `Bearer ${tokenTenantB}` },
        data: { name: 'Hacked Mateo' }
      });
      expect([403, 404]).toContain(mutateRes.status());
    });
  });

  // ==========================================================================
  // 2. PRODUCT & PRODUCT ADDITION FLOWS
  // ==========================================================================
  test.describe('2. Product & Product Addition Isolation Flows', () => {
    test.describe.configure({ mode: 'serial' });
    let productAId: string;

    test('2.1 Create product in Tenant A, update price, deactivate, and verify Storefront vs Admin visibility', async ({ request }) => {
      // 1. Create product in Tenant A
      const createRes = await request.post(`${API_BASE}/products`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: {
          name: 'Hamburguesa Doble Trufa',
          description: 'Carne angus doble con salsa de trufa',
          price: 34900,
          category: 'Hamburguesas',
          isAvailable: true,
        }
      });
      expect(createRes.status()).toBe(201);
      const product = await createRes.json();
      productAId = product.id;
      expect(product.price).toBe(34900);
      expect(product.restaurantId).toBe(tenantAId);

      // 2. Update price
      const updatePriceRes = await request.put(`${API_BASE}/products/${productAId}`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: { price: 36900 }
      });
      expect(updatePriceRes.status()).toBe(200);
      expect((await updatePriceRes.json()).price).toBe(36900);

      // 3. Deactivate product (isAvailable = false)
      const deactivateRes = await request.put(`${API_BASE}/products/${productAId}`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: { isAvailable: false }
      });
      expect(deactivateRes.status()).toBe(200);
      expect((await deactivateRes.json()).isAvailable).toBe(false);

      // 4. Public Storefront (GET /products?restaurantId=...) MUST NOT show inactive item
      const publicStorefrontRes = await request.get(`${API_BASE}/products?restaurantId=${tenantAId}`);
      expect(publicStorefrontRes.status()).toBe(200);
      const publicCatalog = await publicStorefrontRes.json();
      expect(publicCatalog.some((p: any) => p.id === productAId)).toBe(false);

      // 5. Admin Catalog (GET /products with JWT A) MUST show inactive item
      const adminCatalogRes = await request.get(`${API_BASE}/products`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` }
      });
      expect(adminCatalogRes.status()).toBe(200);
      const adminCatalog = await adminCatalogRes.json();
      const foundInactive = adminCatalog.find((p: any) => p.id === productAId);
      expect(foundInactive).toBeDefined();
      expect(foundInactive.isAvailable).toBe(false);
    });

    test('2.2 Cross-Tenant Attack: Tenant B cannot modify or delete product of Tenant A', async ({ request }) => {
      // 1. Tenant B tries to update Tenant A's product -> 404 (not found in tenant scope)
      const updateRes = await request.put(`${API_BASE}/products/${productAId}`, {
        headers: { Authorization: `Bearer ${tokenTenantB}` },
        data: { price: 1000 }
      });
      expect([403, 404]).toContain(updateRes.status());

      // 2. Tenant B tries to delete Tenant A's product -> 404
      const deleteRes = await request.delete(`${API_BASE}/products/${productAId}`, {
        headers: { Authorization: `Bearer ${tokenTenantB}` }
      });
      expect([403, 404]).toContain(deleteRes.status());
    });
  });

  // ==========================================================================
  // 3. INVENTORY & STOCK CONTROL FLOWS
  // ==========================================================================
  test.describe('3. Inventory & Stock Control Flows', () => {
    test.describe.configure({ mode: 'serial' });
    let inventoryAId: string;

    test('3.1 Create inventory item, adjust stock positive/negative, reject negative result, and verify tenant isolation', async ({ request }) => {
      // 1. Create item in Tenant A
      const createRes = await request.post(`${API_BASE}/inventory`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: {
          name: 'Queso Gouda Holandés',
          category: 'ingredients',
          quantity: 40,
          unit: 'kg',
          minStockAlert: 10,
          alertThreshold: 10,
          costPerUnit: 32000,
        }
      });
      expect(createRes.status()).toBe(201);
      const item = await createRes.json();
      inventoryAId = item.id;
      expect(item.restaurantId).toBe(tenantAId);
      expect(item.quantity).toBe(40);
      expect(item.costPerUnit).toBe(32000);

      // 2. Increase stock (+15)
      const incRes = await request.patch(`${API_BASE}/inventory/${inventoryAId}/stock`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: { quantityChange: 15 }
      });
      expect(incRes.status()).toBe(200);
      expect((await incRes.json()).currentStock).toBe(55);

      // 3. Decrease stock (-20)
      const decRes = await request.patch(`${API_BASE}/inventory/${inventoryAId}/stock`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: { quantityChange: -20 }
      });
      expect(decRes.status()).toBe(200);
      expect((await decRes.json()).currentStock).toBe(35);

      // 4. Attempt reducing stock below zero (-50 when stock is 35) -> MUST FAIL (400)
      const invalidDecRes = await request.patch(`${API_BASE}/inventory/${inventoryAId}/stock`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: { quantityChange: -50 }
      });
      expect(invalidDecRes.status()).toBe(400);

      // 5. Cross-Tenant Attack: Tenant B tries to adjust Tenant A stock -> 404
      const crossStockRes = await request.patch(`${API_BASE}/inventory/${inventoryAId}/stock`, {
        headers: { Authorization: `Bearer ${tokenTenantB}` },
        data: { quantityChange: 10 }
      });
      expect([403, 404]).toContain(crossStockRes.status());
    });
  });

  // ==========================================================================
  // 4. ORDERS & AUTHORITATIVE PRICING FLOWS
  // ==========================================================================
  test.describe('4. Orders, Authoritative Pricing & Cross-Tenant Rejection', () => {
    test.describe.configure({ mode: 'serial' });
    let validProductA: any;

    test.beforeAll(async ({ request }) => {
      // Create a dedicated product for order tests in Tenant A
      const createProd = await request.post(`${API_BASE}/products`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: {
          name: 'Burger Classic Pricing Test',
          price: 25000,
          category: 'Hamburguesas',
          isAvailable: true,
        }
      });
      validProductA = await createProd.json();
    });

    test('4.1 Create order with authoritative pricing: backend calculates prices, ignores client-supplied totals', async ({ request }) => {
      const orderRes = await request.post(`${API_BASE}/orders`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: {
          restaurantId: tenantAId,
          items: [
            {
              productId: validProductA.id,
              quantity: 2,
              // Malicious client tries to send unit_price = 100
              unitPrice: 100,
              subtotal: 200,
            }
          ],
          // Malicious client tries to send finalTotal = 200 and deliveryFee = 0
          subtotal: 200,
          deliveryFee: 0,
          finalTotal: 200,
          paymentMethod: 'Efectivo',
          paymentAmount: 60000,
        }
      });

      expect(orderRes.status()).toBe(201);
      const order = await orderRes.json();
      expect(order.id).toBeDefined();
      expect(order.restaurantId).toBe(tenantAId);

      // Subtotal MUST BE calculated from product price (25000 * 2 = 50000)
      expect(order.subtotal).toBe(50000);
      // Final total MUST BE 50000
      expect(order.finalTotal).toBe(50000);
      expect(order.status).toBe('pending');
    });

    test('4.2 Cross-Tenant Rejection: Order in Tenant A cannot reference product from Tenant B', async ({ request }) => {
      // 1. Create product in Tenant B
      const prodBRes = await request.post(`${API_BASE}/products`, {
        headers: { Authorization: `Bearer ${tokenTenantB}` },
        data: {
          name: 'Rosto Special Burger',
          price: 30000,
          category: 'Hamburguesas',
          isAvailable: true,
        }
      });
      const prodB = await prodBRes.json();

      // 2. Tenant A tries to create an order using Tenant B's product -> 404 (Product not found in this tenant)
      const invalidOrderRes = await request.post(`${API_BASE}/orders`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: {
          restaurantId: tenantAId,
          items: [{ productId: prodB.id, quantity: 1 }]
        }
      });

      expect(invalidOrderRes.status()).toBe(404);
    });

    test('4.3 Order status transitions enforce valid state machine', async ({ request }) => {
      // 1. Create order
      const orderRes = await request.post(`${API_BASE}/orders`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: {
          restaurantId: tenantAId,
          items: [{ productId: validProductA.id, quantity: 1 }]
        }
      });
      const order = await orderRes.json();

      // 2. Transition pending -> cooking
      const cookRes = await request.patch(`${API_BASE}/orders/${order.id}/status`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: { status: 'cooking' }
      });
      expect(cookRes.status()).toBe(200);

      // 3. Transition cooking -> delivering
      const delivRes = await request.patch(`${API_BASE}/orders/${order.id}/status`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: { status: 'delivering' }
      });
      expect(delivRes.status()).toBe(200);

      // 4. Transition delivering -> delivered
      const deliveredRes = await request.patch(`${API_BASE}/orders/${order.id}/status`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: { status: 'delivered' }
      });
      expect(deliveredRes.status()).toBe(200);

      // 5. Invalid transition: delivered -> pending MUST FAIL (400)
      const invalidTransRes = await request.patch(`${API_BASE}/orders/${order.id}/status`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: { status: 'pending' }
      });
      expect(invalidTransRes.status()).toBe(400);
    });
  });

  // ==========================================================================
  // 5. JWT MANIPULATION ATTACK MATRIX
  // ==========================================================================
  test.describe('5. JWT Manipulation & Body Spoofing Attack Matrix', () => {
    test('5.1 JWT = Tenant A, Body restaurantId = Tenant B -> MUST operate strictly on Tenant A', async ({ request }) => {
      // 1. Customer Creation
      const custRes = await request.post(`${API_BASE}/customers`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: {
          restaurantId: tenantBId, // Spoof Tenant B
          name: 'Spoof Test Customer',
          phone: '+57 300 999 1122'
        }
      });
      expect(custRes.status()).toBe(201);
      const cust = await custRes.json();
      expect(cust.restaurantId).toBe(tenantAId); // ENFORCED FROM JWT!

      // 2. Product Creation
      const prodRes = await request.post(`${API_BASE}/products`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: {
          restaurantId: tenantBId, // Spoof Tenant B
          name: 'Spoof Burger',
          price: 20000,
          category: 'Hamburguesas',
        }
      });
      expect(prodRes.status()).toBe(201);
      const prod = await prodRes.json();
      expect(prod.restaurantId).toBe(tenantAId); // ENFORCED FROM JWT!

      // 3. Inventory Creation
      const invRes = await request.post(`${API_BASE}/inventory`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: {
          restaurantId: tenantBId, // Spoof Tenant B
          name: 'Spoof Insumo',
          category: 'ingredients',
          unit: 'kg',
          quantity: 10,
        }
      });
      expect(invRes.status()).toBe(201);
      const inv = await invRes.json();
      expect(inv.restaurantId).toBe(tenantAId); // ENFORCED FROM JWT!
    });
  });

  // ==========================================================================
  // 6. CONCURRENCY & RACE CONDITION TEST
  // ==========================================================================
  test.describe('6. Concurrency & High Load Test', () => {
    test('6.1 Create 10 concurrent orders simultaneously for Tenant A without collisions or errors', async ({ request }) => {
      // 1. Create a base product
      const prodRes = await request.post(`${API_BASE}/products`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
        data: {
          name: 'Concurrent Test Burger',
          price: 22000,
          category: 'Hamburguesas',
          isAvailable: true,
        }
      });
      const prod = await prodRes.json();

      // 2. Dispatch 10 parallel requests
      const promises = Array.from({ length: 10 }, (_, i) =>
        request.post(`${API_BASE}/orders`, {
          headers: { Authorization: `Bearer ${tokenTenantA}` },
          data: {
            restaurantId: tenantAId,
            items: [{ productId: prod.id, quantity: 1 }],
            comment: `Concurrent Order #${i + 1}`,
          }
        })
      );

      const responses = await Promise.all(promises);
      expect(responses.every((r) => r.status() === 201)).toBe(true);

      const createdOrders = await Promise.all(responses.map((r) => r.json()));
      const ids = createdOrders.map((o) => o.id);
      const uniqueIds = new Set(ids);

      // Verify all orders are distinct and no data was lost
      expect(uniqueIds.size).toBe(10);
      expect(createdOrders.every((o) => o.restaurantId === tenantAId)).toBe(true);
      expect(createdOrders.every((o) => o.finalTotal === 22000)).toBe(true);
    });
  });
});
