import { Database } from 'better-sqlite3';
import { Restaurant } from '../../../domain/models/Restaurant.js';
import { RestaurantRepository } from '../../../domain/ports/out/RestaurantRepository.js';

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

    let openingHours = { open: '12:00', close: '22:30' };
    if (row.opening_hours) {
      try {
        openingHours = JSON.parse(row.opening_hours);
      } catch {
        // use default
      }
    }

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
      openingHours,
      isActive: true,
      categories,
    };
  }

  async findById(id: string): Promise<Restaurant | null> {
    const row = this.db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  async findBySlug(slug: string): Promise<Restaurant | null> {
    const row = this.db.prepare('SELECT * FROM restaurants WHERE slug = ?').get(slug) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  async findAll(): Promise<Restaurant[]> {
    const rows = this.db.prepare('SELECT * FROM restaurants ORDER BY created_at ASC').all() as any[];
    return rows.map((row) => this.mapRow(row));
  }

  async save(restaurant: Restaurant): Promise<void> {
    const slug =
      restaurant.slug?.trim() ||
      restaurant.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') ||
      restaurant.id;

    const stmt = this.db.prepare(`
      INSERT INTO restaurants (id, slug, name, tagline, config, opening_hours, categories, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        name = excluded.name,
        config = excluded.config,
        opening_hours = excluded.opening_hours,
        categories = excluded.categories
    `);

    stmt.run(
      restaurant.id,
      slug,
      restaurant.name,
      restaurant.tagline || 'Cocina artesanal',
      JSON.stringify(restaurant.config || { bgTheme: restaurant.theme, theme: restaurant.theme }),
      JSON.stringify(restaurant.openingHours),
      JSON.stringify(restaurant.categories || []),
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
      this.db.prepare('UPDATE restaurants SET config = ? WHERE id = ?').run(JSON.stringify(config), id);
    }
  }

  async hardDelete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM restaurants WHERE id = ?').run(id);
  }
}
