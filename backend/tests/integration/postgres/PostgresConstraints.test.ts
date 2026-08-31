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
  describe('Migration 001_security_hardening.sql', () => {
    it('applies cleanly and idempotently on the schema', async () => {
      if (!isDbConnected) return;
      const migrationPath = resolve(process.cwd(), '../supabase/migrations/001_security_hardening.sql');
      const fallbackPath = resolve(process.cwd(), 'supabase/migrations/001_security_hardening.sql');
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
        `INSERT INTO public.products (id, restaurant_id, name, category_name, price, is_available)
         VALUES ($1, $2, 'Test Burger', 'Burgers', 10000.00, true)
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
        `INSERT INTO public.products (id, restaurant_id, name, category_name, price, is_available)
         VALUES ($1, $2, 'Test Burger Updated', 'Burgers', 12500.00, true)
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
          `INSERT INTO public.products (id, restaurant_id, name, category_name, price, is_available)
           VALUES ($1, $2, 'Hijacked Burger', 'Burgers', 1.00, true)
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
});
