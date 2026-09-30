import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgInventoryRepository } from '../../../src/infrastructure/persistence/postgres/PgInventoryRepository.js';
import { ConflictError } from '../../../src/domain/errors/DomainErrors.js';
import { Inventory } from '../../../src/domain/models/Inventory.js';

const h = vi.hoisted(() => {
  const calls: { sql: string; params: unknown[] }[] = [];
  const state = { existingIds: [] as string[], failWith: null as any };
  const client = {
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      if (state.failWith && /^\s*(INSERT|UPDATE)/i.test(sql)) throw state.failWith;
      if (/^\s*SELECT id/i.test(sql)) return { rows: state.existingIds.map((id) => ({ id })) };
      return { rows: [] };
    },
  };
  return { calls, state, client };
});

vi.mock('../../../src/infrastructure/persistence/postgres/PgClient.js', () => ({
  withTenantContext: async (_ctx: unknown, cb: (c: unknown) => Promise<unknown>) => cb(h.client),
}));

const item = (over: Partial<Inventory> = {}): Inventory => ({
  id: 'inv-1',
  restaurantId: 'rest-1',
  name: 'Pan',
  category: 'ingredients',
  quantity: 10,
  unit: 'unidades',
  minStockAlert: 2,
  alertThreshold: 2,
  costPerUnit: 1,
  ...over,
});

describe('PgInventoryRepository.save (5.2)', () => {
  beforeEach(() => {
    h.calls.length = 0;
    h.state.existingIds = [];
    h.state.failWith = null;
  });

  it('looks the item up by id only, never by name', async () => {
    await new PgInventoryRepository().save(item());
    const lookup = h.calls[0];
    expect(lookup.sql).not.toMatch(/\bOR\b/i);
    expect(lookup.sql).not.toMatch(/name/i);
    expect(lookup.params).toEqual(['inv-1', 'rest-1']);
  });

  it('updating an existing item never writes current_stock', async () => {
    h.state.existingIds = ['inv-1'];
    await new PgInventoryRepository().save(item({ quantity: 999 }));
    const update = h.calls.find((c) => /UPDATE public\.inventory_items/i.test(c.sql))!;
    expect(update).toBeDefined();
    expect(update.sql).not.toMatch(/current_stock/i);
    expect(update.params).not.toContain(999);
  });

  it('creating a new item writes the initial stock', async () => {
    await new PgInventoryRepository().save(item({ quantity: 7 }));
    const insert = h.calls.find((c) => /INSERT INTO public\.inventory_items/i.test(c.sql))!;
    expect(insert.params).toContain(7);
  });

  it('maps a duplicate-name unique violation to ConflictError on create and on rename', async () => {
    h.state.failWith = { code: '23505', constraint: 'uq_inventory_items_restaurant_name' };
    await expect(new PgInventoryRepository().save(item())).rejects.toThrow(ConflictError);
    h.state.existingIds = ['inv-1'];
    await expect(new PgInventoryRepository().save(item({ name: 'Queso' }))).rejects.toThrow(ConflictError);
  });

  it('rethrows unrelated database errors untouched', async () => {
    h.state.failWith = { code: '23514', message: 'check violated' };
    await expect(new PgInventoryRepository().save(item())).rejects.toMatchObject({ code: '23514' });
  });
});
