import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';
import { globalOrderEventBus } from '../../src/infrastructure/events/OrderEventBus.js';

describe('Order Module Multi-Tenant & Security Suite', () => {
  let app: FastifyInstance;
  let craftToken: string;
  let otherToken: string;
  let productId: string;
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

    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${craftToken}` },
      payload: {
        name: 'Gourmet Burger',
        price: 25,
        description: 'Quality ingredients',
        category: 'Burgers',
        isAvailable: true,
        additions: []
      }
    });
    productId = prodRes.json().id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('permite crear una orden desde el storefront público y calcula totales de forma autoritativa', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        restaurantId: 'burger-craft',
        customerId: 'customer-1',
        items: [{ productId, quantity: 2, additions: [] }],
        paymentMethod: 'Efectivo',
        paymentAmount: 60,
      }
    });

    expect(res.statusCode).toBe(201);
    const order = res.json();
    expect(order.restaurantId).toBe('burger-craft');
    expect(order.subtotal).toBe(50); // 2 * 25
    expect(order.finalTotal).toBe(50);
    expect(order.changeAmount).toBe(10); // 60 - 50
  });

  it('impide a un restaurante ver órdenes de otro tenant (Aislamiento Multi-Tenant)', async () => {
    // 1. Crear orden para burger-craft
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        restaurantId: 'burger-craft',
        customerId: 'customer-1',
        items: [{ productId, quantity: 1, additions: [] }],
      }
    });
    const order = createRes.json();

    // 2. Intentar leer la orden con el token de burger-craft -> 200 OK
    const getCraftRes = await app.inject({
      method: 'GET',
      url: `/api/orders/${order.id}`,
      headers: { authorization: `Bearer ${craftToken}` }
    });
    expect(getCraftRes.statusCode).toBe(200);

    // 3. Intentar leer la orden con el token de other-restaurant -> 404 Not Found (Cross-tenant access blocked)
    const getOtherRes = await app.inject({
      method: 'GET',
      url: `/api/orders/${order.id}`,
      headers: { authorization: `Bearer ${otherToken}` }
    });
    expect(getOtherRes.statusCode).toBe(404);
  });

  it('impide a un restaurante cambiar el estado de una orden de otro tenant', async () => {
    // 1. Crear orden para burger-craft
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        restaurantId: 'burger-craft',
        customerId: 'customer-1',
        items: [{ productId, quantity: 1, additions: [] }],
      }
    });
    const order = createRes.json();

    // 2. Intentar actualizar estado con token de other-restaurant -> 404 Not Found
    const patchOtherRes = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/status`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { status: 'cooking' }
    });
    expect(patchOtherRes.statusCode).toBe(404);

    // 3. Actualizar con token de burger-craft -> 200 OK
    const patchCraftRes = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/status`,
      headers: { authorization: `Bearer ${craftToken}` },
      payload: { status: 'cooking' }
    });
    expect(patchCraftRes.statusCode).toBe(200);
  });

  it('rechaza órdenes en efectivo si el monto pagado es menor al total final', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        restaurantId: 'burger-craft',
        items: [{ productId, quantity: 1, additions: [] }],
        paymentMethod: 'Efectivo',
        paymentAmount: 10, // Menor que 25
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().detail).toMatch(/less than final total/i);
  });

  it('ignora precios manipulados enviados en el body y calcula precio real desde BD', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        restaurantId: 'burger-craft',
        items: [
          { productId, quantity: 2, price: 1, unitPrice: 1, additions: [] } as any // Client tries to force $1 instead of $25
        ],
      }
    });

    expect(res.statusCode).toBe(201);
    const order = res.json();
    expect(order.subtotal).toBe(50); // 2 * $25 = $50 (ignora el $1 enviado por el cliente)
    expect(order.finalTotal).toBe(50);
  });

  it('SSE stream de restaurante B no recibe eventos emitidos para restaurante A', async () => {
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const abortOther = new AbortController();

    const otherEvents: string[] = [];

    // Conectar SSE con token de other-restaurant
    const responseOther = await fetch(`${address}/api/orders/stream`, {
      headers: { authorization: `Bearer ${otherToken}` },
      signal: abortOther.signal
    });

    const reader = responseOther.body?.getReader();
    const readStreamPromise = (async () => {
      try {
        while (true) {
          const { done, value } = await reader!.read();
          if (done) break;
          otherEvents.push(new TextDecoder().decode(value));
        }
      } catch {}
    })();

    // Crear orden para burger-craft
    await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        restaurantId: 'burger-craft',
        items: [{ productId, quantity: 1, additions: [] }],
      }
    });

    // Esperar brevemente para verificar que other-restaurant no reciba nada de burger-craft
    await new Promise((resolve) => setTimeout(resolve, 50));
    abortOther.abort();
    await readStreamPromise.catch(() => {});

    // other-restaurant solo debe haber recibido el evento initial 'connected', pero NINGÚN evento de burger-craft
    const rawOutput = otherEvents.join('');
    expect(rawOutput).toContain('event: connected');
    expect(rawOutput).not.toContain('ORDER_CREATED');
  });
});
