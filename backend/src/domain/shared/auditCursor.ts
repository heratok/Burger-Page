import { ValidationError } from '../errors/DomainErrors.js';

export interface AuditCursor {
  createdAt: string;
  id: string;
}

/** Opaque keyset position: the (createdAt, id) of the last row of a page. */
export function encodeAuditCursor(cursor: AuditCursor): string {
  return Buffer.from(JSON.stringify({ t: cursor.createdAt, i: cursor.id })).toString('base64url');
}

// A cursor timestamp is compared in SQL as timestamptz: anything Date.parse
// tolerates but Postgres rejects ("2026", "Jan 1 2026") would become a 500.
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

export function decodeAuditCursor(raw: string): AuditCursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (
      typeof parsed?.t === 'string' &&
      typeof parsed?.i === 'string' &&
      ISO_TIMESTAMP.test(parsed.t) &&
      !Number.isNaN(Date.parse(parsed.t))
    ) {
      return { createdAt: parsed.t, id: parsed.i };
    }
  } catch {
    // fall through to the validation error
  }
  throw new ValidationError('Invalid audit log cursor');
}
