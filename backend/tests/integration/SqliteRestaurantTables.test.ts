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
