import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';

describe('Inventory API Integration (TDD)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/inventory should serialize currentStock, quantity, minStockAlert and alertThreshold', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/inventory',
    });

    expect(res.statusCode).toBe(200);
    const items = res.json();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);

    const firstItem = items[0];
    expect(firstItem.id).toBeDefined();
    expect(firstItem.name).toBeDefined();
    // Verify JD-03: neither currentStock nor quantity is undefined/dropped
    expect(typeof firstItem.currentStock).toBe('number');
    expect(typeof firstItem.quantity).toBe('number');
    expect(firstItem.currentStock).toBe(firstItem.quantity);
    expect(typeof firstItem.minStockAlert).toBe('number');
    expect(typeof firstItem.alertThreshold).toBe('number');
    expect(firstItem.minStockAlert).toBe(firstItem.alertThreshold);
  });

  it('PATCH /api/inventory/:id/stock should serialize id, currentStock and message', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/inventory',
    });
    const items = listRes.json();
    const initialItem = items[0];
    const initialStock = initialItem.currentStock;

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/inventory/${initialItem.id}/stock`,
      payload: { quantityChange: 15 },
    });

    expect(patchRes.statusCode).toBe(200);
    const body = patchRes.json();
    // Verify JD-04: id, currentStock, and message are all returned and serialized
    expect(body.id).toBe(initialItem.id);
    expect(body.currentStock).toBe(initialStock + 15);
    expect(body.message).toBe('Stock updated successfully');
  });

  it('PATCH /api/inventory/:id/stock should reject invalid payload without quantityChange', async () => {
    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/api/inventory/i1/stock',
      payload: { stock: 15 },
    });

    expect(patchRes.statusCode).toBe(400);
  });
});
