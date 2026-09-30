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
});
