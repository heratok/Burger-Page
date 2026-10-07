import type { AuditAction } from '@burger-page/contracts';

export type { AuditAction };
export type AuditTargetType = 'restaurant' | 'user' | 'role';

/**
 * One immutable record of a super admin mutation. Actor and target are stored
 * as snapshots (username / name) with no foreign keys, so the history survives
 * the deletion of the user or the restaurant it talks about.
 */
export interface AuditLogEntry {
  id: string;
  /** ISO 8601 with millisecond precision (the keyset cursor depends on it). */
  createdAt: string;
  actorUserId: string | null;
  actorUsername: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  targetLabel: string;
  restaurantId: string | null;
  /** Changed field names and non-secret before/after values; never credentials. */
  details: Record<string, unknown>;
}

export interface AuditLogFilter {
  limit: number;
  /** Opaque nextCursor of the previous page. */
  cursor?: string;
  action?: AuditAction;
  restaurantId?: string;
  actorUserId?: string;
  /** Inclusive bounds, ISO 8601. */
  from?: string;
  to?: string;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  nextCursor: string | null;
}
