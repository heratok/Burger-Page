import { Database } from 'better-sqlite3';
import { Restaurant } from '../../../domain/models/Restaurant.js';
import { RestaurantRepository } from '../../../domain/ports/out/RestaurantRepository.js';

export class SqliteRestaurantRepository implements RestaurantRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Restaurant | null> {
    const row = this.db.prepare('SELECT * FROM restaurants WHERE id = ? OR slug = ?').get(id, id) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      theme: row.config ? JSON.parse(row.config).bgTheme || 'dark-charcoal' : 'dark-charcoal',
      openingHours: row.opening_hours ? JSON.parse(row.opening_hours) : { open: '12:00', close: '22:30' },
      isActive: true
    };
  }

  async save(restaurant: Restaurant): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO restaurants (id, slug, name, tagline, config, opening_hours, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        config = excluded.config,
        opening_hours = excluded.opening_hours
    `);
    stmt.run(
      restaurant.id,
      'burger-craft',
      restaurant.name,
      'Hamburguesas artesanales',
      JSON.stringify({ bgTheme: restaurant.theme }),
      JSON.stringify(restaurant.openingHours),
      new Date().toISOString()
    );
  }
}
