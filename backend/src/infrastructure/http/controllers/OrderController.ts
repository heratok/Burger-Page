import { FastifyRequest, FastifyReply } from 'fastify';
import { ListOrdersUseCase } from '../../../application/use-cases/ListOrdersUseCase.js';
import { GetOrderByIdUseCase } from '../../../application/use-cases/GetOrderByIdUseCase.js';
import { CreateOrderUseCase } from '../../../application/use-cases/CreateOrderUseCase.js';
import { UpdateOrderStatusUseCase } from '../../../application/use-cases/UpdateOrderStatusUseCase.js';
import { UpdateOrderReceiptUseCase } from '../../../application/use-cases/UpdateOrderReceiptUseCase.js';
import { DeleteOrderUseCase } from '../../../application/use-cases/DeleteOrderUseCase.js';
import { UpdateOrderUseCase } from '../../../application/use-cases/UpdateOrderUseCase.js';
import { createOrderSchema, updateOrderStatusSchema, updateOrderReceiptSchema, updateOrderSchema } from '@burger-page/contracts';
import { RestaurantRepository } from '../../../domain/ports/out/RestaurantRepository.js';
import { UnauthorizedError, ValidationError } from '../../../domain/errors/DomainErrors.js';
import { CreateOrderDTO, UpdateOrderStatusDTO, UpdateOrderReceiptDTO, UpdateOrderDTO } from '../../../application/dtos/index.js';
import { globalOrderEventBus } from '../../events/OrderEventBus.js';
import { JwtService } from '../../security/JwtService.js';

export class OrderController {
  constructor(
    private readonly listOrdersUseCase: ListOrdersUseCase,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly updateOrderStatusUseCase: UpdateOrderStatusUseCase,
    private readonly updateOrderReceiptUseCase?: UpdateOrderReceiptUseCase,
    private readonly restaurantRepo?: RestaurantRepository,
    private readonly deleteOrderUseCase?: DeleteOrderUseCase,
    private readonly updateOrderUseCase?: UpdateOrderUseCase,
    private readonly jwtService: JwtService = new JwtService()
  ) {}

  /**
   * Mints a short-lived token restricted to the SSE stream. Full session JWTs
   * must never appear in query strings; EventSource cannot set headers, so the
   * browser receives this scoped token instead.
   */
  issueStreamToken(
    user: { userId: string; username: string; role: string; restaurantId?: string; scope?: string },
    ttlSeconds: number
  ): string {
    return this.jwtService.generateToken(
      {
        id: user.userId,
        username: user.username,
        role: user.role as 'super_admin' | 'restaurant_admin',
        restaurantId: user.restaurantId,
        scope: user.scope,
      },
      ttlSeconds
    );
  }

  private async resolveRestaurantId(req: FastifyRequest, options: { mutation?: boolean } = {}): Promise<string> {
    let restaurantId = req.authContext?.restaurantId;
    if (!restaurantId && req.authContext?.role === 'super_admin') {
      const query = (req.query || {}) as any;
      const body = (req.body || {}) as any;
      const headers = (req.headers || {}) as any;
      restaurantId =
        query?.restaurantId ||
        body?.restaurantId ||
        headers?.['x-restaurant-id'];

      // Mutations must never default to an arbitrary tenant (JD-INFO-02): a
      // super admin without an explicit tenant gets undefined and the caller
      // rejects the request. Reads may keep the first-active fallback.
      if (!restaurantId && !options.mutation && this.restaurantRepo) {
        const all = await this.restaurantRepo.findAll();
        const active = all.find((r) => r.isActive);
        if (active) restaurantId = active.id;
      }
    }

    if (restaurantId && this.restaurantRepo) {
      const rest =
        (await this.restaurantRepo.findById(restaurantId)) ||
        (await this.restaurantRepo.findBySlug(restaurantId)) ||
        (await this.restaurantRepo.findBySlug(restaurantId.replace(/^rest-/, ''))) ||
        (await this.restaurantRepo.findById(restaurantId.replace(/^rest-/, '')));
      if (rest) {
        return rest.id;
      }
    }

    return restaurantId || '';
  }

  async list(req: FastifyRequest, reply: FastifyReply) {
    const restaurantId = await this.resolveRestaurantId(req);
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to list orders.');
    }
    const orders = await this.listOrdersUseCase.execute(restaurantId);
    return reply.status(200).send(orders);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const restaurantId = await this.resolveRestaurantId(req);
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
    // H1/A4: a storefront order only carries staff privileges when the
    // authenticated session actually targets its own tenant (or an
    // authenticated super admin explicitly targets a tenant). Any mismatch
    // degrades the call to a public guest, so fee waivers and CRM profile
    // updates can never cross tenant boundaries.
    const bodyRestaurantId = (req.body as any)?.restaurantId;
    const ctx = req.authContext;
    const isStaffForTarget = Boolean(ctx) &&
      Boolean(ctx!.role === 'super_admin' || (ctx!.restaurantId && ctx!.restaurantId === bodyRestaurantId));
    const order = await this.createOrderUseCase.execute(parsed.data as CreateOrderDTO, {
      authenticated: isStaffForTarget,
    });

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
        customer: (order as any).customer,
        items: order.items,
        status: order.status,
        createdAt: order.createdAt,
        deliveryFee: order.deliveryFee,
        subtotal: order.subtotal,
        finalTotal: order.finalTotal,
        total: order.total,
        receiptUrl: order.receiptUrl,
      },
    });

    return reply.status(201).send(order);
  }

  async updateStatus(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const restaurantId = await this.resolveRestaurantId(req, { mutation: true });
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
      actorId,
      req.authContext?.role
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
        receiptUrl: updatedOrder.receiptUrl,
      },
    });

    return reply.status(200).send(updatedOrder);
  }

  async updateReceipt(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const restaurantId = await this.resolveRestaurantId(req, { mutation: true });
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to update order receipt.');
    }

    if (!this.updateOrderReceiptUseCase) {
      throw new Error('UpdateOrderReceiptUseCase is not configured.');
    }

    const parsed = updateOrderReceiptSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const updatedOrder = await this.updateOrderReceiptUseCase.execute(
      params.id,
      parsed.data as UpdateOrderReceiptDTO,
      restaurantId
    );

    // Publish SSE Real-time Event with tenant ID
    globalOrderEventBus.publish({
      eventType: 'ORDER_RECEIPT_UPDATED',
      orderId: params.id,
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.status,
      timestamp: new Date().toISOString(),
      payload: {
        id: updatedOrder.id,
        restaurantId: updatedOrder.restaurantId,
        orderNumber: updatedOrder.orderNumber,
        receiptUrl: updatedOrder.receiptUrl,
      },
    });

    return reply.status(200).send(updatedOrder);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const restaurantId = await this.resolveRestaurantId(req, { mutation: true });
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to delete an order.');
    }

    if (!this.deleteOrderUseCase) {
      throw new Error('DeleteOrderUseCase is not configured.');
    }

    const deletedOrder = await this.deleteOrderUseCase.execute(params.id, restaurantId);

    // Publish SSE Real-time Event with tenant ID
    globalOrderEventBus.publish({
      eventType: 'ORDER_DELETED',
      orderId: params.id,
      orderNumber: deletedOrder.orderNumber,
      status: deletedOrder.status,
      timestamp: new Date().toISOString(),
      payload: {
        id: deletedOrder.id,
        restaurantId: deletedOrder.restaurantId,
        orderNumber: deletedOrder.orderNumber,
      },
    });

    return reply.status(200).send({
      success: true,
      id: params.id,
      message: 'Orden eliminada correctamente',
    });
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const restaurantId = await this.resolveRestaurantId(req, { mutation: true });
    if (!restaurantId) {
      throw new UnauthorizedError('Restaurant context is required to update an order.');
    }

    if (!this.updateOrderUseCase) {
      throw new Error('UpdateOrderUseCase is not configured.');
    }

    const parsed = updateOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const updatedOrder = await this.updateOrderUseCase.execute(
      params.id,
      parsed.data as UpdateOrderDTO,
      restaurantId
    );

    // Publish SSE Real-time Event with tenant ID
    globalOrderEventBus.publish({
      eventType: 'ORDER_UPDATED',
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.status,
      timestamp: new Date().toISOString(),
      payload: {
        id: updatedOrder.id,
        restaurantId: updatedOrder.restaurantId,
        orderNumber: updatedOrder.orderNumber,
        customerId: updatedOrder.customerId,
        customer: (updatedOrder as any).customer,
        items: updatedOrder.items,
        status: updatedOrder.status,
        createdAt: updatedOrder.createdAt,
        deliveryFee: updatedOrder.deliveryFee,
        subtotal: updatedOrder.subtotal,
        finalTotal: updatedOrder.finalTotal,
        total: updatedOrder.total,
        paymentMethod: updatedOrder.paymentMethod,
        paymentAmount: updatedOrder.paymentAmount,
        changeAmount: updatedOrder.changeAmount,
        comment: updatedOrder.comment,
        receiptUrl: updatedOrder.receiptUrl,
      },
    });

    return reply.status(200).send(updatedOrder);
  }
}
