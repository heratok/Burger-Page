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
      orderNumber: order.orderNumber,
      status: order.status,
      timestamp: new Date().toISOString(),
      payload: {
        id: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        items: order.items,
        status: order.status,
        createdAt: order.createdAt,
        deliveryFee: order.deliveryFee,
        subtotal: order.subtotal,
        total: order.total,
      },
    });

    return reply.status(201).send(order);
  }

  async updateStatus(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parsed = updateOrderStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    const updatedOrder = await this.updateOrderStatus.execute(req.params.id, parsed.data as UpdateOrderStatusDTO);

    // Publish SSE Real-time Event
    globalOrderEventBus.publish({
      eventType: 'ORDER_STATUS_UPDATED',
      orderId: req.params.id,
      orderNumber: updatedOrder.orderNumber,
      status: parsed.data.status,
      timestamp: new Date().toISOString(),
      payload: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        customerId: updatedOrder.customerId,
        items: updatedOrder.items,
        status: updatedOrder.status,
        createdAt: updatedOrder.createdAt,
        deliveryFee: updatedOrder.deliveryFee,
        subtotal: updatedOrder.subtotal,
        total: updatedOrder.total,
      },
    });

    return reply.status(200).send(updatedOrder);
  }
}
