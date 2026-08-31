import { Inventory } from '../../../domain/models/Inventory.js';
import { InventoryRepository } from '../../../domain/ports/out/InventoryRepository.js';
import { EntityNotFoundError, ValidationError } from '../../../domain/errors/DomainErrors.js';
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

  async findByRestaurantId(restaurantId: string): Promise<Inventory[]> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.inventory_items WHERE restaurant_id = $1 ORDER BY name ASC`,
        [restaurantId]
      );
      return rows.map(mapRow);
    });
  }

  async save(inventory: Inventory): Promise<void> {
    const minAlert = inventory.minStockAlert ?? inventory.alertThreshold ?? 0;
    await withTenantContext({ restaurantId: inventory.restaurantId }, async (client) => {
      const existing = await client.query(
        `SELECT id FROM public.inventory_items WHERE (id = $1 OR (restaurant_id = $2 AND name = $3))`,
        [inventory.id, inventory.restaurantId, inventory.name]
      );
      if (existing.rows.length > 0) {
        inventory.id = existing.rows[0].id;
        await client.query(
          `UPDATE public.inventory_items SET
             name = $1,
             category = $2,
             current_stock = $3,
             min_stock_alert = $4,
             unit = $5,
             cost_per_unit = $6,
             updated_at = NOW()
           WHERE id = $7 AND restaurant_id = $8`,
          [
            inventory.name,
            inventory.category || 'ingredients',
            inventory.quantity,
            minAlert,
            inventory.unit,
            inventory.costPerUnit || 0,
            existing.rows[0].id,
            inventory.restaurantId,
          ]
        );
      } else {
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
