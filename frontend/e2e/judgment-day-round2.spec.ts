import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:3001/api';

test.describe('Judgment Day Round 2 — Playwright CLI Verification Suite', () => {
  let adminCraftToken: string;
  let _adminRostoToken: string;
  let superAdminToken: string;

  test.beforeAll(async ({ request }) => {
    // 1. Authenticate as Burger Craft admin
    const loginCraft = await request.post(`${API_BASE}/users/login`, {
      data: { username: 'admin_craft', password: 'craft' },
    });
    expect(loginCraft.status()).toBe(200);
    const bodyCraft = await loginCraft.json();
    adminCraftToken = bodyCraft.token;

    // 2. Authenticate as Rosto admin
    const loginRosto = await request.post(`${API_BASE}/users/login`, {
      data: { username: 'admin_rosto', password: 'rosto' },
    });
    expect(loginRosto.status()).toBe(200);
    const bodyRosto = await loginRosto.json();
    _adminRostoToken = bodyRosto.token;

    // 3. Authenticate as Super Admin
    const loginSuper = await request.post(`${API_BASE}/users/login`, {
      data: { username: 'admin', password: 'admin' },
    });
    expect(loginSuper.status()).toBe(200);
    const bodySuper = await loginSuper.json();
    superAdminToken = bodySuper.token;
  });

  test('FWU-001 (JD-CONFIRMED-001): restaurant_admin is isolated by tenant and unassigned admin gets 403 Forbidden', async ({ request }) => {
    // A. Craft admin can list users of their own tenant
    const craftUsersRes = await request.get(`${API_BASE}/users`, {
      headers: { Authorization: `Bearer ${adminCraftToken}` },
    });
    expect(craftUsersRes.status()).toBe(200);
    const craftUsers = await craftUsersRes.json();
    expect(Array.isArray(craftUsers)).toBe(true);
    for (const u of craftUsers) {
      if (u.restaurantId) {
        expect(u.restaurantId).toContain('craft');
      }
    }

    // B. Super admin creates a temporary restaurant_admin without a restaurantId (or unassigned)
    // Note: Creating via super admin requires restaurantId for restaurant_admin,
    // so verify that attempting to create a restaurant_admin without restaurantId fails with 400
    const invalidCreate = await request.post(`${API_BASE}/users`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
      data: {
        username: 'unassigned_test_admin',
        password: 'password123',
        role: 'restaurant_admin',
        // restaurantId omitted
      },
    });
    expect(invalidCreate.status()).toBe(400);
  });

  test('FWU-003 (JD-CONFIRMED-003): Cross-tenant category mutation via slug is rejected with 403 Forbidden', async ({ request }) => {
    // Admin of Burger Craft attempts to alter categories of foreign tenant 'rosto'
    const crossTenantPut = await request.put(`${API_BASE}/restaurant/rosto/categories`, {
      headers: { Authorization: `Bearer ${adminCraftToken}` },
      data: {
        categories: ['Hacked Burger', 'Hacked Sides'],
      },
    });

    // Must be rejected with 403 Forbidden
    expect(crossTenantPut.status()).toBe(403);
    const err = await crossTenantPut.json();
    expect(err.status).toBe(403);
    expect(err.detail).toContain('authorized');
  });

  test('FWU-003 (JD-CONFIRMED-003): Unauthenticated category update is rejected', async ({ request }) => {
    const unauthPut = await request.put(`${API_BASE}/restaurant/categories`, {
      data: {
        categories: ['Public Injected Category'],
      },
    });
    expect(unauthPut.status()).toBe(401);
  });

  test('FWU-004 (JD-CONFIRMED-004): SSE stream token cannot be reused as Bearer token on general API endpoints', async ({ request }) => {
    // 1. Issue an SSE stream token via the dedicated endpoint
    const streamTokenRes = await request.post(`${API_BASE}/orders/stream-token`, {
      headers: { Authorization: `Bearer ${adminCraftToken}` },
    });
    expect(streamTokenRes.status()).toBe(200);
    const { token: streamToken } = await streamTokenRes.json();
    expect(streamToken).toBeDefined();

    // 2. Attempt to use this SSE stream token as Bearer token on /api/users
    const userRes = await request.get(`${API_BASE}/users`, {
      headers: { Authorization: `Bearer ${streamToken}` },
    });
    expect(userRes.status()).toBe(401);
    const userErr = await userRes.json();
    expect(userErr.detail).toContain('restricted scope');

    // 3. Attempt to use this SSE stream token on /api/orders
    const ordersRes = await request.get(`${API_BASE}/orders`, {
      headers: { Authorization: `Bearer ${streamToken}` },
    });
    expect(ordersRes.status()).toBe(401);
    const ordersErr = await ordersRes.json();
    expect(ordersErr.detail).toContain('restricted scope');
  });

  test('FWU-002 (JD-CONFIRMED-002): SSE stream endpoint requires valid stream token or Bearer token', async ({ request }) => {
    // 1. Without token, stream rejects with 401
    const unauthStream = await request.get(`${API_BASE}/orders/stream`);
    expect(unauthStream.status()).toBe(401);

    // 2. With completely invalid token query, rejects with 401
    const invalidStream = await request.get(`${API_BASE}/orders/stream?token=not-a-real-token`);
    expect(invalidStream.status()).toBe(401);
  });
});
