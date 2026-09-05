import { Order, OrderStatus } from '../../models/Order.js';

export interface OrderRepository {
  findById(id: string, restaurantId: string): Promise<Order | null>;
  findByRestaurantId(restaurantId: string): Promise<Order[]>;
  save(order: Order): Promise<void>;
  updateStatus(id: string, status: OrderStatus, restaurantId: string, actorId?: string): Promise<void>;
  updateReceipt(id: string, receiptUrl: string, restaurantId: string): Promise<void>;
}
