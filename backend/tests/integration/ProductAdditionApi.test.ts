import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

describe('Product Addition API Integration', () => {
  let app: FastifyInstance;
  let tokenA: string;
  let tokenB: string;
  const jwtService = new JwtService();

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    tokenA = jwtService.generateToken({
      id: 'usr-admin-1',
      username: 'manager_craft',
      role: 'restaurant_admin',
      restaurantId: 'burger-craft',
    });

    tokenB = jwtService.generateToken({
      id: 'usr-admin-2',
      username: 'manager_other',
      role: 'restaurant_admin',
      restaurantId: 'other-restaurant',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/additions without context or token should return 400 Bad Request', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/additions',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().detail).toMatch(/Restaurant ID or slug is required/i);
  });

  it('GET /api/additions with ?restaurantId returns additions for storefront', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/additions?restaurantId=burger-craft',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('POST /api/additions without auth should return 401 Unauthorized', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/additions',
      payload: {
        name: 'Extra Queso Cheddar',
        price: 3500,
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('POST /api/additions with auth creates addition for tenant (201)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/additions',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        name: 'Tocineta Ahumada',
        price: 4500,
        isAvailable: true,
        displayOrder: 1,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.id).toMatch(/^add_/);
    expect(body.name).toBe('Tocineta Ahumada');
    expect(body.price).toBe(4500);
    expect(body.restaurantId).toBe('burger-craft');
  });

  it('GET /api/additions/:id returns addition details', async () => {
    // 1. Create
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/additions',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        name: 'Salsa Especial',
        price: 2000,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const createdId = createRes.json().id;

    // 2. Fetch by ID with auth
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/additions/${createdId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().name).toBe('Salsa Especial');
  });

  it('PUT /api/additions/:id updates addition for tenant', async () => {
    // 1. Create
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/additions',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        name: 'Cebolla Caramelizada',
        price: 3000,
      },
    });
    const createdId = createRes.json().id;

    // 2. Update
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/additions/${createdId}`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        price: 3500,
        isAvailable: false,
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json();
    expect(updated.price).toBe(3500);
    expect(updated.isAvailable).toBe(false);
  });

  it('Multi-tenant: Tenant B cannot update or delete Tenant A addition (404)', async () => {
    // 1. Tenant A creates addition
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/additions',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        name: 'Tenant A Secret Sauce',
        price: 5000,
      },
    });
    const additionId = createRes.json().id;

    // 2. Tenant B attempts to read Tenant A addition
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/additions/${additionId}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(getRes.statusCode).toBe(404);

    // 3. Tenant B attempts to update Tenant A addition
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/additions/${additionId}`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: {
        name: 'Hacked Sauce',
        price: 0,
      },
    });
    expect(updateRes.statusCode).toBe(404);

    // 4. Tenant B attempts to delete Tenant A addition
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/additions/${additionId}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(deleteRes.statusCode).toBe(404);
  });

  it('DELETE /api/additions/:id deletes addition (204)', async () => {
    // 1. Create
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/additions',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        name: 'Temporary Addition',
        price: 1000,
      },
    });
    const additionId = createRes.json().id;

    // 2. Delete
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/additions/${additionId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(deleteRes.statusCode).toBe(204);

    // 3. Verify gone
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/additions/${additionId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(getRes.statusCode).toBe(404);
  });
});
