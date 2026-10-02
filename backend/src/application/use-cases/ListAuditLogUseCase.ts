import { AuditLogFilter, AuditLogPage } from '../../domain/models/AuditLogEntry.js';
import { AuditLogRepository } from '../../domain/ports/out/AuditLogRepository.js';
import { decodeAuditCursor } from '../../domain/shared/auditCursor.js';

/** Reads the super admin audit trail, newest first. */
export class ListAuditLogUseCase {
  constructor(private readonly repo: AuditLogRepository) {}

  async execute(filter: AuditLogFilter): Promise<AuditLogPage> {
    // Fail with a 400 before touching storage when the cursor is garbage.
    if (filter.cursor) decodeAuditCursor(filter.cursor);
    return this.repo.list(filter);
  }
}
