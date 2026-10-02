import { ID_PREFIX, newId } from '../../domain/shared/newId.js';
import { sanitizeAuditDetails } from '../../domain/shared/auditDetails.js';
import { AuditAction, AuditLogEntry, AuditTargetType } from '../../domain/models/AuditLogEntry.js';
import { AuditLogRepository } from '../../domain/ports/out/AuditLogRepository.js';
import type { UserRole } from '../../domain/models/User.js';

/** Who performed the action, taken from the request auth context. */
export interface AuditActor {
  userId: string;
  username: string;
  role: UserRole;
}

export interface AuditEvent {
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  targetLabel: string;
  restaurantId?: string | null;
  details?: Record<string, unknown>;
}

interface AuditLogger {
  error(message: string, ...rest: unknown[]): void;
}

/**
 * Records super admin mutations. Failure policy: FAIL-OPEN with a loud error.
 *
 * The mutation has already been committed by its own repository transaction
 * when the entry is written (no shared transaction across ports), so failing
 * the request would report an error for a change that happened and invite a
 * retry that duplicates it (a second temporary password, a 409 on create...).
 * Instead the failure is logged at error level with the complete, already
 * sanitized entry so it can be recovered from the logs.
 */
export class AdminAuditRecorder {
  constructor(
    private readonly repo: AuditLogRepository,
    private readonly logger: AuditLogger = console
  ) {}

  async record(actor: AuditActor | undefined, event: AuditEvent): Promise<void> {
    // Only super admin actions are audited; scripts and tenant admins are not.
    if (!actor || actor.role !== 'super_admin') return;
    const entry: AuditLogEntry = {
      id: newId(ID_PREFIX.audit),
      createdAt: new Date().toISOString(),
      actorUserId: actor.userId || null,
      actorUsername: actor.username,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      targetLabel: event.targetLabel,
      restaurantId: event.restaurantId ?? null,
      details: sanitizeAuditDetails(event.details),
    };
    try {
      await this.repo.record(entry);
    } catch (err) {
      this.logger.error('[AUDIT] ACTION NOT RECORDED (audit write failed):', {
        entry,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
