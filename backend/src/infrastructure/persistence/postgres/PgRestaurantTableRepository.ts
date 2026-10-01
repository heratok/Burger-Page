import { RestaurantTable } from '../../../domain/models/RestaurantTable.js';
import { RestaurantTableRepository } from '../../../domain/ports/out/RestaurantTableRepository.js';
import { ConflictError } from '../../../domain/errors/DomainErrors.js';
import { withTenantContext } from './PgClient.js';

const NAME_INDEX = 'uq_restaurant_tables_name';

function mapRow(row: any): RestaurantTable {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

export class PgRestaurantTableRepository implements RestaurantTableRepository {
  async findByRestaurantId(restaurantId: string): Promise<RestaurantTable[]> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.restaurant_tables WHERE restaurant_id = $1 ORDER BY sort_order ASC, name ASC`,
        [restaurantId]
      );
      return rows.map(mapRow);
    });
  }

  async findById(id: string, restaurantId: string): Promise<RestaurantTable | null> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.restaurant_tables WHERE id = $1 AND restaurant_id = $2`,
        [id, restaurantId]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async save(table: RestaurantTable): Promise<void> {
    try {
      await withTenantContext({ restaurantId: table.restaurantId }, async (client) => {
        await client.query(
          `INSERT INTO public.restaurant_tables (id, restaurant_id, name, sort_order, is_active, created_at)
           VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()))
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             sort_order = EXCLUDED.sort_order,
             is_active = EXCLUDED.is_active
           WHERE public.restaurant_tables.restaurant_id = EXCLUDED.restaurant_id`,
          [table.id, table.restaurantId, table.name, table.sortOrder, table.isActive, table.createdAt || null]
        );
      });
    } catch (err: any) {
      if (err?.code === '23505' && (!err?.constraint || err.constraint === NAME_INDEX)) {
        throw new ConflictError(`A table named '${table.name}' already exists.`);
      }
      throw err;
    }
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    await withTenantContext({ restaurantId }, async (client) => {
      await client.query(`DELETE FROM public.restaurant_tables WHERE id = $1 AND restaurant_id = $2`, [id, restaurantId]);
    });
  }
}
