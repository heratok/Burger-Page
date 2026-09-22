import { Product } from '../../../domain/models/Product.js';
import { ProductRepository } from '../../../domain/ports/out/ProductRepository.js';
import { withTenantContext } from './PgClient.js';

function mapRow(row: any): Product {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    description: row.description || '',
    price: Number(row.price),
    category: row.category_name || '',
    categoryId: row.category_id || undefined,
    imageUrl: row.image_url || undefined,
    isAvailable: Boolean(row.is_available),
    isPopular: Boolean(row.is_popular),
    isNew: Boolean(row.is_new),
    preparationTimeMinutes: row.preparation_time_minutes ? Number(row.preparation_time_minutes) : 15,
    displayOrder: row.display_order ? Number(row.display_order) : 0,
    additions: [],
  };
}

export class PgProductRepository implements ProductRepository {
  async findById(id: string, restaurantId: string): Promise<Product | null> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT p.*, c.name AS category_name
         FROM public.products p
         LEFT JOIN public.categories c ON c.id = p.category_id
         WHERE p.id = $1 AND p.restaurant_id = $2`,
        [id, restaurantId]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async findByRestaurantId(restaurantId: string): Promise<Product[]> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT p.*, c.name AS category_name
         FROM public.products p
         LEFT JOIN public.categories c ON c.id = p.category_id
         WHERE p.restaurant_id = $1
         ORDER BY p.display_order ASC, p.id ASC`,
        [restaurantId]
      );
      return rows.map(mapRow);
    });
  }

  async save(product: Product): Promise<void> {
    await withTenantContext({ restaurantId: product.restaurantId }, async (client) => {
      await client.query(
        `INSERT INTO public.products (
           id, restaurant_id, category_id, name, description, price,
           image_url, is_available, is_popular, is_new, preparation_time_minutes, display_order
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           category_id = EXCLUDED.category_id,
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           price = EXCLUDED.price,
           image_url = EXCLUDED.image_url,
           is_available = EXCLUDED.is_available,
           is_popular = EXCLUDED.is_popular,
           is_new = EXCLUDED.is_new,
           preparation_time_minutes = EXCLUDED.preparation_time_minutes,
           display_order = EXCLUDED.display_order`,
        [
          product.id,
          product.restaurantId,
          product.categoryId || null,
          product.name,
          product.description,
          product.price,
          product.imageUrl || null,
          product.isAvailable,
          product.isPopular || false,
          product.isNew || false,
          product.preparationTimeMinutes || 15,
          product.displayOrder || 0,
        ]
      );
    });
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    await withTenantContext({ restaurantId }, async (client) => {
      await client.query(`DELETE FROM public.products WHERE id = $1 AND restaurant_id = $2`, [id, restaurantId]);
    });
  }
}
