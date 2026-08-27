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

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      theme,
      openingHours,
      isActive: true
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

  async save(restaurant: Restaurant): Promise<void> {
    const slug =
      restaurant.slug?.trim() ||
      restaurant.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') ||
      restaurant.id;

    const stmt = this.db.prepare(`
      INSERT INTO restaurants (id, slug, name, tagline, config, opening_hours, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        name = excluded.name,
        config = excluded.config,
        opening_hours = excluded.opening_hours
    `);

    stmt.run(
      restaurant.id,
      slug,
      restaurant.name,
      'Hamburguesas artesanales',
      JSON.stringify({ bgTheme: restaurant.theme, theme: restaurant.theme }),
      JSON.stringify(restaurant.openingHours),
      new Date().toISOString()
    );
  }
}
