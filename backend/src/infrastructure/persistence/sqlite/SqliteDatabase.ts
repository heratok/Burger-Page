import DatabaseConstructor, { Database } from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function createSqliteDatabase(dbPath = ':memory:'): Database {
  if (dbPath !== ':memory:') {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseConstructor(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Schema Migrations
  db.exec(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      tagline TEXT,
      config TEXT NOT NULL,
      opening_hours TEXT NOT NULL,
      categories TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT NOT NULL,
      category_id TEXT,
      image_url TEXT,
      is_available INTEGER NOT NULL DEFAULT 1,
      is_popular INTEGER NOT NULL DEFAULT 0,
      is_new INTEGER NOT NULL DEFAULT 0,
      preparation_time_minutes INTEGER DEFAULT 15,
      display_order INTEGER DEFAULT 0,
      additions TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS product_additions (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL,
      product_id TEXT,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0.0,
      is_available INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL,
      order_number INTEGER,
      customer_id TEXT,
      status TEXT NOT NULL,
      total REAL NOT NULL,
      delivery_fee REAL NOT NULL,
      final_total REAL NOT NULL,
      payment_method TEXT DEFAULT 'Efectivo',
      payment_amount REAL,
      change_amount REAL,
      comment TEXT,
      items TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      barrio TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'ingredients',
      current_stock REAL NOT NULL DEFAULT 0,
      min_stock_alert REAL NOT NULL DEFAULT 5,
      unit TEXT NOT NULL DEFAULT 'unidades',
      cost_per_unit REAL NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );
  `);

  const inventoryColumns = db.prepare("PRAGMA table_info(inventory)").all() as Array<{ name: string }>;
  const hasInvRestaurant = inventoryColumns.some(c => c.name === 'restaurant_id');
  if (!hasInvRestaurant) {
    db.exec("ALTER TABLE inventory ADD COLUMN restaurant_id TEXT NOT NULL DEFAULT 'burger-craft'");
  }

  const customerColumns = db.prepare("PRAGMA table_info(customers)").all() as Array<{ name: string }>;
  const hasEmail = customerColumns.some(c => c.name === 'email');
  if (!hasEmail) {
    db.exec("ALTER TABLE customers ADD COLUMN email TEXT NOT NULL DEFAULT ''");
  }

  const restaurantColumns = db.prepare("PRAGMA table_info(restaurants)").all() as Array<{ name: string }>;
  const hasCategories = restaurantColumns.some(c => c.name === 'categories');
  if (!hasCategories) {
    db.exec("ALTER TABLE restaurants ADD COLUMN categories TEXT");
  }

  return db;
}
