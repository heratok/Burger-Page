import { ValidationError } from '../errors/DomainErrors.js';

export interface AuditCursor {
  createdAt: string;
  id: string;
}

/** Opaque keyset position: the (createdAt, id) of the last row of a page. */
export function encodeAuditCursor(cursor: AuditCursor): string {
  return Buffer.from(JSON.stringify({ t: cursor.createdAt, i: cursor.id })).toString('base64url');
}

export function decodeAuditCursor(raw: string): AuditCursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (
      typeof parsed?.t === 'string' &&
      typeof parsed?.i === 'string' &&
      !Number.isNaN(Date.parse(parsed.t))
    ) {
      return { createdAt: parsed.t, id: parsed.i };
    }
  } catch {
    // fall through to the validation error
  }
  throw new ValidationError('Invalid audit log cursor');
}
