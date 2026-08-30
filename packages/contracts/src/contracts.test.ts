import { describe, it, expect } from 'vitest';
import {
  createProductSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  orderEventSchema,
} from './index.js';

describe('@burger-page/contracts', () => {
  it('should validate valid createProduct payload', () => {
    const valid = {
      name: 'Classic Cheeseburger',
      description: 'Juicy Angus patty with cheddar',
      price: 24000,
      category: 'Clásicas',
      isAvailable: true,
      additions: ['Bacon', 'Extra Cheese'],
    };
    const result = createProductSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject invalid createProduct payload', () => {
    const invalid = {
      name: '',
      price: -500,
    };
    const result = createProductSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should validate valid createOrder payload', () => {
    const valid = {
      restaurantId: 'burger-craft',
      customerId: 'cust-101',
      items: [
        { productId: 'prod-1', quantity: 2, additions: ['add-1'] },
      ],
      deliveryFee: 4500,
    };
    const result = createOrderSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate order status enum transitions', () => {
    expect(updateOrderStatusSchema.safeParse({ status: 'cooking' }).success).toBe(true);
    expect(updateOrderStatusSchema.safeParse({ status: 'invalid-status' }).success).toBe(false);
  });

  it('should validate real-time SSE order event payload', () => {
    const validEvent = {
      eventType: 'ORDER_STATUS_UPDATED',
      orderId: 'ord-123',
      orderNumber: 24081,
      status: 'cooking',
      timestamp: new Date().toISOString(),
    };
    const result = orderEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });
});
