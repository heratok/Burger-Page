import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgOrderRepository } from '../../src/infrastructure/persistence/postgres/PgOrderRepository.js';
import { Order } from '../../src/domain/models/Order.js';
import { EntityNotFoundError, InvalidOrderStateError } from '../../src/domain/errors/DomainErrors.js';

// RED round-2 regressions: the Pg update must persist the status column.
const h = vi.hoisted(() => {
  const queries: string[] = [];
  const rpcParams: unknown[][] = [];
  const client: any = {
    query: async (sql: string) => {
      queries.push(sql);
      if (sql.includes('information_schema')) return { rows: [{ column_name: 'customer_name' }] };
      if (sql.includes('SELECT * FROM public.orders')) return { rows: [] };
      if (sql.includes('LEFT JOIN public.customers')) return { rows: [{ id: 'ord-1', status: 'cooking', customer_id: null, subtotal: 0, delivery_fee: 0, final_total: 0, payment_method: 'Efectivo' }] };
      if (sql.includes('order_items') || sql.includes('order_item_additions')) return { rows: [] };
      if (sql.includes('UPDATE public.orders')) return { rows: [{ id: 'ord-1' }] };
      return { rows: [] };
    },
  };
  return { queries, rpcParams, client };
});

vi.mock('../../src/infrastructure/persistence/postgres/PgClient.js', () => ({
  withTenantContext: async (_ctx: unknown, cb: (c: unknown) => Promise<unknown>) => cb(h.client),
}));

describe('PgOrderRepository.update (Status Persistence)', () => {
  beforeEach(() => {
    h.queries.length = 0;
    h.client.query.mockClear?.();
  });

  const baseOrder = (): Order => {
    const order = new Order(
      'ord-1',
      'rest-a',
      undefined,
      [],
      'cooking',
      new Date(),
      3000,
      101
    );
    (order as any).comment = null;
    (order as any).receiptUrl = null;
    (order as any).paymentAmount = null;
    (order as any).changeAmount = null;
    return order;
  };

  it('updates orders without catalog introspection (R2 regression)', async () => {
    // Simulate an existing order row so the repo proceeds to the UPDATE.
    h.client.query = vi.fn(async (sql: string) => {
      h.queries.push(sql);
      if (sql.includes('SELECT * FROM public.orders')) return { rows: [{ id: 'ord-1', customer_id: null }] };
      if (sql.includes('LEFT JOIN public.customers')) return { rows: [{ id: 'ord-1', status: 'cooking', customer_id: null, subtotal: 0, delivery_fee: 0, final_total: 0, payment_method: 'Efectivo' }] };
      if (sql.includes('order_items') || sql.includes('order_item_additions')) return { rows: [] };
      return { rows: [] };
    });

    const repo = new PgOrderRepository();
    await repo.update(baseOrder(), 'rest-a');

    // The orders table has no customer_name column; the update must never
    // pay a catalog roundtrip to discover it (information_schema query removed).
    expect(h.queries.some((q) => q.includes('information_schema'))).toBe(false);

    const updateSql = h.queries.find((q) => q.includes('UPDATE public.orders SET'));
    expect(updateSql).toBeDefined();
    expect(updateSql).toContain('status');
    expect(updateSql).toContain('status = $8');
    expect(updateSql).not.toContain('customer_name');
  });

  it('includes status in the single UPDATE when an order exists', async () => {
    h.client.query = vi.fn(async (sql: string) => {
      h.queries.push(sql);
      if (sql.includes('SELECT * FROM public.orders')) return { rows: [{ id: 'ord-1', customer_id: null }] };
      if (sql.includes('LEFT JOIN public.customers')) return { rows: [{ id: 'ord-1', status: 'cooking', customer_id: null, subtotal: 0, delivery_fee: 0, final_total: 0, payment_method: 'Efectivo' }] };
      if (sql.includes('order_items') || sql.includes('order_item_additions')) return { rows: [] };
      return { rows: [] };
    });

    const repo = new PgOrderRepository();
    await repo.update(baseOrder(), 'rest-a');

    const updateSql = h.queries.find((q) => q.includes('UPDATE public.orders SET'));
    expect(updateSql).toBeDefined();
    expect(updateSql).toContain('status');
    expect(updateSql).not.toContain('customer_name');
  });

  it('passes the 5th expectedStatus arg to the CAS RPC', async () => {
    h.rpcParams.length = 0;
    h.client.query = vi.fn(async (sql: string, params?: unknown[]) => {
      h.queries.push(sql);
      if (sql.includes('update_order_status_with_actor')) {
        h.rpcParams.push(params ?? []);
        return { rows: [{ updated: true }] };
      }
      return { rows: [] };
    });

    const repo = new PgOrderRepository();
    await repo.updateStatus('ord-1', 'cooking', 'rest-a', 'actor-1', 'restaurant_admin', 'pending');

    expect(h.rpcParams).toHaveLength(1);
    // Parameters: id, new status, restaurant, actor, expectedStatus.
    expect(h.rpcParams[0]).toEqual(['ord-1', 'cooking', 'rest-a', 'actor-1', 'pending']);
    // And the CAS arg is omitted as NULL when no snapshot is passed.
    h.rpcParams.length = 0;
    h.client.query = vi.fn(async (sql: string, params?: unknown[]) => {
      h.queries.push(sql);
      if (sql.includes('update_order_status_with_actor')) {
        h.rpcParams.push(params ?? []);
        return { rows: [{ updated: true }] };
      }
      return { rows: [] };
    });
    await repo.updateStatus('ord-1', 'cooking', 'rest-a');
    expect(h.rpcParams[0]).toEqual(['ord-1', 'cooking', 'rest-a', null, null]);
  });

  it('maps the RPC concurrency P0001 to InvalidOrderStateError when expectedStatus is stale', async () => {
    h.client.query = vi.fn(async (sql: string) => {
      h.queries.push(sql);
      if (sql.includes('update_order_status_with_actor')) {
        const err: any = new Error('Order status changed concurrently');
        err.code = 'P0001';
        throw err;
      }
      return { rows: [] };
    });

    const repo = new PgOrderRepository();
    await expect(
      repo.updateStatus('ord-1', 'cooking', 'rest-a', 'actor-1', 'restaurant_admin', 'pending')
    ).rejects.toBeInstanceOf(InvalidOrderStateError);
  });

  it('still surfaces EntityNotFoundError when the RPC returns false (no CAS arg)', async () => {
    h.client.query = vi.fn(async (sql: string) => {
      h.queries.push(sql);
      if (sql.includes('update_order_status_with_actor')) return { rows: [{ updated: false }] };
      return { rows: [] };
    });

    const repo = new PgOrderRepository();
    await expect(repo.updateStatus('ord-1', 'cooking', 'rest-a')).rejects.toBeInstanceOf(EntityNotFoundError);
  });
});

describe('PgOrderRepository.findByRestaurantId (N+1 batch)', () => {
  beforeEach(() => {
    h.queries.length = 0;
    h.client.query.mockClear?.();
  });

  it('lists 2+ orders with exactly one items query and one additions query (ANY batch)', async () => {
    const queries: string[] = [];
    const params: unknown[][] = [];
    h.client.query = vi.fn(async (sql: string, p?: unknown[]) => {
      queries.push(sql);
      params.push(p ?? []);
      if (sql.includes('LEFT JOIN public.customers')) {
        // ORDER BY o.created_at DESC: newest first.
        return {
          rows: [
            { id: 'ord-1', restaurant_id: 'rest-a', status: 'cooking', created_at: '2025-01-02T10:00:00.000Z', customer_id: null, delivery_fee: 0, payment_method: 'Efectivo', payment_amount: null, change_amount: null, subtotal: 0, final_total: 0 },
            { id: 'ord-2', restaurant_id: 'rest-a', status: 'pending', created_at: '2025-01-01T10:00:00.000Z', customer_id: null, delivery_fee: 0, payment_method: 'Efectivo', payment_amount: null, change_amount: null, subtotal: 0, final_total: 0 },
          ],
        };
      }
      if (sql.includes('FROM public.order_item_additions')) {
        return {
          rows: [
            { id: 'add-1', order_item_id: 'item-1', addition_id: 'add-prod-1', addition_name: 'Queso', unit_price: 20, quantity: 1, created_at: '2025-01-02T10:00:01.000Z' },
          ],
        };
      }
      if (sql.includes('FROM public.order_items')) {
        return {
          rows: [
            { id: 'item-1', order_id: 'ord-1', product_id: 'prod-1', product_name: 'Burger', unit_price: 100, quantity: 2, observation: 'sin cebolla', created_at: '2025-01-02T10:00:00.500Z' },
            { id: 'item-2', order_id: 'ord-2', product_id: 'prod-2', product_name: 'Papas', unit_price: 50, quantity: 1, observation: null, created_at: '2025-01-01T10:00:00.500Z' },
          ],
        };
      }
      return { rows: [] };
    });

    const repo = new PgOrderRepository();
    const orders = await repo.findByRestaurantId('rest-a');

    // N+1 fix: 2 orders must cost 3 roundtrips (orders + 1 items + 1 additions),
    // not 1 + 2N = 5. The items/additions queries are batched with ANY.
    expect(queries).toHaveLength(3);
    expect(queries.filter((q) => q.includes('FROM public.order_items'))).toHaveLength(1);
    expect(queries.filter((q) => q.includes('FROM public.order_item_additions'))).toHaveLength(1);
    const itemsQuery = queries.find((q) => q.includes('FROM public.order_items'))!;
    const additionsQuery = queries.find((q) => q.includes('FROM public.order_item_additions'))!;
    expect(itemsQuery).toContain('ANY($1::text[])');
    expect(additionsQuery).toContain('ANY($1::text[])');
    expect(params[queries.indexOf(itemsQuery)]).toEqual([['ord-1', 'ord-2']]);
    expect(params[queries.indexOf(additionsQuery)]).toEqual([['item-1', 'item-2']]);

    // Grouping is exact: each order keeps its own items and additions.
    expect(orders).toHaveLength(2);
    expect(orders.map((o) => o.id)).toEqual(['ord-1', 'ord-2']); // created_at DESC
    const cooked = orders[0];
    expect(cooked.items).toHaveLength(1);
    expect(cooked.items[0]).toMatchObject({
      id: 'item-1',
      productId: 'prod-1',
      productName: 'Burger',
      unitPrice: 100,
      quantity: 2,
      observation: 'sin cebolla',
    });
    expect(cooked.items[0].additions).toEqual([
      { id: 'add-1', additionId: 'add-prod-1', additionName: 'Queso', unitPrice: 20, quantity: 1 },
    ]);
    const pending = orders[1];
    expect(pending.items).toHaveLength(1);
    expect(pending.items[0].productName).toBe('Papas');
    expect(pending.items[0].additions).toEqual([]);
  });
});