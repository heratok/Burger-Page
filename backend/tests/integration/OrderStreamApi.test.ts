import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { globalOrderEventBus, MAX_ACTIVE_STREAMS, registerStream, unregisterStream, getActiveStreamCount } from '../../src/infrastructure/events/OrderEventBus.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

describe('Real-Time Order SSE Stream (TDD)', () => {
  let app: FastifyInstance;
  let authTokenCraft: string;
  let authTokenOther: string;
  const jwtService = new JwtService();

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    authTokenCraft = jwtService.generateToken({
      id: 'usr-1',
      username: 'craft_manager',
      role: 'restaurant_admin',
      restaurantId: 'burger-craft',
    });

    authTokenOther = jwtService.generateToken({
      id: 'usr-2',
      username: 'other_manager',
      role: 'restaurant_admin',
      restaurantId: 'other-restaurant',
    });
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
      headers: { authorization: `Bearer ${authTokenCraft}` },
      payload: {
        name: 'Smash Classic',
        description: 'Cheese & Bacon',
        price: 22000,
        categoryId: 'cat-1',
        category: 'Burgers',
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
        restaurantId: 'burger-craft',
        customerId: 'cust-1',
        items: [{ productId: product.id, quantity: 1, additions: [] }],
      }
    });
    expect(orderRes.statusCode).toBe(201);
    const order = orderRes.json();

    // 3. Update order status (triggers ORDER_STATUS_UPDATED event)
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/status`,
      headers: {
        authorization: `Bearer ${authTokenCraft}`
      },
      payload: { status: 'cooking' }
    });
    expect(patchRes.statusCode).toBe(200);

    unsubscribe();

    // Verify events were emitted
    expect(receivedEvents.length).toBeGreaterThanOrEqual(2);
    const createdEvent = receivedEvents.find(e => e.eventType === 'ORDER_CREATED' && e.orderId === order.id);
    expect(createdEvent).toBeDefined();
    expect(createdEvent.status).toBe('pending');
    expect(createdEvent.payload.restaurantId).toBe('burger-craft');

    const updatedEvent = receivedEvents.find(e => e.eventType === 'ORDER_STATUS_UPDATED' && e.orderId === order.id);
    expect(updatedEvent).toBeDefined();
    expect(updatedEvent.status).toBe('cooking');
    expect(updatedEvent.payload.restaurantId).toBe('burger-craft');
  });

  it('should require authentication on SSE stream endpoint and reject with 401 without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/orders/stream'
    });
    expect(res.statusCode).toBe(401);
  });

  it('should establish SSE stream connection with correct headers and tenant context', async () => {
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const abortController = new AbortController();
    const streamBaseline = getActiveStreamCount();
    try {
      const response = await fetch(`${address}/api/orders/stream`, {
        headers: {
          authorization: `Bearer ${authTokenCraft}`
        },
        signal: abortController.signal
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      expect(response.headers.get('cache-control')).toContain('no-cache');

      const reader = response.body?.getReader();
      expect(reader).toBeDefined();
      const { value } = await reader!.read();
      const text = new TextDecoder().decode(value);
      expect(text).toContain('event: connected');
      expect(text).toContain('burger-craft');
    } finally {
      abortController.abort();
    }
    // H3: the stream slot reserved by this connection must be released once
    // the client disconnects (close/error/teardown all funnel into the same
    // once-only release helper).
    await expect.poll(() => getActiveStreamCount(), { timeout: 2000 }).toBe(streamBaseline);
  });

  it('should cap concurrent streams at MAX_ACTIVE_STREAMS and release slots exactly once', () => {
    // The registry is a per-process module global, so drain any slots left
    // over from prior suite runs before asserting the cap from a clean base.
    while (getActiveStreamCount() > 0) unregisterStream();

    const reservations: boolean[] = [];
    for (let i = 0; i < MAX_ACTIVE_STREAMS; i++) {
      reservations.push(registerStream());
    }
    expect(reservations.every((ok) => ok)).toBe(true);
    expect(getActiveStreamCount()).toBe(MAX_ACTIVE_STREAMS);

    // The next reservation over the cap is refused (the route answers 503).
    expect(registerStream()).toBe(false);
    expect(getActiveStreamCount()).toBe(MAX_ACTIVE_STREAMS);

    // Releasing a slot admits a new stream again.
    unregisterStream();
    expect(registerStream()).toBe(true);
    expect(getActiveStreamCount()).toBe(MAX_ACTIVE_STREAMS);

    // unregisterStream never underflows below zero.
    while (getActiveStreamCount() > 0) unregisterStream();
    unregisterStream();
    expect(getActiveStreamCount()).toBe(0);
  });
});
