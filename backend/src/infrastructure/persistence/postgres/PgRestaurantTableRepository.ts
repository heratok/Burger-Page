import { RestaurantTable, duplicateTableMessage } from '../../../domain/models/RestaurantTable.js';
import { RestaurantTableRepository } from '../../../domain/ports/out/RestaurantTableRepository.js';
import { ConflictError } from '../../../domain/errors/DomainErrors.js';
import { withTenantContext } from './PgClient.js';

const IDENTITY_INDEX = 'uq_restaurant_tables_zone_number';

const UPSERT_SQL = `INSERT INTO public.restaurant_tables (id, restaurant_id, name, zone, number, alias, sort_order, is_active, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, NOW()))
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             zone = EXCLUDED.zone,
             number = EXCLUDED.number,
             alias = EXCLUDED.alias,
             sort_order = EXCLUDED.sort_order,
             is_active = EXCLUDED.is_active
           WHERE public.restaurant_tables.restaurant_id = EXCLUDED.restaurant_id`;

const upsertParams = (table: RestaurantTable) => [
  table.id,
  table.restaurantId,
  table.name,
  table.zone,
  table.number,
  table.alias,
  table.sortOrder,
  table.isActive,
  table.createdAt || null,
];

function mapRow(row: any): RestaurantTable {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    zone: row.zone,
    number: Number(row.number),
    alias: row.alias ?? null,
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
        `SELECT * FROM public.restaurant_tables WHERE restaurant_id = $1 ORDER BY sort_order ASC, lower(zone) ASC, number ASC`,
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
        await client.query(UPSERT_SQL, upsertParams(table));
      });
    } catch (err: any) {
      if (err?.code === '23505' && (!err?.constraint || err.constraint === IDENTITY_INDEX)) {
        throw new ConflictError(duplicateTableMessage(table));
      }
      throw err;
    }
  }

  async saveMany(tables: RestaurantTable[]): Promise<void> {
    if (tables.length === 0) return;
    const restaurantId = tables[0].restaurantId;
    try {
      // One tenant transaction: a conflict on any row rolls the whole batch back.
      await withTenantContext({ restaurantId }, async (client) => {
        for (const table of tables) {
          await client.query(UPSERT_SQL, upsertParams(table));
        }
      });
    } catch (err: any) {
      if (err?.code === '23505' && (!err?.constraint || err.constraint === IDENTITY_INDEX)) {
        throw new ConflictError(`Ya existe alguna de las mesas del rango en la zona '${tables[0].zone}'`);
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
