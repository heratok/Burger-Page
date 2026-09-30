import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgCategoryRepository } from '../../../src/infrastructure/persistence/postgres/PgCategoryRepository.js';

const h = vi.hoisted(() => {
  const calls: { sql: string; params: unknown[] }[] = [];
  const client = {
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };
  return { calls, client };
});

vi.mock('../../../src/infrastructure/persistence/postgres/PgClient.js', () => ({
  withTenantContext: async (_ctx: unknown, cb: (c: unknown) => Promise<unknown>) => cb(h.client),
}));

describe('PgCategoryRepository.findByName (5.1)', () => {
  beforeEach(() => {
    h.calls.length = 0;
  });

  it('uses exact case-insensitive equality, never ILIKE wildcards', async () => {
    await new PgCategoryRepository().findByName('100%_Beef', 'rest-1');
    const { sql, params } = h.calls[0];
    expect(sql).not.toMatch(/ILIKE/i);
    expect(sql).toMatch(/LOWER\(name\)\s*=\s*LOWER\(\$2\)/i);
    expect(params).toEqual(['rest-1', '100%_Beef']);
  });
});
