import { AuditLogEntry, AuditLogFilter, AuditLogPage } from '../../models/AuditLogEntry.js';

/**
 * Append-only store of super admin actions. Deliberately has no update or
 * delete: history is never edited from the application.
 */
export interface AuditLogRepository {
  record(entry: AuditLogEntry): Promise<void>;
  /** Newest first, keyset-paginated on (createdAt, id). */
  list(filter: AuditLogFilter): Promise<AuditLogPage>;
}
