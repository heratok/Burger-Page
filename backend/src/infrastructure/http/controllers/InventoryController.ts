import { FastifyRequest, FastifyReply } from 'fastify';
import { GetInventoryUseCase } from '../../../application/use-cases/GetInventoryUseCase.js';
import { UpdateInventoryStockUseCase } from '../../../application/use-cases/UpdateInventoryStockUseCase.js';
import { updateInventoryStockSchema } from '@burger-page/contracts';
import { ValidationError } from '../../../domain/errors/DomainErrors.js';

export class InventoryController {
  constructor(
    private getInventoryUseCase: GetInventoryUseCase,
    private updateInventoryStockUseCase: UpdateInventoryStockUseCase
  ) {}

  async list(req: FastifyRequest, reply: FastifyReply) {
    const inventory = await this.getInventoryUseCase.execute();
    const mapped = inventory.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category || 'ingredients',
      currentStock: item.quantity,
      quantity: item.quantity,
      minStockAlert: item.minStockAlert ?? item.alertThreshold,
      alertThreshold: item.alertThreshold,
      unit: item.unit,
      costPerUnit: item.costPerUnit || 0
    }));
    return reply.status(200).send(mapped);
  }

  async updateStock(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parsed = updateInventoryStockSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    const updated = await this.updateInventoryStockUseCase.execute(req.params.id, parsed.data.quantityChange);
    return reply.status(200).send({
      id: updated.id,
      currentStock: updated.quantity,
      message: 'Stock updated successfully'
    });
  }
}
