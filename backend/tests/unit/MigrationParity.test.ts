import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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
