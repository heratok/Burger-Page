import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';

let isDbConnected = false;

describe('PostgreSQL Real Instance Integration Suite (Docker)', () => {
  let pool: pg.Pool;
  const RESTAURANT_A = `test-rest-a-${randomUUID().slice(0, 8)}`;
  const RESTAURANT_B = `test-rest-b-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: 2000,
    });

    try {
      await pool.query('SELECT 1');
      isDbConnected = true;

      // Seed test tenant restaurants
      await pool.query(
        `INSERT INTO public.restaurants (id, slug, name, is_active)
         VALUES ($1, $1, 'Test Restaurant A', true),
                ($2, $2, 'Test Restaurant B', true)
         ON CONFLICT (id) DO UPDATE SET is_active = true`,
        [RESTAURANT_A, RESTAURANT_B]
      );
    } catch (err: any) {
      console.warn(`\n⚠️ [PostgreSQL Test] Skipping tests: Cannot connect to ${DATABASE_URL} (${err.message}). Run via 'npm run test:integration:postgres' or start Docker.`);
      isDbConnected = false;
    }
  });

  afterAll(async () => {
    if (pool && isDbConnected) {
      // Clean up test data
      await pool.query(`DELETE FROM public.restaurants WHERE id IN ($1, $2)`, [
        RESTAURANT_A,
        RESTAURANT_B,
      ]);
      await pool.end();
    }
  });

  // ─────────────────────────────────────────────────────────
  // 1. Migration 001_security_hardening.sql Idempotency
  // ─────────────────────────────────────────────────────────
  describe('Database 01_schema.sql Idempotency', () => {
    it('applies cleanly and idempotently on the schema', async () => {
      if (!isDbConnected) return;
      const migrationPath = resolve(process.cwd(), '../database/01_schema.sql');
      const fallbackPath = resolve(process.cwd(), 'database/01_schema.sql');
      let sql: string;
      try {
        sql = readFileSync(migrationPath, 'utf8');
      } catch {
        sql = readFileSync(fallbackPath, 'utf8');
      }

      // Execute the entire migration script
      await pool.query(sql);

      // Verify all 4 components exist
      const checkResult = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = 'inventory_items')::int AS inventory_items_exists,
          (SELECT COUNT(*) FROM information_schema.table_constraints
           WHERE table_schema = 'public' AND table_name = 'customers' AND constraint_name = 'uq_customers_id_restaurant')::int AS customers_constraint_exists,
          (SELECT COUNT(*) FROM information_schema.table_constraints
           WHERE table_schema = 'public' AND table_name = 'inventory_items' AND constraint_name = 'uq_inventory_items_id_restaurant')::int AS inventory_constraint_exists,
          (SELECT COUNT(*) FROM information_schema.routines
           WHERE routine_schema = 'public' AND routine_name = 'adjust_inventory_stock')::int AS adjust_stock_fn_exists;
      `);

      const row = checkResult.rows[0];
      expect(row.inventory_items_exists).toBe(1);
      expect(row.customers_constraint_exists).toBe(1);
      expect(row.inventory_constraint_exists).toBe(1);
      expect(row.adjust_stock_fn_exists).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 2. Products — Composite UNIQUE(id, restaurant_id)
  // ─────────────────────────────────────────────────────────
  describe('Products — UNIQUE(id, restaurant_id)', () => {
    const productId = `prod_${randomUUID()}`;

    it('creates product in restaurant A using composite ON CONFLICT', async () => {
      if (!isDbConnected) return;
      const result = await pool.query(
        `INSERT INTO public.products (id, restaurant_id, name, price, is_available)
         VALUES ($1, $2, 'Test Burger', 10000.00, true)
         ON CONFLICT (id, restaurant_id) DO UPDATE SET price = EXCLUDED.price
         RETURNING *`,
        [productId, RESTAURANT_A]
      );
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].name).toBe('Test Burger');
      expect(Number(result.rows[0].price)).toBe(10000);
    });

    it('updates product in restaurant A idempotently', async () => {
      if (!isDbConnected) return;
      const result = await pool.query(
        `INSERT INTO public.products (id, restaurant_id, name, price, is_available)
         VALUES ($1, $2, 'Test Burger Updated', 12500.00, true)
         ON CONFLICT (id, restaurant_id) DO UPDATE
         SET name = EXCLUDED.name, price = EXCLUDED.price
         RETURNING *`,
        [productId, RESTAURANT_A]
      );
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].name).toBe('Test Burger Updated');
      expect(Number(result.rows[0].price)).toBe(12500);
    });

    it('rejects cross-tenant insert with same ID via PK and does NOT overwrite restaurant A', async () => {
      if (!isDbConnected) return;
      // Attempt hijack from Restaurant B with same product ID
      let errorOccurred = false;
      try {
        await pool.query(
          `INSERT INTO public.products (id, restaurant_id, name, price, is_available)
           VALUES ($1, $2, 'Hijacked Burger', 1.00, true)
           ON CONFLICT (id, restaurant_id) DO UPDATE SET name = EXCLUDED.name`,
          [productId, RESTAURANT_B]
        );
      } catch (err: any) {
        errorOccurred = true;
        // Postgres error 23505: duplicate key value violates unique constraint "products_pkey"
        expect(err.code).toBe('23505');
      }
      expect(errorOccurred).toBe(true);

      // Verify Restaurant A product was untouched
      const res = await pool.query(
        `SELECT name, price FROM public.products WHERE id = $1 AND restaurant_id = $2`,
        [productId, RESTAURANT_A]
      );
      expect(res.rows[0].name).toBe('Test Burger Updated');
      expect(Number(res.rows[0].price)).toBe(12500);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 3. Customers — Composite UNIQUE(id, restaurant_id)
  // ─────────────────────────────────────────────────────────
  describe('Customers — UNIQUE(id, restaurant_id)', () => {
    const customerId = `cust_${randomUUID()}`;

    it('creates customer in restaurant A using composite ON CONFLICT', async () => {
      if (!isDbConnected) return;
      const result = await pool.query(
        `INSERT INTO public.customers (id, restaurant_id, name, phone)
         VALUES ($1, $2, 'Juan Perez', '3001112233')
         ON CONFLICT (id, restaurant_id) DO UPDATE SET name = EXCLUDED.name
         RETURNING *`,
        [customerId, RESTAURANT_A]
      );
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].name).toBe('Juan Perez');
    });

    it('rejects cross-tenant customer collision via PK and preserves restaurant A customer', async () => {
      if (!isDbConnected) return;
      let errorOccurred = false;
      try {
        await pool.query(
          `INSERT INTO public.customers (id, restaurant_id, name, phone)
           VALUES ($1, $2, 'Hijacker', '3009998877')
           ON CONFLICT (id, restaurant_id) DO UPDATE SET name = EXCLUDED.name`,
          [customerId, RESTAURANT_B]
        );
      } catch (err: any) {
        errorOccurred = true;
        expect(err.code).toBe('23505');
      }
      expect(errorOccurred).toBe(true);

      const res = await pool.query(
        `SELECT name, phone FROM public.customers WHERE id = $1 AND restaurant_id = $2`,
        [customerId, RESTAURANT_A]
      );
      expect(res.rows[0].name).toBe('Juan Perez');
    });
  });

  // ─────────────────────────────────────────────────────────
  // 4. Inventory Items & adjust_inventory_stock RPC
  // ─────────────────────────────────────────────────────────
  describe('Inventory & adjust_inventory_stock RPC', () => {
    const itemId = `inv_${randomUUID()}`;

    it('creates inventory item with current_stock = 0', async () => {
      if (!isDbConnected) return;
      const result = await pool.query(
        `INSERT INTO public.inventory_items (id, restaurant_id, name, category, current_stock, unit, min_stock_alert, cost_per_unit)
         VALUES ($1, $2, 'Queso Cheddar', 'ingredients', 0.00, 'kg', 5.00, 25000.00)
         ON CONFLICT (id, restaurant_id) DO UPDATE SET name = EXCLUDED.name
         RETURNING *`,
        [itemId, RESTAURANT_A]
      );
      expect(result.rows.length).toBe(1);
      expect(Number(result.rows[0].current_stock)).toBe(0);
    });

    it('adjustStock delta=+50 (restock) from current_stock=0 is NOT blocked', async () => {
      if (!isDbConnected) return;
      const result = await pool.query(
        `SELECT * FROM public.adjust_inventory_stock($1, $2, $3)`,
        [itemId, RESTAURANT_A, 50]
      );
      expect(result.rows.length).toBe(1);
      expect(Number(result.rows[0].current_stock)).toBe(50);
    });

    it('adjustStock delta=-15 (decrement) with sufficient stock succeeds', async () => {
      if (!isDbConnected) return;
      const result = await pool.query(
        `SELECT * FROM public.adjust_inventory_stock($1, $2, $3)`,
        [itemId, RESTAURANT_A, -15]
      );
      expect(result.rows.length).toBe(1);
      expect(Number(result.rows[0].current_stock)).toBe(35);
    });

    it('adjustStock delta=-100 (decrement) with insufficient stock returns 0 rows (guard blocks)', async () => {
      if (!isDbConnected) return;
      const result = await pool.query(
        `SELECT * FROM public.adjust_inventory_stock($1, $2, $3)`,
        [itemId, RESTAURANT_A, -100]
      );
      expect(result.rows.length).toBe(0);

      // Verify stock remained unchanged at 35
      const check = await pool.query(
        `SELECT current_stock FROM public.inventory_items WHERE id = $1 AND restaurant_id = $2`,
        [itemId, RESTAURANT_A]
      );
      expect(Number(check.rows[0].current_stock)).toBe(35);
    });

    it('adjustStock cross-tenant call returns 0 rows', async () => {
      if (!isDbConnected) return;
      const result = await pool.query(
        `SELECT * FROM public.adjust_inventory_stock($1, $2, $3)`,
        [itemId, RESTAURANT_B, 10]
      );
      expect(result.rows.length).toBe(0);
    });

    it('rejects cross-tenant inventory collision via PK and preserves restaurant A inventory', async () => {
      if (!isDbConnected) return;
      let errorOccurred = false;
      try {
        await pool.query(
          `INSERT INTO public.inventory_items (id, restaurant_id, name, category, current_stock, unit, min_stock_alert, cost_per_unit)
           VALUES ($1, $2, 'Hijacked Cheddar', 'ingredients', 9999.00, 'kg', 5.00, 1.00)
           ON CONFLICT (id, restaurant_id) DO UPDATE SET current_stock = EXCLUDED.current_stock`,
          [itemId, RESTAURANT_B]
        );
      } catch (err: any) {
        errorOccurred = true;
        expect(err.code).toBe('23505');
      }
      expect(errorOccurred).toBe(true);

      const res = await pool.query(
        `SELECT name, current_stock FROM public.inventory_items WHERE id = $1 AND restaurant_id = $2`,
        [itemId, RESTAURANT_A]
      );
      expect(res.rows[0].name).toBe('Queso Cheddar');
      expect(Number(res.rows[0].current_stock)).toBe(35);
    });
  });

  describe('Customer metrics trigger — DELETE orders (JD-CRIT-01)', () => {
    let customerId: string;
    let orderId: string;

    it('deletes an order without raising "record new is not assigned yet" and refreshes customer metrics', async () => {
      if (!isDbConnected) return;
      customerId = `cust-${randomUUID().slice(0, 8)}`;
      orderId = `order-${randomUUID().slice(0, 8)}`;

      await pool.query(
        `INSERT INTO public.customers (id, restaurant_id, name, phone) VALUES ($1, $2, 'Trigger Test Customer', '3005556677')`,
        [customerId, RESTAURANT_A]
      );

      // Metrics trigger must run on INSERT (order linked to a customer).
      const inserted = await pool.query(
        `INSERT INTO public.orders (id, restaurant_id, customer_id, status, subtotal, delivery_fee, final_total, payment_method)
         VALUES ($1, $2, $3, 'pending', 100.00, 10.00, 110.00, 'Efectivo')`,
        [orderId, RESTAURANT_A, customerId]
      );
      expect(inserted.rowCount).toBe(1);

      const afterInsert = await pool.query(
        `SELECT total_orders, total_spent FROM public.customers WHERE id = $1`,
        [customerId]
      );
      expect(Number(afterInsert.rows[0].total_orders)).toBe(1);
      expect(Number(afterInsert.rows[0].total_spent)).toBe(110.0);

      // Regression: DELETE used to abort with 'record "new" is not assigned yet'.
      const deleted = await pool.query(
        `DELETE FROM public.orders WHERE id = $1 AND restaurant_id = $2`,
        [orderId, RESTAURANT_A]
      );
      expect(deleted.rowCount).toBe(1);

      const afterDelete = await pool.query(
        `SELECT total_orders, total_spent FROM public.customers WHERE id = $1`,
        [customerId]
      );
      expect(Number(afterDelete.rows[0].total_orders)).toBe(0);
      expect(Number(afterDelete.rows[0].total_spent)).toBe(0.0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 5. Composite tenant-scoped FKs (WU-1b, M2/M3)
  //    order_items.order_id, orders.customer_id, products.category_id
  //    must reference a parent row of the SAME restaurant (23503).
  // ─────────────────────────────────────────────────────────
  describe('Composite tenant-scoped FKs (WU-1b)', () => {
    const orderId = `order-${randomUUID().slice(0, 8)}`;
    const customerId = `cust-${randomUUID().slice(0, 8)}`;
    const categoryId = `cat-${randomUUID().slice(0, 8)}`;
    const productId = `prod-${randomUUID().slice(0, 8)}`;

    it('rejects order_items whose order belongs to another tenant (FK 23503)', async () => {
      if (!isDbConnected) return;
      // Tenant A owns the order
      await pool.query(
        `INSERT INTO public.orders (id, restaurant_id, status, subtotal, delivery_fee, final_total, payment_method)
         VALUES ($1, $2, 'pending', 100.00, 10.00, 110.00, 'Efectivo')`,
        [orderId, RESTAURANT_A]
      );

      // order_id is tenant A's, but restaurant_id claims tenant B
      let errorOccurred = false;
      try {
        await pool.query(
          `INSERT INTO public.order_items (id, order_id, restaurant_id, product_name, unit_price, quantity)
           VALUES ($1, $2, $3, 'Cross Tenant Burger', 100.00, 1)`,
          [`oi-${randomUUID().slice(0, 8)}`, orderId, RESTAURANT_B]
        );
      } catch (err: any) {
        errorOccurred = true;
        expect(err.code).toBe('23503');
      }
      expect(errorOccurred).toBe(true);
    });

    it('rejects orders whose customer belongs to another tenant (FK 23503)', async () => {
      if (!isDbConnected) return;
      // Tenant A owns the customer
      await pool.query(
        `INSERT INTO public.customers (id, restaurant_id, name, phone) VALUES ($1, $2, 'Cross Tenant Customer', '3007778899')`,
        [customerId, RESTAURANT_A]
      );

      // customer_id is tenant A's, but restaurant_id claims tenant B
      let errorOccurred = false;
      try {
        await pool.query(
          `INSERT INTO public.orders (id, restaurant_id, customer_id, status, subtotal, delivery_fee, final_total, payment_method)
           VALUES ($1, $2, $3, 'pending', 100.00, 10.00, 110.00, 'Efectivo')`,
          [`order-${randomUUID().slice(0, 8)}`, RESTAURANT_B, customerId]
        );
      } catch (err: any) {
        errorOccurred = true;
        expect(err.code).toBe('23503');
      }
      expect(errorOccurred).toBe(true);
    });

    it('rejects products whose category belongs to another tenant (FK 23503)', async () => {
      if (!isDbConnected) return;
      // Tenant A owns the category
      await pool.query(
        `INSERT INTO public.categories (id, restaurant_id, name, display_order, is_active)
         VALUES ($1, $2, 'Cat A', 0, true)`,
        [categoryId, RESTAURANT_A]
      );

      // category_id is tenant A's, but restaurant_id claims tenant B
      let errorOccurred = false;
      try {
        await pool.query(
          `INSERT INTO public.products (id, restaurant_id, category_id, name, price, is_available)
           VALUES ($1, $2, $3, 'Cross Tenant Burger', 10000.00, true)`,
          [productId, RESTAURANT_B, categoryId]
        );
      } catch (err: any) {
        errorOccurred = true;
        expect(err.code).toBe('23503');
      }
      expect(errorOccurred).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 6. Schema integrity (migration 0000000000007)
  //    order_items.product_id / order_item_additions.addition_id are
  //    tenant-scoped FKs; stale overload and duplicate indexes are gone.
  // ─────────────────────────────────────────────────────────
  describe('Schema integrity (0000000000007)', () => {
    const suffix = randomUUID().slice(0, 8);
    const productA = `prod-a-${suffix}`;
    const additionA = `add-a-${suffix}`;
    const orderA = `order-a-${suffix}`;
    const orderB = `order-b-${suffix}`;

    const insertOrder = (id: string, restaurantId: string) =>
      pool.query(
        `INSERT INTO public.orders (id, restaurant_id, status, subtotal, delivery_fee, final_total, payment_method)
         VALUES ($1, $2, 'pending', 100.00, 10.00, 110.00, 'Efectivo')`,
        [id, restaurantId]
      );

    const expectFkViolation = async (run: () => Promise<unknown>) => {
      let code: string | undefined;
      try {
        await run();
      } catch (err: any) {
        code = err.code;
      }
      expect(code).toBe('23503');
    };

    beforeAll(async () => {
      if (!isDbConnected) return;
      await pool.query(
        `INSERT INTO public.products (id, restaurant_id, name, price, is_available)
         VALUES ($1, $2, 'Product A', 10000.00, true)`,
        [productA, RESTAURANT_A]
      );
      await pool.query(
        `INSERT INTO public.product_additions (id, restaurant_id, name, price)
         VALUES ($1, $2, 'Addition A', 1000.00)`,
        [additionA, RESTAURANT_A]
      );
      await insertOrder(orderA, RESTAURANT_A);
      await insertOrder(orderB, RESTAURANT_B);
    });

    it('rejects an order line in tenant B that references the product of tenant A', async () => {
      if (!isDbConnected) return;
      await expectFkViolation(() =>
        pool.query(
          `INSERT INTO public.order_items (id, order_id, restaurant_id, product_id, product_name, unit_price, quantity)
           VALUES ($1, $2, $3, $4, 'Cross Tenant Product', 100.00, 1)`,
          [`oi-x-${suffix}`, orderB, RESTAURANT_B, productA]
        )
      );
    });

    it('rejects an order item addition in tenant B that references the addition of tenant A', async () => {
      if (!isDbConnected) return;
      const itemB = `oi-b-${suffix}`;
      await pool.query(
        `INSERT INTO public.order_items (id, order_id, restaurant_id, product_name, unit_price, quantity)
         VALUES ($1, $2, $3, 'Line B', 100.00, 1)`,
        [itemB, orderB, RESTAURANT_B]
      );
      await expectFkViolation(() =>
        pool.query(
          `INSERT INTO public.order_item_additions (id, order_item_id, restaurant_id, addition_id, addition_name, unit_price, quantity)
           VALUES ($1, $2, $3, $4, 'Cross Tenant Addition', 10.00, 1)`,
          [`oia-x-${suffix}`, itemB, RESTAURANT_B, additionA]
        )
      );
    });

    it('keeps the sale line and restaurant_id when the product is deleted (SET NULL only product_id)', async () => {
      if (!isDbConnected) return;
      const itemId = `oi-a-${suffix}`;
      await pool.query(
        `INSERT INTO public.order_items (id, order_id, restaurant_id, product_id, product_name, unit_price, quantity)
         VALUES ($1, $2, $3, $4, 'Product A', 100.00, 1)`,
        [itemId, orderA, RESTAURANT_A, productA]
      );
      await pool.query(
        `INSERT INTO public.order_item_additions (id, order_item_id, restaurant_id, addition_id, addition_name, unit_price, quantity)
         VALUES ($1, $2, $3, $4, 'Addition A', 10.00, 1)`,
        [`oia-a-${suffix}`, itemId, RESTAURANT_A, additionA]
      );

      await pool.query('DELETE FROM public.product_additions WHERE id = $1', [additionA]);
      await pool.query('DELETE FROM public.products WHERE id = $1', [productA]);

      const line = await pool.query(
        'SELECT product_id, restaurant_id FROM public.order_items WHERE id = $1',
        [itemId]
      );
      expect(line.rows[0]).toEqual({ product_id: null, restaurant_id: RESTAURANT_A });
      const addition = await pool.query(
        'SELECT addition_id, restaurant_id FROM public.order_item_additions WHERE id = $1',
        [`oia-a-${suffix}`]
      );
      expect(addition.rows[0]).toEqual({ addition_id: null, restaurant_id: RESTAURANT_A });
    });

    it('no longer defines the stale 9-arg create_order_atomic overload', async () => {
      if (!isDbConnected) return;
      const result = await pool.query(
        `SELECT pronargs FROM pg_proc
         WHERE proname = 'create_order_atomic' AND pronamespace = 'public'::regnamespace`
      );
      expect(result.rows.map((r) => r.pronargs)).toEqual([10]);
    });

    it('does not keep indexes that duplicate a unique or composite index', async () => {
      if (!isDbConnected) return;
      const result = await pool.query(
        `SELECT indexname FROM pg_indexes
         WHERE schemaname = 'public'
           AND indexname IN ('idx_users_username', 'idx_customers_rest_phone',
                             'idx_restaurant_hours_rest', 'idx_inventory_items_restaurant')`
      );
      expect(result.rows).toEqual([]);
    });
  });
});
