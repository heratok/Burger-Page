import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

describe('Inventory API Integration Suite (TDD)', () => {
  let app: FastifyInstance;
  let tokenTenant: string;
  const jwtService = new JwtService();

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    tokenTenant = jwtService.generateToken({
      id: 'usr-admin-craft',
      username: 'admin_craft',
      role: 'restaurant_admin',
      restaurantId: 'burger-craft',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. GET /api/inventory should return 401 Unauthorized without auth token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/inventory',
    });
    expect(res.statusCode).toBe(401);
  });

  it('2. POST /api/inventory should return 401 Unauthorized without auth token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/inventory',
      payload: { name: 'Papas', category: 'ingredients', unit: 'kg' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('3. PUT /api/inventory/:id should return 401 Unauthorized without auth token', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/inventory/i1',
      payload: { name: 'Papas Francesas' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('4. PATCH /api/inventory/:id/stock should return 401 Unauthorized without auth token', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/inventory/i1/stock',
      payload: { quantityChange: 10 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('5. DELETE /api/inventory/:id should return 401 Unauthorized without auth token', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/inventory/i1',
    });
    expect(res.statusCode).toBe(401);
  });

  it('6. GET /api/inventory authenticated returns items with all required stock properties', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/inventory',
      headers: { authorization: `Bearer ${tokenTenant}` },
    });

    expect(res.statusCode).toBe(200);
    const items = res.json();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);

    const first = items[0];
    expect(first.id).toBeDefined();
    expect(first.restaurantId).toBe('burger-craft');
    expect(typeof first.currentStock).toBe('number');
    expect(typeof first.quantity).toBe('number');
    expect(first.currentStock).toBe(first.quantity);
    expect(typeof first.minStockAlert).toBe('number');
    expect(typeof first.alertThreshold).toBe('number');
  });

  it('7. PATCH /api/inventory/:id/stock authenticated adjusts stock correctly', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/inventory',
      headers: { authorization: `Bearer ${tokenTenant}` },
    });
    const items = listRes.json();
    const target = items[0];
    const initialStock = target.currentStock;

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/inventory/${target.id}/stock`,
      headers: { authorization: `Bearer ${tokenTenant}` },
      payload: { quantityChange: 15 },
    });

    expect(patchRes.statusCode).toBe(200);
    const body = patchRes.json();
    expect(body.id).toBe(target.id);
    expect(body.currentStock).toBe(initialStock + 15);
    expect(body.message).toBe('Stock updated successfully');
  });

  it('8. POST /api/inventory creates item using tenant from JWT and ignores body restaurantId', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/inventory',
      headers: { authorization: `Bearer ${tokenTenant}` },
      payload: {
        restaurantId: 'attacker-tenant', // Should be ignored in favor of JWT
        name: 'Tocineta Ahumada',
        category: 'ingredients',
        quantity: 30,
        unit: 'kg',
        minStockAlert: 5,
        alertThreshold: 5,
        costPerUnit: 18000,
      },
    });

    expect(postRes.statusCode).toBe(201);
    const item = postRes.json();
    expect(item.restaurantId).toBe('burger-craft'); // Enforced from JWT!
    expect(item.name).toBe('Tocineta Ahumada');
  });
});
