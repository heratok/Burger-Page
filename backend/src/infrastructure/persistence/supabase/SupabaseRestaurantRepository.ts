import { SupabaseClient } from '@supabase/supabase-js';
import { Restaurant, OpeningHours } from '../../../domain/models/Restaurant.js';
import { RestaurantRepository } from '../../../domain/ports/out/RestaurantRepository.js';

export class SupabaseRestaurantRepository implements RestaurantRepository {
  constructor(private client: SupabaseClient) {}

  private mapRow(row: any): Restaurant {
    const theme = row.bg_theme || 'dark-charcoal';
    const openTime = row.open_time ? String(row.open_time).substring(0, 5) : '12:00';
    const closeTime = row.close_time ? String(row.close_time).substring(0, 5) : '22:30';
    const openingHours: OpeningHours = { open: openTime, close: closeTime };

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      tagline: row.tagline || 'Cocina artesanal',
      whatsappNumber: row.whatsapp_number || undefined,
      primaryColor: row.primary_color || '#E63946',
      theme,
      openingHours,
      isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
      categories: ['Hamburguesas', 'Bebidas', 'Acompañamientos'],
      config: {
        name: row.name,
        tagline: row.tagline || 'Cocina artesanal',
        logoUrl: row.logo_url || '',
        bannerUrl: row.banner_url || '',
        showBanner: row.show_banner ?? true,
        announcementText: row.announcement_text || '',
        showAnnouncement: row.show_announcement ?? true,
        whatsappNumber: row.whatsapp_number || '',
        currency: row.currency || 'COP',
        currencySymbol: row.currency_symbol || '$',
        deliveryFee: Number(row.delivery_fee) || 0,
        minOrderAmount: Number(row.min_order_amount) || 0,
        estimatedDeliveryTime: row.estimated_delivery_time || '30 - 45 min',
        openingHours: `${openTime} - ${closeTime}`,
        address: row.address || '',
        primaryColor: row.primary_color || '#E63946',
        bgTheme: row.bg_theme || 'dark-charcoal',
      },
      createdAt: row.created_at || new Date().toISOString(),
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

  async findAll(): Promise<Restaurant[]> {
    const { data, error } = await this.client
      .from('restaurants')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to list restaurants: ${error.message}`);
    }
    return (data || []).map((row: any) => this.mapRow(row));
  }

  async save(restaurant: Restaurant): Promise<void> {
    const slug =
      restaurant.slug?.trim() ||
      restaurant.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') ||
      restaurant.id;

    const payload: any = {
      id: restaurant.id,
      slug,
      name: restaurant.name,
      tagline: restaurant.tagline || restaurant.config?.tagline || 'Cocina artesanal',
      whatsapp_number: restaurant.whatsappNumber || restaurant.config?.whatsappNumber || null,
      primary_color: restaurant.primaryColor || restaurant.config?.primaryColor || '#E63946',
      bg_theme: restaurant.theme || restaurant.config?.bgTheme || 'dark-charcoal',
      open_time: restaurant.openingHours?.open ? `${restaurant.openingHours.open}:00` : '12:00:00',
      close_time: restaurant.openingHours?.close ? `${restaurant.openingHours.close}:00` : '22:30:00',
      is_active: restaurant.isActive !== undefined ? Boolean(restaurant.isActive) : true,
      created_at: restaurant.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (restaurant.config) {
      if (restaurant.config.logoUrl) payload.logo_url = restaurant.config.logoUrl;
      if (restaurant.config.bannerUrl) payload.banner_url = restaurant.config.bannerUrl;
      if (restaurant.config.deliveryFee !== undefined) payload.delivery_fee = restaurant.config.deliveryFee;
      if (restaurant.config.minOrderAmount !== undefined) payload.min_order_amount = restaurant.config.minOrderAmount;
      if (restaurant.config.address) payload.address = restaurant.config.address;
    }

    const { error } = await this.client
      .from('restaurants')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      throw new Error(`Failed to save restaurant: ${error.message}`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      // 1. Cascade delete order structure
      const { data: orderRows } = await this.client.from('orders').select('id').eq('restaurant_id', id);
      const orderIds = (orderRows || []).map((o: any) => o.id);
      if (orderIds.length > 0) {
        const { data: itemRows } = await this.client.from('order_items').select('id').in('order_id', orderIds);
        const itemIds = (itemRows || []).map((i: any) => i.id);
        if (itemIds.length > 0) {
          await this.client.from('order_item_additions').delete().in('order_item_id', itemIds);
        }
        await this.client.from('order_items').delete().in('order_id', orderIds);
        await this.client.from('orders').delete().eq('restaurant_id', id);
      }

      // 2. Cascade delete tenant users, products, and customers
      await this.client.from('users').delete().eq('restaurant_id', id);
      await this.client.from('products').delete().eq('restaurant_id', id);
      await this.client.from('customers').delete().eq('restaurant_id', id);
    } catch (cascadeErr) {
      console.warn('Cascade cleanup partial warning:', cascadeErr);
    }

    const { error } = await this.client
      .from('restaurants')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete restaurant: ${error.message}`);
    }
  }
}
