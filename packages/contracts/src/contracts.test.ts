import { describe, it, expect } from 'vitest';
import {
  createProductSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  orderEventSchema,
  updateCustomerSchema,
  updateRestaurantSchema,
  restoreRestaurantSchema,
  createRestaurantSchema,
  restaurantDTOSchema,
  restaurantTemplateSummarySchema,
} from './index.js';

describe('@burger-page/contracts', () => {
  it('should validate valid updateCustomer payload', () => {
    const valid = {
      name: 'Carlos Mendoza',
      phone: '+57 301 555 1234',
      address: 'Calle 80 # 11-25',
      barrio: 'Antiguo Country',
      notes: 'Timbre 301',
    };
    const result = updateCustomerSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate valid createProduct payload', () => {
    const valid = {
      name: 'Classic Cheeseburger',
      description: 'Juicy Angus patty with cheddar',
      price: 24000,
      categoryId: 'cat-clasicas',
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

describe('restaurant schedule contracts', () => {
  const base = { name: 'Tienda de Pruebas', slug: 'tienda-pruebas' };

  it('accepts schedule, timezone and ordersPaused on create/update', () => {
    const payload = {
      schedule: [{ dayOfWeek: 1, open: '12:00', close: '22:30' }],
      timezone: 'America/Bogota',
      ordersPaused: true,
    };
    expect(createRestaurantSchema.safeParse({ ...base, ...payload }).success).toBe(true);
    expect(updateRestaurantSchema.safeParse(payload).success).toBe(true);
    expect(updateRestaurantSchema.safeParse({ schedule: [] }).success).toBe(true);
  });

  it('rejects an invalid timezone, day of week or time', () => {
    expect(updateRestaurantSchema.safeParse({ timezone: 'Mars/Olympus' }).success).toBe(false);
    expect(updateRestaurantSchema.safeParse({ schedule: [{ dayOfWeek: 9, open: '12:00', close: '22:30' }] }).success).toBe(false);
    expect(updateRestaurantSchema.safeParse({ schedule: [{ dayOfWeek: 1, open: '7pm', close: '22:30' }] }).success).toBe(false);
    expect(updateRestaurantSchema.safeParse({ ordersPaused: 'yes' }).success).toBe(false);
  });

  it('restaurantDTOSchema carries schedule, timezone and ordersPaused', () => {
    const parsed = restaurantDTOSchema.parse({
      id: 'rest_1',
      slug: 'tienda-pruebas',
      name: 'Tienda de Pruebas',
      schedule: [{ dayOfWeek: 0, open: '12:00', close: '22:30' }],
      timezone: 'America/Bogota',
      ordersPaused: false,
    });
    expect(parsed.schedule).toHaveLength(1);
    expect(parsed.timezone).toBe('America/Bogota');
    expect(parsed.ordersPaused).toBe(false);
  });

  it('accepts currency and currencySymbol on update and rejects malformed ones', () => {
    expect(updateRestaurantSchema.safeParse({ currency: 'MXN', currencySymbol: 'MX$' }).success).toBe(true);
    expect(updateRestaurantSchema.safeParse({ currency: 'EURO' }).success).toBe(false);
    expect(updateRestaurantSchema.safeParse({ currencySymbol: '' }).success).toBe(false);
  });

  it('restoreRestaurantSchema takes an optional slug', () => {
    expect(restoreRestaurantSchema.safeParse({}).success).toBe(true);
    expect(restoreRestaurantSchema.safeParse({ slug: 'otro' }).success).toBe(true);
    expect(restoreRestaurantSchema.safeParse({ slug: '' }).success).toBe(false);
  });

  it('createRestaurantSchema accepts currency and currencySymbol and rejects malformed ones', () => {
    expect(
      createRestaurantSchema.safeParse({ name: 'A', slug: 'a', currency: 'MXN', currencySymbol: 'MX$', templateType: 'tacos' })
        .success
    ).toBe(true);
    expect(createRestaurantSchema.safeParse({ name: 'A', slug: 'a', currency: 'PESOS' }).success).toBe(false);
    expect(createRestaurantSchema.safeParse({ name: 'A', slug: 'a', templateType: 'sushi' }).success).toBe(false);
  });

  it('restaurantTemplateSummarySchema describes a template list entry', () => {
    const entry = { id: 'burger', name: 'Hamburguesería', description: 'x', productCount: 6, additionCount: 7 };
    expect(restaurantTemplateSummarySchema.safeParse(entry).success).toBe(true);
    expect(restaurantTemplateSummarySchema.safeParse({ ...entry, productCount: -1 }).success).toBe(false);
  });
});
