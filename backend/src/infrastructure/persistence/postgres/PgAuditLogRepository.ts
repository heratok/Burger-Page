import { AuditLogEntry, AuditLogFilter, AuditLogPage } from '../../../domain/models/AuditLogEntry.js';
import { AuditLogRepository } from '../../../domain/ports/out/AuditLogRepository.js';
import { decodeAuditCursor, encodeAuditCursor } from '../../../domain/shared/auditCursor.js';
import { withTenantContext } from './PgClient.js';

function mapRow(row: any): AuditLogEntry {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    actorUserId: row.actor_user_id ?? null,
    actorUsername: row.actor_username,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    targetLabel: row.target_label,
    restaurantId: row.restaurant_id ?? null,
    details: row.details ?? {},
  };
}

// The trail is platform data: RLS only lets a super_admin session read or
// append, so both operations run under that role. The caller (use case /
// route guard) is what decides who may get here.
const PLATFORM = { restaurantId: null, actorRole: 'super_admin' as const };

/**
 * Append-only: there is intentionally no update or delete method, and the
 * database grants app_user only SELECT and INSERT on the table.
 */
export class PgAuditLogRepository implements AuditLogRepository {
  async record(entry: AuditLogEntry): Promise<void> {
    await withTenantContext({ ...PLATFORM, actor: entry.actorUsername }, async (client) => {
      await client.query(
        `INSERT INTO public.admin_audit_log
           (id, created_at, actor_user_id, actor_username, action, target_type, target_id, target_label, restaurant_id, details)
         VALUES ($1, $2::timestamptz, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
        [
          entry.id,
          entry.createdAt,
          entry.actorUserId,
          entry.actorUsername,
          entry.action,
          entry.targetType,
          entry.targetId,
          entry.targetLabel,
          entry.restaurantId,
          JSON.stringify(entry.details ?? {}),
        ]
      );
    });
  }

  async list(filter: AuditLogFilter): Promise<AuditLogPage> {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: (n: number) => string, value: unknown) => {
      params.push(value);
      where.push(sql(params.length));
    };

    if (filter.action) add((n) => `action = $${n}`, filter.action);
    if (filter.restaurantId) add((n) => `restaurant_id = $${n}`, filter.restaurantId);
    if (filter.actorUserId) add((n) => `actor_user_id = $${n}`, filter.actorUserId);
    if (filter.from) add((n) => `created_at >= $${n}::timestamptz`, filter.from);
    if (filter.to) add((n) => `created_at <= $${n}::timestamptz`, filter.to);
    if (filter.cursor) {
      const c = decodeAuditCursor(filter.cursor);
      params.push(c.createdAt, c.id);
      where.push(`(created_at, id) < ($${params.length - 1}::timestamptz, $${params.length})`);
    }
    // One extra row tells whether another page exists without a COUNT.
    params.push(filter.limit + 1);

    const sql = `SELECT * FROM public.admin_audit_log
                 ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                 ORDER BY created_at DESC, id DESC
                 LIMIT $${params.length}`;
    const rows = await withTenantContext(PLATFORM, async (client) => (await client.query(sql, params)).rows);

    const page = rows.slice(0, filter.limit).map(mapRow);
    const last = page[page.length - 1];
    return {
      items: page,
      nextCursor: rows.length > filter.limit && last ? encodeAuditCursor({ createdAt: last.createdAt, id: last.id }) : null,
    };
  }
}
