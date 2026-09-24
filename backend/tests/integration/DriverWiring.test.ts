import { afterEach, describe, expect, it } from 'vitest';
import { buildDependencies } from '../../src/infrastructure/http/app.js';
import { PgRestaurantRepository } from '../../src/infrastructure/persistence/postgres/PgRestaurantRepository.js';
import { PgOrderRepository } from '../../src/infrastructure/persistence/postgres/PgOrderRepository.js';
import { PgUserRepository } from '../../src/infrastructure/persistence/postgres/PgUserRepository.js';

/**
 * S5 wiring contract: the 'supabase' driver must resolve to the same Pg
 * repositories as 'postgres' (pooler + app_user/NOBYPASSRLS, RLS enforced) and
 * must fail fast without DATABASE_URL. Supabase now handles file storage only.
 *
 * No real connection is made: the Pg repositories have no constructor side
 * effects (the pool is created lazily in PgClient on first query), so a
 * placeholder pooler URL is deterministic even though it never resolves.
 */

const FAKE_POOLER_URL =
  'postgres://app_user:secret@db.pooler.supabase.com:6543/postgres?sslmode=require';

describe('Driver wiring (S5): supabase routes data through the pooler', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('supabase driver returns Pg repositories when DATABASE_URL is set', () => {
    process.env.DATABASE_URL = FAKE_POOLER_URL;
    const deps = buildDependencies(undefined, 'supabase');

    expect(deps.restaurantRepo).toBeInstanceOf(PgRestaurantRepository);
    expect(deps.orderRepo).toBeInstanceOf(PgOrderRepository);
    expect(deps.userRepo).toBeInstanceOf(PgUserRepository);
  });

  it('postgres driver returns Pg repositories when DATABASE_URL is set', () => {
    process.env.DATABASE_URL = FAKE_POOLER_URL;
    const deps = buildDependencies(undefined, 'postgres');

    expect(deps.restaurantRepo).toBeInstanceOf(PgRestaurantRepository);
    expect(deps.orderRepo).toBeInstanceOf(PgOrderRepository);
    expect(deps.userRepo).toBeInstanceOf(PgUserRepository);
  });

  it('supabase driver fails fast with a clear error when DATABASE_URL is unset', () => {
    delete process.env.DATABASE_URL;

    expect(() => buildDependencies(undefined, 'supabase')).toThrow(/DATABASE_URL/);
  });

  it('postgres driver fails fast with a clear error when DATABASE_URL is unset', () => {
    delete process.env.DATABASE_URL;

    expect(() => buildDependencies(undefined, 'postgres')).toThrow(/DATABASE_URL/);
  });

  it('STORAGE_DRIVER=supabase without DATABASE_URL fails fast', () => {
    delete process.env.DATABASE_URL;
    process.env.STORAGE_DRIVER = 'supabase';
    try {
      expect(() => buildDependencies()).toThrow(/DATABASE_URL/);
    } finally {
      delete process.env.STORAGE_DRIVER;
    }
  });
});