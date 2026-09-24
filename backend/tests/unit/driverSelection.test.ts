import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dataRunsOnPostgres,
  resolveStorageDriver,
  type StorageDriver,
} from '../../src/infrastructure/persistence/driverSelection.js';

/**
 * D3 (driver selection hygiene): the precedence rule used to be duplicated
 * with drift in buildDependencies(), the /health route and src/index.ts.
 * These tests pin the single source of truth in driverSelection.ts:
 *   1. explicit argument
 *   2. STORAGE_DRIVER env (must be one of the four lowercase names; anything
 *      else, uppercase included, falls through)
 *   3. SUPABASE_URL set -> 'supabase'
 *   4. DATABASE_URL set -> 'postgres'
 *   5. 'memory'
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveStorageDriver precedence', () => {
  it('explicit argument wins over env and URL fallbacks', () => {
    vi.stubEnv('STORAGE_DRIVER', 'supabase');
    vi.stubEnv('SUPABASE_URL', 'https://abc.supabase.co');
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@host:5432/db');
    expect(resolveStorageDriver('sqlite')).toBe('sqlite');
    expect(resolveStorageDriver('postgres')).toBe('postgres');
  });

  it('explicit undefined falls through to env', () => {
    vi.stubEnv('STORAGE_DRIVER', 'sqlite');
    expect(resolveStorageDriver(undefined)).toBe('sqlite');
  });

  it('STORAGE_DRIVER=supabase wins over DATABASE_URL', () => {
    vi.stubEnv('STORAGE_DRIVER', 'supabase');
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@host:5432/db');
    expect(resolveStorageDriver()).toBe('supabase');
  });

  it('SUPABASE_URL alone selects supabase', () => {
    vi.stubEnv('SUPABASE_URL', 'https://abc.supabase.co');
    expect(resolveStorageDriver()).toBe('supabase');
  });

  it('DATABASE_URL alone selects postgres', () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@host:5432/db');
    expect(resolveStorageDriver()).toBe('postgres');
  });

  it('no signals selects memory', () => {
    vi.stubEnv('STORAGE_DRIVER', undefined);
    vi.stubEnv('SUPABASE_URL', undefined);
    vi.stubEnv('DATABASE_URL', undefined);
    expect(resolveStorageDriver()).toBe('memory');
  });

  it('uppercase STORAGE_DRIVER is invalid and falls through', () => {
    vi.stubEnv('STORAGE_DRIVER', 'SUPABASE');
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@host:5432/db');
    expect(resolveStorageDriver()).toBe('postgres');
  });

  it('unknown STORAGE_DRIVER value falls through', () => {
    vi.stubEnv('STORAGE_DRIVER', 'oracle');
    expect(resolveStorageDriver()).toBe('memory');
  });

  it('empty STORAGE_DRIVER falls through', () => {
    vi.stubEnv('STORAGE_DRIVER', '');
    expect(resolveStorageDriver()).toBe('memory');
  });
});

describe('dataRunsOnPostgres truth table', () => {
  const cases: Array<[StorageDriver, boolean]> = [
    ['memory', false],
    ['sqlite', false],
    ['supabase', true],
    ['postgres', true],
  ];

  it.each(cases)('%s -> %s', (driver, expected) => {
    expect(dataRunsOnPostgres(driver)).toBe(expected);
  });
});