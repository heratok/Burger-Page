import { SupabaseClient } from '@supabase/supabase-js';
import { Restaurant, OpeningHours } from '../../../domain/models/Restaurant.js';
import { RestaurantRepository } from '../../../domain/ports/out/RestaurantRepository.js';

export class SupabaseRestaurantRepository implements RestaurantRepository {
  constructor(private client: SupabaseClient) {}

  private mapRow(row: any): Restaurant {
    let theme = 'dark-charcoal';
    if (row.config) {
      if (typeof row.config === 'object') {
        theme = row.config.bgTheme || row.config.theme || theme;
      } else if (typeof row.config === 'string') {
        try {
          const parsed = JSON.parse(row.config);
          theme = parsed.bgTheme || parsed.theme || theme;
        } catch {
          theme = 'dark-charcoal';
        }
      }
    }

    let openingHours: OpeningHours = { open: '12:00', close: '22:30' };
    if (row.opening_hours) {
      if (typeof row.opening_hours === 'object') {
        openingHours = {
          open: row.opening_hours.open || '12:00',
          close: row.opening_hours.close || '22:30'
        };
      } else if (typeof row.opening_hours === 'string') {
        try {
          const parsed = JSON.parse(row.opening_hours);
          openingHours = {
            open: parsed.open || '12:00',
            close: parsed.close || '22:30'
          };
        } catch {
          // fallback
        }
      }
    }

    let categories: string[] = [];
    if (row.categories) {
      if (Array.isArray(row.categories)) {
        categories = row.categories;
      } else if (typeof row.categories === 'string') {
        try {
          categories = JSON.parse(row.categories);
        } catch {
          categories = [];
        }
      }
    }

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      theme,
      openingHours,
      isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
      categories,
    };
  }

  async findById(id: string): Promise<Restaurant | null> {
    const { data, error } = await this.client
      .from('restaurants')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find restaurant by id: ${error.message}`);
    }
    if (!data) return null;
    return this.mapRow(data);
  }

  async findBySlug(slug: string): Promise<Restaurant | null> {
    const { data, error } = await this.client
      .from('restaurants')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find restaurant by slug: ${error.message}`);
    }
    if (!data) return null;
    return this.mapRow(data);
  }

  async save(restaurant: Restaurant): Promise<void> {
    const slug =
      restaurant.slug?.trim() ||
      restaurant.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') ||
      restaurant.id;

    const payload = {
      id: restaurant.id,
      slug,
      name: restaurant.name,
      tagline: 'Cocina artesanal',
      config: { bgTheme: restaurant.theme, theme: restaurant.theme },
      opening_hours: restaurant.openingHours,
      categories: restaurant.categories || [],
      created_at: new Date().toISOString()
    };

    const { error } = await this.client
      .from('restaurants')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      throw new Error(`Failed to save restaurant: ${error.message}`);
    }
  }
}
