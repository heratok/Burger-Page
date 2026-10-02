import { FastifyRequest, FastifyReply } from 'fastify';
import { ListRestaurantTablesUseCase } from '../../../application/use-cases/ListRestaurantTablesUseCase.js';
import { CreateRestaurantTableUseCase } from '../../../application/use-cases/CreateRestaurantTableUseCase.js';
import { UpdateRestaurantTableUseCase } from '../../../application/use-cases/UpdateRestaurantTableUseCase.js';
import { DeleteRestaurantTableUseCase } from '../../../application/use-cases/DeleteRestaurantTableUseCase.js';
import { ReorderRestaurantTablesUseCase } from '../../../application/use-cases/ReorderRestaurantTablesUseCase.js';
import { RestaurantRepository } from '../../../domain/ports/out/RestaurantRepository.js';
import { UnauthorizedError, ValidationError } from '../../../domain/errors/DomainErrors.js';
import { resolveTenantForRequest } from '../TenantResolver.js';
import {
  createRestaurantTableSchema,
  updateRestaurantTableSchema,
  reorderRestaurantTablesSchema,
} from '@burger-page/contracts';

export class RestaurantTableController {
  constructor(
    private listTablesUseCase: ListRestaurantTablesUseCase,
    private createTableUseCase: CreateRestaurantTableUseCase,
    private updateTableUseCase: UpdateRestaurantTableUseCase,
    private deleteTableUseCase: DeleteRestaurantTableUseCase,
    private reorderTablesUseCase: ReorderRestaurantTablesUseCase,
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
    const restaurantId = await this.tenantFor(req, 'list tables', false);
    return reply.status(200).send(await this.listTablesUseCase.execute(restaurantId));
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await this.tenantFor(req, 'create a table', true);
    const parsed = createRestaurantTableSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
    }
    const table = await this.createTableUseCase.execute(restaurantId, parsed.data);
    return reply.status(201).send(table);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await this.tenantFor(req, 'update a table', true);
    const params = req.params as { id: string };
    const parsed = updateRestaurantTableSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
    }
    const table = await this.updateTableUseCase.execute(params.id, restaurantId, parsed.data);
    return reply.status(200).send(table);
  }

  async reorder(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await this.tenantFor(req, 'reorder tables', true);
    const parsed = reorderRestaurantTablesSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
    }
    const tables = await this.reorderTablesUseCase.execute(restaurantId, parsed.data.ids);
    return reply.status(200).send(tables);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await this.tenantFor(req, 'delete a table', true);
    const params = req.params as { id: string };
    await this.deleteTableUseCase.execute(params.id, restaurantId);
    return reply.status(204).send();
  }
}
