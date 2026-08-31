import { ProductAddition } from '../../../domain/models/ProductAddition.js';
import { ProductAdditionRepository } from '../../../domain/ports/out/ProductAdditionRepository.js';
import { withTenantContext } from './PgClient.js';

function mapRow(row: any): ProductAddition {
  return new ProductAddition(
    row.id,
    row.restaurant_id,
    row.name,
    Number(row.price || 0),
    row.is_available !== undefined ? Boolean(row.is_available) : true,
    row.product_id || undefined,
    row.display_order ? Number(row.display_order) : 0
  );
}

export class PgProductAdditionRepository implements ProductAdditionRepository {
  async findById(id: string, restaurantId: string): Promise<ProductAddition | null> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.product_additions WHERE id = $1 AND restaurant_id = $2`,
        [id, restaurantId]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async findByRestaurantId(restaurantId: string): Promise<ProductAddition[]> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.product_additions WHERE restaurant_id = $1 ORDER BY display_order ASC, name ASC`,
        [restaurantId]
      );
      return rows.map(mapRow);
    });
  }

  async findByProductId(productId: string, restaurantId: string): Promise<ProductAddition[]> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.product_additions
         WHERE restaurant_id = $1 AND (product_id = $2 OR product_id IS NULL)
         ORDER BY display_order ASC, name ASC`,
        [restaurantId, productId]
      );
      return rows.map(mapRow);
    });
  }

  async save(addition: ProductAddition): Promise<void> {
    await withTenantContext({ restaurantId: addition.restaurantId }, async (client) => {
      await client.query(
        `INSERT INTO public.product_additions (id, restaurant_id, product_id, name, price, is_available, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           product_id = EXCLUDED.product_id,
           name = EXCLUDED.name,
           price = EXCLUDED.price,
           is_available = EXCLUDED.is_available,
           display_order = EXCLUDED.display_order,
           updated_at = NOW()`,
        [
          addition.id,
          addition.restaurantId,
          addition.productId || null,
          addition.name,
          addition.price,
          addition.isAvailable !== undefined ? addition.isAvailable : true,
          addition.displayOrder || 0,
        ]
      );
    });
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    await withTenantContext({ restaurantId }, async (client) => {
      await client.query(`DELETE FROM public.product_additions WHERE id = $1 AND restaurant_id = $2`, [
        id,
        restaurantId,
      ]);
    });
  }
}
