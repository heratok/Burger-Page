import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';

describe('Product API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/products should return list of products', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/products'
    });

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json())).toBe(true);
  });

  it('POST /api/products should create a product', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/products',
      payload: {
        name: 'Test Burger',
        price: 15,
        description: 'A test burger',
        category: 'Burgers',
        isAvailable: true,
        additions: []
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.name).toBe('Test Burger');
    expect(body.price).toBe(15);
  });

  it('POST /api/products should fail validation for invalid data', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/products',
      payload: {
        name: 'Test Burger'
        // Missing price, category, etc.
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it('GET /api/products/:id should return a specific product', async () => {
    // Create first
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      payload: {
        name: 'Specific Burger',
        price: 12,
        description: 'A specific test burger',
        category: 'Burgers',
        isAvailable: true,
        additions: []
      }
    });
    
    const product = createRes.json();

    // Fetch it
    const fetchRes = await app.inject({
      method: 'GET',
      url: `/api/products/${product.id}`
    });

    expect(fetchRes.statusCode).toBe(200);
    expect(fetchRes.json().id).toBe(product.id);
  });
});
