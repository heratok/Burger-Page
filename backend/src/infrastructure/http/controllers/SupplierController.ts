import { FastifyRequest, FastifyReply } from 'fastify';
import { ListSuppliersUseCase } from '../../../application/use-cases/ListSuppliersUseCase.js';
import { CreateSupplierUseCase } from '../../../application/use-cases/CreateSupplierUseCase.js';
import { UpdateSupplierUseCase } from '../../../application/use-cases/UpdateSupplierUseCase.js';
import { DeleteSupplierUseCase } from '../../../application/use-cases/DeleteSupplierUseCase.js';
import { RestaurantRepository } from '../../../domain/ports/out/RestaurantRepository.js';
import { UnauthorizedError, ValidationError } from '../../../domain/errors/DomainErrors.js';
import { resolveTenantForRequest } from '../TenantResolver.js';
import { createSupplierSchema, updateSupplierSchema } from '@burger-page/contracts';

export class SupplierController {
  constructor(
    private listSuppliersUseCase: ListSuppliersUseCase,
    private createSupplierUseCase: CreateSupplierUseCase,
    private updateSupplierUseCase: UpdateSupplierUseCase,
    private deleteSupplierUseCase: DeleteSupplierUseCase,
    private restaurantRepo?: RestaurantRepository
  ) {}

  async list(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await resolveTenantForRequest(req, { restaurantRepo: this.restaurantRepo });
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to list suppliers.');
    }
    const suppliers = await this.listSuppliersUseCase.execute(restaurantId);
    return reply.status(200).send(suppliers);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await resolveTenantForRequest(req, { restaurantRepo: this.restaurantRepo }, { mutation: true });
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to create a supplier.');
    }
    const parseResult = createSupplierSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
    }
    const supplier = await this.createSupplierUseCase.execute(restaurantId, parseResult.data);
    return reply.status(201).send(supplier);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await resolveTenantForRequest(req, { restaurantRepo: this.restaurantRepo }, { mutation: true });
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to update a supplier.');
    }
    const params = req.params as { id: string };
    const parseResult = updateSupplierSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
    }
    const supplier = await this.updateSupplierUseCase.execute(params.id, restaurantId, parseResult.data);
    return reply.status(200).send(supplier);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await resolveTenantForRequest(req, { restaurantRepo: this.restaurantRepo }, { mutation: true });
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to delete a supplier.');
    }
    const params = req.params as { id: string };
    await this.deleteSupplierUseCase.execute(params.id, restaurantId);
    return reply.status(204).send();
  }
}
