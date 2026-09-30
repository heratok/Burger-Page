import { Inventory } from '../../../domain/models/Inventory.js';
import { InventoryRepository } from '../../../domain/ports/out/InventoryRepository.js';
import { ConflictError, EntityNotFoundError, ValidationError } from '../../../domain/errors/DomainErrors.js';
import { ListOptions } from '../../../domain/ports/out/ListOptions.js';
import { withTenantContext } from './PgClient.js';

function mapRow(row: any): Inventory {
  const minAlert = Number(row.min_stock_alert ?? 0);
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    category: row.category,
    quantity: Number(row.current_stock ?? 0),
    unit: row.unit,
    minStockAlert: minAlert,
    alertThreshold: minAlert,
    costPerUnit: Number(row.cost_per_unit ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const NAME_CONSTRAINT = 'uq_inventory_items_restaurant_name';

function duplicateNameError(inventory: Inventory): ConflictError {
  return new ConflictError(`An inventory item named '${inventory.name}' already exists.`);
}

function isDuplicateName(err: any): boolean {
  return err?.code === '23505' && (!err?.constraint || err.constraint === NAME_CONSTRAINT);
}

export class PgInventoryRepository implements InventoryRepository {
  async findById(id: string, restaurantId: string): Promise<Inventory | null> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.inventory_items WHERE id = $1 AND restaurant_id = $2`,
        [id, restaurantId]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async findByRestaurantId(restaurantId: string, options?: ListOptions): Promise<Inventory[]> {
    return withTenantContext({ restaurantId }, async (client) => {
      const limit = options?.limit;
      if (typeof limit === 'number' && Number.isInteger(limit) && limit > 0) {
        const page = options?.page && Number.isInteger(options.page) && options.page >= 1 ? options.page : 1;
        const { rows } = await client.query(
          `SELECT * FROM public.inventory_items WHERE restaurant_id = $1 ORDER BY name ASC LIMIT $2 OFFSET $3`,
          [restaurantId, limit, (page - 1) * limit]
        );
        return rows.map(mapRow);
      }
      const { rows } = await client.query(
        `SELECT * FROM public.inventory_items WHERE restaurant_id = $1 ORDER BY name ASC`,
        [restaurantId]
      );
      return rows.map(mapRow);
    });
  }

  async countByRestaurantId(restaurantId: string): Promise<number> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS total FROM public.inventory_items WHERE restaurant_id = $1`,
        [restaurantId]
      );
      return Number(rows[0]?.total ?? 0);
    });
  }

  async save(inventory: Inventory): Promise<void> {
    const minAlert = inventory.minStockAlert ?? inventory.alertThreshold ?? 0;
    await withTenantContext({ restaurantId: inventory.restaurantId }, async (client) => {
      // Match by id only: a name match must never redirect the write to
      // another item. Duplicate names surface as ConflictError (unique per tenant).
      const existing = await client.query(
        `SELECT id FROM public.inventory_items WHERE id = $1 AND restaurant_id = $2`,
        [inventory.id, inventory.restaurantId]
      );
      try {
        if (existing.rows.length > 0) {
          // Stock is never written on edit: it changes only through adjustStock
          // (atomic delta), so a stale edit cannot overwrite a concurrent adjust.
          await client.query(
            `UPDATE public.inventory_items SET
               name = $1,
               category = $2,
               min_stock_alert = $3,
               unit = $4,
               cost_per_unit = $5,
               updated_at = NOW()
             WHERE id = $6 AND restaurant_id = $7`,
            [
              inventory.name,
              inventory.category || 'ingredients',
              minAlert,
              inventory.unit,
              inventory.costPerUnit || 0,
              inventory.id,
              inventory.restaurantId,
            ]
          );
          return;
        }
        await client.query(
          `INSERT INTO public.inventory_items (id, restaurant_id, name, category, current_stock, min_stock_alert, unit, cost_per_unit)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            inventory.id,
            inventory.restaurantId,
            inventory.name,
            inventory.category || 'ingredients',
            inventory.quantity,
            minAlert,
            inventory.unit,
            inventory.costPerUnit || 0,
          ]
        );
      } catch (err) {
        if (isDuplicateName(err)) throw duplicateNameError(inventory);
        throw err;
      }
    });
  }

  async adjustStock(id: string, restaurantId: string, delta: number): Promise<Inventory> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.adjust_inventory_stock($1, $2, $3)`,
        [id, restaurantId, delta]
      );

      if (rows.length === 0) {
        const { rows: existingRows } = await client.query(
          `SELECT * FROM public.inventory_items WHERE id = $1 AND restaurant_id = $2`,
          [id, restaurantId]
        );
        if (existingRows.length === 0) {
          throw new EntityNotFoundError(`Inventory item '${id}' not found for restaurant '${restaurantId}'.`);
        }
        const existing = mapRow(existingRows[0]);
        throw new ValidationError(
          `Insufficient stock for item '${existing.name}'. Current stock is ${existing.quantity}, cannot reduce by ${Math.abs(delta)}.`
        );
      }

      return mapRow(rows[0]);
    });
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    await withTenantContext({ restaurantId }, async (client) => {
      await client.query(`DELETE FROM public.inventory_items WHERE id = $1 AND restaurant_id = $2`, [
        id,
        restaurantId,
      ]);
    });
  }
}
