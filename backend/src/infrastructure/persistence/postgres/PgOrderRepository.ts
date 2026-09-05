import { Order, OrderStatus, OrderItem, OrderItemAddition } from '../../../domain/models/Order.js';
import { OrderRepository } from '../../../domain/ports/out/OrderRepository.js';
import { withTenantContext } from './PgClient.js';
import type { PoolClient } from 'pg';

async function loadItemsWithAdditions(client: PoolClient, orderId: string): Promise<OrderItem[]> {
  const { rows: itemRows } = await client.query(
    `SELECT * FROM public.order_items WHERE order_id = $1 ORDER BY created_at ASC`,
    [orderId]
  );
  if (itemRows.length === 0) return [];

  const itemIds = itemRows.map((r) => r.id);
  const { rows: additionRows } = await client.query(
    `SELECT * FROM public.order_item_additions WHERE order_item_id = ANY($1::text[]) ORDER BY created_at ASC`,
    [itemIds]
  );

  return itemRows.map((itemRow) => {
    const additions: OrderItemAddition[] = additionRows
      .filter((a) => a.order_item_id === itemRow.id)
      .map((a) => ({
        id: a.id,
        additionId: a.addition_id,
        additionName: a.addition_name,
        unitPrice: Number(a.unit_price || 0),
        quantity: Number(a.quantity || 1),
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
}

function mapOrderRow(row: any, items: OrderItem[]): Order {
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

export class PgOrderRepository implements OrderRepository {
  async findById(id: string, restaurantId: string): Promise<Order | null> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.orders WHERE id = $1 AND restaurant_id = $2`,
        [id, restaurantId]
      );
      if (rows.length === 0) return null;
      const items = await loadItemsWithAdditions(client, id);
      return mapOrderRow(rows[0], items);
    });
  }

  async findByRestaurantId(restaurantId: string): Promise<Order[]> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.orders WHERE restaurant_id = $1 ORDER BY created_at DESC`,
        [restaurantId]
      );
      const orders: Order[] = [];
      for (const row of rows) {
        const items = await loadItemsWithAdditions(client, row.id);
        orders.push(mapOrderRow(row, items));
      }
      return orders;
    });
  }

  async save(order: Order): Promise<void> {
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

    await withTenantContext({ restaurantId: order.restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.create_order_atomic($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          order.id,
          order.restaurantId,
          order.customerId || null,
          order.paymentMethod,
          order.paymentAmount !== undefined ? order.paymentAmount : null,
          order.changeAmount !== undefined ? order.changeAmount : null,
          order.comment || null,
          JSON.stringify(itemsPayload),
        ]
      );
      const created = rows[0]?.create_order_atomic;
      if (created && created.order_number) {
        (order as any).orderNumber = created.order_number;
      }
      if (order.receiptUrl) {
        await client.query(
          `UPDATE public.orders SET receipt_url = $1, updated_at = NOW() WHERE id = $2 AND restaurant_id = $3`,
          [order.receiptUrl, order.id, order.restaurantId]
        );
      }
    });
  }

  async updateStatus(id: string, status: OrderStatus, restaurantId: string, actorId?: string): Promise<void> {
    await withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT public.update_order_status_with_actor($1, $2, $3, $4) AS updated`,
        [id, status, restaurantId, actorId || null]
      );
      if (rows[0]?.updated === false) {
        throw new Error(`Order ${id} not found for restaurant ${restaurantId}`);
      }
    });
  }

  async updateReceipt(id: string, receiptUrl: string, restaurantId: string): Promise<void> {
    await withTenantContext({ restaurantId }, async (client) => {
      const { rowCount } = await client.query(
        `UPDATE public.orders SET receipt_url = $1, updated_at = NOW() WHERE id = $2 AND restaurant_id = $3`,
        [receiptUrl, id, restaurantId]
      );
      if (!rowCount) {
        throw new Error(`Order ${id} not found for restaurant ${restaurantId}`);
      }
    });
  }
}
