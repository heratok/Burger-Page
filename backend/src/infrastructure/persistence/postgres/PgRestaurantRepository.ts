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
      const { rows } = await client.query(`SELECT * FROM public.restaurants WHERE id = $1`, [id]);
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async findBySlug(slug: string): Promise<Restaurant | null> {
    return withTenantContext({ restaurantId: null }, async (client) => {
      const { rows } = await client.query(`SELECT * FROM public.restaurants WHERE slug = $1`, [slug]);
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async findAll(): Promise<Restaurant[]> {
    return withTenantContext({ restaurantId: null, actorRole: 'super_admin' }, async (client) => {
      const { rows } = await client.query(`SELECT * FROM public.restaurants ORDER BY created_at ASC`);
      return rows.map(mapRow);
    });
  }

  async save(restaurant: Restaurant): Promise<void> {
    const slug =
      restaurant.slug?.trim() ||
      restaurant.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') ||
      restaurant.id;

    const payload: Record<string, unknown> = {
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

    const columns = Object.keys(payload);
    const values = Object.values(payload);
    const placeholders = columns.map((_, i) => `$${i + 1}`);
    const updates = columns.filter((c) => c !== 'id').map((c) => `${c} = EXCLUDED.${c}`);

    await withTenantContext({ restaurantId: restaurant.id, actorRole: 'super_admin' }, async (client) => {
      await client.query(
        `INSERT INTO public.restaurants (${columns.join(', ')}) VALUES (${placeholders.join(', ')})
         ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')}`,
        values
      );
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
