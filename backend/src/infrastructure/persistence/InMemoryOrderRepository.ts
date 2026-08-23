import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { Order } from '../../domain/models/Order.js';
import { initialOrders } from './seedData.js';

export class InMemoryOrderRepository implements OrderRepository {
  private orders: Map<string, Order> = new Map();

  constructor() {
    for (const o of initialOrders) {
      this.orders.set(o.id, o);
    }
  }

  async findById(id: string): Promise<Order | null> {
    return this.orders.get(id) || null;
  }

  async findAll(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async save(order: Order): Promise<void> {
    this.orders.set(order.id, order);
  }
}
