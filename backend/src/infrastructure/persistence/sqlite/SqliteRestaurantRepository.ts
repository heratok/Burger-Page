import { Database } from 'better-sqlite3';
import type { WeeklySchedule } from '@burger-page/contracts';
import { DeletedRestaurant, Restaurant } from '../../../domain/models/Restaurant.js';
import { RestaurantRepository, RestoreRestaurantOutcome } from '../../../domain/ports/out/RestaurantRepository.js';
import {
  DEFAULT_TIMEZONE,
  defaultWeeklySchedule,
  everyDaySchedule,
  legacyOpeningHours,
  sortSchedule,
} from '../../../domain/shared/restaurantSchedule.js';

// opening_hours holds the JSON weekly schedule. Rows written before the weekly
// schedule existed hold a single {open, close} object, which applies to every day.
function parseSchedule(raw: unknown): WeeklySchedule {
  if (typeof raw !== 'string' || raw === '') return defaultWeeklySchedule();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return sortSchedule(parsed as WeeklySchedule);
    if (parsed && typeof parsed.open === 'string' && typeof parsed.close === 'string') {
      return everyDaySchedule(parsed.open, parsed.close);
    }
  } catch {
    // fall through to the default
  }
  return defaultWeeklySchedule();
}

export class SqliteRestaurantRepository implements RestaurantRepository {
  constructor(private db: Database) {}

  private mapRow(row: any): Restaurant {
    let theme = 'dark-charcoal';
    if (row.config) {
      try {
        const parsed = JSON.parse(row.config);
        theme = parsed.bgTheme || parsed.theme || theme;
      } catch {
        theme = 'dark-charcoal';
      }
    }

    const schedule = parseSchedule(row.opening_hours);
    const timezone: string = row.timezone || DEFAULT_TIMEZONE;

    let categories: string[] = [];
    if (row.categories) {
      try {
        categories = JSON.parse(row.categories);
      } catch {
        categories = [];
      }
    }

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      theme,
      schedule,
      timezone,
      ordersPaused: Boolean(row.orders_paused),
      openingHours: legacyOpeningHours(schedule, timezone),
      isActive: true,
      categories,
    };
  }

  async findById(id: string): Promise<Restaurant | null> {
    const row = this.db.prepare('SELECT * FROM restaurants WHERE id = ? AND deleted_at IS NULL').get(id) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  async findBySlug(slug: string): Promise<Restaurant | null> {
    const row = this.db.prepare('SELECT * FROM restaurants WHERE slug = ? AND deleted_at IS NULL').get(slug) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  async findAll(): Promise<Restaurant[]> {
    const rows = this.db.prepare('SELECT * FROM restaurants WHERE deleted_at IS NULL ORDER BY created_at ASC').all() as any[];
    return rows.map((row) => this.mapRow(row));
  }

  async save(restaurant: Restaurant): Promise<void> {
    const slug =
      restaurant.slug?.trim() ||
      restaurant.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') ||
      restaurant.id;

    const stmt = this.db.prepare(`
      INSERT INTO restaurants (id, slug, name, tagline, config, opening_hours, categories, timezone, orders_paused, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        name = excluded.name,
        config = excluded.config,
        opening_hours = excluded.opening_hours,
        categories = excluded.categories,
        timezone = excluded.timezone,
        orders_paused = excluded.orders_paused
      WHERE restaurants.deleted_at IS NULL
    `);

    stmt.run(
      restaurant.id,
      slug,
      restaurant.name,
      restaurant.tagline || 'Cocina artesanal',
      JSON.stringify(restaurant.config || { bgTheme: restaurant.theme, theme: restaurant.theme }),
      JSON.stringify(sortSchedule(restaurant.schedule ?? [])),
      JSON.stringify(restaurant.categories || []),
      restaurant.timezone || DEFAULT_TIMEZONE,
      restaurant.ordersPaused ? 1 : 0,
      restaurant.createdAt || new Date().toISOString()
    );
  }

  async delete(id: string): Promise<void> {
    const row = this.db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id) as any;
    if (row) {
      let config: any = {};
      try {
        config = JSON.parse(row.config || '{}');
      } catch {
        config = {};
      }
      config.isActive = false;
      // Soft delete: hidden from every lookup, slug renamed so it can be reused.
      this.db
        .prepare("UPDATE restaurants SET config = ?, deleted_at = ?, slug = slug || '-deleted-' || id WHERE id = ? AND deleted_at IS NULL")
        .run(JSON.stringify(config), new Date().toISOString(), id);
    }
  }

  // The legacy SQLite driver keeps no separate original-slug column: delete
  // appends '-deleted-<id>', so stripping that suffix recovers the slug.
  async findDeleted(): Promise<DeletedRestaurant[]> {
    const rows = this.db
      .prepare('SELECT id, name, slug, deleted_at FROM restaurants WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC')
      .all() as any[];
    return rows.map((row) => {
      const suffix = `-deleted-${row.id}`;
      const slug: string = row.slug.endsWith(suffix) ? row.slug.slice(0, -suffix.length) : row.slug;
      return { id: row.id, name: row.name, slug, deletedAt: row.deleted_at };
    });
  }

  async restore(id: string, slug: string): Promise<RestoreRestaurantOutcome> {
    const row = this.db.prepare('SELECT * FROM restaurants WHERE id = ? AND deleted_at IS NOT NULL').get(id) as any;
    if (!row) return 'not_found';
    const taken = this.db.prepare('SELECT 1 FROM restaurants WHERE slug = ? AND deleted_at IS NULL').get(slug);
    if (taken) return 'slug_taken';
    let config: any = {};
    try {
      config = JSON.parse(row.config || '{}');
    } catch {
      config = {};
    }
    config.isActive = false;
    this.db
      .prepare('UPDATE restaurants SET slug = ?, config = ?, deleted_at = NULL WHERE id = ?')
      .run(slug, JSON.stringify(config), id);
    return 'restored';
  }

  async hardDelete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM restaurants WHERE id = ?').run(id);
  }
}
