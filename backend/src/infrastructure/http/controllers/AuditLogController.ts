import { FastifyRequest, FastifyReply } from 'fastify';
import { auditLogQuerySchema } from '@burger-page/contracts';
import { ListAuditLogUseCase } from '../../../application/use-cases/ListAuditLogUseCase.js';
import { ValidationError } from '../../../domain/errors/DomainErrors.js';

export class AuditLogController {
  constructor(private readonly listAuditLog: ListAuditLogUseCase) {}

  async list(req: FastifyRequest, reply: FastifyReply) {
    const parsed = auditLogQuerySchema.safeParse(req.query ?? {});
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    return reply.status(200).send(await this.listAuditLog.execute(parsed.data));
  }
}
