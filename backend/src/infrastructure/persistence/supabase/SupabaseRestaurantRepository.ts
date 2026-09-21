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

  private flattenEmbedded(row: any): any {
    // 1:1 embeds de PostgREST llegan como arreglos de 0/1 elementos.
    const settings = Array.isArray(row.restaurant_settings)
      ? row.restaurant_settings[0]
      : row.restaurant_settings;
    const branding = Array.isArray(row.restaurant_branding)
      ? row.restaurant_branding[0]
      : row.restaurant_branding;
    // Orden: branding < settings < restaurants (la identidad manda en
    // created_at/is_active; settings/branding aportan el resto).
    return { ...(branding || {}), ...(settings || {}), ...row };
  }

  async findById(id: string): Promise<Restaurant | null> {
    const { data, error } = await this.client
      .from('restaurants')
      .select('*, restaurant_settings(*), restaurant_branding(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find restaurant by id: ${error.message}`);
    }
    if (!data) return null;
    return this.mapRow(this.flattenEmbedded(data));
  }

  async findBySlug(slug: string): Promise<Restaurant | null> {
    const { data, error } = await this.client
      .from('restaurants')
      .select('*, restaurant_settings(*), restaurant_branding(*)')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find restaurant by slug: ${error.message}`);
    }
    if (!data) return null;
    return this.mapRow(this.flattenEmbedded(data));
  }

  async findAll(): Promise<Restaurant[]> {
    const { data, error } = await this.client
      .from('restaurants')
      .select('*, restaurant_settings(*), restaurant_branding(*)')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to list restaurants: ${error.message}`);
    }
    return (data || []).map((row: any) => this.mapRow(this.flattenEmbedded(row)));
  }

  async save(restaurant: Restaurant): Promise<void> {
    const slug =
      restaurant.slug?.trim() ||
      restaurant.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') ||
      restaurant.id;
    const now = new Date().toISOString();
    const cfg = restaurant.config || {};
    const openTime = restaurant.openingHours?.open ? `${restaurant.openingHours.open}:00` : '12:00:00';
    const closeTime = restaurant.openingHours?.close ? `${restaurant.openingHours.close}:00` : '22:30:00';

    // Identidad (restaurants)
    const identity: any = {
      id: restaurant.id,
      slug,
      name: restaurant.name,
      tagline: restaurant.tagline || cfg.tagline || 'Cocina artesanal',
      whatsapp_number: restaurant.whatsappNumber || cfg.whatsappNumber || null,
      is_active: restaurant.isActive !== undefined ? Boolean(restaurant.isActive) : true,
      created_at: restaurant.createdAt || now,
      updated_at: now,
    };
    if (cfg.address !== undefined) identity.address = cfg.address || null;

    // Configuración operativa (restaurant_settings) — solo campos provistos
    const settings: any = { restaurant_id: restaurant.id, updated_at: now };
    if (cfg.currency !== undefined) settings.currency = cfg.currency;
    if (cfg.currencySymbol !== undefined) settings.currency_symbol = cfg.currencySymbol;
    if (cfg.deliveryFee !== undefined) settings.delivery_fee = cfg.deliveryFee;
    if (cfg.minOrderAmount !== undefined) settings.min_order_amount = cfg.minOrderAmount;
    if (cfg.estimatedDeliveryTime !== undefined) settings.estimated_delivery_time = cfg.estimatedDeliveryTime;
    if (cfg.openingHours !== undefined) settings.opening_hours_text = cfg.openingHours;
    settings.open_time = openTime;
    settings.close_time = closeTime;
    if (cfg.announcementText !== undefined) settings.announcement_text = cfg.announcementText || null;
    if (cfg.showAnnouncement !== undefined) settings.show_announcement = cfg.showAnnouncement;

    // Identidad visual (restaurant_branding)
    const branding: any = { restaurant_id: restaurant.id, updated_at: now };
    if (cfg.logoUrl !== undefined) branding.logo_url = cfg.logoUrl || null;
    if (cfg.bannerUrl !== undefined) branding.banner_url = cfg.bannerUrl || null;
    if (cfg.showBanner !== undefined) branding.show_banner = cfg.showBanner;
    branding.primary_color = restaurant.primaryColor || cfg.primaryColor || '#E63946';
    if (cfg.primaryHoverColor !== undefined) branding.primary_hover_color = cfg.primaryHoverColor;
    branding.bg_theme = restaurant.theme || cfg.bgTheme || 'dark-charcoal';
    if (cfg.fontFamily !== undefined) branding.font_family = cfg.fontFamily;
    if (cfg.cardRadius !== undefined) branding.card_radius = cfg.cardRadius;
    if (cfg.cardStyle !== undefined) branding.card_style = cfg.cardStyle;
    if (cfg.compactGrid !== undefined) branding.compact_grid = cfg.compactGrid;
    if (cfg.showBadges !== undefined) branding.show_badges = cfg.showBadges;

    const { error } = await this.client.from('restaurants').upsert(identity, { onConflict: 'id' });
    if (error) {
      throw new Error(`Failed to save restaurant: ${error.message}`);
    }
    const { error: settingsError } = await this.client
      .from('restaurant_settings')
      .upsert(settings, { onConflict: 'restaurant_id' });
    if (settingsError) {
      throw new Error(`Failed to save restaurant settings: ${settingsError.message}`);
    }
    const { error: brandingError } = await this.client
      .from('restaurant_branding')
      .upsert(branding, { onConflict: 'restaurant_id' });
    if (brandingError) {
      throw new Error(`Failed to save restaurant branding: ${brandingError.message}`);
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from('restaurants')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to soft delete restaurant: ${error.message}`);
    }
  }

  async hardDelete(id: string): Promise<void> {
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
      throw new Error(`Failed to hard delete restaurant: ${error.message}`);
    }
  }
}
