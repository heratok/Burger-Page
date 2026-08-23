import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';

describe('Order API', () => {
  let app: FastifyInstance;
  let productId: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    
    // Setup: Create a product so we can order it
    const productRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      payload: {
        name: 'Integration Burger',
        price: 10,
        description: 'For testing orders',
        category: 'Burgers',
        isAvailable: true,
        additions: []
      }
    });
    productId = productRes.json().id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/orders should create an order successfully', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        customerId: 'customer-123',
        items: [
          { productId, quantity: 2, additions: [] }
        ],
        deliveryFee: 5
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toHaveProperty('id');
    expect(body.status).toBe('pending');
    expect(body.customerId).toBe('customer-123');
  });

  it('POST /api/orders should return validation error for missing fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        customerId: 'customer-123'
        // Missing items
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it('GET /api/orders should return list of orders', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/orders'
    });

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json())).toBe(true);
  });

  it('PATCH /api/orders/:id/status should update status to valid state', async () => {
    // Create an order first
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        customerId: 'customer-123',
        items: [{ productId, quantity: 1, additions: [] }],
        deliveryFee: 0
      }
    });
    
    const order = createRes.json();

    // Transition to cooking
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/status`,
      payload: {
        status: 'cooking'
      }
    });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().message).toBe('Order status updated successfully');
  });

  it('PATCH /api/orders/:id/status should fail for invalid transition', async () => {
    // Create an order first
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        customerId: 'customer-123',
        items: [{ productId, quantity: 1, additions: [] }],
        deliveryFee: 0
      }
    });
    
    const order = createRes.json(); // status 'pending'

    // Attempt to transition to 'delivered' directly from 'pending'
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/status`,
      payload: {
        status: 'delivered'
      }
    });

    expect(updateRes.statusCode).toBe(400); // 400 Bad Request mapped from Domain Error
  });
});
