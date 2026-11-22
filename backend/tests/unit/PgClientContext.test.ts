import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockState = vi.hoisted(() => ({
  queries: [] as Array<{ sql: string; params?: unknown[] }>,
  events: [] as string[],
  connect: vi.fn(),
  release: vi.fn(),
  end: vi.fn(async () => {}),
  on: vi.fn(),
}));

vi.mock('pg', () => {
  class MockPool {
    on = mockState.on;
    connect = mockState.connect;
    end = mockState.end;
  }
  return {
    default: { Pool: MockPool },
    Pool: MockPool,
  };
});

import { withTenantContext, closePgPool } from '../../src/infrastructure/persistence/postgres/PgClient.js';

describe('withTenantContext GUC batching', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
    mockState.queries = [];
    mockState.events = [];
    mockState.release.mockClear();
    mockState.end.mockClear();
    mockState.on.mockClear();
    mockState.connect.mockReset();
    mockState.connect.mockResolvedValue({
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        mockState.queries.push({ sql, params });
        mockState.events.push(`query:${sql}`);
        return { rows: [] };
      }),
      release: mockState.release,
    });
  });

  afterEach(async () => {
    await closePgPool();
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('batches all four transaction-scoped GUCs into one statement between BEGIN and callback', async () => {
    const result = await withTenantContext(
      {
        restaurantId: 'rest-1',
        restaurantSlug: 'burger-craft',
        actorRole: 'restaurant_admin',
        actor: 'usr-1',
      },
      async () => {
        mockState.events.push('callback');
        return 'ok';
      }
    );

    expect(result).toBe('ok');

    const setConfigQueries = mockState.queries.filter((q) => /set_config/i.test(q.sql));
    expect(setConfigQueries).toHaveLength(1);

    const batched = setConfigQueries[0]!;
    expect(batched.sql).toMatch(/set_config\(\s*'app\.restaurant_id'\s*,\s*\$1\s*,\s*true\s*\)/i);
    expect(batched.sql).toMatch(/set_config\(\s*'app\.restaurant_slug'\s*,\s*\$2\s*,\s*true\s*\)/i);
    expect(batched.sql).toMatch(/set_config\(\s*'app\.actor_role'\s*,\s*\$3\s*,\s*true\s*\)/i);
    expect(batched.sql).toMatch(/set_config\(\s*'app\.actor'\s*,\s*\$4\s*,\s*true\s*\)/i);
    expect(batched.params).toEqual(['rest-1', 'burger-craft', 'restaurant_admin', 'usr-1']);

    expect(mockState.queries.map((q) => q.sql)).toEqual([
      'BEGIN',
      batched.sql,
      'COMMIT',
    ]);
    expect(mockState.events).toEqual([
      'query:BEGIN',
      `query:${batched.sql}`,
      'callback',
      'query:COMMIT',
    ]);
    expect(mockState.release).toHaveBeenCalledTimes(1);
  });

  it('sends explicit empty strings for absent context fields including undefined restaurantId', async () => {
    await withTenantContext(
      { restaurantId: undefined as unknown as null },
      async () => {
        mockState.events.push('callback');
      }
    );

    const setConfigQueries = mockState.queries.filter((q) => /set_config/i.test(q.sql));
    expect(setConfigQueries).toHaveLength(1);
    expect(setConfigQueries[0]!.params).toEqual(['', '', '', '']);
    expect(mockState.queries.map((q) => q.sql)).toEqual([
      'BEGIN',
      setConfigQueries[0]!.sql,
      'COMMIT',
    ]);
    expect(mockState.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back and releases the client when the callback throws', async () => {
    await expect(
      withTenantContext({ restaurantId: null }, async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(mockState.queries.map((q) => q.sql)).toEqual([
      'BEGIN',
      expect.stringMatching(/set_config/i),
      'ROLLBACK',
    ]);
    expect(mockState.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back and releases the client when the batched set_config statement itself rejects', async () => {
    const callback = vi.fn(async () => 'should-not-run');
    mockState.connect.mockResolvedValue({
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        mockState.queries.push({ sql, params });
        mockState.events.push(`query:${sql}`);
        if (/set_config/i.test(sql)) {
          throw new Error('set_config failed');
        }
        return { rows: [] };
      }),
      release: mockState.release,
    });

    await expect(withTenantContext({ restaurantId: 'rest-1' }, callback)).rejects.toThrow('set_config failed');

    expect(callback).not.toHaveBeenCalled();
    expect(mockState.queries.map((q) => q.sql)).toEqual([
      'BEGIN',
      expect.stringMatching(/set_config/i),
      'ROLLBACK',
    ]);
    expect(mockState.release).toHaveBeenCalledTimes(1);
  });
});
