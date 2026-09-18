import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgOrderRepository } from '../../src/infrastructure/persistence/postgres/PgOrderRepository.js';
import { Order } from '../../src/domain/models/Order.js';
import { EntityNotFoundError } from '../../src/domain/errors/DomainErrors.js';

// RED round-2 regressions: the Pg update must persist the status column.
const h = vi.hoisted(() => {
  const queries: string[] = [];
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
  return { queries, client };
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

  it('includes status in the UPDATE when customer_name column exists', async () => {
    // Simulate an existing order row so the repo proceeds to the UPDATE.
    h.client.query = vi.fn(async (sql: string) => {
      h.queries.push(sql);
      if (sql.includes('SELECT * FROM public.orders')) return { rows: [{ id: 'ord-1', customer_id: null }] };
      if (sql.includes('LEFT JOIN public.customers')) return { rows: [{ id: 'ord-1', status: 'cooking', customer_id: null, subtotal: 0, delivery_fee: 0, final_total: 0, payment_method: 'Efectivo' }] };
      if (sql.includes('information_schema')) return { rows: [{ column_name: 'customer_name' }] };
      if (sql.includes('order_items') || sql.includes('order_item_additions')) return { rows: [] };
      return { rows: [] };
    });

    const repo = new PgOrderRepository();
    await repo.update(baseOrder(), 'rest-a');

    const updateSql = h.queries.find((q) => q.includes('UPDATE public.orders SET'));
    expect(updateSql).toBeDefined();
    expect(updateSql).toContain('status');
    expect(updateSql).toContain('status = $12');
  });

  it('includes status in the UPDATE when customer_name column is missing', async () => {
    h.client.query = vi.fn(async (sql: string) => {
      h.queries.push(sql);
      if (sql.includes('SELECT * FROM public.orders')) return { rows: [{ id: 'ord-1', customer_id: null }] };
      if (sql.includes('LEFT JOIN public.customers')) return { rows: [{ id: 'ord-1', status: 'cooking', customer_id: null, subtotal: 0, delivery_fee: 0, final_total: 0, payment_method: 'Efectivo' }] };
      if (sql.includes('information_schema')) return { rows: [] };
      if (sql.includes('order_items') || sql.includes('order_item_additions')) return { rows: [] };
      return { rows: [] };
    });

    const repo = new PgOrderRepository();
    await repo.update(baseOrder(), 'rest-a');

    const updateSql = h.queries.find((q) => q.includes('UPDATE public.orders SET'));
    expect(updateSql).toBeDefined();
    expect(updateSql).toContain('status');
  });
});