import { SupabaseClient } from '@supabase/supabase-js';
import { Order, OrderStatus, OrderItem } from '../../../domain/models/Order.js';
import { OrderRepository } from '../../../domain/ports/out/OrderRepository.js';

export class SupabaseOrderRepository implements OrderRepository {
  constructor(private client: SupabaseClient) {}

  private mapToDomain(row: any): Order {
    let items: OrderItem[] = [];
    if (Array.isArray(row.items)) {
      items = row.items;
    } else if (typeof row.items === 'string') {
      try {
        items = JSON.parse(row.items);
      } catch {
        items = [];
      }
    }

    return new Order(
      row.id,
      row.customer_id,
      items,
      row.status as OrderStatus,
      new Date(row.created_at),
      Number(row.delivery_fee || 0)
    );
  }

  async findById(id: string): Promise<Order | null> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find order by id: ${error.message}`);
    }
    if (!data) return null;
    return this.mapToDomain(data);
  }

  async findAll(): Promise<Order[]> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list orders: ${error.message}`);
    }
    return (data || []).map((row) => this.mapToDomain(row));
  }

  async save(order: Order): Promise<void> {
    const now = new Date().toISOString();
    const payload = {
      id: order.id,
      order_number: Date.now() % 100000,
      customer_id: order.customerId,
      status: order.status,
      total: order.subtotal,
      delivery_fee: order.deliveryFee,
      final_total: order.total,
      items: order.items,
      created_at: order.createdAt.toISOString(),
      updated_at: now
    };

    const { error } = await this.client
      .from('orders')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      throw new Error(`Failed to save order: ${error.message}`);
    }
  }
}
