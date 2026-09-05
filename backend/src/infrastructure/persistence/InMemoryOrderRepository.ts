import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { Order, OrderStatus } from '../../domain/models/Order.js';
import { initialOrders } from './seedData.js';

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
    return order;
  }

  async findByRestaurantId(restaurantId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter((o) => o.restaurantId === restaurantId);
  }

  async save(order: Order): Promise<void> {
    this.orders.set(order.id, order);
  }

  async updateStatus(id: string, status: OrderStatus, restaurantId: string, _actorId?: string): Promise<void> {
    const order = await this.findById(id, restaurantId);
    if (!order) {
      throw new Error(`Order ${id} not found for restaurant ${restaurantId}`);
    }
    order.status = status;
  }

  async updateReceipt(id: string, receiptUrl: string, restaurantId: string): Promise<void> {
    const order = await this.findById(id, restaurantId);
    if (!order) {
      throw new Error(`Order ${id} not found for restaurant ${restaurantId}`);
    }
    order.receiptUrl = receiptUrl;
  }

  clear(): void {
    this.orders.clear();
  }
}
