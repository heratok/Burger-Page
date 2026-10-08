import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgProductRepository } from '../../../src/infrastructure/persistence/postgres/PgProductRepository.js';
import { Product } from '../../../src/domain/models/Product.js';

const h = vi.hoisted(() => {
  const calls: { sql: string; params: unknown[] }[] = [];
  const state = { rows: [] as any[] };
  const client = {
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return { rows: state.rows };
    },
  };
  return { calls, state, client };
});

vi.mock('../../../src/infrastructure/persistence/postgres/PgClient.js', () => ({
  withTenantContext: async (_ctx: unknown, cb: (c: unknown) => Promise<unknown>) => cb(h.client),
}));

const product = (over: Partial<Product>): Product => ({
  id: 'p1',
  restaurantId: 'rest-1',
  name: 'Burger',
  description: '',
  price: 10,
  category: 'Clásicas',
  isAvailable: true,
  additions: [],
  ...over,
});

describe('PgProductRepository preparation time (5.7)', () => {
  beforeEach(() => {
    h.calls.length = 0;
  });

  it('persists a preparation time of 0 instead of coercing it to 15', async () => {
    await new PgProductRepository().save(product({ preparationTimeMinutes: 0 }));
    expect(h.calls[0].params).toContain(0);
    expect(h.calls[0].params).not.toContain(15);
  });

  it('defaults to 15 only when the value is absent', async () => {
    await new PgProductRepository().save(product({ preparationTimeMinutes: undefined }));
    expect(h.calls[0].params).toContain(15);
  });

  it('maps a stored 0 back as 0 and a NULL as 15', async () => {
    h.state.rows = [{ id: 'p1', restaurant_id: 'r', name: 'a', price: '1', is_available: true, preparation_time_minutes: 0 }];
    expect((await new PgProductRepository().findById('p1', 'r'))?.preparationTimeMinutes).toBe(0);
    h.state.rows = [{ id: 'p1', restaurant_id: 'r', name: 'a', price: '1', is_available: true, preparation_time_minutes: null }];
    expect((await new PgProductRepository().findById('p1', 'r'))?.preparationTimeMinutes).toBe(15);
  });
});

describe('PgProductRepository.findByIds', () => {
  beforeEach(() => {
    h.calls.length = 0;
  });

  it('uses one ANY($1) query scoped to the tenant and maps rows like findById', async () => {
    h.state.rows = [{ id: 'p1', restaurant_id: 'rest-1', name: 'a', price: '3', is_available: true }];
    const found = await new PgProductRepository().findByIds(['p1', 'p2'], 'rest-1');
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].sql).toContain('p.id = ANY($1)');
    expect(h.calls[0].sql).toContain('p.restaurant_id = $2');
    expect(h.calls[0].params).toEqual([['p1', 'p2'], 'rest-1']);
    expect(found.map((p) => [p.id, p.price])).toEqual([['p1', 3]]);
  });

  it('skips the database for an empty id list', async () => {
    expect(await new PgProductRepository().findByIds([], 'rest-1')).toEqual([]);
    expect(h.calls).toHaveLength(0);
  });
});
