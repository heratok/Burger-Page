import { describe, it, expect } from 'vitest';
import { diffFields, sanitizeAuditDetails } from '../../../src/domain/shared/auditDetails.js';
import { decodeAuditCursor, encodeAuditCursor } from '../../../src/domain/shared/auditCursor.js';
import { ValidationError } from '../../../src/domain/errors/DomainErrors.js';

describe('sanitizeAuditDetails', () => {
  it('drops secret keys at any depth, case-insensitively', () => {
    const out = sanitizeAuditDetails({
      password: 'p1',
      adminPassword: 'p2',
      temporaryPassword: 'p3',
      passwordHash: 'h',
      password_hash: 'h',
      token: 't',
      Authorization: 'Bearer x',
      secret: 's',
      nested: { newPassword: 'x', ok: 'keep', deep: [{ apiKey: 'k', fine: 1 }] },
      slug: 'keep-me',
    });
    expect(out).toEqual({ nested: { ok: 'keep', deep: [{ fine: 1 }] }, slug: 'keep-me' });
    expect(JSON.stringify(out)).not.toMatch(/p1|p2|p3|Bearer|"h"/);
  });

  it('keeps changed field NAMES even when a name looks secret (names are values, not keys)', () => {
    expect(sanitizeAuditDetails({ changedFields: ['adminPassword', 'name'] })).toEqual({
      changedFields: ['adminPassword', 'name'],
    });
  });

  it('truncates long strings, caps depth and tolerates non-JSON values', () => {
    const out = sanitizeAuditDetails({ long: 'x'.repeat(2000), when: new Date('2026-01-01T00:00:00.000Z'), u: undefined, f: () => 1 });
    expect((out.long as string).length).toBeLessThanOrEqual(501);
    expect(out.when).toBe('2026-01-01T00:00:00.000Z');
    expect('u' in out).toBe(false);
    expect('f' in out).toBe(false);
    const deep: any = { a: { b: { c: { d: { e: { f: { g: 1 } } } } } } };
    expect(JSON.stringify(sanitizeAuditDetails(deep))).not.toContain('"g"');
  });

  it('returns an empty object for undefined', () => {
    expect(sanitizeAuditDetails(undefined)).toEqual({});
  });
});

describe('diffFields', () => {
  it('reports only changed fields with before/after for scalars and names for objects', () => {
    const before = { name: 'A', slug: 'a', schedule: [1], isActive: true, same: 1 };
    const after = { name: 'B', slug: 'a', schedule: [2], isActive: true, same: 1 };
    expect(diffFields(before, after, ['name', 'slug', 'schedule', 'isActive', 'same'])).toEqual({
      changedFields: ['name', 'schedule'],
      changes: { name: { from: 'A', to: 'B' } },
    });
  });

  it('returns no changes for identical records', () => {
    expect(diffFields({ a: 1 }, { a: 1 }, ['a'])).toEqual({ changedFields: [], changes: {} });
  });
});

describe('audit cursor', () => {
  it('round-trips and rejects garbage', () => {
    const c = encodeAuditCursor({ createdAt: '2026-01-01T00:00:00.000Z', id: 'aud_1' });
    expect(decodeAuditCursor(c)).toEqual({ createdAt: '2026-01-01T00:00:00.000Z', id: 'aud_1' });
    expect(() => decodeAuditCursor('not-a-cursor')).toThrow(ValidationError);
    expect(() => decodeAuditCursor(Buffer.from('{"x":1}').toString('base64url'))).toThrow(ValidationError);
  });
});
