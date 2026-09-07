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
      row.comment || undefined,
      row.receipt_url || undefined
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

    if (order.receiptUrl) {
      await this.client
        .from('orders')
        .update({ receipt_url: order.receiptUrl })
        .eq('id', order.id)
        .eq('restaurant_id', order.restaurantId);
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

  async updateReceipt(id: string, receiptUrl: string, restaurantId: string): Promise<void> {
    const { error } = await this.client
      .from('orders')
      .update({ receipt_url: receiptUrl })
      .eq('id', id)
      .eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(`Failed to update order receipt: ${error.message}`);
    }
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    const existing = await this.findById(id, restaurantId);
    if (!existing) {
      throw new Error(`Order ${id} not found for restaurant ${restaurantId}`);
    }

    const { data: itemRows } = await this.client
      .from('order_items')
      .select('id')
      .eq('order_id', id);

    const itemIds = (itemRows || []).map((i: any) => i.id);
    if (itemIds.length > 0) {
      await this.client.from('order_item_additions').delete().in('order_item_id', itemIds);
    }
    await this.client.from('order_items').delete().eq('order_id', id);

    const { error } = await this.client
      .from('orders')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(`Failed to delete order: ${error.message}`);
    }
  }

  async update(order: Order, restaurantId: string): Promise<Order> {
    const existing = await this.findById(order.id, restaurantId);
    if (!existing) {
      throw new Error(`Order ${order.id} not found for restaurant ${restaurantId}`);
    }

    // Update orders table
    const { error: orderError } = await this.client
      .from('orders')
      .update({
        delivery_fee: order.deliveryFee,
        subtotal: order.subtotal,
        final_total: order.finalTotal,
        payment_method: order.paymentMethod,
        payment_amount: order.paymentAmount !== undefined ? order.paymentAmount : null,
        change_amount: order.changeAmount !== undefined ? order.changeAmount : null,
        comment: order.comment !== undefined ? order.comment : null,
        status: order.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('restaurant_id', restaurantId);

    if (orderError) {
      throw new Error(`Failed to update order: ${orderError.message}`);
    }

    // Update customer if provided
    const cust = (order as any).customer;
    const customerId = order.customerId || existing.customerId;
    if (customerId && cust) {
      const custName = cust.name || cust.nombre;
      const custPhone = cust.phone || cust.telefono;
      const custAddress = cust.address || cust.direccion;
      const custBarrio = cust.barrio;

      await this.client
        .from('customers')
        .update({
          ...(custName ? { name: custName } : {}),
          ...(custPhone ? { phone: custPhone } : {}),
          ...(custAddress ? { address: custAddress } : {}),
          ...(custBarrio ? { barrio: custBarrio } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId)
        .eq('restaurant_id', restaurantId);
    }

    // Delete existing additions and items
    const { data: itemRows } = await this.client
      .from('order_items')
      .select('id')
      .eq('order_id', order.id);

    const itemIds = (itemRows || []).map((i: any) => i.id);
    if (itemIds.length > 0) {
      await this.client.from('order_item_additions').delete().in('order_item_id', itemIds);
    }
    await this.client.from('order_items').delete().eq('order_id', order.id);

    // Re-insert items and additions
    for (const item of order.items) {
      const itemId = item.id || `ord_item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const { error: itemErr } = await this.client.from('order_items').insert({
        id: itemId,
        order_id: order.id,
        restaurant_id: restaurantId,
        product_id: item.productId,
        product_name: item.productName,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        observation: item.observation || null,
      });
      if (itemErr) {
        throw new Error(`Failed to insert order item: ${itemErr.message}`);
      }

      for (const add of item.additions || []) {
        const addId = add.id || `ord_add_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const { error: addErr } = await this.client.from('order_item_additions').insert({
          id: addId,
          order_item_id: itemId,
          restaurant_id: restaurantId,
          addition_id: add.additionId,
          addition_name: add.additionName,
          unit_price: add.unitPrice,
          quantity: add.quantity || 1,
        });
        if (addErr) {
          throw new Error(`Failed to insert order item addition: ${addErr.message}`);
        }
      }
    }

    return (await this.findById(order.id, restaurantId)) || order;
  }
}
