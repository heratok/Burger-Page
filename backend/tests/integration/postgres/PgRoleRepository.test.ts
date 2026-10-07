import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { PgRoleRepository } from '../../../src/infrastructure/persistence/postgres/PgRoleRepository.js';
import { PgUserRepository } from '../../../src/infrastructure/persistence/postgres/PgUserRepository.js';
import { ConflictError } from '../../../src/domain/errors/DomainErrors.js';
import { Role } from '../../../src/domain/models/Role.js';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';
const APP_USER_DATABASE_URL =
  process.env.APP_USER_DATABASE_URL || 'postgres://app_user:app_user_test_only@localhost:5432/burger_page_test';

let isDbConnected = false;

describe('PgRoleRepository (real Postgres, app_user role)', () => {
  let adminPool: pg.Pool;
  let repo: PgRoleRepository;
  let userRepo: PgUserRepository;
  const suffix = randomUUID().slice(0, 8);
  const REST_A = `pgrole-a-${suffix}`;
  const REST_B = `pgrole-b-${suffix}`;

  const role = (restaurantId: string, name: string, over: Partial<Role> = {}): Role => ({
    id: `role_${randomUUID()}`,
    restaurantId,
    name,
    permissions: ['orders.view'],
    isSystem: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...over,
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = APP_USER_DATABASE_URL;
    adminPool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
    try {
      await adminPool.query('SELECT 1');
      await adminPool.query(
        `INSERT INTO public.restaurants (id, slug, name, is_active) VALUES ($1,$1,'A',true),($2,$2,'B',true)`,
        [REST_A, REST_B]
      );
      isDbConnected = true;
      repo = new PgRoleRepository();
      userRepo = new PgUserRepository();
    } catch (err: any) {
      console.warn(`\n[PgRoleRepository Test] Skipping: ${err.message}`);
      isDbConnected = false;
    }
  });

  afterAll(async () => {
    if (isDbConnected) {
      await adminPool.query(`DELETE FROM public.users WHERE restaurant_id IN ($1, $2)`, [REST_A, REST_B]);
      await adminPool.query(`DELETE FROM public.restaurants WHERE id IN ($1, $2)`, [REST_A, REST_B]);
    }
    await adminPool?.end();
  });

  it('saves, reads back by name order, updates and deletes a role', async () => {
    if (!isDbConnected) return;
    const waiter = role(REST_A, 'waiter', { permissions: ['orders.view', 'orders.manage'], description: 'Floor' });
    const cook = role(REST_A, 'Cook');
    await repo.save(waiter);
    await repo.save(cook);

    const listed = await repo.findByRestaurantId(REST_A);
    expect(listed.map((r) => r.name)).toEqual(['Cook', 'waiter']);
    expect(listed[1]).toMatchObject({ permissions: ['orders.view', 'orders.manage'], description: 'Floor', isSystem: false });

    await repo.save({ ...waiter, name: 'Server', permissions: [], description: undefined });
    const updated = await repo.findById(waiter.id, REST_A);
    expect(updated).toMatchObject({ name: 'Server', permissions: [] });
    expect(updated?.description).toBeUndefined();

    await repo.delete(waiter.id, REST_A);
    expect(await repo.findById(waiter.id, REST_A)).toBeNull();
  });

  it('enforces unique names per restaurant ignoring case and padding, but not across restaurants', async () => {
    if (!isDbConnected) return;
    await repo.save(role(REST_A, 'Barista'));
    await expect(repo.save(role(REST_A, ' BARISTA '))).rejects.toBeInstanceOf(ConflictError);
    await expect(repo.save(role(REST_B, 'Barista'))).resolves.toBeUndefined();
  });

  it('isolates tenants through RLS: another tenant context cannot read or delete the role', async () => {
    if (!isDbConnected) return;
    const r = role(REST_A, 'Private');
    await repo.save(r);
    expect(await repo.findById(r.id, REST_B)).toBeNull();
    expect((await repo.findByRestaurantId(REST_B)).some((x) => x.id === r.id)).toBe(false);
    await repo.delete(r.id, REST_B);
    expect(await repo.findById(r.id, REST_A)).not.toBeNull();
  });

  it('rejects a role that violates the db checks (blank name, bad id)', async () => {
    if (!isDbConnected) return;
    await expect(repo.save(role(REST_A, '   '))).rejects.toThrow();
    await expect(repo.save(role(REST_A, 'Ok', { id: 'bad id!' }))).rejects.toThrow();
  });

  it('refuses to delete a role a staff user holds and maps it to ConflictError', async () => {
    if (!isDbConnected) return;
    const r = role(REST_A, 'InUse');
    await repo.save(r);
    const staffId = `usr_${randomUUID()}`;
    await userRepo.save({
      id: staffId,
      username: `staff-${suffix}`,
      passwordHash: 'x',
      role: 'restaurant_staff',
      restaurantId: REST_A,
      roleId: r.id,
      createdAt: new Date().toISOString(),
    });

    const loaded = await userRepo.findById(staffId);
    expect(loaded).toMatchObject({ role: 'restaurant_staff', roleId: r.id, restaurantId: REST_A });

    await expect(repo.delete(r.id, REST_A)).rejects.toBeInstanceOf(ConflictError);
    expect(await repo.findById(r.id, REST_A)).not.toBeNull();

    await userRepo.delete(staffId);
    await expect(repo.delete(r.id, REST_A)).resolves.toBeUndefined();
  });

  it('cannot attach a staff user to a role of another restaurant', async () => {
    if (!isDbConnected) return;
    const foreign = role(REST_B, 'Foreign');
    await repo.save(foreign);
    await expect(
      userRepo.save({
        id: `usr_${randomUUID()}`,
        username: `cross-${suffix}`,
        passwordHash: 'x',
        role: 'restaurant_staff',
        restaurantId: REST_A,
        roleId: foreign.id,
        createdAt: new Date().toISOString(),
      })
    ).rejects.toThrow();
  });
});
