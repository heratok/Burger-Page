import { describe, it, expect } from 'vitest';
import { assertLocalDatabaseUrl } from '../setup/assertLocalDatabase';

describe('assertLocalDatabaseUrl', () => {
  it.each([
    undefined,
    '',
    'postgres://postgres:postgres@localhost:5432/burger_page_test',
    'postgres://app_user:app_user_test_only@127.0.0.1:5432/burger_page_test',
    'postgresql://postgres@[::1]:5432/db',
    'postgres://postgres:postgres@postgres-test:5432/burger_page_test',
  ])('accepts a local or unset url: %s', (url) => {
    expect(() => assertLocalDatabaseUrl('DATABASE_URL', url)).not.toThrow();
  });

  it.each([
    'postgres://postgres.abc:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
    'postgres://user:pass@db.example.com:5432/app',
    'not a url',
  ])('rejects a non-local url: %s', (url) => {
    expect(() => assertLocalDatabaseUrl('DATABASE_URL', url)).toThrow(/DATABASE_URL/);
  });

  it('never leaks credentials in the error message', () => {
    expect(() =>
      assertLocalDatabaseUrl('DATABASE_URL', 'postgres://user:topsecret@db.example.com:5432/app'),
    ).toThrow(expect.objectContaining({ message: expect.not.stringContaining('topsecret') }));
  });
});
