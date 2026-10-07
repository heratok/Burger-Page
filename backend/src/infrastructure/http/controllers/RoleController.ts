import { FastifyRequest, FastifyReply } from 'fastify';
import { roleCreateSchema, roleUpdateSchema } from '@burger-page/contracts';
import { ListRolesUseCase } from '../../../application/use-cases/ListRolesUseCase.js';
import { CreateRoleUseCase } from '../../../application/use-cases/CreateRoleUseCase.js';
import { UpdateRoleUseCase } from '../../../application/use-cases/UpdateRoleUseCase.js';
import { DeleteRoleUseCase } from '../../../application/use-cases/DeleteRoleUseCase.js';
import { RestaurantRepository } from '../../../domain/ports/out/RestaurantRepository.js';
import { UnauthorizedError, ValidationError } from '../../../domain/errors/DomainErrors.js';
import { resolveTenantForRequest } from '../TenantResolver.js';
import { auditActorOf } from '../auditActor.js';

export class RoleController {
  constructor(
    private listRolesUseCase: ListRolesUseCase,
    private createRoleUseCase: CreateRoleUseCase,
    private updateRoleUseCase: UpdateRoleUseCase,
    private deleteRoleUseCase: DeleteRoleUseCase,
    private restaurantRepo?: RestaurantRepository
  ) {}

  private async tenantFor(req: FastifyRequest, action: string, mutation: boolean): Promise<string> {
    const restaurantId = await resolveTenantForRequest(
      req,
      { restaurantRepo: this.restaurantRepo },
      mutation ? { mutation: true } : {}
    );
    if (!restaurantId) {
      throw new UnauthorizedError(`Restaurant context is required to ${action}.`);
    }
    return restaurantId;
  }

  async list(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await this.tenantFor(req, 'list roles', false);
    return reply.status(200).send(await this.listRolesUseCase.execute(restaurantId));
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await this.tenantFor(req, 'create a role', true);
    const parsed = roleCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
    }
    const { restaurantId: _ignored, ...input } = parsed.data;
    const role = await this.createRoleUseCase.execute(restaurantId, input, auditActorOf(req));
    return reply.status(201).send(role);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await this.tenantFor(req, 'update a role', true);
    const params = req.params as { id: string };
    const parsed = roleUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
    }
    const { restaurantId: _ignored, ...input } = parsed.data;
    const role = await this.updateRoleUseCase.execute(params.id, restaurantId, input, auditActorOf(req));
    return reply.status(200).send(role);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await this.tenantFor(req, 'delete a role', true);
    const params = req.params as { id: string };
    await this.deleteRoleUseCase.execute(params.id, restaurantId, auditActorOf(req));
    return reply.status(204).send();
  }
}
