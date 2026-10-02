import type { WeeklySchedule } from '@burger-page/contracts';
import { Restaurant } from '../../../domain/models/Restaurant.js';
import { RestaurantRepository } from '../../../domain/ports/out/RestaurantRepository.js';
import { ID_PREFIX, newId } from '../../../domain/shared/newId.js';
import {
  DEFAULT_TIMEZONE,
  legacyHoursText,
  legacyOpeningHours,
  sortSchedule,
} from '../../../domain/shared/restaurantSchedule.js';
import { withTenantContext } from './PgClient.js';

// The read query aggregates restaurant_opening_hours into a JSON array; the
// pg driver already parses it, a string only shows up with other adapters.
function parseSchedule(raw: unknown): WeeklySchedule {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? sortSchedule(value as WeeklySchedule) : [];
}

export function mapRow(row: any): Restaurant {
  const theme = row.bg_theme || 'dark-charcoal';
  const schedule = parseSchedule(row.schedule);
  const timezone: string = row.timezone || DEFAULT_TIMEZONE;
  const openingHours = legacyOpeningHours(schedule, timezone);

  let categories: string[] = [];
  if (Array.isArray(row.categories)) {
    categories = row.categories;
  } else if (typeof row.categories === 'string') {
    try {
      const parsed = JSON.parse(row.categories);
      if (Array.isArray(parsed)) {
        categories = parsed;
      }
    } catch {}
  } else {
    // No fabricated default: a missing/undecodable categories column yields [].
    categories = [];
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline || 'Cocina artesanal',
    whatsappNumber: row.whatsapp_number || undefined,
    primaryColor: row.primary_color || '#E63946',
    theme,
    schedule,
    timezone,
    ordersPaused: Boolean(row.orders_paused),
    openingHours,
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
    categories,
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
      // Legacy "HH:MM - HH:MM" text, a read-only projection of the weekly
      // schedule (restaurant_opening_hours is the single stored source).
      openingHours: legacyHoursText(openingHours),
      address: row.address || '',
      primaryColor: row.primary_color || '#E63946',
      primaryHoverColor: row.primary_hover_color || '#F25C69',
      bgTheme: row.bg_theme || 'dark-charcoal',
      fontFamily: row.font_family || 'sans',
      cardRadius: row.card_radius || 'md',
      cardStyle: row.card_style || 'elevated',
      compactGrid: row.compact_grid ?? false,
      showBadges: row.show_badges ?? true,
    },
    createdAt: row.created_at || new Date().toISOString(),
  };
}

const RESTAURANT_READ_COLUMNS = `
  SELECT r.id, r.slug, r.name, r.tagline, r.whatsapp_number, r.address, r.is_active,
         r.created_at,
         s.currency, s.currency_symbol, s.delivery_fee, s.min_order_amount,
         s.estimated_delivery_time, s.timezone, s.orders_paused,
         s.announcement_text, s.show_announcement,
         b.logo_url, b.banner_url, b.show_banner, b.primary_color, b.primary_hover_color,
         b.bg_theme, b.font_family, b.card_radius, b.card_style, b.compact_grid, b.show_badges,
         COALESCE(
           (SELECT json_agg(c.name ORDER BY c.display_order ASC, c.name ASC)
            FROM public.categories c
            WHERE c.restaurant_id = r.id AND c.is_active = true),
           '[]'::json
         ) AS categories,
         COALESCE(
           (SELECT json_agg(
                     json_build_object(
                       'dayOfWeek', h.day_of_week,
                       'open', to_char(h.open_time, 'HH24:MI'),
                       'close', to_char(h.close_time, 'HH24:MI')
                     )
                     ORDER BY h.day_of_week ASC, h.open_time ASC)
            FROM public.restaurant_opening_hours h
            WHERE h.restaurant_id = r.id),
           '[]'::json
         ) AS schedule
  FROM public.restaurants r
  LEFT JOIN public.restaurant_settings s ON s.restaurant_id = r.id
  LEFT JOIN public.restaurant_branding b ON b.restaurant_id = r.id
`;

// Deleted tenants (deleted_at set) are invisible to every read below, for
// super_admin included: deleting is distinct from pausing (is_active=false),
// which keeps the tenant listed and editable.
//
// findById/findAll/save/delete/hardDelete are administrative — no tenant
// context exists yet to scope by (a restaurant is the tenant root), so they
// run as actorRole 'super_admin' to preserve today's unrestricted
// service_role behavior. findBySlug is the public storefront lookup and
// deliberately runs with NO super_admin escape hatch: it declares the slug
// (app.restaurant_slug) and relies only on the slug-scoped public read
// policies, which expose just the ACTIVE restaurant with that slug — an
// inactive restaurant must stay invisible, and the session cannot list others.
export class PgRestaurantRepository implements RestaurantRepository {
  async findById(id: string): Promise<Restaurant | null> {
    return withTenantContext({ restaurantId: null, actorRole: 'super_admin' }, async (client) => {
      const { rows } = await client.query(`${RESTAURANT_READ_COLUMNS} WHERE r.deleted_at IS NULL AND r.id = $1`, [id]);
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async findBySlug(slug: string): Promise<Restaurant | null> {
    return withTenantContext({ restaurantId: null, restaurantSlug: slug }, async (client) => {
      const { rows } = await client.query(`${RESTAURANT_READ_COLUMNS} WHERE r.deleted_at IS NULL AND r.slug = $1`, [slug]);
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async findAll(): Promise<Restaurant[]> {
    return withTenantContext({ restaurantId: null, actorRole: 'super_admin' }, async (client) => {
      const { rows } = await client.query(`${RESTAURANT_READ_COLUMNS} WHERE r.deleted_at IS NULL ORDER BY r.created_at ASC`);
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

  // The weekly schedule is config, not history: it is replaced wholesale.
  private async replaceSchedule(client: any, restaurantId: string, schedule: WeeklySchedule): Promise<void> {
    await client.query('DELETE FROM public.restaurant_opening_hours WHERE restaurant_id = $1', [restaurantId]);
    for (const range of sortSchedule(schedule)) {
      await client.query(
        `INSERT INTO public.restaurant_opening_hours (id, restaurant_id, day_of_week, open_time, close_time)
         VALUES ($1, $2, $3, $4, $5)`,
        [newId(ID_PREFIX.openingHours), restaurantId, range.dayOfWeek, range.open, range.close]
      );
    }
  }

  async save(restaurant: Restaurant): Promise<void> {
    const slug =
      restaurant.slug?.trim() ||
      restaurant.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') ||
      restaurant.id;
    const now = new Date().toISOString();
    const cfg = restaurant.config || {};

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
    settings.timezone = restaurant.timezone || DEFAULT_TIMEZONE;
    settings.orders_paused = Boolean(restaurant.ordersPaused);
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
      // A deleted tenant can never be resurrected by a save.
      const { rowCount } = await client.query(
        'SELECT 1 FROM public.restaurants WHERE id = $1 AND deleted_at IS NOT NULL',
        [restaurant.id]
      );
      if (rowCount) return;
      await this.upsert(client, 'public.restaurants', identity);
      await this.upsert(client, 'public.restaurant_settings', settings);
      await this.upsert(client, 'public.restaurant_branding', branding);
      await this.replaceSchedule(client, restaurant.id, restaurant.schedule ?? []);
    });
  }

  async delete(id: string): Promise<void> {
    await withTenantContext({ restaurantId: id, actorRole: 'super_admin' }, async (client) => {
      await client.query(
        // The slug is renamed so it can be reused by a new tenant; the id suffix
        // keeps the renamed value unique.
        `UPDATE public.restaurants
            SET is_active = false,
                deleted_at = NOW(),
                slug = slug || '-deleted-' || id,
                updated_at = NOW()
          WHERE id = $1 AND deleted_at IS NULL`,
        [id]
      );
    });
  }

  async hardDelete(id: string): Promise<void> {
    await withTenantContext({ restaurantId: id, actorRole: 'super_admin' }, async (client) => {
      // The restaurant FKs of orders/order_items/order_item_additions/
      // order_status_history are ON DELETE RESTRICT, so the orders go first;
      // their items, additions and status history follow through the order
      // FK cascades (referential actions run as table owner, so the append-only
      // grants on order_status_history do not block them).
      await client.query(`DELETE FROM public.orders WHERE restaurant_id = $1`, [id]);
      await client.query(`DELETE FROM public.users WHERE restaurant_id = $1`, [id]);
      await client.query(`DELETE FROM public.products WHERE restaurant_id = $1`, [id]);
      await client.query(`DELETE FROM public.customers WHERE restaurant_id = $1`, [id]);
      await client.query(`DELETE FROM public.restaurants WHERE id = $1`, [id]);
    });
  }
}
