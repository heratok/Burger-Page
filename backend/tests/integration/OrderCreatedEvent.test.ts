import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { globalOrderEventBus } from '../../src/infrastructure/events/OrderEventBus.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

describe('ORDER_CREATED SSE event (flow fixes 1.4 and 1.5)', () => {
  let app: FastifyInstance;
  let productId: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    const token = new JwtService().generateToken({
      id: 'usr-1',
      username: 'craft_manager',
      role: 'restaurant_admin',
      restaurantId: 'burger-craft',
    });
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Event Burger',
        description: 'Event test',
        price: 20000,
        categoryId: 'cat-1',
        category: 'Burgers',
        isAvailable: true,
        additions: [],
      },
    });
    productId = prodRes.json().id;
  });

  afterAll(async () => {
    await app.close();
  });

  const createOrder = (extra: Record<string, unknown> = {}) =>
    app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        restaurantId: 'burger-craft',
        items: [{ productId, quantity: 1, additions: [] }],
        ...extra,
      },
    });

  const collect = async (fn: () => Promise<void>) => {
    const events: any[] = [];
    const unsubscribe = globalOrderEventBus.subscribe((e) => events.push(e));
    try {
      await fn();
    } finally {
      unsubscribe();
    }
    return events;
  };

  it('includes payment data and comment in the ORDER_CREATED payload', async () => {
    let orderId = '';
    const events = await collect(async () => {
      const res = await createOrder({
        paymentMethod: 'Efectivo',
        paymentAmount: 50000,
        comment: 'tocar timbre',
      });
      expect(res.statusCode).toBe(201);
      orderId = res.json().id;
    });
    const created = events.find((e) => e.eventType === 'ORDER_CREATED' && e.orderId === orderId);
    expect(created).toBeDefined();
    expect(created.payload.paymentMethod).toBe('Efectivo');
    expect(created.payload.paymentAmount).toBe(50000);
    expect(created.payload.changeAmount).toBe(30000);
    expect(created.payload.comment).toBe('tocar timbre');
  });

  it('carries the transfer payment method instead of the cash default', async () => {
    let orderId = '';
    const events = await collect(async () => {
      const res = await createOrder({ paymentMethod: 'Transferencia' });
      orderId = res.json().id;
    });
    const created = events.find((e) => e.eventType === 'ORDER_CREATED' && e.orderId === orderId);
    expect(created.payload.paymentMethod).toBe('Transferencia');
  });

  it('does not republish ORDER_CREATED when the request is an idempotent replay', async () => {
    const clientOrderId = `cli-replay-${Date.now()}`;
    let firstId = '';
    let secondId = '';
    const events = await collect(async () => {
      const first = await createOrder({ clientOrderId });
      expect(first.statusCode).toBe(201);
      firstId = first.json().id;
      const second = await createOrder({ clientOrderId });
      expect(second.statusCode).toBe(201);
      secondId = second.json().id;
    });
    expect(secondId).toBe(firstId);
    const createdEvents = events.filter((e) => e.eventType === 'ORDER_CREATED' && e.orderId === firstId);
    expect(createdEvents).toHaveLength(1);
  });
});
