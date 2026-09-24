import { Order, OrderStatus } from '../../models/Order.js';
import { UserRole } from '../../models/User.js';
import { ListOptions } from './ListOptions.js';

export interface OrderRepository {
  findById(id: string, restaurantId: string): Promise<Order | null>;
  findByRestaurantId(restaurantId: string, options?: ListOptions): Promise<Order[]>;
  /** Tenant-scoped total count for pagination (optional so test fakes may omit it). */
  countByRestaurantId?(restaurantId: string): Promise<number>;
  save(order: Order): Promise<void>;
  updateStatus(id: string, status: OrderStatus, restaurantId: string, actorId?: string, actorRole?: UserRole, expectedStatus?: OrderStatus): Promise<void>;
  updateReceipt(id: string, receiptUrl: string, restaurantId: string): Promise<void>;
  delete(id: string, restaurantId: string): Promise<void>;
  update(order: Order, restaurantId: string): Promise<Order>;
}
