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
import { assertWithinManagerPermissions } from '../../../application/use-cases/userGuards.js';
import { ForbiddenError } from '../../../domain/errors/DomainErrors.js';

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

  /**
   * Staff delegated roles.manage must not escalate: they can only grant
   * permissions they hold, and cannot edit or delete the role they hold
   * themselves. Administrators (full catalog, no roleId) are unaffected.
   */
  private assertNoEscalation(req: FastifyRequest, permissions: readonly string[] | undefined, roleId?: string): void {
    const auth = req.authContext;
    if (!auth || auth.role !== 'restaurant_staff') return;
    if (roleId && roleId === auth.roleId) {
      throw new ForbiddenError('You cannot modify the role you hold');
    }
    if (permissions) {
      assertWithinManagerPermissions(
        { userId: auth.userId, role: auth.role, restaurantId: auth.restaurantId, permissions: auth.permissions },
        permissions,
        'The role'
      );
    }
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
    this.assertNoEscalation(req, input.permissions);
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
    this.assertNoEscalation(req, input.permissions, params.id);
    const role = await this.updateRoleUseCase.execute(params.id, restaurantId, input, auditActorOf(req));
    return reply.status(200).send(role);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await this.tenantFor(req, 'delete a role', true);
    const params = req.params as { id: string };
    this.assertNoEscalation(req, undefined, params.id);
    await this.deleteRoleUseCase.execute(params.id, restaurantId, auditActorOf(req));
    return reply.status(204).send();
  }
}
