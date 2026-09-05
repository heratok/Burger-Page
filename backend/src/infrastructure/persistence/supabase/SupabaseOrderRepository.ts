import { SupabaseClient } from '@supabase/supabase-js';
import { Order, OrderStatus, OrderItem, OrderItemAddition } from '../../../domain/models/Order.js';
import { OrderRepository } from '../../../domain/ports/out/OrderRepository.js';

export class SupabaseOrderRepository implements OrderRepository {
  constructor(private client: SupabaseClient) {}

  private mapToDomain(row: any): Order {
    const rawItems = row.order_items || [];
    const items: OrderItem[] = rawItems.map((itemRow: any) => {
      const rawAdditions = itemRow.order_item_additions || [];
      const additions: OrderItemAddition[] = rawAdditions.map((add: any) => ({
        id: add.id,
        additionId: add.addition_id,
        additionName: add.addition_name,
        unitPrice: Number(add.unit_price || 0),
        quantity: Number(add.quantity || 1),
      }));

      return {
        id: itemRow.id,
        productId: itemRow.product_id,
        productName: itemRow.product_name,
        unitPrice: Number(itemRow.unit_price || 0),
        quantity: Number(itemRow.quantity || 1),
        observation: itemRow.observation || undefined,
        additions,
      };
    });

    return new Order(
      row.id,
      row.restaurant_id,
      row.customer_id || undefined,
      items,
      row.status as OrderStatus,
      new Date(row.created_at),
      Number(row.delivery_fee || 0),
      row.order_number || undefined,
      row.payment_method || 'Efectivo',
      row.payment_amount !== null ? Number(row.payment_amount) : undefined,
      row.change_amount !== null ? Number(row.change_amount) : undefined,
      row.comment || undefined
    );
  }

  async findById(id: string, restaurantId: string): Promise<Order | null> {
    const { data, error } = await this.client
      .from('orders')
      .select('*, order_items(*, order_item_additions(*))')
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find order by id: ${error.message}`);
    }
    if (!data) return null;
    return this.mapToDomain(data);
  }

  async findByRestaurantId(restaurantId: string): Promise<Order[]> {
    const { data, error } = await this.client
      .from('orders')
      .select('*, order_items(*, order_item_additions(*))')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list orders: ${error.message}`);
    }
    return (data || []).map((row) => this.mapToDomain(row));
  }

  async save(order: Order): Promise<void> {
    // 1. Preparar payload para la función RPC atómica (SIN enviar precios ni subtotales)
    const itemsPayload = order.items.map((item) => ({
      id: item.id || `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      product_id: item.productId,
      quantity: item.quantity,
      observation: item.observation || null,
      additions: (item.additions || []).map((add) => ({
        id: add.id || `add_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        addition_id: add.additionId,
        quantity: add.quantity || 1,
      })),
    }));

    const { data, error } = await this.client.rpc('create_order_atomic', {
      p_order_id: order.id,
      p_restaurant_id: order.restaurantId,
      p_customer_id: order.customerId || null,
      p_payment_method: order.paymentMethod,
      p_payment_amount: order.paymentAmount !== undefined ? order.paymentAmount : null,
      p_change_amount: order.changeAmount !== undefined ? order.changeAmount : null,
      p_comment: order.comment || null,
      p_items: itemsPayload,
    });

    if (error) {
      throw new Error(`Failed to save order atomically via RPC: ${error.message}`);
    }

    if (data && data.order_number) {
      (order as any).orderNumber = data.order_number;
    }
  }

  async updateStatus(id: string, status: OrderStatus, restaurantId: string, actorId?: string): Promise<void> {
    const { data, error } = await this.client.rpc('update_order_status_with_actor', {
      p_order_id: id,
      p_new_status: status,
      p_restaurant_id: restaurantId,
      p_actor: actorId || null,
    });

    if (error) {
      throw new Error(`Failed to update order status via RPC: ${error.message}`);
    }

    if (data === false) {
      throw new Error(`Order ${id} not found for restaurant ${restaurantId}`);
    }
  }
}
