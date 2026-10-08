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

describe('migration 0000000000008 (db hardening) parity with the baseline schema', () => {
  const baseline = read('01_schema.sql');
  const up = read('migrations/0000000000008_db_hardening.up.sql');
  const down = read('migrations/0000000000008_db_hardening.down.sql');
  const migration6 = read('migrations/0000000000006_order_contact_snapshot_and_metrics.up.sql');

  describe('T2 customer metrics row lock', () => {
    it('redefines update_customer_order_metrics byte-identically in baseline and up', () => {
      expect(extractFunction(up, 'update_customer_order_metrics')).toBe(
        extractFunction(baseline, 'update_customer_order_metrics')
      );
    });

    it('locks the customer row before aggregating', () => {
      const body = extractFunction(baseline, 'update_customer_order_metrics');
      const lock = body.indexOf('FOR UPDATE');
      expect(lock).toBeGreaterThan(-1);
      expect(lock).toBeLessThan(body.indexOf('COUNT(*)'));
    });

    it('down restores the body that 0000000000006 introduced', () => {
      expect(extractFunction(down, 'update_customer_order_metrics')).toBe(
        extractFunction(migration6, 'update_customer_order_metrics')
      );
    });
  });
  describe('T3 RLS helper functions', () => {
    const norm = (sql?: string) => sql?.replace(/\s+/g, ' ');
    const policyStatements = (sql: string) =>
      [...sql.matchAll(/CREATE POLICY "([^"]+)" ON public\.(\w+)[\s\S]*?;\n/g)].map((m) => ({ name: m[1], table: m[2], sql: m[0] }));

    it('defines STABLE app_current_restaurant_id() and app_is_super_admin() identically in baseline and up', () => {
      for (const fn of ['app_current_restaurant_id', 'app_is_super_admin']) {
        const body = extractFunction(baseline, fn);
        expect(body).toMatch(/\bSTABLE\b/);
        expect(extractFunction(up, fn)).toBe(body);
      }
    });

    it('baseline tenant policies read the tenant only through the helpers', () => {
      const tenant = policyStatements(baseline).filter(
        (p) => p.name.startsWith('tenant_isolation_') || p.name === 'users_select_for_auth'
      );
      expect(tenant.length).toBeGreaterThan(20);
      for (const p of tenant) {
        expect(p.sql, p.name).not.toMatch(/current_setting/);
        expect(p.sql, p.name).toContain('(SELECT public.app_current_restaurant_id())');
      }
    });

    it('up recreates every rewritten tenant policy exactly as the baseline declares it', () => {
      const upPolicies = new Map(policyStatements(up).map((p) => [p.name, p.sql]));
      // restaurant_opening_hours / restaurant_tables / roles only exist from migrations 0009 / 0010 / 0017.
      const tenant = policyStatements(baseline).filter(
        (p) =>
          (p.name.startsWith('tenant_isolation_') || p.name === 'users_select_for_auth') &&
          p.table !== 'restaurant_opening_hours' &&
          p.table !== 'restaurant_tables' &&
          p.table !== 'roles'
      );
      for (const p of tenant) {
        expect(norm(upPolicies.get(p.name)), p.name).toBe(norm(p.sql));
      }
    });

    it('down restores the inline current_setting policies', () => {
      const downPolicies = policyStatements(down);
      expect(downPolicies.length).toBeGreaterThan(20);
      for (const p of downPolicies) {
        expect(p.sql, p.name).toContain("current_setting('app.");
      }
    });
  });

  describe('T4 slug-scoped public reads', () => {
    const policyNames = (sql: string) => [...sql.matchAll(/CREATE POLICY "([^"]+)"/g)].map((m) => m[1]);

    it('drops the blanket public read on products and additions (baseline and up; down recreates them)', () => {
      for (const name of ['public_read_available_products', 'public_read_available_additions']) {
        expect(policyNames(baseline)).not.toContain(name);
        expect(up).toContain(`DROP POLICY IF EXISTS "${name}"`);
        expect(policyNames(up)).not.toContain(name);
        expect(policyNames(down)).toContain(name);
      }
    });

    it.each([
      'public_read_active_restaurants',
      'public_read_restaurant_settings',
      'public_read_restaurant_branding',
      'public_read_categories',
    ])('%s only applies without tenant context, without super_admin and for the declared slug', (name) => {
      const grab = (sql: string) => sql.match(new RegExp(`CREATE POLICY "${name}"[\\s\\S]*?;\\n`))![0].replace(/\s+/g, ' ');
      const def = grab(baseline);
      expect(def).toContain('(SELECT public.app_current_restaurant_id()) IS NULL');
      expect(def).toContain('NOT (SELECT public.app_is_super_admin())');
      expect(def).toContain('(SELECT public.app_current_restaurant_slug())');
      expect(grab(up)).toBe(def);
      expect(grab(down)).not.toContain('app_current_restaurant_slug');
    });

    it('defines STABLE app_current_restaurant_slug() identically in baseline and up', () => {
      const body = extractFunction(baseline, 'app_current_restaurant_slug');
      expect(body).toMatch(/\bSTABLE\b/);
      expect(extractFunction(up, 'app_current_restaurant_slug')).toBe(body);
    });
  });

  describe('T5 append-only order_status_history', () => {
    it('baseline grants app_user only SELECT and INSERT on the history table', () => {
      expect(baseline).toMatch(/GRANT SELECT, INSERT ON public\.order_status_history TO app_user;/);
      expect(baseline).not.toMatch(/GRANT [A-Z, ]*(UPDATE|DELETE)[A-Z, ]* ON public\.order_status_history/);
    });

    it('up revokes UPDATE and DELETE, down grants them back', () => {
      expect(up).toMatch(/REVOKE UPDATE, DELETE ON public\.order_status_history FROM app_user;/);
      expect(down).toMatch(/GRANT UPDATE, DELETE ON public\.order_status_history TO app_user;/);
    });

    it('declares the BEFORE UPDATE guard identically in baseline and up, and drops it in down', () => {
      const fn = extractFunction(baseline, 'guard_order_status_history_immutable');
      expect(fn).toContain("ERRCODE = '42501'");
      expect(extractFunction(up, 'guard_order_status_history_immutable')).toBe(fn);
      for (const sql of [baseline, up]) {
        expect(sql.replace(/\s+/g, ' ')).toContain(
          'CREATE TRIGGER trg_order_status_history_immutable BEFORE UPDATE ON public.order_status_history FOR EACH ROW EXECUTE FUNCTION public.guard_order_status_history_immutable();'
        );
      }
      expect(down).toContain('DROP TRIGGER IF EXISTS trg_order_status_history_immutable');
      expect(down).toContain('DROP FUNCTION IF EXISTS public.guard_order_status_history_immutable()');
    });
  });

  describe('T6 restaurant FKs on financial tables are RESTRICT', () => {
    const tables = ['orders', 'order_items', 'order_item_additions', 'order_status_history'];

    it.each(tables)('baseline declares %s.restaurant_id ON DELETE RESTRICT', (table) => {
      const body = baseline.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\(([\\s\\S]*?)\\n\\);`))![1];
      expect(body).toMatch(/restaurant_id\s+TEXT NOT NULL REFERENCES public\.restaurants\(id\) ON DELETE RESTRICT/);
    });

    it.each(tables)('up swaps %s_restaurant_id_fkey to RESTRICT (NOT VALID + VALIDATE) and down restores CASCADE', (table) => {
      expect(up).toContain(`'${table}'`);
      expect(up).toContain('ON DELETE RESTRICT');
      expect(up).toContain('NOT VALID');
      expect(up).toContain('VALIDATE CONSTRAINT');
      expect(down).toContain(`'${table}'`);
      expect(down).toContain('ON DELETE CASCADE');
    });
  });

  describe('T7 hours consolidation', () => {
    it('baseline no longer declares restaurant_hours nor opening_hours_text', () => {
      expect(baseline).not.toMatch(/public\.restaurant_hours/);
      expect(baseline).not.toMatch(/opening_hours_text/);
      expect(baseline).not.toContain('horarios_restaurante');
    });

    it('up backfills the times, aborts on a lossy text, then drops the column and the table', () => {
      expect(up).toMatch(/UPDATE public\.restaurant_settings/);
      expect(up).toMatch(/RAISE EXCEPTION[\s\S]*opening_hours_text/);
      expect(up).toContain('DROP COLUMN IF EXISTS opening_hours_text');
      expect(up).toContain('DROP TABLE IF EXISTS public.restaurant_hours');
    });

    it('down re-adds the column and recreates the table', () => {
      expect(down).toContain('ADD COLUMN IF NOT EXISTS opening_hours_text');
      expect(down).toContain('CREATE TABLE IF NOT EXISTS public.restaurant_hours');
      expect(down).toContain('uq_restaurant_hours_day');
      expect(down).toContain('chk_hours_consistent');
    });
  });

  describe("T8 optional text columns: '' -> NULL", () => {
    const cols = [
      ['customers', 'email'],
      ['customers', 'address'],
      ['customers', 'barrio'],
      ['products', 'description'],
      ['suppliers', 'contact_name'],
      ['suppliers', 'phone'],
      ['suppliers', 'email'],
    ];

    it.each(cols)("baseline declares %s.%s without an empty-string default", (table, column) => {
      const body = baseline.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\(([\\s\\S]*?)\\n\\);`))![1];
      const line = body.split('\n').find((l) => new RegExp(`^\\s+${column}\\s`).test(l))!;
      expect(line).toBeDefined();
      expect(line).not.toMatch(/DEFAULT\s+''/);
    });

    it.each(cols)("up converts %s.%s '' to NULL and drops the default; down restores both", (table, column) => {
      expect(up).toMatch(new RegExp(`ALTER TABLE public\\.${table}[\\s\\S]*?ALTER COLUMN ${column} DROP DEFAULT`));
      expect(up).toMatch(new RegExp(`UPDATE public\\.${table}[\\s\\S]*?${column} = NULLIF\\(${column}, ''\\)`));
      expect(down).toMatch(new RegExp(`ALTER COLUMN ${column} SET DEFAULT ''`));
      expect(down).toMatch(new RegExp(`${column} = COALESCE\\(${column}, ''\\)`));
    });
  });

  describe('T9 orders total consistency CHECK', () => {
    it('baseline declares chk_orders_final_total on orders', () => {
      const body = baseline.match(/CREATE TABLE IF NOT EXISTS public\.orders \(([\s\S]*?)\n\);/)![1];
      expect(body.replace(/\s+/g, ' ')).toContain(
        'CONSTRAINT chk_orders_final_total CHECK (final_total = subtotal + delivery_fee)'
      );
    });

    it('up adds it NOT VALID, validates it and aborts loudly on violating rows; down drops it', () => {
      const flat = up.replace(/\s+/g, ' ');
      expect(flat).toContain('ADD CONSTRAINT chk_orders_final_total CHECK (final_total = subtotal + delivery_fee) NOT VALID');
      expect(up).toContain('VALIDATE CONSTRAINT chk_orders_final_total');
      expect(up).toMatch(/RAISE EXCEPTION[\s\S]*chk_orders_final_total/);
      expect(down).toContain('DROP CONSTRAINT IF EXISTS chk_orders_final_total');
    });
  });

  describe('T10 primary key id format CHECK', () => {
    const tables = [
      'restaurants', 'users', 'categories', 'products', 'product_additions', 'customers', 'orders',
      'order_status_history', 'order_items', 'order_item_additions', 'suppliers', 'inventory_items',
    ];

    it.each(tables)('baseline declares chk_%s_id_format on the id primary key', (table) => {
      const body = baseline.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\(([\\s\\S]*?)\\n\\);`))![1];
      expect(body.replace(/\s+/g, ' ')).toContain(
        `CONSTRAINT chk_${table}_id_format CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$')`
      );
    });

    it('up covers every table (NOT VALID + VALIDATE, aborting on offending ids) and down drops them', () => {
      for (const table of tables) {
        expect(up).toContain(`'${table}'`);
        expect(down).toContain(`'${table}'`);
      }
      expect(up).toContain("'^[A-Za-z0-9_-]{1,64}$'");
      expect(up).toContain('NOT VALID');
      expect(up).toContain('VALIDATE CONSTRAINT');
      expect(up).toMatch(/RAISE EXCEPTION/);
      expect(down).toContain('DROP CONSTRAINT IF EXISTS');
    });
  });
});

describe('migration 0000000000009 (store opening hours) parity with the baseline schema', () => {
  const baseline = read('01_schema.sql');
  const up = read('migrations/0000000000009_store_opening_hours.up.sql');
  const down = read('migrations/0000000000009_store_opening_hours.down.sql');
  const flat = (sql: string) => sql.replace(/\s+/g, ' ');
  const tableBody = (sql: string) =>
    sql.match(/CREATE TABLE IF NOT EXISTS public\.restaurant_opening_hours \(([\s\S]*?)\n\);/)![1];

  describe('T1 restaurant_settings timezone and orders_paused', () => {
    it('baseline declares both columns with their defaults and no open_time/close_time', () => {
      const body = baseline.match(/CREATE TABLE IF NOT EXISTS public\.restaurant_settings \(([\s\S]*?)\n\);/)![1];
      expect(flat(body)).toContain("timezone TEXT NOT NULL DEFAULT 'America/Bogota'");
      expect(flat(body)).toContain('orders_paused BOOLEAN NOT NULL DEFAULT FALSE');
      expect(body).not.toMatch(/\bopen_time\b|\bclose_time\b/);
      expect(baseline).not.toMatch(/restaurant_settings\.open_time/);
    });

    it('up adds the columns and a sane-looking timezone CHECK (NOT VALID + VALIDATE); down drops them', () => {
      expect(up).toContain('ADD COLUMN IF NOT EXISTS timezone');
      expect(up).toContain('ADD COLUMN IF NOT EXISTS orders_paused');
      expect(flat(up)).toContain('ADD CONSTRAINT chk_restaurant_settings_timezone');
      expect(up).toContain('NOT VALID');
      expect(up).toContain('VALIDATE CONSTRAINT chk_restaurant_settings_timezone');
      expect(down).toContain('DROP CONSTRAINT IF EXISTS chk_restaurant_settings_timezone');
      expect(down).toContain('DROP COLUMN IF EXISTS timezone');
      expect(down).toContain('DROP COLUMN IF EXISTS orders_paused');
    });
  });

  describe('T2 restaurant_opening_hours table', () => {
    it('baseline and up declare the same table definition', () => {
      expect(flat(tableBody(up))).toBe(flat(tableBody(baseline)));
    });

    it('has a cascading restaurant FK, a 0-6 weekday CHECK, the id format CHECK and a unique range', () => {
      const body = flat(tableBody(baseline));
      expect(body).toContain('restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE');
      expect(body).toContain('CHECK (day_of_week BETWEEN 0 AND 6)');
      expect(body).toContain("CONSTRAINT chk_restaurant_opening_hours_id_format CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$')");
      expect(body).toContain('CONSTRAINT uq_restaurant_opening_hours_range UNIQUE (restaurant_id, day_of_week, open_time)');
    });

    it('enables and forces RLS with tenant isolation and a slug-scoped public read, and grants app_user', () => {
      for (const sql of [baseline, up]) {
        expect(flat(sql)).toContain('ALTER TABLE public.restaurant_opening_hours ENABLE ROW LEVEL SECURITY');
        expect(flat(sql)).toContain('ALTER TABLE public.restaurant_opening_hours FORCE ROW LEVEL SECURITY');
        expect(flat(sql)).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_opening_hours TO app_user');
        expect(flat(sql)).toContain('"tenant_isolation_restaurant_opening_hours" ON public.restaurant_opening_hours');
        expect(flat(sql)).toContain('"public_read_restaurant_opening_hours"');
        expect(flat(sql)).toContain('r.id = restaurant_opening_hours.restaurant_id');
        expect(flat(sql)).toContain('r.slug = (SELECT public.app_current_restaurant_slug())');
      }
    });

    it('down drops the table, which removes its policies and grants', () => {
      expect(down).toContain('DROP TABLE IF EXISTS public.restaurant_opening_hours');
    });
  });

  describe('T3 backfill and single source of truth', () => {
    it('up backfills 7 rows per restaurant from open_time/close_time (only while the columns exist), then drops them', () => {
      expect(up).toContain('generate_series(0, 6)');
      expect(up).toMatch(/information_schema\.columns[\s\S]*open_time/);
      expect(up).toContain('DROP COLUMN IF EXISTS open_time');
      expect(up).toContain('DROP COLUMN IF EXISTS close_time');
    });

    it('down restores the time columns (0008 shape) and refills them from the schedule', () => {
      expect(down).toContain("ADD COLUMN IF NOT EXISTS open_time TIME DEFAULT '12:00'");
      expect(down).toContain("ADD COLUMN IF NOT EXISTS close_time TIME DEFAULT '22:30'");
      expect(down).toMatch(/UPDATE public\.restaurant_settings[\s\S]*restaurant_opening_hours/);
    });
  });

  it('the README table count follows the baseline', () => {
    const tables = [...baseline.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g)].length;
    expect(read('README.md')).toContain(`${tables} tablas relacionales`);
  });
});

describe('migration 0000000000010 (restaurant tables) parity with the baseline schema', () => {
  const baseline = read('01_schema.sql');
  const up = read('migrations/0000000000010_restaurant_tables.up.sql');
  const down = read('migrations/0000000000010_restaurant_tables.down.sql');
  const flat = (sql: string) => sql.replace(/\s+/g, ' ');
  const tableBody = (sql: string) =>
    sql.match(/CREATE TABLE IF NOT EXISTS public\.restaurant_tables \(([\s\S]*?)\n\);/)![1];

  describe('T1 restaurant_tables table', () => {
    it('baseline and up declare the same table definition', () => {
      expect(flat(tableBody(up))).toBe(flat(tableBody(baseline)));
    });

    it('cascades with the restaurant and constrains id format, name length and tenant-scoped uniqueness', () => {
      const body = flat(tableBody(baseline));
      expect(body).toContain('restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE');
      expect(body).toContain("CONSTRAINT chk_restaurant_tables_id_format CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$')");
      expect(body).toContain('CHECK (char_length(btrim(name)) BETWEEN 1 AND 40)');
      expect(body).toContain('CONSTRAINT uq_restaurant_tables_id_restaurant UNIQUE (id, restaurant_id)');
      for (const sql of [baseline, up]) {
        expect(flat(sql)).toContain('uq_restaurant_tables_name');
        expect(flat(sql)).toContain('(restaurant_id, lower(btrim(name)))');
      }
    });

    it('enables and forces RLS with tenant isolation only (no public read) and grants app_user', () => {
      for (const sql of [baseline, up]) {
        expect(flat(sql)).toContain('ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY');
        expect(flat(sql)).toContain('ALTER TABLE public.restaurant_tables FORCE ROW LEVEL SECURITY');
        expect(flat(sql)).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_tables TO app_user');
        expect(flat(sql)).toContain('CREATE POLICY "tenant_isolation_restaurant_tables" ON public.restaurant_tables FOR ALL');
        expect(flat(sql)).toContain(
          'USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))'
        );
        expect(sql).not.toContain('public_read_restaurant_tables');
        expect(flat(sql)).toContain('trg_restaurant_tables_updated_at');
      }
    });

    it('down drops the table, which removes its policy, trigger and grants', () => {
      expect(down).toContain('DROP TABLE IF EXISTS public.restaurant_tables');
    });
  });

  describe('T2 orders.table_id and orders.table_label', () => {
    it('baseline declares both nullable columns and the tenant-scoped SET NULL (table_id) FK', () => {
      const body = flat(baseline.match(/CREATE TABLE IF NOT EXISTS public\.orders \(([\s\S]*?)\n\);/)![1]);
      expect(body).toContain('table_id TEXT, table_label TEXT,');
      expect(body).toContain(
        'CONSTRAINT fk_orders_table_tenant FOREIGN KEY (table_id, restaurant_id) REFERENCES public.restaurant_tables(id, restaurant_id) ON DELETE SET NULL (table_id)'
      );
    });

    it('up adds the same columns and FK idempotently; down removes them', () => {
      expect(up).toContain('ADD COLUMN IF NOT EXISTS table_id TEXT');
      expect(up).toContain('ADD COLUMN IF NOT EXISTS table_label TEXT');
      expect(flat(up)).toContain(
        'FOREIGN KEY (table_id, restaurant_id) REFERENCES public.restaurant_tables(id, restaurant_id) ON DELETE SET NULL (table_id)'
      );
      expect(up).toContain("conname = 'fk_orders_table_tenant'");
      expect(down).toContain('DROP CONSTRAINT IF EXISTS fk_orders_table_tenant');
      expect(down).toContain('DROP COLUMN IF EXISTS table_id');
      expect(down).toContain('DROP COLUMN IF EXISTS table_label');
    });
  });
});

describe('schema file structure', () => {
  const baseline = read('01_schema.sql');

  it('never resets the app_user password when the role already exists (re-apply safe)', () => {
    const code = baseline.replace(/^\s*--.*$/gm, '');
    expect(code).not.toMatch(/ALTER ROLE app_user[^;]*PASSWORD/i);
    expect(code).toMatch(/CREATE ROLE app_user[^;]*PASSWORD 'app_user_test_only'/);
  });

  it('has no transaction control statements so it applies atomically with psql -1', () => {
    expect(baseline).not.toMatch(/^\s*(BEGIN|COMMIT|ROLLBACK|START TRANSACTION)\s*;/im);
  });

  it('has no statement that cannot run inside a transaction block', () => {
    const code = baseline.replace(/^\s*--.*$/gm, '');
    expect(code).not.toMatch(/CREATE INDEX CONCURRENTLY|ALTER TYPE[^;]*ADD VALUE|CREATE DATABASE|VACUUM\b/i);
  });

  it('has no stale header or table references in its comments (db-hardening-0008 T12)', () => {
    expect(baseline).toContain('-- File: database/01_schema.sql');
    expect(baseline).not.toContain('File: database/schema.sql');
    expect(baseline).not.toContain('horarios_restaurante');
    expect(baseline).not.toMatch(/restaurant_hours/);
    expect(baseline).toMatch(/COMMENT ON TABLE public\.order_status_history IS '[^']*append-only/i);
  });

  it('the database README states the real minimum version and table count', () => {
    const readme = read('README.md');
    expect(readme).toMatch(/versión 15 en adelante/);
    expect(readme).not.toMatch(/versión 14/);
    const tables = [...baseline.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g)].length;
    expect(readme).toContain(`${tables} tablas relacionales`);
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

describe('migration drift check wiring', () => {
  const root = resolve(dbDir, '..');
  const script = readFileSync(resolve(dbDir, 'scripts/check-migration-drift.sh'), 'utf8');
  const fingerprint = read('scripts/schema-fingerprint.sql');
  const ci = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8');

  it('CI runs the drift script on a postgres service with full git history', () => {
    expect(ci).toContain('migration-drift:');
    expect(ci).toContain('bash database/scripts/check-migration-drift.sh');
    expect(ci).toMatch(/fetch-depth: 0/);
  });

  it('the script uses node-pg-migrate directly (no doppler) with the same ignore pattern as db:migrate', () => {
    expect(script).not.toMatch(/^\s*doppler\b/m);
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    expect(pkg.scripts['db:migrate']).toContain('--ignore-pattern ".*\\.down\\.sql|.*\\.md"');
    expect(script).toContain("IGNORE_UP='.*\\.down\\.sql|.*\\.md'");
  });

  it('applies the fresh baseline atomically and marks base migrations with --fake', () => {
    expect(script).toMatch(/psql_q -1 -f "\$ROOT\/database\/01_schema\.sql"/);
    expect(script).toContain('--fake');
  });

  it('the fingerprint covers columns, constraints, indexes, functions, policies and privileges', () => {
    for (const kind of ['column', 'constraint', 'index', 'trigger', 'policy', 'function', 'acl=', 'defacl']) {
      expect(fingerprint).toContain(kind);
    }
    expect(fingerprint).toContain("'pgmigrations'");
  });
});

describe('migration 0000000000011 (users.must_change_password) parity with the baseline schema', () => {
  const baseline = read('01_schema.sql');
  const up = read('migrations/0000000000011_users_must_change_password.up.sql');
  const down = read('migrations/0000000000011_users_must_change_password.down.sql');

  it('declares the column NOT NULL DEFAULT FALSE in baseline and migration', () => {
    expect(baseline).toMatch(/must_change_password\s+BOOLEAN NOT NULL DEFAULT FALSE,/);
    expect(up).toMatch(/ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE/);
  });

  it('is reversible', () => {
    expect(down).toContain('DROP COLUMN IF EXISTS must_change_password');
  });
});

describe('migration 0000000000012 (restaurants.deleted_at) parity with the baseline schema', () => {
  const baseline = read('01_schema.sql');
  const up = read('migrations/0000000000012_restaurants_deleted_at.up.sql');
  const down = read('migrations/0000000000012_restaurants_deleted_at.down.sql');

  it('declares the nullable deleted_at column in baseline and migration', () => {
    expect(baseline).toMatch(/deleted_at\s+TIMESTAMPTZ,/);
    expect(up).toMatch(/ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ/);
  });

  it('is reversible', () => {
    expect(down).toContain('DROP COLUMN IF EXISTS deleted_at');
  });
});

describe('migration 0000000000013 (users.password_changed_at) parity with the baseline schema', () => {
  const baseline = read('01_schema.sql');
  const up = read('migrations/0000000000013_users_password_changed_at.up.sql');
  const down = read('migrations/0000000000013_users_password_changed_at.down.sql');

  it('declares the nullable password_changed_at column in baseline and migration', () => {
    expect(baseline).toMatch(/password_changed_at\s+TIMESTAMPTZ,/);
    expect(up).toMatch(/ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ/);
  });

  it('is reversible', () => {
    expect(down).toContain('DROP COLUMN IF EXISTS password_changed_at');
  });
});

describe('migration 0000000000014 (restaurants.deleted_slug) parity with the baseline schema', () => {
  const baseline = read('01_schema.sql');
  const up = read('migrations/0000000000014_restaurants_deleted_slug.up.sql');
  const down = read('migrations/0000000000014_restaurants_deleted_slug.down.sql');

  it('declares the nullable deleted_slug column in baseline and migration', () => {
    expect(baseline).toMatch(/deleted_slug\s+TEXT,/);
    expect(up).toMatch(/ADD COLUMN IF NOT EXISTS deleted_slug TEXT/);
  });

  it('backfills only deleted rows that lack the value, so a re-run changes nothing', () => {
    expect(up).toMatch(/WHERE deleted_at IS NOT NULL\s+AND deleted_slug IS NULL/);
  });

  it('is reversible', () => {
    expect(down).toContain('DROP COLUMN IF EXISTS deleted_slug');
  });
});

describe('migration 0000000000015 (admin_audit_log) parity with the baseline schema', () => {
  const baseline = read('01_schema.sql');
  const up = read('migrations/0000000000015_admin_audit_log.up.sql');
  const down = read('migrations/0000000000015_admin_audit_log.down.sql');

  const tableDef = (sql: string) => {
    const start = sql.indexOf('CREATE TABLE IF NOT EXISTS public.admin_audit_log');
    expect(start).toBeGreaterThan(-1);
    return sql.slice(start, sql.indexOf('\n);', start)).replace(/\s+/g, ' ');
  };

  it('declares the same table, with no foreign keys, in baseline and migration', () => {
    // Migration 0017 later widened target_type with 'role' (baseline only).
    expect(tableDef(baseline).replace(", 'role'", '')).toBe(tableDef(up));
    expect(tableDef(up)).not.toMatch(/REFERENCES/i);
    expect(tableDef(up)).toMatch(/actor_user_id TEXT,/);
    expect(tableDef(up)).toMatch(/details JSONB NOT NULL DEFAULT '\{\}'::jsonb/);
  });

  it.each([
    'idx_admin_audit_log_created ON public.admin_audit_log (created_at DESC, id DESC)',
    'idx_admin_audit_log_restaurant ON public.admin_audit_log (restaurant_id, created_at DESC)',
    'idx_admin_audit_log_actor ON public.admin_audit_log (actor_user_id)',
  ])('creates index %s in baseline and migration', (def) => {
    for (const sql of [baseline, up]) expect(sql.replace(/\s+/g, ' ')).toContain(`CREATE INDEX IF NOT EXISTS ${def}`);
  });

  it('is append-only for app_user in baseline and migration, with super-admin-only RLS', () => {
    for (const sql of [baseline, up]) {
      expect(sql).toContain('GRANT SELECT, INSERT ON public.admin_audit_log TO app_user;');
      expect(sql).toContain('REVOKE UPDATE, DELETE ON public.admin_audit_log FROM app_user;');
      expect(sql).toMatch(/ALTER TABLE public\.admin_audit_log\s+ENABLE ROW LEVEL SECURITY;/);
      expect(sql).toMatch(/ALTER TABLE public\.admin_audit_log\s+FORCE ROW LEVEL SECURITY;/);
      expect(sql).toMatch(/super_admin_read_admin_audit_log[\s\S]*?FOR SELECT\s+USING \(\(SELECT public\.app_is_super_admin\(\)\)\)/);
      expect(sql).toMatch(/super_admin_append_admin_audit_log[\s\S]*?FOR INSERT\s+WITH CHECK \(\(SELECT public\.app_is_super_admin\(\)\)\)/);
      expect(sql).toContain('BEFORE UPDATE ON public.admin_audit_log');
      expect(sql).not.toMatch(/ON public\.admin_audit_log\s+FOR (ALL|UPDATE|DELETE)/);
    }
  });

  it('is reversible', () => {
    expect(down).toContain('DROP TABLE IF EXISTS public.admin_audit_log');
    expect(down).toContain('DROP FUNCTION IF EXISTS public.guard_admin_audit_log_immutable()');
  });
});

describe('migration 0000000000016 (users.retired_was_active) parity with the baseline schema', () => {
  const baseline = read('01_schema.sql');
  const up = read('migrations/0000000000016_users_retired_was_active.up.sql');
  const down = read('migrations/0000000000016_users_retired_was_active.down.sql');

  it('declares the nullable column in baseline and migration, without a default or backfill', () => {
    expect(baseline).toMatch(/retired_was_active BOOLEAN,/);
    expect(up).toMatch(/ADD COLUMN IF NOT EXISTS retired_was_active BOOLEAN;/);
    expect(up).not.toMatch(/\bUPDATE\b/);
  });

  it('is reversible', () => {
    expect(down).toContain('DROP COLUMN IF EXISTS retired_was_active');
  });
});
