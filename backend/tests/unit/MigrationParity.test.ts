import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const dbDir = resolve(__dirname, '../../../database');
const read = (rel: string) => readFileSync(resolve(dbDir, rel), 'utf8');

function extractFunction(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start < 0) throw new Error(`function ${name} not found`);
  const end = sql.indexOf('\n$$;', start);
  return sql.slice(start, end + 4);
}

describe('migration 0000000000006 parity with the baseline schema', () => {
  const baseline = read('01_schema.sql');
  const up = read('migrations/0000000000006_order_contact_snapshot_and_metrics.up.sql');
  const down = read('migrations/0000000000006_order_contact_snapshot_and_metrics.down.sql');
  const previous = read('migrations/0000000000004_composite_tenant_fks.up.sql');

  it('redefines update_customer_order_metrics byte-identically in baseline and up', () => {
    expect(extractFunction(up, 'update_customer_order_metrics')).toBe(
      extractFunction(baseline, 'update_customer_order_metrics')
    );
  });

  it('down restores the body that 0000000000004 introduced', () => {
    expect(extractFunction(down, 'update_customer_order_metrics')).toBe(
      extractFunction(previous, 'update_customer_order_metrics')
    );
  });

  it('declares the same nullable snapshot columns in baseline and migration', () => {
    for (const col of ['contact_name', 'contact_phone', 'contact_address', 'contact_barrio']) {
      expect(baseline).toMatch(new RegExp(`\\b${col}\\s+TEXT,`));
      expect(up).toContain(`ADD COLUMN IF NOT EXISTS ${col}`);
      expect(down).toContain(`DROP COLUMN IF EXISTS ${col}`);
    }
  });
});

describe('migration 0000000000007 (schema integrity) parity with the baseline schema', () => {
  const baseline = read('01_schema.sql');
  const up = read('migrations/0000000000007_schema_integrity.up.sql');
  const down = read('migrations/0000000000007_schema_integrity.down.sql');

  const NINE_ARG_DROP =
    /DROP FUNCTION IF EXISTS public\.create_order_atomic\(\s*TEXT,\s*TEXT,\s*TEXT,\s*TEXT,\s*NUMERIC,\s*NUMERIC,\s*TEXT,\s*JSONB,\s*NUMERIC\s*\);/i;

  it('drops the stale 9-arg create_order_atomic overload in both places and never recreates it', () => {
    expect(baseline).toMatch(NINE_ARG_DROP);
    expect(up).toMatch(NINE_ARG_DROP);
    expect(down).not.toMatch(/CREATE (OR REPLACE )?FUNCTION/i);
  });

  it.each([
    ['fk_order_items_product_tenant', 'order_items', '(product_id, restaurant_id)', 'public.products(id, restaurant_id)', 'ON DELETE SET NULL (product_id)'],
    ['fk_order_item_additions_addition_tenant', 'order_item_additions', '(addition_id, restaurant_id)', 'public.product_additions(id, restaurant_id)', 'ON DELETE SET NULL (addition_id)'],
  ])('declares %s identically in baseline and migration', (name, _table, cols, target, action) => {
    for (const sql of [baseline, up]) {
      const start = sql.indexOf(name);
      expect(start).toBeGreaterThan(-1);
      const def = sql.slice(start, start + 600).replace(/\s+/g, ' ');
      expect(def).toContain(`FOREIGN KEY ${cols}`);
      expect(def).toContain(`REFERENCES ${target}`);
      expect(def).toContain(action);
    }
    expect(down).toContain(`DROP CONSTRAINT IF EXISTS ${name}`);
  });

  it('adds the FKs NOT VALID, validates them and fails loudly on cross-tenant rows', () => {
    expect(up).toMatch(/NOT VALID;/);
    expect(up).toContain('VALIDATE CONSTRAINT fk_order_items_product_tenant');
    expect(up).toContain('VALIDATE CONSTRAINT fk_order_item_additions_addition_tenant');
    expect(up).toMatch(/RAISE EXCEPTION[\s\S]*Cross-tenant references/);
    expect(up).not.toMatch(/^\s*(UPDATE|DELETE)\b/im);
  });

  it('no longer declares the single-column FKs in the baseline', () => {
    expect(baseline).not.toMatch(/product_id\s+TEXT\s+REFERENCES/);
    expect(baseline).not.toMatch(/addition_id\s+TEXT\s+REFERENCES/);
    expect(down).toContain('order_items_product_id_fkey');
    expect(down).toContain('order_item_additions_addition_id_fkey');
  });

  it('declares the product_additions (id, restaurant_id) UNIQUE target in baseline and migration', () => {
    expect(baseline).toMatch(/CONSTRAINT uq_product_additions_id_restaurant\s+UNIQUE \(id, restaurant_id\)/);
    expect(up).toContain('ADD CONSTRAINT uq_product_additions_id_restaurant UNIQUE (id, restaurant_id)');
  });

  it.each([
    'idx_users_username',
    'idx_customers_rest_phone',
    'idx_restaurant_hours_rest',
    'idx_inventory_items_restaurant',
  ])('removes duplicate index %s from the baseline, drops it in up and recreates it in down', (name) => {
    expect(baseline).not.toMatch(new RegExp(`CREATE INDEX IF NOT EXISTS ${name}\\b`));
    expect(up).toContain(`'${name}'`);
    expect(down).toMatch(new RegExp(`CREATE INDEX IF NOT EXISTS ${name}\\b`));
  });

  it('keeps no non-unique baseline index that is a prefix of a UNIQUE constraint', () => {
    const uniques: Array<{ table: string; cols: string[] }> = [];
    for (const m of baseline.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+) \(([\s\S]*?)\n\);/g)) {
      const [, table, body] = m;
      for (const u of body.matchAll(/UNIQUE \(([^)]+)\)/g)) {
        uniques.push({ table, cols: u[1].split(',').map((c) => c.trim()) });
      }
      for (const u of body.matchAll(/^\s+(\w+)\s+[A-Z]+[^,\n]*\bUNIQUE\b/gm)) {
        uniques.push({ table, cols: [u[1]] });
      }
    }
    expect(uniques.length).toBeGreaterThan(5);
    const redundant: string[] = [];
    for (const m of baseline.matchAll(/^CREATE INDEX IF NOT EXISTS (\w+)\s+ON public\.(\w+)\(([^)]*)\);/gm)) {
      const [, name, table, rawCols] = m;
      const cols = rawCols.split(',').map((c) => c.trim().split(/\s+/)[0]);
      if (uniques.some((u) => u.table === table && cols.every((c, i) => u.cols[i] === c))) {
        redundant.push(name);
      }
    }
    expect(redundant).toEqual([]);
  });
});

describe('schema file structure', () => {
  const baseline = read('01_schema.sql');

  it('has no transaction control statements so it applies atomically with psql -1', () => {
    expect(baseline).not.toMatch(/^\s*(BEGIN|COMMIT|ROLLBACK|START TRANSACTION)\s*;/im);
  });

  it('has no statement that cannot run inside a transaction block', () => {
    const code = baseline.replace(/^\s*--.*$/gm, '');
    expect(code).not.toMatch(/CREATE INDEX CONCURRENTLY|ALTER TYPE[^;]*ADD VALUE|CREATE DATABASE|VACUUM\b/i);
  });

  it('documents the real minimum PostgreSQL version (15+)', () => {
    expect(baseline).toMatch(/Postgres 15\+/);
    expect(baseline).not.toMatch(/Postgres 14\+/);
  });

  it('migrations never open or close their own transaction (node-pg-migrate wraps them)', () => {
    const dir = resolve(dbDir, 'migrations');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
      expect(read(`migrations/${file}`), file).not.toMatch(/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/im);
    }
  });

  it('migration files avoid the up/down marker comments node-pg-migrate scans for', () => {
    const dir = resolve(dbDir, 'migrations');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
      expect(read(`migrations/${file}`), file).not.toMatch(/^\s*--[\s-]*(up|down)\s+migration/im);
    }
  });

  it('seed never resets an order counter on re-run', () => {
    const seed = read('02_seed.sql');
    const counters = seed.split('\n').filter((l) => l.includes('restaurant_order_counters') && l.startsWith('INSERT'));
    expect(counters.length).toBeGreaterThan(0);
    for (const line of counters) {
      expect(line).toContain('DO NOTHING');
      expect(line).not.toMatch(/DO UPDATE/i);
    }
  });
});
