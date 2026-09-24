import { randomBytes } from 'node:crypto';
import { Order, OrderStatus, OrderItem, OrderItemAddition } from '../../../domain/models/Order.js';
import { UserRole } from '../../../domain/models/User.js';
import { EntityNotFoundError, InvalidOrderStateError } from '../../../domain/errors/DomainErrors.js';
import { OrderRepository } from '../../../domain/ports/out/OrderRepository.js';
import { ListOptions } from '../../../domain/ports/out/ListOptions.js';
import { withTenantContext } from './PgClient.js';
import type { PoolClient } from 'pg';

function mapAdditionRow(row: any): OrderItemAddition {
  return {
    id: row.id,
    additionId: row.addition_id,
    additionName: row.addition_name,
    unitPrice: Number(row.unit_price || 0),
    quantity: Number(row.quantity || 1),
  };
}

function mapItemRow(row: any, additions: OrderItemAddition[]): OrderItem {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    unitPrice: Number(row.unit_price || 0),
    quantity: Number(row.quantity || 1),
    observation: row.observation || undefined,
    additions,
  };
}

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

  const additionsByItem = new Map<string, OrderItemAddition[]>();
  for (const row of additionRows) {
    const list = additionsByItem.get(row.order_item_id);
    if (list) list.push(mapAdditionRow(row));
    else additionsByItem.set(row.order_item_id, [mapAdditionRow(row)]);
  }

  return itemRows.map((itemRow) => mapItemRow(itemRow, additionsByItem.get(itemRow.id) ?? []));
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
    row.receipt_url || undefined,
    row.client_order_id || undefined
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

  async findByRestaurantId(restaurantId: string, options?: ListOptions): Promise<Order[]> {
    return withTenantContext({ restaurantId }, async (client) => {
      // Pagination: limit/offset apply to the ORDERS select only; the batched
      // items/additions queries below always run over the page's order ids and
      // never re-add a limit.
      const limit = options?.limit;
      let sql = `SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address, c.barrio as customer_barrio
         FROM public.orders o
         LEFT JOIN public.customers c ON o.customer_id = c.id
         WHERE o.restaurant_id = $1 ORDER BY o.created_at DESC`;
      const params: unknown[] = [restaurantId];
      if (typeof limit === 'number' && Number.isInteger(limit) && limit > 0) {
        const page = options?.page && Number.isInteger(options.page) && options.page >= 1 ? options.page : 1;
        sql += `\n         LIMIT $2 OFFSET $3`;
        params.push(limit, (page - 1) * limit);
      }
      const { rows } = await client.query(sql, params);
      if (rows.length === 0) return [];

      // N+1 fix: batch items and additions for ALL orders with exactly two
      // extra queries (1 + 2N roundtrips -> 3 total), group them in JS, and
      // rebuild each order. Orders keep DESC sort; items/additions stay ASC,
      // exactly matching the per-order helper's output shape.
      const orderIds = rows.map((r) => r.id);
      const { rows: itemRows } = await client.query(
        `SELECT * FROM public.order_items WHERE order_id = ANY($1::text[]) ORDER BY created_at ASC`,
        [orderIds]
      );
      const itemIds = itemRows.map((r) => r.id);
      const { rows: additionRows } = await client.query(
        `SELECT * FROM public.order_item_additions WHERE order_item_id = ANY($1::text[]) ORDER BY created_at ASC`,
        [itemIds]
      );

      const additionsByItem = new Map<string, OrderItemAddition[]>();
      for (const row of additionRows) {
        const list = additionsByItem.get(row.order_item_id);
        if (list) list.push(mapAdditionRow(row));
        else additionsByItem.set(row.order_item_id, [mapAdditionRow(row)]);
      }

      const itemsByOrder = new Map<string, OrderItem[]>();
      for (const itemRow of itemRows) {
        const item = mapItemRow(itemRow, additionsByItem.get(itemRow.id) ?? []);
        const list = itemsByOrder.get(itemRow.order_id);
        if (list) list.push(item);
        else itemsByOrder.set(itemRow.order_id, [item]);
      }

      return rows.map((row) => mapOrderRow(row, itemsByOrder.get(row.id) ?? []));
    });
  }

  async countByRestaurantId(restaurantId: string): Promise<number> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS total FROM public.orders WHERE restaurant_id = $1`,
        [restaurantId]
      );
      return Number(rows[0]?.total ?? 0);
    });
  }

  async save(order: Order): Promise<void> {
    const itemsPayload = order.items.map((item) => ({
      id: item.id || `item_${Date.now()}_${randomBytes(4).toString('hex')}`,
      product_id: item.productId,
      quantity: item.quantity,
      observation: item.observation || null,
      additions: (item.additions || []).map((add) => ({
        id: add.id || `add_${Date.now()}_${randomBytes(4).toString('hex')}`,
        addition_id: add.additionId,
        quantity: add.quantity || 1,
      })),
    }));

    await withTenantContext({ restaurantId: order.restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.create_order_atomic($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          order.id,
          order.restaurantId,
          order.customerId || null,
          order.paymentMethod,
          order.paymentAmount ?? null,
          order.changeAmount ?? null,
          order.comment || null,
          JSON.stringify(itemsPayload),
          // The use-case-computed fee (client-honored when valid, restaurant
          // fallback otherwise) is authoritative: the RPC must not silently
          // re-derive the restaurant fee for counter/table sales.
          order.deliveryFee ?? null,
          // SUS-19: idempotent replay key — the RPC returns the existing order
          // when one is already persisted for (restaurant_id, client_order_id).
          order.clientOrderId ?? null,
        ]
      );
      const created = rows[0]?.create_order_atomic;
      if (created && created.order_number) {
        (order as any).orderNumber = created.order_number;
      }
      // SUS-19 replay: the RPC returned the already-persisted row for this
      // (restaurant_id, client_order_id); adopt its real id so the response
      // references the original order, not a freshly generated phantom id.
      if (created && created.id && created.id !== order.id) {
        (order as any).id = created.id;
      }
      if (order.receiptUrl) {
        await client.query(
          `UPDATE public.orders SET receipt_url = $1, updated_at = NOW() WHERE id = $2 AND restaurant_id = $3`,
          [order.receiptUrl, order.id, order.restaurantId]
        );
      }
    });
  }

  async updateStatus(id: string, status: OrderStatus, restaurantId: string, actorId?: string, actorRole?: UserRole, expectedStatus?: OrderStatus): Promise<void> {
    // SUS-03: app.actor_role is derived from the caller's granted role (JWT),
    // never hardcoded — undefined omits it so the SECURITY DEFINER
    // update_order_status_with_actor validation runs under RLS with the
    // caller's real identity.
    await withTenantContext({ restaurantId, ...(actorRole ? { actorRole } : {}) }, async (client) => {
      let rows: any[];
      try {
        const res = await client.query(
          `SELECT public.update_order_status_with_actor($1, $2, $3, $4, $5) AS updated`,
          [id, status, restaurantId, actorId || null, expectedStatus ?? null]
        );
        rows = res.rows;
      } catch (err: any) {
        // M1 CAS: the RPC raises P0001 'Order status changed concurrently'
        // when the expected (snapshot) status no longer matches the persisted
        // row; surface it as the same DomainError the domain's own transition
        // validation throws, so both paths map identically in the API.
        if (err?.code === 'P0001' && /concurrently/i.test(err?.message ?? '')) {
          throw new InvalidOrderStateError(`Order status changed concurrently for order ${id}`);
        }
        throw err;
      }
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

      await client.query(
        `UPDATE public.orders SET
           subtotal = $1,
           delivery_fee = $2,
           final_total = $3,
           payment_method = $4,
           payment_amount = $5,
           change_amount = $6,
           comment = $7,
           status = $8,             updated_at = NOW()           WHERE id = $9 AND restaurant_id = $10`,
        [
          order.subtotal,
          order.deliveryFee,
          order.finalTotal,
          order.paymentMethod,
          order.paymentAmount ?? null,
          order.changeAmount ?? null,
          order.comment ?? null,
          order.status,
          order.id,
          restaurantId,
        ]
      );

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
        const itemId = item.id || `ord_item_${Date.now()}_${randomBytes(4).toString('hex')}`;

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
            const addId = add.id || `ord_add_${Date.now()}_${randomBytes(4).toString('hex')}`;

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
