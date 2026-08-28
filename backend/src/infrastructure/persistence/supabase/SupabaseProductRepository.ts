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

    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      price: Number(row.price),
      category: row.category,
      isAvailable: Boolean(row.is_available),
      additions
    };
  }

  async findById(id: string): Promise<Product | null> {
    const { data, error } = await this.client
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find product by id: ${error.message}`);
    }
    if (!data) return null;
    return this.mapRow(data);
  }

  async findAll(): Promise<Product[]> {
    const { data, error } = await this.client
      .from('products')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      throw new Error(`Failed to list products: ${error.message}`);
    }
    return (data || []).map((row) => this.mapRow(row));
  }

  async save(product: Product): Promise<void> {
    const payload = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      is_available: product.isAvailable,
      additions: product.additions || []
    };

    const { error } = await this.client
      .from('products')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      throw new Error(`Failed to save product: ${error.message}`);
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete product: ${error.message}`);
    }
  }
}
