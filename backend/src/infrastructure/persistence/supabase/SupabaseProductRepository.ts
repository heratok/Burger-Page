import { SupabaseClient } from '@supabase/supabase-js';
import { Product } from '../../../domain/models/Product.js';
import { ProductRepository } from '../../../domain/ports/out/ProductRepository.js';

export class SupabaseProductRepository implements ProductRepository {
  constructor(private client: SupabaseClient) {}

  private mapRow(row: any): Product {
    let additions: string[] = [];
    if (Array.isArray(row.additions)) {
      additions = row.additions;
    } else if (typeof row.additions === 'string') {
      try {
        additions = JSON.parse(row.additions);
      } catch {
        additions = [];
      }
    }

    const categoryName = row.categories?.name || row.category_name || row.category || 'General';

    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      name: row.name,
      description: row.description || '',
      price: Number(row.price),
      category: categoryName,
      categoryId: row.category_id || undefined,
      imageUrl: row.image_url || undefined,
      isAvailable: Boolean(row.is_available),
      isPopular: Boolean(row.is_popular),
      isNew: Boolean(row.is_new),
      preparationTimeMinutes: row.preparation_time_minutes ? Number(row.preparation_time_minutes) : 15,
      displayOrder: row.display_order ? Number(row.display_order) : 0,
      additions,
    };
  }

  async findById(id: string, restaurantId: string): Promise<Product | null> {
    const { data, error } = await this.client
      .from('products')
      .select('*, categories(id, name)')
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find product by id: ${error.message}`);
    }
    if (!data) return null;
    return this.mapRow(data);
  }

  async findByRestaurantId(restaurantId: string): Promise<Product[]> {
    const { data, error } = await this.client
      .from('products')
      .select('*, categories(id, name)')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      throw new Error(`Failed to list products: ${error.message}`);
    }
    return (data || []).map((row) => this.mapRow(row));
  }

  async save(product: Product): Promise<void> {
    const payload = {
      id: product.id,
      restaurant_id: product.restaurantId,
      name: product.name,
      description: product.description,
      price: product.price,
      category_name: product.category,
      category_id: product.categoryId || null,
      image_url: product.imageUrl || null,
      is_available: product.isAvailable,
      is_popular: product.isPopular || false,
      is_new: product.isNew || false,
      preparation_time_minutes: product.preparationTimeMinutes || 15,
      display_order: product.displayOrder || 0,
      additions: product.additions || [],
    };

    const { error } = await this.client
      .from('products')
      .upsert(payload, { onConflict: 'id,restaurant_id' });

    if (error) {
      throw new Error(`Failed to save product: ${error.message}`);
    }
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    const { error } = await this.client
      .from('products')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(`Failed to delete product: ${error.message}`);
    }
  }
}
