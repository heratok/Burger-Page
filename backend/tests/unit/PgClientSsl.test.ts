import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolvePgSsl } from '../../src/infrastructure/persistence/postgres/PgClient.js';

const remote = 'postgresql://app_user.ref:pw@aws-0-us-west-2.pooler.supabase.com:5432/postgres';
const PEM = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';

describe('resolvePgSsl', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses no TLS for localhost or sslmode=disable', () => {
    expect(resolvePgSsl('postgresql://u:p@localhost:5432/db', {})).toBeUndefined();
    expect(resolvePgSsl(`${remote}?sslmode=disable`, {})).toBeUndefined();
  });

  it('verifies the server certificate against DATABASE_SSL_CA', () => {
    expect(resolvePgSsl(remote, { DATABASE_SSL_CA: PEM })).toEqual({ ca: PEM, rejectUnauthorized: true });
  });

  it('accepts a one-line CA with literal \\n escapes', () => {
    const oneLine = PEM.replace(/\n/g, '\\n');
    expect(resolvePgSsl(remote, { DATABASE_SSL_CA: oneLine })).toEqual({ ca: PEM, rejectUnauthorized: true });
  });

  it('verifies against the system CAs with DATABASE_SSL_VERIFY=true', () => {
    expect(resolvePgSsl(remote, { DATABASE_SSL_VERIFY: 'true' })).toEqual({ rejectUnauthorized: true });
  });

  it('keeps the unverified default and warns in production when nothing is configured', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolvePgSsl(remote, { NODE_ENV: 'production' })).toEqual({ rejectUnauthorized: false });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('NOT verified'));
  });
});
