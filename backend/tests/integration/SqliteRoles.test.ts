import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from 'better-sqlite3';
import { createSqliteDatabase } from '../../src/infrastructure/persistence/sqlite/SqliteDatabase.js';
import { SqliteRoleRepository } from '../../src/infrastructure/persistence/sqlite/SqliteRoleRepository.js';
import { ConflictError } from '../../src/domain/errors/DomainErrors.js';
import { Role } from '../../src/domain/models/Role.js';

let hasSqliteBinding = false;
try {
  createSqliteDatabase(':memory:').close();
  hasSqliteBinding = true;
} catch {
  hasSqliteBinding = false;
}

const role = (restaurantId: string, id: string, name: string, over: Partial<Role> = {}): Role => ({
  id,
  restaurantId,
  name,
  permissions: ['orders.view'],
  isSystem: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe.skipIf(!hasSqliteBinding)('SQLite roles', () => {
  let db: Database;
  let repo: SqliteRoleRepository;

  beforeEach(() => {
    db = createSqliteDatabase(':memory:');
    repo = new SqliteRoleRepository(db);
  });

  afterEach(() => db.close());

  it('round-trips permissions and description, orders by name and isolates tenants', async () => {
    await repo.save(role('rest-a', 'role_2', 'waiter', { permissions: ['orders.view', 'orders.manage'], description: 'Floor' }));
    await repo.save(role('rest-a', 'role_1', 'Cook'));
    await repo.save(role('rest-b', 'role_3', 'Cook'));

    const listed = await repo.findByRestaurantId('rest-a');
    expect(listed.map((r) => r.name)).toEqual(['Cook', 'waiter']);
    expect(listed[1]).toMatchObject({ permissions: ['orders.view', 'orders.manage'], description: 'Floor', isSystem: false });
    expect(await repo.findById('role_1', 'rest-b')).toBeNull();
  });

  it('updates in place and clears the description', async () => {
    await repo.save(role('rest-a', 'role_1', 'Cook', { description: 'Hot line' }));
    await repo.save(role('rest-a', 'role_1', 'Chef', { permissions: [], updatedAt: '2026-02-01T00:00:00.000Z' }));
    const found = await repo.findById('role_1', 'rest-a');
    expect(found).toMatchObject({ name: 'Chef', permissions: [], updatedAt: '2026-02-01T00:00:00.000Z' });
    expect(found?.description).toBeUndefined();
  });

  it('keeps names unique per restaurant ignoring case and padding', async () => {
    await repo.save(role('rest-a', 'role_1', 'Cook'));
    await expect(repo.save(role('rest-a', 'role_2', '  COOK '))).rejects.toBeInstanceOf(ConflictError);
    await expect(repo.save(role('rest-b', 'role_3', 'Cook'))).resolves.toBeUndefined();
  });

  it('deletes only inside the tenant', async () => {
    await repo.save(role('rest-a', 'role_1', 'Cook'));
    await repo.delete('role_1', 'rest-b');
    expect(await repo.findById('role_1', 'rest-a')).not.toBeNull();
    await repo.delete('role_1', 'rest-a');
    expect(await repo.findById('role_1', 'rest-a')).toBeNull();
  });
});
