import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from 'better-sqlite3';
import { createSqliteDatabase } from '../../src/infrastructure/persistence/sqlite/SqliteDatabase.js';
import { SqliteRestaurantTableRepository } from '../../src/infrastructure/persistence/sqlite/SqliteRestaurantTableRepository.js';
import { SqliteOrderRepository } from '../../src/infrastructure/persistence/sqlite/SqliteOrderRepository.js';
import { ConflictError } from '../../src/domain/errors/DomainErrors.js';
import { Order } from '../../src/domain/models/Order.js';
import { RestaurantTable } from '../../src/domain/models/RestaurantTable.js';

let hasSqliteBinding = false;
try {
  createSqliteDatabase(':memory:').close();
  hasSqliteBinding = true;
} catch {
  hasSqliteBinding = false;
}

const table = (restaurantId: string, id: string, name: string, sortOrder = 0): RestaurantTable => ({
  id,
  restaurantId,
  name,
  sortOrder,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe.skipIf(!hasSqliteBinding)('SQLite restaurant tables', () => {
  let db: Database;
  let repo: SqliteRestaurantTableRepository;
  let orders: SqliteOrderRepository;

  beforeEach(() => {
    db = createSqliteDatabase(':memory:');
    repo = new SqliteRestaurantTableRepository(db);
    orders = new SqliteOrderRepository(db);
  });

  afterEach(() => db.close());

  it('round-trips, orders by sort order and isolates tenants', async () => {
    await repo.save(table('rest-a', 'tbl_2', 'Mesa 2', 1));
    await repo.save(table('rest-a', 'tbl_1', 'Mesa 1', 0));
    await repo.save(table('rest-b', 'tbl_3', 'Mesa 1', 0));

    expect((await repo.findByRestaurantId('rest-a')).map((t) => t.name)).toEqual(['Mesa 1', 'Mesa 2']);
    expect(await repo.findById('tbl_1', 'rest-b')).toBeNull();

    await repo.save({ ...table('rest-a', 'tbl_1', 'Terraza', 0), isActive: false });
    expect(await repo.findById('tbl_1', 'rest-a')).toMatchObject({ name: 'Terraza', isActive: false });

    await repo.delete('tbl_1', 'rest-b');
    expect(await repo.findById('tbl_1', 'rest-a')).not.toBeNull();
    await repo.delete('tbl_1', 'rest-a');
    expect(await repo.findById('tbl_1', 'rest-a')).toBeNull();
  });

  it('rejects a duplicate name in the same restaurant ignoring case', async () => {
    await repo.save(table('rest-a', 'tbl_1', 'Mesa 1'));

    await expect(repo.save(table('rest-a', 'tbl_2', ' mesa 1 '))).rejects.toBeInstanceOf(ConflictError);
  });

  it('persists the table of an order on save and update', async () => {
    const order = new Order('ord-1', 'rest-a', undefined, [], 'pending', new Date(), 0, 1, 'Efectivo');
    order.tableId = 'tbl_1';
    order.tableLabel = 'Mesa 1';
    await orders.save(order);
    expect(await orders.findById('ord-1', 'rest-a')).toMatchObject({ tableId: 'tbl_1', tableLabel: 'Mesa 1' });

    const loaded = (await orders.findById('ord-1', 'rest-a'))!;
    loaded.tableId = undefined;
    loaded.tableLabel = undefined;
    await orders.update(loaded, 'rest-a');
    const after = await orders.findById('ord-1', 'rest-a');
    expect(after?.tableId).toBeUndefined();
    expect(after?.tableLabel).toBeUndefined();
  });
});

describe.skipIf(!hasSqliteBinding)('SQLite restaurant tables schema upgrade (0018 twin)', () => {
  const columns = (db: Database) => (db.prepare('PRAGMA table_info(restaurant_tables)').all() as Array<{ name: string }>).map((c) => c.name);

  it('creates zone, number and alias on a fresh database', () => {
    const db = createSqliteDatabase(':memory:');
    expect(columns(db)).toEqual(expect.arrayContaining(['zone', 'number', 'alias']));
    db.close();
  });

  it('adds the columns to a legacy file and backfills them from the old names, deriving name', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const BetterSqlite = (await import('better-sqlite3')).default;
    const dir = mkdtempSync(join(tmpdir(), 'tables-upgrade-'));
    const file = join(dir, 'legacy.db');
    try {
      const legacy = new BetterSqlite(file);
      legacy.exec(`CREATE TABLE restaurant_tables (
        id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL, name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT, updated_at TEXT)`);
      const ins = legacy.prepare('INSERT INTO restaurant_tables (id, restaurant_id, name, sort_order) VALUES (?, ?, ?, ?)');
      ['VIP', 'Mesa 1', 'terraza 2'].forEach((n, i) => ins.run(`t${i}`, 'rest-a', n, i));
      legacy.close();

      const db = createSqliteDatabase(file);
      const rows = db.prepare('SELECT zone, number, alias, name FROM restaurant_tables ORDER BY sort_order').all();
      expect(rows).toEqual([
        { zone: 'Mesa', number: 2, alias: 'VIP', name: 'Mesa 2 · VIP' },
        { zone: 'Mesa', number: 1, alias: null, name: 'Mesa 1' },
        { zone: 'Terraza', number: 2, alias: null, name: 'Terraza 2' },
      ]);
      db.close();

      // Re-opening an already upgraded file changes nothing.
      const again = createSqliteDatabase(file);
      expect(again.prepare('SELECT zone, number FROM restaurant_tables ORDER BY sort_order').all()).toHaveLength(3);
      again.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
