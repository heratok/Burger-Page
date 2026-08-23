import { FastifyRequest, FastifyReply } from 'fastify';
import { GetInventoryUseCase } from '../../../application/use-cases/GetInventoryUseCase.js';
import { UpdateInventoryStockUseCase } from '../../../application/use-cases/UpdateInventoryStockUseCase.js';
import { updateInventoryStockSchema } from '../schemas/inventory.schema.js';
import { ValidationError } from '../../../domain/errors/DomainErrors.js';

export class InventoryController {
  constructor(
    private getInventoryUseCase: GetInventoryUseCase,
    private updateInventoryStockUseCase: UpdateInventoryStockUseCase
  ) {}

  async list(req: FastifyRequest, reply: FastifyReply) {
    const inventory = await this.getInventoryUseCase.execute();
    return reply.status(200).send(inventory);
  }

  async updateStock(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parsed = updateInventoryStockSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    await this.updateInventoryStockUseCase.execute(req.params.id, parsed.data.quantityChange);
    return reply.status(200).send({ message: 'Stock updated successfully' });
  }
}
