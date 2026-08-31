import { SupabaseClient } from '@supabase/supabase-js';
import { Category } from '../../../domain/models/Category.js';
import { CategoryRepository } from '../../../domain/ports/out/CategoryRepository.js';

export class SupabaseCategoryRepository implements CategoryRepository {
  constructor(private client: SupabaseClient) {}

  private mapRow(row: any): Category {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      name: row.name,
      slug: row.slug || undefined,
      displayOrder: row.display_order ? Number(row.display_order) : 0,
      isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
    };
  }

  async findById(id: string, restaurantId: string): Promise<Category | null> {
    const { data, error } = await this.client
      .from('categories')
      .select('*')
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find category by id: ${error.message}`);
    }
    if (!data) return null;
    return this.mapRow(data);
  }

  async findByRestaurantId(restaurantId: string): Promise<Category[]> {
    const { data, error } = await this.client
      .from('categories')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to list categories: ${error.message}`);
    }
    return (data || []).map((row) => this.mapRow(row));
  }

  async findByName(name: string, restaurantId: string): Promise<Category | null> {
    const { data, error } = await this.client
      .from('categories')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .ilike('name', name)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find category by name: ${error.message}`);
    }
    if (!data) return null;
    return this.mapRow(data);
  }

  async save(category: Category): Promise<void> {
    const payload = {
      id: category.id,
      restaurant_id: category.restaurantId,
      name: category.name,
      slug: category.slug || null,
      display_order: category.displayOrder || 0,
      is_active: category.isActive !== undefined ? category.isActive : true,
    };

    const { error } = await this.client
      .from('categories')
      .upsert(payload, { onConflict: 'restaurant_id,name' });

    if (error) {
      throw new Error(`Failed to save category: ${error.message}`);
    }
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    const { error } = await this.client
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(`Failed to delete category: ${error.message}`);
    }
  }
}
