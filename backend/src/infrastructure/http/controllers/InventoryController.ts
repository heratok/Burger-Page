import { FastifyRequest, FastifyReply } from 'fastify';
import { ListInventoryUseCase } from '../../../application/use-cases/ListInventoryUseCase.js';
import { GetInventoryItemByIdUseCase } from '../../../application/use-cases/GetInventoryItemByIdUseCase.js';
import { CreateInventoryItemUseCase } from '../../../application/use-cases/CreateInventoryItemUseCase.js';
import { UpdateInventoryStockUseCase } from '../../../application/use-cases/UpdateInventoryStockUseCase.js';
import { UpdateInventoryItemUseCase } from '../../../application/use-cases/UpdateInventoryItemUseCase.js';
import { DeleteInventoryItemUseCase } from '../../../application/use-cases/DeleteInventoryItemUseCase.js';
import { RestaurantRepository } from '../../../domain/ports/out/RestaurantRepository.js';
import { updateInventoryStockSchema } from '@burger-page/contracts';
import { UnauthorizedError, ValidationError } from '../../../domain/errors/DomainErrors.js';
import { resolveTenantForRequest } from '../TenantResolver.js';
import { CreateInventoryItemDTO, UpdateInventoryItemDTO } from '../../../application/dtos/index.js';
import { ListOptions } from '../../../domain/ports/out/ListOptions.js';

/**
 * Lenient pagination parsing: honored only when BOTH page and limit are
 * present valid integers (page >= 1, limit clamped 1..100); anything else is
 * ignored so the request keeps the exact pre-pagination behavior.
 */
function parsePagination(query: unknown): ListOptions | undefined {
  const q = (query ?? {}) as { page?: unknown; limit?: unknown };
  const page = typeof q.page === 'number' ? q.page : Number(q.page);
  const limitRaw = typeof q.limit === 'number' ? q.limit : Number(q.limit);
  if (!Number.isInteger(page) || page < 1) return undefined;
  if (!Number.isInteger(limitRaw) || limitRaw < 1) return undefined;
  return { page, limit: Math.min(limitRaw, 100) };
}

export class InventoryController {
  constructor(
    private listInventoryUseCase: ListInventoryUseCase,
    private updateInventoryStockUseCase: UpdateInventoryStockUseCase,
    private getInventoryItemByIdUseCase?: GetInventoryItemByIdUseCase,
    private createInventoryItemUseCase?: CreateInventoryItemUseCase,
    private updateInventoryItemUseCase?: UpdateInventoryItemUseCase,
    private deleteInventoryItemUseCase?: DeleteInventoryItemUseCase,
    private restaurantRepo?: RestaurantRepository
  ) {}

  async list(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await resolveTenantForRequest(req, { restaurantRepo: this.restaurantRepo });
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to list inventory.');
    }
    const options = parsePagination(req.query);
    const mapItem = (item: any) => ({
      id: item.id,
      restaurantId: item.restaurantId,
      name: item.name,
      category: item.category || 'ingredients',
      currentStock: item.quantity,
      quantity: item.quantity,
      minStockAlert: item.minStockAlert,
      alertThreshold: item.alertThreshold,
      unit: item.unit,
      costPerUnit: item.costPerUnit || 0,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
    if (options) {
      const { items, total } = await this.listInventoryUseCase.execute(restaurantId, options);
      reply.header('X-Total-Count', String(total));
      return reply.status(200).send(items.map((item: any) => mapItem(item)));
    }
    const inventory = await this.listInventoryUseCase.execute(restaurantId);
    const mapped = inventory.map((item) => mapItem(item));
    return reply.status(200).send(mapped);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await resolveTenantForRequest(req, { restaurantRepo: this.restaurantRepo });
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to get inventory item.');
    }
    const params = req.params as { id: string };
    if (!this.getInventoryItemByIdUseCase) {
      throw new ValidationError('GetInventoryItemByIdUseCase not configured.');
    }
    const item = await this.getInventoryItemByIdUseCase.execute(params.id, restaurantId);
    return reply.status(200).send({
      id: item.id,
      restaurantId: item.restaurantId,
      name: item.name,
      category: item.category || 'ingredients',
      currentStock: item.quantity,
      quantity: item.quantity,
      minStockAlert: item.minStockAlert,
      alertThreshold: item.alertThreshold,
      unit: item.unit,
      costPerUnit: item.costPerUnit || 0,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await resolveTenantForRequest(req, { restaurantRepo: this.restaurantRepo }, { mutation: true });
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to create inventory item.');
    }
    const body = req.body as CreateInventoryItemDTO;
    if (!this.createInventoryItemUseCase) {
      throw new ValidationError('CreateInventoryItemUseCase not configured.');
    }
    const item = await this.createInventoryItemUseCase.execute(body, restaurantId);
    return reply.status(201).send({
      id: item.id,
      restaurantId: item.restaurantId,
      name: item.name,
      category: item.category,
      currentStock: item.quantity,
      quantity: item.quantity,
      minStockAlert: item.minStockAlert,
      alertThreshold: item.alertThreshold,
      unit: item.unit,
      costPerUnit: item.costPerUnit,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await resolveTenantForRequest(req, { restaurantRepo: this.restaurantRepo }, { mutation: true });
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to update inventory item.');
    }
    const params = req.params as { id: string };
    const body = req.body as UpdateInventoryItemDTO;
    if (!this.updateInventoryItemUseCase) {
      throw new ValidationError('UpdateInventoryItemUseCase not configured.');
    }
    const item = await this.updateInventoryItemUseCase.execute(params.id, body, restaurantId);
    return reply.status(200).send({
      id: item.id,
      restaurantId: item.restaurantId,
      name: item.name,
      category: item.category,
      currentStock: item.quantity,
      quantity: item.quantity,
      minStockAlert: item.minStockAlert,
      alertThreshold: item.alertThreshold,
      unit: item.unit,
      costPerUnit: item.costPerUnit,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }

  async updateStock(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await resolveTenantForRequest(req, { restaurantRepo: this.restaurantRepo }, { mutation: true });
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to update stock.');
    }
    const params = req.params as { id: string };
    const parsed = updateInventoryStockSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    const updated = await this.updateInventoryStockUseCase.execute(
      params.id,
      parsed.data.quantityChange,
      restaurantId
    );
    return reply.status(200).send({
      id: updated.id,
      restaurantId: updated.restaurantId,
      currentStock: updated.quantity,
      quantity: updated.quantity,
      message: 'Stock updated successfully',
    });
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await resolveTenantForRequest(req, { restaurantRepo: this.restaurantRepo }, { mutation: true });
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to delete inventory item.');
    }
    const params = req.params as { id: string };
    if (!this.deleteInventoryItemUseCase) {
      throw new ValidationError('DeleteInventoryItemUseCase not configured.');
    }
    await this.deleteInventoryItemUseCase.execute(params.id, restaurantId);
    return reply.status(204).send();
  }
}
