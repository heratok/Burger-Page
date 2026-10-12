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
  AUDIT_ACTIONS,
  auditLogQuerySchema,
  auditLogItemSchema,
  auditLogPageSchema,
  platformStatsQuerySchema,
  platformStatsSchema,
  createRestaurantTableSchema,
  updateRestaurantTableSchema,
  bulkCreateRestaurantTablesSchema,
  normalizeTableZone,
  formatTableName,
  MAX_TABLE_NAME_LENGTH,
  MAX_TABLE_ZONE_LENGTH,
  MAX_TABLE_ALIAS_LENGTH,
  MAX_TABLE_NUMBER,
  MAX_BULK_TABLES,
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
    expect(restaurantTemplateSummarySchema.safeParse({ ...entry, supportedCurrencies: ['COP', 'USD'] }).success).toBe(true);
    expect(restaurantTemplateSummarySchema.safeParse({ ...entry, supportedCurrencies: null }).success).toBe(true);
  });

  describe('audit log contracts', () => {
    it('lists every super admin action', () => {
      expect(AUDIT_ACTIONS).toEqual([
        'restaurant.create', 'restaurant.update', 'restaurant.pause', 'restaurant.activate',
        'restaurant.delete', 'restaurant.restore',
        'user.create', 'user.update', 'user.activate', 'user.deactivate', 'user.delete', 'user.reset_password',
        'role.create', 'role.update', 'role.delete',
      ]);
    });

    it('defaults limit to 50, caps it at 200 and coerces query strings', () => {
      expect(auditLogQuerySchema.parse({}).limit).toBe(50);
      expect(auditLogQuerySchema.parse({ limit: '25' }).limit).toBe(25);
      expect(auditLogQuerySchema.safeParse({ limit: '201' }).success).toBe(false);
      expect(auditLogQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    });

    it('validates filters', () => {
      expect(auditLogQuerySchema.safeParse({ action: 'restaurant.create', restaurantId: 'r', actorUserId: 'u', from: '2026-01-01T00:00:00.000Z', to: '2026-02-01T00:00:00.000Z', cursor: 'abc' }).success).toBe(true);
      expect(auditLogQuerySchema.safeParse({ action: 'restaurant.explode' }).success).toBe(false);
      expect(auditLogQuerySchema.safeParse({ from: 'yesterday' }).success).toBe(false);
    });

    it('describes an item and a page', () => {
      const item = {
        id: 'aud_1', createdAt: '2026-01-01T00:00:00.000Z', actorUserId: 'usr_1', actorUsername: 'root',
        action: 'user.create', targetType: 'user', targetId: 'usr_2', targetLabel: 'bob', restaurantId: null,
        details: { role: 'restaurant_admin' },
      };
      expect(auditLogItemSchema.safeParse(item).success).toBe(true);
      expect(auditLogPageSchema.safeParse({ items: [item], nextCursor: null }).success).toBe(true);
      expect(auditLogItemSchema.safeParse({ ...item, targetType: 'order' }).success).toBe(false);
    });
  });
  describe('platform stats', () => {
    const stats = { totalRevenue: 125000.5, totalOrders: 12, cancelledOrders: 2, totalCustomers: 7, totalRestaurants: 3, activeRestaurants: 2 };

    it('accepts an empty query and ISO calendar dates', () => {
      expect(platformStatsQuerySchema.safeParse({}).success).toBe(true);
      expect(platformStatsQuerySchema.safeParse({ from: '2026-01-01', to: '2026-01-31' }).success).toBe(true);
      expect(platformStatsQuerySchema.safeParse({ from: '2026-03-05', to: '2026-03-05' }).success).toBe(true);
    });

    it('rejects anything that is not a real YYYY-MM-DD date', () => {
      expect(platformStatsQuerySchema.safeParse({ from: 'yesterday' }).success).toBe(false);
      expect(platformStatsQuerySchema.safeParse({ from: '2026-1-1' }).success).toBe(false);
      expect(platformStatsQuerySchema.safeParse({ to: '2026-02-30' }).success).toBe(false);
      expect(platformStatsQuerySchema.safeParse({ to: '2026-02-29' }).success).toBe(false);
      expect(platformStatsQuerySchema.safeParse({ to: '2028-02-29' }).success).toBe(true);
      expect(platformStatsQuerySchema.safeParse({ to: '2026-01-01T00:00:00.000Z' }).success).toBe(false);
    });

    it('rejects a range whose start is after its end', () => {
      expect(platformStatsQuerySchema.safeParse({ from: '2026-02-01', to: '2026-01-31' }).success).toBe(false);
    });

    it('describes the stats payload', () => {
      expect(platformStatsSchema.safeParse(stats).success).toBe(true);
      expect(platformStatsSchema.safeParse({ ...stats, totalOrders: -1 }).success).toBe(false);
      expect(platformStatsSchema.safeParse({ ...stats, totalOrders: 1.5 }).success).toBe(false);
      expect(platformStatsSchema.safeParse({ ...stats, cancelledOrders: -1 }).success).toBe(false);
      expect(platformStatsSchema.safeParse({ ...stats, cancelledOrders: 0.5 }).success).toBe(false);
      const { cancelledOrders: _noCancelled, ...withoutCancelled } = stats;
      expect(platformStatsSchema.safeParse(withoutCancelled).success).toBe(false);
      const { totalCustomers: _omit, ...missing } = stats;
      expect(platformStatsSchema.safeParse(missing).success).toBe(false);
    });
  });
});

describe('structured restaurant table contracts', () => {
  describe('normalizeTableZone', () => {
    it('collapses whitespace, trims and capitalizes the first letter', () => {
      expect(normalizeTableZone('  terraza   alta ')).toBe('Terraza alta');
      expect(normalizeTableZone('mesa')).toBe('Mesa');
      expect(normalizeTableZone('VIP')).toBe('VIP');
      expect(normalizeTableZone('   ')).toBe('');
    });
  });

  describe('formatTableName', () => {
    it('formats zone and number', () => {
      expect(formatTableName({ zone: 'Terraza', number: 5 })).toBe('Terraza 5');
    });
    it('appends the alias when present', () => {
      expect(formatTableName({ zone: 'Mesa', number: 4, alias: 'VIP' })).toBe('Mesa 4 · VIP');
    });
    it('ignores empty or null aliases', () => {
      expect(formatTableName({ zone: 'Mesa', number: 4, alias: null })).toBe('Mesa 4');
      expect(formatTableName({ zone: 'Mesa', number: 4, alias: '   ' })).toBe('Mesa 4');
    });
    it('normalizes the zone', () => {
      expect(formatTableName({ zone: ' terraza  ', number: 2 })).toBe('Terraza 2');
    });
    it('fits the widest possible values within MAX_TABLE_NAME_LENGTH', () => {
      const name = formatTableName({
        zone: 'Z'.repeat(MAX_TABLE_ZONE_LENGTH),
        number: MAX_TABLE_NUMBER,
        alias: 'a'.repeat(MAX_TABLE_ALIAS_LENGTH),
      });
      expect(name.length).toBe(MAX_TABLE_NAME_LENGTH);
    });
  });

  describe('createRestaurantTableSchema', () => {
    it('accepts zone and number and normalizes the zone', () => {
      const r = createRestaurantTableSchema.parse({ zone: '  terraza ', number: 5 });
      expect(r.zone).toBe('Terraza');
      expect(r.number).toBe(5);
    });
    it('accepts an optional alias and isActive', () => {
      const r = createRestaurantTableSchema.parse({ zone: 'Mesa', number: 1, alias: ' Ventana ', isActive: false });
      expect(r.alias).toBe('Ventana');
      expect(r.isActive).toBe(false);
    });
    it('does not expose a client-provided name', () => {
      const r = createRestaurantTableSchema.parse({ zone: 'Mesa', number: 1, name: 'Hack' });
      expect('name' in r).toBe(false);
    });
    it('rejects missing, empty or too long zones', () => {
      expect(createRestaurantTableSchema.safeParse({ number: 1 }).success).toBe(false);
      expect(createRestaurantTableSchema.safeParse({ zone: '   ', number: 1 }).success).toBe(false);
      expect(createRestaurantTableSchema.safeParse({ zone: 'x'.repeat(MAX_TABLE_ZONE_LENGTH + 1), number: 1 }).success).toBe(false);
    });
    it('rejects numbers out of 1..9999 or non-integer', () => {
      for (const number of [0, -1, 1.5, MAX_TABLE_NUMBER + 1, '3']) {
        expect(createRestaurantTableSchema.safeParse({ zone: 'Mesa', number }).success).toBe(false);
      }
      expect(createRestaurantTableSchema.safeParse({ zone: 'Mesa', number: MAX_TABLE_NUMBER }).success).toBe(true);
    });
    it('rejects aliases longer than the limit and treats blank alias as absent', () => {
      expect(createRestaurantTableSchema.safeParse({ zone: 'Mesa', number: 1, alias: 'x'.repeat(MAX_TABLE_ALIAS_LENGTH + 1) }).success).toBe(false);
      expect(createRestaurantTableSchema.parse({ zone: 'Mesa', number: 1, alias: '   ' }).alias).toBeNull();
    });
  });

  describe('updateRestaurantTableSchema', () => {
    it('accepts partial payloads and a null alias to clear it', () => {
      expect(updateRestaurantTableSchema.parse({ alias: null }).alias).toBeNull();
      expect(updateRestaurantTableSchema.parse({ isActive: false })).toEqual({ isActive: false });
      expect(updateRestaurantTableSchema.parse({ zone: 'salon' }).zone).toBe('Salon');
    });
    it('still validates provided fields', () => {
      expect(updateRestaurantTableSchema.safeParse({ number: 0 }).success).toBe(false);
      expect(updateRestaurantTableSchema.safeParse({ zone: '' }).success).toBe(false);
    });
  });

  describe('bulkCreateRestaurantTablesSchema', () => {
    it('accepts a valid range', () => {
      const r = bulkCreateRestaurantTablesSchema.parse({ zone: 'terraza', from: 1, to: 10 });
      expect(r).toMatchObject({ zone: 'Terraza', from: 1, to: 10 });
    });
    it('accepts from === to and a range of exactly MAX_BULK_TABLES', () => {
      expect(bulkCreateRestaurantTablesSchema.safeParse({ zone: 'Mesa', from: 3, to: 3 }).success).toBe(true);
      expect(bulkCreateRestaurantTablesSchema.safeParse({ zone: 'Mesa', from: 1, to: MAX_BULK_TABLES }).success).toBe(true);
    });
    it('rejects from > to, ranges over the limit and out-of-range numbers', () => {
      expect(bulkCreateRestaurantTablesSchema.safeParse({ zone: 'Mesa', from: 5, to: 4 }).success).toBe(false);
      expect(bulkCreateRestaurantTablesSchema.safeParse({ zone: 'Mesa', from: 1, to: MAX_BULK_TABLES + 1 }).success).toBe(false);
      expect(bulkCreateRestaurantTablesSchema.safeParse({ zone: 'Mesa', from: 0, to: 3 }).success).toBe(false);
      expect(bulkCreateRestaurantTablesSchema.safeParse({ zone: 'Mesa', from: 1, to: MAX_TABLE_NUMBER + 1 }).success).toBe(false);
    });
  });
});
