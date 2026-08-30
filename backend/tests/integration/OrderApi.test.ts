import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

describe('Order API', () => {
  let app: FastifyInstance;
  let productId: string;
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
    
    // Setup: Create a product so we can order it
    const productRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${authToken}` },
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

  it('POST /api/orders should create an order successfully from public storefront', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        restaurantId: 'burger-craft',
        customerId: 'customer-123',
        items: [
          { productId, quantity: 2, additions: [] }
        ],
        paymentMethod: 'Efectivo',
        paymentAmount: 25,
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toHaveProperty('id');
    expect(body.restaurantId).toBe('burger-craft');
    expect(body.status).toBe('pending');
    expect(body.customerId).toBe('customer-123');
    expect(body.subtotal).toBe(20);
    expect(body.finalTotal).toBe(20);
    expect(body.changeAmount).toBe(5);
  });

  it('POST /api/orders should return validation error for missing fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        customerId: 'customer-123'
        // Missing items and restaurantId
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it('GET /api/orders should require auth and reject with 401 without token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/orders'
    });

    expect(response.statusCode).toBe(401);
  });

  it('GET /api/orders should return list of orders for authenticated tenant', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/orders',
      headers: {
        authorization: `Bearer ${authToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json())).toBe(true);
  });

  it('PATCH /api/orders/:id/status should update status to valid state for authenticated tenant', async () => {
    // Create an order first
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        restaurantId: 'burger-craft',
        customerId: 'customer-123',
        items: [{ productId, quantity: 1, additions: [] }],
        paymentMethod: 'Efectivo',
      }
    });
    
    const order = createRes.json();

    // Transition to cooking
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/status`,
      headers: {
        authorization: `Bearer ${authToken}`
      },
      payload: {
        status: 'cooking'
      }
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json();
    expect(updated.id).toBe(order.id);
    expect(updated.status).toBe('cooking');
  });

  it('PATCH /api/orders/:id/status should fail for invalid transition', async () => {
    // Create an order first
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        restaurantId: 'burger-craft',
        customerId: 'customer-123',
        items: [{ productId, quantity: 1, additions: [] }],
        paymentMethod: 'Efectivo',
      }
    });
    
    const order = createRes.json(); // status 'pending'

    // Attempt to transition to 'delivered' directly from 'pending'
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/status`,
      headers: {
        authorization: `Bearer ${authToken}`
      },
      payload: {
        status: 'delivered'
      }
    });

    expect(updateRes.statusCode).toBe(400); // 400 Bad Request mapped from Domain Error
  });
});
