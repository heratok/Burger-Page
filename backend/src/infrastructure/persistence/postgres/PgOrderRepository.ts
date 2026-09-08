import { Order, OrderStatus, OrderItem, OrderItemAddition } from '../../../domain/models/Order.js';
import { EntityNotFoundError } from '../../../domain/errors/DomainErrors.js';
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
  const order = new Order(
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
  if (row.customer_name) {
    (order as any).customer = {
      nombre: row.customer_name,
      telefono: row.customer_phone || '',
      direccion: row.customer_address || '',
      barrio: row.customer_barrio || '',
    };
  }
  return order;
}

export class PgOrderRepository implements OrderRepository {
  async findById(id: string, restaurantId: string): Promise<Order | null> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address, c.barrio as customer_barrio
         FROM public.orders o
         LEFT JOIN public.customers c ON o.customer_id = c.id
         WHERE o.id = $1 AND o.restaurant_id = $2`,
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
        `SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address, c.barrio as customer_barrio
         FROM public.orders o
         LEFT JOIN public.customers c ON o.customer_id = c.id
         WHERE o.restaurant_id = $1 ORDER BY o.created_at DESC`,
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
        throw new EntityNotFoundError(`Order ${id} not found for restaurant ${restaurantId}`);
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
        throw new EntityNotFoundError(`Order ${id} not found for restaurant ${restaurantId}`);
      }
    });
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    await withTenantContext({ restaurantId }, async (client) => {
      const { rows: itemRows } = await client.query(
        `SELECT id FROM public.order_items WHERE order_id = $1`,
        [id]
      );
      const itemIds = itemRows.map((i) => i.id);
      if (itemIds.length > 0) {
        await client.query(
          `DELETE FROM public.order_item_additions WHERE order_item_id = ANY($1::text[])`,
          [itemIds]
        );
      }
      await client.query(`DELETE FROM public.order_items WHERE order_id = $1`, [id]);
      const { rowCount } = await client.query(
        `DELETE FROM public.orders WHERE id = $1 AND restaurant_id = $2`,
        [id, restaurantId]
      );
      if (!rowCount) {
        throw new EntityNotFoundError(`Order ${id} not found for restaurant ${restaurantId}`);
      }
    });
  }

  async update(order: Order, restaurantId: string): Promise<Order> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows: existingRows } = await client.query(
        `SELECT * FROM public.orders WHERE id = $1 AND restaurant_id = $2`,
        [order.id, restaurantId]
      );
      if (existingRows.length === 0) {
        throw new EntityNotFoundError(`Order ${order.id} not found for restaurant ${restaurantId}`);
      }

      // Extract customer details if present
      const cust = (order as any).customer;
      const custName = cust?.name || cust?.nombre || null;
      const custPhone = cust?.phone || cust?.telefono || null;
      const custAddress = cust?.address || cust?.direccion || null;
      const custBarrio = cust?.barrio || null;

      // Check if orders table has customer_name column
      const { rows: colRows } = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_name'`
      );

      if (colRows.length > 0) {
        await client.query(
          `UPDATE public.orders SET
             customer_name = COALESCE($1, customer_name),
             customer_phone = COALESCE($2, customer_phone),
             customer_address = COALESCE($3, customer_address),
             customer_barrio = COALESCE($4, customer_barrio),
             subtotal = $5,
             delivery_fee = $6,
             final_total = $7,
             payment_method = $8,
             payment_amount = $9,
             change_amount = $10,
             comment = $11,
             updated_at = NOW()
           WHERE id = $12 AND restaurant_id = $13`,
          [
            custName,
            custPhone,
            custAddress,
            custBarrio,
            order.subtotal,
            order.deliveryFee,
            order.finalTotal,
            order.paymentMethod,
            order.paymentAmount !== undefined ? order.paymentAmount : null,
            order.changeAmount !== undefined ? order.changeAmount : null,
            order.comment !== undefined ? order.comment : null,
            order.id,
            restaurantId,
          ]
        );
      } else {
        await client.query(
          `UPDATE public.orders SET
             subtotal = $1,
             delivery_fee = $2,
             final_total = $3,
             payment_method = $4,
             payment_amount = $5,
             change_amount = $6,
             comment = $7,
             updated_at = NOW()
           WHERE id = $8 AND restaurant_id = $9`,
          [
            order.subtotal,
            order.deliveryFee,
            order.finalTotal,
            order.paymentMethod,
            order.paymentAmount !== undefined ? order.paymentAmount : null,
            order.changeAmount !== undefined ? order.changeAmount : null,
            order.comment !== undefined ? order.comment : null,
            order.id,
            restaurantId,
          ]
        );
      }

      // Also update public.customers if order is linked to a customer
      const customerId = order.customerId || existingRows[0].customer_id;
      if (customerId && (custName || custPhone || custAddress || custBarrio)) {
        try {
          await client.query(
            `UPDATE public.customers SET
               name = COALESCE($1, name),
               phone = COALESCE($2, phone),
               address = COALESCE($3, address),
               barrio = COALESCE($4, barrio),
               updated_at = NOW()
             WHERE id = $5 AND restaurant_id = $6`,
            [custName, custPhone, custAddress, custBarrio, customerId, restaurantId]
          );
        } catch {
          // If updating phone violates unique constraint, update without modifying phone
          try {
            await client.query(
              `UPDATE public.customers SET
                 name = COALESCE($1, name),
                 address = COALESCE($2, address),
                 barrio = COALESCE($3, barrio),
                 updated_at = NOW()
               WHERE id = $4 AND restaurant_id = $5`,
              [custName, custAddress, custBarrio, customerId, restaurantId]
            );
          } catch {
            // Gracefully continue without failing order transaction
          }
        }
      }

      // Delete existing order_item_additions & order_items for this order
      const { rows: itemRows } = await client.query(
        `SELECT id FROM public.order_items WHERE order_id = $1`,
        [order.id]
      );
      const itemIds = itemRows.map((i) => i.id);
      if (itemIds.length > 0) {
        await client.query(
          `DELETE FROM public.order_item_additions WHERE order_item_id = ANY($1::text[])`,
          [itemIds]
        );
      }
      await client.query(`DELETE FROM public.order_items WHERE order_id = $1`, [order.id]);

      // Re-insert the updated items and their additions
      for (const item of order.items) {
        const itemId = item.id || `ord_item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        // Verify product_id foreign key or resolve by name
        let validProductId: string | null = null;
        if (item.productId) {
          const { rows: prodRows } = await client.query(
            `SELECT id FROM public.products WHERE (id = $1 OR LOWER(name) = LOWER($2)) AND restaurant_id = $3 LIMIT 1`,
            [item.productId, item.productName || item.productId, restaurantId]
          );
          if (prodRows.length > 0) {
            validProductId = prodRows[0].id;
          }
        }

        await client.query(
          `INSERT INTO public.order_items (id, order_id, restaurant_id, product_id, product_name, unit_price, quantity, observation)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            itemId,
            order.id,
            restaurantId,
            validProductId,
            item.productName,
            item.unitPrice,
            item.quantity,
            item.observation || null,
          ]
        );

        if (item.additions && item.additions.length > 0) {
          for (const add of item.additions) {
            const addId = add.id || `ord_add_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

            // Verify addition_id foreign key or resolve by name
            let validAdditionId: string | null = null;
            if (add.additionId) {
              const { rows: addRows } = await client.query(
                `SELECT id FROM public.product_additions WHERE (id = $1 OR LOWER(name) = LOWER($2)) AND restaurant_id = $3 LIMIT 1`,
                [add.additionId, add.additionName || add.additionId, restaurantId]
              );
              if (addRows.length > 0) {
                validAdditionId = addRows[0].id;
              }
            }

            await client.query(
              `INSERT INTO public.order_item_additions (id, order_item_id, restaurant_id, addition_id, addition_name, unit_price, quantity)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                addId,
                itemId,
                restaurantId,
                validAdditionId,
                add.additionName,
                add.unitPrice,
                add.quantity || 1,
              ]
            );
          }
        }
      }

      // Return the reloaded and updated Order domain model
      const { rows: updatedRows } = await client.query(
        `SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address, c.barrio as customer_barrio
         FROM public.orders o
         LEFT JOIN public.customers c ON o.customer_id = c.id
         WHERE o.id = $1 AND o.restaurant_id = $2`,
        [order.id, restaurantId]
      );
      if (updatedRows.length === 0) {
        throw new EntityNotFoundError(`Order ${order.id} not found for restaurant ${restaurantId}`);
      }
      const loadedItems = await loadItemsWithAdditions(client, order.id);
      return mapOrderRow(updatedRows[0], loadedItems);
    });
  }
}
