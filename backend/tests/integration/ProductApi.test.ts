import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

describe('Product API Integration', () => {
  let app: FastifyInstance;
  let authToken: string;
  const jwtService = new JwtService();

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    authToken = jwtService.generateToken({
      id: 'usr-admin-1',
      username: 'manager_craft',
      role: 'restaurant_admin',
      restaurantId: 'burger-craft',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/products with ?restaurantId should return available products for storefront', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/products?restaurantId=burger-craft'
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body.every((p: any) => p.isAvailable === true)).toBe(true);
  });

  it('GET /api/products without context or token should return 400 Bad Request', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/products'
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().detail).toMatch(/Restaurant ID or slug is required/i);
  });

  it('POST /api/products without auth should reject with 401 Unauthorized', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/products',
      payload: {
        name: 'Unauthorized Burger',
        price: 15,
        category: 'Burgers',
        isAvailable: true
      }
    });

    expect(response.statusCode).toBe(401);
  });

  it('POST /api/products with token should create a product for authenticated tenant', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: {
        authorization: `Bearer ${authToken}`
      },
      payload: {
        name: 'Craft Artisan Burger',
        price: 26000,
        description: 'Special smoked cheese and bacon',
        category: 'Especiales',
        isAvailable: true,
        additions: []
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.name).toBe('Craft Artisan Burger');
    expect(body.price).toBe(26000);
    expect(body.restaurantId).toBe('burger-craft');
  });

  it('PUT /api/products/:id should update product for authenticated tenant', async () => {
    // 1. Create product first
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Modifiable Burger',
        price: 20000,
        category: 'Clásicas',
        isAvailable: true
      }
    });
    const product = createRes.json();

    // 2. Update price and availability
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/products/${product.id}`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        price: 22000,
        isAvailable: false
      }
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json();
    expect(updated.price).toBe(22000);
    expect(updated.isAvailable).toBe(false);
  });

  it('DELETE /api/products/:id should delete product for authenticated tenant', async () => {
    // 1. Create product first
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'To Delete Burger',
        price: 18000,
        category: 'Clásicas',
        isAvailable: true
      }
    });
    const product = createRes.json();

    // 2. Delete product
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/products/${product.id}`,
      headers: { authorization: `Bearer ${authToken}` }
    });
    expect(deleteRes.statusCode).toBe(204);

    // 3. Verify it cannot be retrieved anymore
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/products/${product.id}?restaurantId=burger-craft`
    });
    expect(getRes.statusCode).toBe(404);
  });
});
