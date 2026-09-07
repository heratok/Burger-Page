import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';
import { globalOrderEventBus } from '../../src/infrastructure/events/OrderEventBus.js';

describe('Order Update API (TDD)', () => {
  let app: FastifyInstance;
  let craftToken: string;
  let otherToken: string;
  let product1Id: string;
  let product2Id: string;
  let additionId: string;
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

    // 1. Create Product 1 for burger-craft
    const prod1Res = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${craftToken}` },
      payload: {
        name: 'Classic Update Burger',
        price: 20,
        description: 'Testing base burger',
        categoryId: 'cat-1',
        category: 'Burgers',
        isAvailable: true,
        additions: [],
      },
    });
    product1Id = prod1Res.json().id;

    // 2. Create Product 2 for burger-craft
    const prod2Res = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${craftToken}` },
      payload: {
        name: 'Deluxe Update Burger',
        price: 25,
        description: 'Testing updated burger',
        categoryId: 'cat-1',
        category: 'Burgers',
        isAvailable: true,
        additions: [],
      },
    });
    product2Id = prod2Res.json().id;

    // 3. Create Addition for burger-craft
    const addRes = await app.inject({
      method: 'POST',
      url: '/api/additions',
      headers: { authorization: `Bearer ${craftToken}` },
      payload: {
        name: 'Extra Cheddar Melt',
        price: 5,
        isAvailable: true,
        displayOrder: 1,
      },
    });
    additionId = addRes.json().id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('PUT /api/orders/:id should return 401 Unauthorized when unauthenticated', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/orders/ord-test-unauth',
      payload: {
        comment: 'Unauthenticated attempt',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('PUT /api/orders/:id should return 404 when trying to update an order belonging to a different tenant', async () => {
    // 1. Create an order under burger-craft
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        restaurantId: 'burger-craft',
        customerId: 'cust-tenant-iso',
        items: [{ productId: product1Id, quantity: 1, additions: [] }],
        paymentMethod: 'Efectivo',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const order = createRes.json();

    // 2. Attempt update using other-restaurant token
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/orders/${order.id}`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: {
        comment: 'Malicious cross-tenant edit',
      },
    });

    expect(updateRes.statusCode).toBe(404);
  });

  it('PUT /api/orders/:id should return 200 when updating customer info, comment, paymentMethod, deliveryFee, and items (with additions), updating database and publishing ORDER_UPDATED event', async () => {
    // 1. Create initial order under burger-craft
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: {
        restaurantId: 'burger-craft',
        customerId: 'cust-edit-target',
        customer: {
          name: 'Original Customer',
          phone: '3001112233',
          address: 'Calle 1 # 2-3',
          barrio: 'Centro',
        },
        items: [{ productId: product1Id, quantity: 1, additions: [] }],
        deliveryFee: 4,
        paymentMethod: 'Efectivo',
        paymentAmount: 30,
        comment: 'Original comment',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const initialOrder = createRes.json();
    expect(initialOrder.subtotal).toBe(20);
    expect(initialOrder.finalTotal).toBe(20);

    // 2. Set up SSE event listener on globalOrderEventBus
    let capturedEvent: any = null;
    const unsubscribe = globalOrderEventBus.subscribe((event) => {
      if (event.orderId === initialOrder.id && event.eventType === 'ORDER_UPDATED') {
        capturedEvent = event;
      }
    });

    // 3. Perform PUT update with new customer info, comment, paymentMethod, deliveryFee, and items with additions
    const updatePayload = {
      customer: {
        name: 'Updated VIP Customer',
        phone: '3119998877',
        address: 'Carrera 15 # 90-20',
        barrio: 'Chicó Norte',
      },
      comment: 'Urgent: deliver quickly and hot',
      paymentMethod: 'Transferencia',
      deliveryFee: 6,
      items: [
        {
          productId: product2Id,
          quantity: 2,
          observation: 'Sin cebolla',
          additions: [
            {
              additionId,
              quantity: 1,
            },
          ],
        },
      ],
    };

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/orders/${initialOrder.id}`,
      headers: { authorization: `Bearer ${craftToken}` },
      payload: updatePayload,
    });

    expect(updateRes.statusCode).toBe(200);
    const updatedOrder = updateRes.json();

    // Verification of updated values in response:
    // Product 2 is $25, Addition is $5 -> (25 + 5) * 2 = 60 subtotal
    // Delivery fee is 6 -> finalTotal = 66
    expect(updatedOrder.id).toBe(initialOrder.id);
    expect(updatedOrder.restaurantId).toBe('burger-craft');
    expect(updatedOrder.comment).toBe('Urgent: deliver quickly and hot');
    expect(updatedOrder.paymentMethod).toBe('Transferencia');
    expect(updatedOrder.deliveryFee).toBe(6);
    expect(updatedOrder.subtotal).toBe(60);
    expect(updatedOrder.finalTotal).toBe(66);
    expect(updatedOrder.items).toHaveLength(1);
    expect(updatedOrder.items[0].productId).toBe(product2Id);
    expect(updatedOrder.items[0].quantity).toBe(2);
    expect(updatedOrder.items[0].observation).toBe('Sin cebolla');
    expect(updatedOrder.items[0].additions).toHaveLength(1);
    expect(updatedOrder.items[0].additions[0].additionId).toBe(additionId);

    // 4. Verify that database row was updated by retrieving it via GET
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/orders/${initialOrder.id}`,
      headers: { authorization: `Bearer ${craftToken}` },
    });
    expect(getRes.statusCode).toBe(200);
    const retrieved = getRes.json();
    expect(retrieved.comment).toBe('Urgent: deliver quickly and hot');
    expect(retrieved.deliveryFee).toBe(6);
    expect(retrieved.subtotal).toBe(60);
    expect(retrieved.finalTotal).toBe(66);
    expect(retrieved.items).toHaveLength(1);
    expect(retrieved.items[0].productId).toBe(product2Id);

    // 5. Verify ORDER_UPDATED event on globalOrderEventBus
    unsubscribe();
    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent.eventType).toBe('ORDER_UPDATED');
    expect(capturedEvent.orderId).toBe(initialOrder.id);
    expect(capturedEvent.payload.restaurantId).toBe('burger-craft');
    expect(capturedEvent.payload.subtotal).toBe(60);
    expect(capturedEvent.payload.finalTotal).toBe(66);
    expect(capturedEvent.payload.deliveryFee).toBe(6);
    expect(capturedEvent.payload.comment).toBe('Urgent: deliver quickly and hot');
  });
});
