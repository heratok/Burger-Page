import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { Order, OrderStatus } from '../../domain/models/Order.js';
import { UserRole } from '../../domain/models/User.js';
import { ListOptions } from '../../domain/ports/out/ListOptions.js';
import { initialOrders } from './seedData.js';
import { EntityNotFoundError, InvalidOrderStateError } from '../../domain/errors/DomainErrors.js';

// The repository owns its persisted state: reads return a shallow copy so a
// domain mutation on a fetched snapshot (e.g. transitionTo in the status use
// case) never leaks into the store before an explicit write-back. This is the
// same isolation the Pg/Sqlite/Supabase drivers have between the rows they
// return and the persisted row — without it, the status CAS below would see
// the domain-mutated status as the persisted status and raise false
// concurrency errors on the normal single-writer path.
function cloneOrder(order: Order): Order {
  const copy = new Order(
    order.id,
    order.restaurantId,
    order.customerId,
    order.items,
    order.status,
    order.createdAt,
    order.deliveryFee,
    order.orderNumber,
    order.paymentMethod,
    order.paymentAmount,
    order.changeAmount,
    order.comment,
    order.receiptUrl,
    order.clientOrderId
  );
  if (order.customer) {
    copy.customer = order.customer;
  }
  return copy;
}

export class InMemoryOrderRepository implements OrderRepository {
  private orders: Map<string, Order> = new Map();

  constructor() {
    for (const o of initialOrders) {
      this.orders.set(o.id, o);
    }
  }

  async findById(id: string, restaurantId: string): Promise<Order | null> {
    const order = this.orders.get(id);
    if (!order || order.restaurantId !== restaurantId) return null;
    return cloneOrder(order);
  }

  async findByRestaurantId(restaurantId: string, options?: ListOptions): Promise<Order[]> {
    const filtered = Array.from(this.orders.values()).filter((o) => o.restaurantId === restaurantId);
    const limit = options?.limit;
    if (typeof limit === 'number' && Number.isInteger(limit) && limit > 0) {
      const page = options?.page && Number.isInteger(options.page) && options.page >= 1 ? options.page : 1;
      const start = (page - 1) * limit;
      return filtered.slice(start, start + limit);
    }
    return filtered;
  }

  async countByRestaurantId(restaurantId: string): Promise<number> {
    return Array.from(this.orders.values()).filter((o) => o.restaurantId === restaurantId).length;
  }

  async save(order: Order): Promise<void> {
    // SUS-19 idempotent replay: a retried save carrying the same
    // (restaurantId, clientOrderId) as an existing order must not create a
    // duplicate sale — the first persisted order already represents it.
    if (order.clientOrderId) {
      const existing = Array.from(this.orders.values()).find(
        (o) => o.restaurantId === order.restaurantId && o.clientOrderId === order.clientOrderId
      );
      if (existing) {
        // SUS-19 replay: adopt the originally persisted identity so the
        // returned order (and the HTTP response) references the real row,
        // never a freshly generated phantom id.
        (order as any).id = existing.id;
        (order as any).orderNumber = existing.orderNumber;
        return;
      }
    }
    this.orders.set(order.id, order);
  }

  async updateStatus(id: string, status: OrderStatus, restaurantId: string, _actorId?: string, _actorRole?: UserRole, expectedStatus?: OrderStatus): Promise<void> {
    const order = await this.findById(id, restaurantId);
    if (!order) {
      throw new EntityNotFoundError(`Order ${id} not found for restaurant ${restaurantId}`);
    }
    // M1 CAS — identical semantics to the Pg/Sqlite/Supabase drivers: only
    // apply the transition when the persisted status still equals the snapshot
    // the domain validated. Because findById returns a copy, the stored status
    // is untouched by the domain's transitionTo, so a legitimate single-writer
    // update passes the CAS and a genuine concurrent write raises the
    // concurrency DomainError (delivered -> cooking / cancel after delivery).
    if (expectedStatus !== undefined && expectedStatus !== null && order.status !== expectedStatus) {
      throw new InvalidOrderStateError(`Order status changed concurrently for order ${id}`);
    }
    order.status = status;
    // Write back the mutated snapshot (findById returns copies). The Order
    // model has no updatedAt field, so only status is persisted here.
    this.orders.set(order.id, order);
  }

  async updateReceipt(id: string, receiptUrl: string, restaurantId: string): Promise<void> {
    const order = await this.findById(id, restaurantId);
    if (!order) {
      throw new EntityNotFoundError(`Order ${id} not found for restaurant ${restaurantId}`);
    }
    order.receiptUrl = receiptUrl;
    // Write back the mutated snapshot (findById returns copies).
    this.orders.set(order.id, order);
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    const order = await this.findById(id, restaurantId);
    if (!order) {
      throw new EntityNotFoundError(`Order ${id} not found for restaurant ${restaurantId}`);
    }
    this.orders.delete(id);
  }

  async update(order: Order, restaurantId: string): Promise<Order> {
    const existing = await this.findById(order.id, restaurantId);
    if (!existing) {
      throw new EntityNotFoundError(`Order ${order.id} not found for restaurant ${restaurantId}`);
    }
    this.orders.set(order.id, order);
    return order;
  }

  clear(): void {
    this.orders.clear();
  }
}
