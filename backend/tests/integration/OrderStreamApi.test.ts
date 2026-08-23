import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { globalOrderEventBus } from '../../src/infrastructure/events/OrderEventBus.js';

describe('Real-Time Order SSE Stream (TDD)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should broadcast order status update events through global event bus', async () => {
    const receivedEvents: any[] = [];
    const unsubscribe = globalOrderEventBus.subscribe((event) => {
      receivedEvents.push(event);
    });

    // 1. Create product first
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      payload: {
        name: 'Smash Classic',
        description: 'Cheese & Bacon',
        price: 22000,
        category: 'Clásicas',
        isAvailable: true,
        additions: []
      }
    });
    const product = prodRes.json();

    // 2. Create order (triggers ORDER_CREATED event)
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        customerId: 'cust-1',
        items: [{ productId: product.id, quantity: 1, additions: [] }],
        deliveryFee: 4500
      }
    });
    expect(orderRes.statusCode).toBe(201);
    const order = orderRes.json();

    // 3. Update order status (triggers ORDER_STATUS_UPDATED event)
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/status`,
      payload: { status: 'cooking' }
    });
    expect(patchRes.statusCode).toBe(200);

    unsubscribe();

    // Verify events were emitted
    expect(receivedEvents.length).toBeGreaterThanOrEqual(2);
    const createdEvent = receivedEvents.find(e => e.eventType === 'ORDER_CREATED' && e.orderId === order.id);
    expect(createdEvent).toBeDefined();
    expect(createdEvent.status).toBe('pending');

    const updatedEvent = receivedEvents.find(e => e.eventType === 'ORDER_STATUS_UPDATED' && e.orderId === order.id);
    expect(updatedEvent).toBeDefined();
    expect(updatedEvent.status).toBe('cooking');
  });
});
