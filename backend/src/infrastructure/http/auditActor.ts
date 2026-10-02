import { FastifyRequest } from 'fastify';
import type { AuditActor } from '../../application/services/AdminAuditRecorder.js';

/** The authenticated caller as the audit trail's actor (undefined when unauthenticated). */
export function auditActorOf(req: FastifyRequest): AuditActor | undefined {
  const auth = req.authContext;
  return auth ? { userId: auth.userId, username: auth.username, role: auth.role } : undefined;
}
