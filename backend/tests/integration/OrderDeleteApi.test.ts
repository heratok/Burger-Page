import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';
import { globalOrderEventBus } from '../../src/infrastructure/events/OrderEventBus.js';

describe('Order Delete API & Multi-Tenant Isolation (TDD)', () => {
  let app: FastifyInstance;
  let craftToken: string;
  let otherToken: string;
  let craftProductId: string;
  const jwtService = new JwtService();

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    craftToken = jwtService.generateToken({
      id: 'usr-craft-1',
      username: 'manager_craft',
      role: 'restaurant_admin',
      restaurantId: 'burger-craft',
    });

    otherToken = jwtService.generateToken({
      id: 'usr-other-1',
      username: 'manager_other',
      role: 'restaurant_admin',
      restaurantId: 'other-restaurant',
    });

    // Create a product for burger-craft
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${craftToken}` },
      payload: {
        name: 'Delete Test Burger',
        price: 15,
        description: 'Testing order deletion',
        categoryId: 'cat-1',
        category: 'Burgers',
        isAvailable: true,
        additions: [],
      },
    });
    craftProductId = prodRes.json().id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('DELETE /api/orders/:id should return 401 Unauthorized without auth token', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/orders/ord-fake-123',
    });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /api/orders/:id should return 404 if order does not belong to the tenant', async () => {
    // 1. Create order for burger-craft
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        restaurantId: 'burger-craft',
        customerId: 'customer-cross-tenant',
        items: [{ productId: craftProductId, quantity: 1, additions: [] }],
        paymentMethod: 'Efectivo',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const order = createRes.json();

    // 2. Attempt deletion using other-restaurant token
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/orders/${order.id}`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(deleteRes.statusCode).toBe(404);

    // 3. Verify order still exists for burger-craft
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/orders/${order.id}`,
      headers: { authorization: `Bearer ${craftToken}` },
    });
    expect(getRes.statusCode).toBe(200);
  });

  it('DELETE /api/orders/:id should delete order successfully for valid tenant and publish ORDER_DELETED event', async () => {
    // 1. Create order for burger-craft
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        restaurantId: 'burger-craft',
        customerId: 'customer-delete-target',
        items: [{ productId: craftProductId, quantity: 2, additions: [] }],
        paymentMethod: 'Efectivo',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const order = createRes.json();

    // Listen for SSE event
    let capturedEvent: any = null;
    const unsubscribe = globalOrderEventBus.subscribe((event) => {
      if (event.orderId === order.id && event.eventType === 'ORDER_DELETED') {
        capturedEvent = event;
      }
    });

    // 2. Delete the order
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/orders/${order.id}`,
      headers: { authorization: `Bearer ${craftToken}` },
    });
    expect(deleteRes.statusCode).toBe(200);
    const deleteBody = deleteRes.json();
    expect(deleteBody).toHaveProperty('success', true);
    expect(deleteBody).toHaveProperty('id', order.id);

    // 3. Verify event was published
    unsubscribe();
    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent.eventType).toBe('ORDER_DELETED');
    expect(capturedEvent.orderId).toBe(order.id);
    expect(capturedEvent.payload.restaurantId).toBe('burger-craft');

    // 4. Verify order no longer exists
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/orders/${order.id}`,
      headers: { authorization: `Bearer ${craftToken}` },
    });
    expect(getRes.statusCode).toBe(404);
  });
});
