import { SupabaseClient } from '@supabase/supabase-js';
import { ProductAddition } from '../../../domain/models/ProductAddition.js';
import { ProductAdditionRepository } from '../../../domain/ports/out/ProductAdditionRepository.js';

export class SupabaseProductAdditionRepository implements ProductAdditionRepository {
  constructor(private client: SupabaseClient) {}

  private mapToDomain(row: any): ProductAddition {
    return new ProductAddition(
      row.id,
      row.restaurant_id,
      row.name,
      Number(row.price || 0),
      Boolean(row.is_available ?? true),
      row.product_id || undefined,
      Number(row.display_order || 0)
    );
  }

  async findById(id: string, restaurantId?: string): Promise<ProductAddition | null> {
    let query = this.client.from('product_additions').select('*').eq('id', id);
    if (restaurantId) {
      query = query.eq('restaurant_id', restaurantId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
      throw new Error(`Failed to find product addition: ${error.message}`);
    }
    if (!data) return null;
    return this.mapToDomain(data);
  }

  async findByRestaurantId(restaurantId: string): Promise<ProductAddition[]> {
    const { data, error } = await this.client
      .from('product_additions')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to list product additions: ${error.message}`);
    }
    return (data || []).map((row) => this.mapToDomain(row));
  }

  async findByProductId(productId: string, restaurantId: string): Promise<ProductAddition[]> {
    const { data, error } = await this.client
      .from('product_additions')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .or(`product_id.eq.${productId},product_id.is.null`)
      .order('display_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to list product additions for product: ${error.message}`);
    }
    return (data || []).map((row) => this.mapToDomain(row));
  }

  async save(addition: ProductAddition): Promise<void> {
    const payload = {
      id: addition.id,
      restaurant_id: addition.restaurantId,
      product_id: addition.productId || null,
      name: addition.name,
      price: addition.price,
      is_available: addition.isAvailable,
      display_order: addition.displayOrder,
      updated_at: new Date().toISOString(),
    };

    const { error } = await this.client
      .from('product_additions')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      throw new Error(`Failed to save product addition: ${error.message}`);
    }
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    const { error } = await this.client
      .from('product_additions')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(`Failed to delete product addition: ${error.message}`);
    }
  }
}
