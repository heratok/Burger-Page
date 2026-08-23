import { FastifyRequest, FastifyReply } from 'fastify';
import { ListOrdersUseCase } from '../../../application/use-cases/ListOrdersUseCase.js';
import { GetOrderByIdUseCase } from '../../../application/use-cases/GetOrderByIdUseCase.js';
import { CreateOrderUseCase } from '../../../application/use-cases/CreateOrderUseCase.js';
import { UpdateOrderStatusUseCase } from '../../../application/use-cases/UpdateOrderStatusUseCase.js';
import { createOrderSchema, updateOrderStatusSchema } from '@burger-page/contracts';
import { ValidationError } from '../../../domain/errors/DomainErrors.js';
import { CreateOrderDTO, UpdateOrderStatusDTO } from '../../../application/dtos/index.js';
import { globalOrderEventBus } from '../../events/OrderEventBus.js';

export class OrderController {
  constructor(
    private listOrdersUseCase: ListOrdersUseCase,
    private getOrderById: GetOrderByIdUseCase,
    private createOrderUseCase: CreateOrderUseCase,
    private updateOrderStatus: UpdateOrderStatusUseCase
  ) {}

  async list(req: FastifyRequest, reply: FastifyReply) {
    const orders = await this.listOrdersUseCase.execute();
    return reply.status(200).send(orders);
  }

  async getById(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const order = await this.getOrderById.execute(req.params.id);
    return reply.status(200).send(order);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    const order = await this.createOrderUseCase.execute(parsed.data as CreateOrderDTO);
    
    // Publish SSE Real-time Event
    globalOrderEventBus.publish({
      eventType: 'ORDER_CREATED',
      orderId: order.id,
      status: order.status,
      timestamp: new Date().toISOString(),
    });

    return reply.status(201).send(order);
  }

  async updateStatus(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parsed = updateOrderStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    await this.updateOrderStatus.execute(req.params.id, parsed.data as UpdateOrderStatusDTO);

    // Publish SSE Real-time Event
    globalOrderEventBus.publish({
      eventType: 'ORDER_STATUS_UPDATED',
      orderId: req.params.id,
      status: parsed.data.status,
      timestamp: new Date().toISOString(),
    });

    return reply.status(200).send({ message: 'Order status updated successfully' });
  }
}
