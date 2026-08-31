import { Category } from '../../../domain/models/Category.js';
import { CategoryRepository } from '../../../domain/ports/out/CategoryRepository.js';
import { withTenantContext } from './PgClient.js';

function mapRow(row: any): Category {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    slug: row.slug || undefined,
    displayOrder: row.display_order ? Number(row.display_order) : 0,
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
  };
}

export class PgCategoryRepository implements CategoryRepository {
  async findById(id: string, restaurantId: string): Promise<Category | null> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.categories WHERE id = $1 AND restaurant_id = $2`,
        [id, restaurantId]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async findByRestaurantId(restaurantId: string): Promise<Category[]> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.categories WHERE restaurant_id = $1 ORDER BY display_order ASC, name ASC`,
        [restaurantId]
      );
      return rows.map(mapRow);
    });
  }

  async findByName(name: string, restaurantId: string): Promise<Category | null> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.categories WHERE restaurant_id = $1 AND name ILIKE $2`,
        [restaurantId, name]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async save(category: Category): Promise<void> {
    await withTenantContext({ restaurantId: category.restaurantId }, async (client) => {
      await client.query(
        `INSERT INTO public.categories (id, restaurant_id, name, slug, display_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           slug = EXCLUDED.slug,
           display_order = EXCLUDED.display_order,
           is_active = EXCLUDED.is_active`,
        [
          category.id,
          category.restaurantId,
          category.name,
          category.slug || null,
          category.displayOrder || 0,
          category.isActive !== undefined ? category.isActive : true,
        ]
      );
    });
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    await withTenantContext({ restaurantId }, async (client) => {
      await client.query(`DELETE FROM public.categories WHERE id = $1 AND restaurant_id = $2`, [id, restaurantId]);
    });
  }
}
