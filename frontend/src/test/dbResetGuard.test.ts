import { describe, expect, it } from 'vitest'
import { assertSafeToReset } from '../../e2e/db-reset-guard'

const refuses = (url: string | undefined, pattern: RegExp) =>
  expect(() => assertSafeToReset(url)).toThrow(pattern)

describe('assertSafeToReset', () => {
  it('accepts the local dev database on localhost', () => {
    const target = assertSafeToReset('postgres://postgres:postgres@localhost:5432/burger_page_dev')
    expect(target).toMatchObject({ host: 'localhost', port: 5432, database: 'burger_page_dev' })
  })

  it('accepts the test database on 127.0.0.1 and the postgresql scheme', () => {
    const target = assertSafeToReset('postgresql://u:p@127.0.0.1:5433/burger_page_test')
    expect(target).toMatchObject({ host: '127.0.0.1', port: 5433, database: 'burger_page_test' })
  })

  it('accepts the IPv6 loopback ::1', () => {
    const target = assertSafeToReset('postgres://u:p@[::1]:5432/burger_page_dev')
    expect(target.database).toBe('burger_page_dev')
  })

  it('defaults the port to 5432', () => {
    expect(assertSafeToReset('postgres://u:p@localhost/burger_page_test').port).toBe(5432)
  })

  it('refuses a missing or empty URL', () => {
    refuses(undefined, /no database url/i)
    refuses('', /no database url/i)
    refuses('   ', /no database url/i)
  })

  it('refuses an unparseable URL', () => {
    refuses('not a url', /not a valid url/i)
  })

  it('refuses a non-postgres protocol', () => {
    refuses('mysql://u:p@localhost:5432/burger_page_dev', /protocol/i)
    refuses('http://localhost:5432/burger_page_dev', /protocol/i)
  })

  it('refuses remote hosts', () => {
    refuses('postgres://u:p@db.example.com:5432/burger_page_dev', /host/i)
    refuses('postgres://u:p@10.0.0.5:5432/burger_page_dev', /host/i)
    refuses('postgres://u:p@localhost.evil.com:5432/burger_page_dev', /host/i)
  })

  it('refuses Supabase and pooler hosts', () => {
    refuses('postgres://u:p@db.abcdefgh.supabase.co:5432/burger_page_dev', /host|cloud/i)
    refuses('postgres://u:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres', /host|cloud/i)
    refuses('postgres://u:p@x.amazonaws.com:5432/burger_page_dev', /host|cloud/i)
    refuses('postgres://u:p@x.onrender.com:5432/burger_page_dev', /host|cloud/i)
  })

  it('refuses a cloud marker even when the host is local (tunnels, user names)', () => {
    refuses('postgres://postgres.projref:p@localhost:5432/burger_page_dev?options=supabase', /cloud/i)
  })

  it('refuses sslmode=require', () => {
    refuses('postgres://u:p@localhost:5432/burger_page_dev?sslmode=require', /sslmode/i)
  })

  it('refuses databases outside the allowlist', () => {
    refuses('postgres://u:p@localhost:5432/postgres', /allowlist/i)
    refuses('postgres://u:p@localhost:5432/production', /allowlist/i)
    refuses('postgres://u:p@localhost:5432/burger_page_dev_copy', /allowlist/i)
    refuses('postgres://u:p@localhost:5432/', /allowlist/i)
  })
})
