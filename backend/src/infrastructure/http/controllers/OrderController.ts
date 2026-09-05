import { FastifyRequest, FastifyReply } from 'fastify';
import { ListOrdersUseCase } from '../../../application/use-cases/ListOrdersUseCase.js';
import { GetOrderByIdUseCase } from '../../../application/use-cases/GetOrderByIdUseCase.js';
import { CreateOrderUseCase } from '../../../application/use-cases/CreateOrderUseCase.js';
import { UpdateOrderStatusUseCase } from '../../../application/use-cases/UpdateOrderStatusUseCase.js';
import { createOrderSchema, updateOrderStatusSchema } from '@burger-page/contracts';
import { UnauthorizedError, ValidationError } from '../../../domain/errors/DomainErrors.js';
import { CreateOrderDTO, UpdateOrderStatusDTO } from '../../../application/dtos/index.js';
import { globalOrderEventBus } from '../../events/OrderEventBus.js';

export class OrderController {
  constructor(
    private listOrdersUseCase: ListOrdersUseCase,
    private getOrderByIdUseCase: GetOrderByIdUseCase,
    private createOrderUseCase: CreateOrderUseCase,
    private updateOrderStatusUseCase: UpdateOrderStatusUseCase
  ) {}

  async list(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = req.authContext?.restaurantId;
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to list orders.');
    }
    const orders = await this.listOrdersUseCase.execute(restaurantId);
    return reply.status(200).send(orders);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const restaurantId = req.authContext?.restaurantId;
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to fetch an order.');
    }
    const order = await this.getOrderByIdUseCase.execute(params.id, restaurantId);
    return reply.status(200).send(order);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    const order = await this.createOrderUseCase.execute(parsed.data as CreateOrderDTO);

    // Publish SSE Real-time Event with tenant ID
    globalOrderEventBus.publish({
      eventType: 'ORDER_CREATED',
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      timestamp: new Date().toISOString(),
      payload: {
        id: order.id,
        restaurantId: order.restaurantId,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        items: order.items,
        status: order.status,
        createdAt: order.createdAt,
        deliveryFee: order.deliveryFee,
        subtotal: order.subtotal,
        finalTotal: order.finalTotal,
        total: order.total,
      },
    });

    return reply.status(201).send(order);
  }

  async updateStatus(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const restaurantId = req.authContext?.restaurantId;
    const actorId = req.authContext?.userId;
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to update order status.');
    }

    const parsed = updateOrderStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const updatedOrder = await this.updateOrderStatusUseCase.execute(
      params.id,
      parsed.data as UpdateOrderStatusDTO,
      restaurantId,
      actorId
    );

    // Publish SSE Real-time Event with tenant ID
    globalOrderEventBus.publish({
      eventType: 'ORDER_STATUS_UPDATED',
      orderId: params.id,
      orderNumber: updatedOrder.orderNumber,
      status: parsed.data.status,
      timestamp: new Date().toISOString(),
      payload: {
        id: updatedOrder.id,
        restaurantId: updatedOrder.restaurantId,
        orderNumber: updatedOrder.orderNumber,
        customerId: updatedOrder.customerId,
        items: updatedOrder.items,
        status: updatedOrder.status,
        createdAt: updatedOrder.createdAt,
        deliveryFee: updatedOrder.deliveryFee,
        subtotal: updatedOrder.subtotal,
        finalTotal: updatedOrder.finalTotal,
        total: updatedOrder.total,
      },
    });

    return reply.status(200).send(updatedOrder);
  }
}
