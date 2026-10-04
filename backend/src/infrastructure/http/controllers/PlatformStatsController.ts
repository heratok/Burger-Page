import { FastifyRequest, FastifyReply } from 'fastify';
import { platformStatsQuerySchema } from '@burger-page/contracts';
import { GetPlatformStatsUseCase } from '../../../application/use-cases/GetPlatformStatsUseCase.js';
import { ValidationError } from '../../../domain/errors/DomainErrors.js';

export class PlatformStatsController {
  constructor(private readonly getPlatformStats: GetPlatformStatsUseCase) {}

  async get(req: FastifyRequest, reply: FastifyReply) {
    const parsed = platformStatsQuerySchema.safeParse(req.query ?? {});
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    return reply.status(200).send(await this.getPlatformStats.execute(parsed.data));
  }
}
