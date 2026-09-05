import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';
import { Restaurant } from '../../src/domain/models/Restaurant.js';
import { RestaurantRepository } from '../../src/domain/ports/out/RestaurantRepository.js';

describe('Product Module Multi-Tenant Security & Isolation (Integration)', () => {
  let app: FastifyInstance;
  let tokenRestaurantA: string;
  let tokenRestaurantB: string;
  const jwtService = new JwtService();

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    tokenRestaurantA = jwtService.generateToken({
      id: 'usr-admin-a',
      username: 'admin_a',
      role: 'restaurant_admin',
      restaurantId: 'tenant-a',
    });

    tokenRestaurantB = jwtService.generateToken({
      id: 'usr-admin-b',
      username: 'admin_b',
      role: 'restaurant_admin',
      restaurantId: 'tenant-b',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Tenant A can create products within its own tenant boundary', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${tokenRestaurantA}` },
      payload: {
        name: 'Burger Tenant A',
        price: 25000,
        description: 'Exclusive to Tenant A',
        categoryId: 'cat-a1',
        category: 'Burgers',
        isAvailable: true,
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.restaurantId).toBe('tenant-a');
    expect(body.name).toBe('Burger Tenant A');
  });

  it('2. Tenant B cannot list products created by Tenant A in admin mode', async () => {
    // Tenant A lists products
    const resA = await app.inject({
      method: 'GET',
      url: '/api/products',
      headers: { authorization: `Bearer ${tokenRestaurantA}` }
    });
    expect(resA.statusCode).toBe(200);
    const productsA = resA.json();
    expect(productsA.every((p: any) => p.restaurantId === 'tenant-a')).toBe(true);

    // Tenant B lists products
    const resB = await app.inject({
      method: 'GET',
      url: '/api/products',
      headers: { authorization: `Bearer ${tokenRestaurantB}` }
    });
    expect(resB.statusCode).toBe(200);
    const productsB = resB.json();
    expect(productsB.every((p: any) => p.restaurantId === 'tenant-b')).toBe(true);
    expect(productsB.some((p: any) => p.name === 'Burger Tenant A')).toBe(false);
  });

  it('3. Tenant B cannot get product details of Tenant A by ID (404 Not Found)', async () => {
    // 1. Tenant A creates product
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${tokenRestaurantA}` },
      payload: {
        name: 'Secret Recipe Burger',
        price: 30000,
        categoryId: 'cat-a1',
        category: 'Burgers',
        isAvailable: true,
      }
    });
    const productA = createRes.json();

    // 2. Tenant B attempts to fetch it
    const fetchRes = await app.inject({
      method: 'GET',
      url: `/api/products/${productA.id}`,
      headers: { authorization: `Bearer ${tokenRestaurantB}` }
    });

    expect(fetchRes.statusCode).toBe(404);
  });

  it('4. Tenant B cannot update or tamper with Tenant A product (404/403)', async () => {
    // 1. Tenant A creates product
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${tokenRestaurantA}` },
      payload: {
        name: 'Original Price Burger',
        price: 20000,
        categoryId: 'cat-a1',
        category: 'Burgers',
        isAvailable: true,
      }
    });
    const productA = createRes.json();

    // 2. Tenant B attempts to reduce price to 1000
    const tamperRes = await app.inject({
      method: 'PUT',
      url: `/api/products/${productA.id}`,
      headers: { authorization: `Bearer ${tokenRestaurantB}` },
      payload: {
        price: 1000
      }
    });

    expect(tamperRes.statusCode).toBe(404);

    // 3. Verify original price untouched
    const verifyRes = await app.inject({
      method: 'GET',
      url: `/api/products/${productA.id}`,
      headers: { authorization: `Bearer ${tokenRestaurantA}` }
    });
    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.json().price).toBe(20000);
  });

  it('5. Tenant B cannot delete Tenant A product', async () => {
    // 1. Tenant A creates product
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${tokenRestaurantA}` },
      payload: {
        name: 'Protected Product',
        price: 24000,
        categoryId: 'cat-a1',
        category: 'Burgers',
        isAvailable: true,
      }
    });
    const productA = createRes.json();

    // 2. Tenant B attempts to delete it
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/products/${productA.id}`,
      headers: { authorization: `Bearer ${tokenRestaurantB}` }
    });

    expect(deleteRes.statusCode).toBe(404);

    // 3. Verify product still exists in Tenant A
    const verifyRes = await app.inject({
      method: 'GET',
      url: `/api/products/${productA.id}`,
      headers: { authorization: `Bearer ${tokenRestaurantA}` }
    });
    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.json().name).toBe('Protected Product');
  });

  it('6. Public storefront only shows available items of the requested restaurant', async () => {
    // 1. Tenant A creates an available product and an unavailable product
    await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${tokenRestaurantA}` },
      payload: {
        name: 'Available Promo',
        price: 15000,
        categoryId: 'cat-a1',
        category: 'Burgers',
        isAvailable: true,
      }
    });

    await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${tokenRestaurantA}` },
      payload: {
        name: 'Out of Stock Burger',
        price: 18000,
        categoryId: 'cat-a1',
        category: 'Burgers',
        isAvailable: false,
      }
    });

    // 2. Public query for burger-craft
    const publicRes = await app.inject({
      method: 'GET',
      url: '/api/products?restaurantId=burger-craft'
    });
    expect(publicRes.statusCode).toBe(200);
    const catalog = publicRes.json();
    expect(catalog.every((p: any) => p.isAvailable === true)).toBe(true);
  });
});
