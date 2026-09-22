import { Restaurant, OpeningHours } from '../../../domain/models/Restaurant.js';
import { RestaurantRepository } from '../../../domain/ports/out/RestaurantRepository.js';
import { withTenantContext } from './PgClient.js';

function mapRow(row: any): Restaurant {
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

const RESTAURANT_READ_COLUMNS = `
  SELECT r.id, r.slug, r.name, r.tagline, r.whatsapp_number, r.address, r.is_active,
         r.created_at,
         s.currency, s.currency_symbol, s.delivery_fee, s.min_order_amount,
         s.estimated_delivery_time, s.opening_hours_text, s.open_time, s.close_time,
         s.announcement_text, s.show_announcement,
         b.logo_url, b.banner_url, b.show_banner, b.primary_color, b.primary_hover_color,
         b.bg_theme, b.font_family, b.card_radius, b.card_style, b.compact_grid, b.show_badges
  FROM public.restaurants r
  LEFT JOIN public.restaurant_settings s ON s.restaurant_id = r.id
  LEFT JOIN public.restaurant_branding b ON b.restaurant_id = r.id
`;

// findById/findAll/save/delete/hardDelete are administrative — no tenant
// context exists yet to scope by (a restaurant is the tenant root), so they
// run as actorRole 'super_admin' to preserve today's unrestricted
// service_role behavior. findBySlug is the public storefront lookup and
// deliberately runs with NO super_admin escape hatch, relying only on the
// public_read_active_restaurants policy (is_active = true) — an inactive
// restaurant must stay invisible to a storefront slug lookup.
export class PgRestaurantRepository implements RestaurantRepository {
  async findById(id: string): Promise<Restaurant | null> {
    return withTenantContext({ restaurantId: null, actorRole: 'super_admin' }, async (client) => {
      const { rows } = await client.query(`${RESTAURANT_READ_COLUMNS} WHERE r.id = $1`, [id]);
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async findBySlug(slug: string): Promise<Restaurant | null> {
    return withTenantContext({ restaurantId: null }, async (client) => {
      const { rows } = await client.query(`${RESTAURANT_READ_COLUMNS} WHERE r.slug = $1`, [slug]);
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async findAll(): Promise<Restaurant[]> {
    return withTenantContext({ restaurantId: null, actorRole: 'super_admin' }, async (client) => {
      const { rows } = await client.query(`${RESTAURANT_READ_COLUMNS} ORDER BY r.created_at ASC`);
      return rows.map(mapRow);
    });
  }

  private async upsert(client: any, table: string, payload: Record<string, unknown>): Promise<void> {
    const columns = Object.keys(payload);
    const values = Object.values(payload);
    const placeholders = columns.map((_, i) => `$${i + 1}`);
    const updates = columns.filter((c) => c !== 'id' && c !== 'restaurant_id').map((c) => `${c} = EXCLUDED.${c}`);
    await client.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})
       ON CONFLICT (${columns.includes('id') ? 'id' : 'restaurant_id'}) DO UPDATE SET ${updates.join(', ')}`,
      values
    );
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

    // Identidad del tenant (restaurants)
    const identity: Record<string, unknown> = {
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
    // para no pisar valores existentes en updates parciales; el INSERT nuevo
    // completa con los defaults de la tabla.
    const settings: Record<string, unknown> = { restaurant_id: restaurant.id, updated_at: now };
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
    const branding: Record<string, unknown> = { restaurant_id: restaurant.id, updated_at: now };
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

    await withTenantContext({ restaurantId: restaurant.id, actorRole: 'super_admin' }, async (client) => {
      await this.upsert(client, 'public.restaurants', identity);
      await this.upsert(client, 'public.restaurant_settings', settings);
      await this.upsert(client, 'public.restaurant_branding', branding);
    });
  }

  async delete(id: string): Promise<void> {
    await withTenantContext({ restaurantId: id, actorRole: 'super_admin' }, async (client) => {
      await client.query(
        `UPDATE public.restaurants SET is_active = false, updated_at = NOW() WHERE id = $1`,
        [id]
      );
    });
  }

  async hardDelete(id: string): Promise<void> {
    await withTenantContext({ restaurantId: id, actorRole: 'super_admin' }, async (client) => {
      const { rows: orderRows } = await client.query(`SELECT id FROM public.orders WHERE restaurant_id = $1`, [id]);
      const orderIds = orderRows.map((o) => o.id);
      if (orderIds.length > 0) {
        const { rows: itemRows } = await client.query(
          `SELECT id FROM public.order_items WHERE order_id = ANY($1::text[])`,
          [orderIds]
        );
        const itemIds = itemRows.map((i) => i.id);
        if (itemIds.length > 0) {
          await client.query(`DELETE FROM public.order_item_additions WHERE order_item_id = ANY($1::text[])`, [itemIds]);
        }
        await client.query(`DELETE FROM public.order_items WHERE order_id = ANY($1::text[])`, [orderIds]);
        await client.query(`DELETE FROM public.orders WHERE restaurant_id = $1`, [id]);
      }

      await client.query(`DELETE FROM public.users WHERE restaurant_id = $1`, [id]);
      await client.query(`DELETE FROM public.products WHERE restaurant_id = $1`, [id]);
      await client.query(`DELETE FROM public.customers WHERE restaurant_id = $1`, [id]);
      await client.query(`DELETE FROM public.restaurants WHERE id = $1`, [id]);
    });
  }
}
