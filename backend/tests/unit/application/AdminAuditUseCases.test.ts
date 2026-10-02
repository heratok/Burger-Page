import { describe, it, expect, beforeEach } from 'vitest';
import { CreateRestaurantUseCase } from '../../../src/application/use-cases/CreateRestaurantUseCase.js';
import { UpdateRestaurantUseCase } from '../../../src/application/use-cases/UpdateRestaurantUseCase.js';
import { DeleteRestaurantUseCase } from '../../../src/application/use-cases/DeleteRestaurantUseCase.js';
import { RestoreRestaurantUseCase } from '../../../src/application/use-cases/RestoreRestaurantUseCase.js';
import { CreateUserUseCase } from '../../../src/application/use-cases/CreateUserUseCase.js';
import { UpdateUserUseCase } from '../../../src/application/use-cases/UpdateUserUseCase.js';
import { DeleteUserUseCase } from '../../../src/application/use-cases/DeleteUserUseCase.js';
import { ResetUserPasswordUseCase } from '../../../src/application/use-cases/ResetUserPasswordUseCase.js';
import { AdminAuditRecorder, AuditActor } from '../../../src/application/services/AdminAuditRecorder.js';
import { InMemoryAuditLogRepository } from '../../../src/infrastructure/persistence/InMemoryAuditLogRepository.js';
import { InMemoryUserRepository } from '../../../src/infrastructure/persistence/InMemoryUserRepository.js';
import { InMemoryRestaurantRepository } from '../../../src/infrastructure/persistence/InMemoryRestaurantRepository.js';
import { InMemoryCategoryRepository } from '../../../src/infrastructure/persistence/InMemoryCategoryRepository.js';
import { CryptoPasswordHasher } from '../../../src/infrastructure/security/CryptoPasswordHasher.js';
import { AuditLogEntry } from '../../../src/domain/models/AuditLogEntry.js';
import { ConflictError } from '../../../src/domain/errors/DomainErrors.js';

const actor: AuditActor = { userId: 'root', username: 'root', role: 'super_admin' };

describe('super admin mutations are audited', () => {
  let audit: InMemoryAuditLogRepository;
  let recorder: AdminAuditRecorder;
  let users: InMemoryUserRepository;
  let restaurants: InMemoryRestaurantRepository;
  const hasher = new CryptoPasswordHasher();

  const entries = async (): Promise<AuditLogEntry[]> => (await audit.list({ limit: 200 })).items.reverse();
  const actions = async () => (await entries()).map((e) => e.action);

  beforeEach(async () => {
    audit = new InMemoryAuditLogRepository();
    recorder = new AdminAuditRecorder(audit);
    users = new InMemoryUserRepository();
    for (const u of await users.findAll()) await users.delete(u.id);
    restaurants = new InMemoryRestaurantRepository();
    await users.save({ id: 'root', username: 'root', passwordHash: 'h', role: 'super_admin', createdAt: '2026-01-01T00:00:00.000Z', isActive: true });
    await users.save({ id: 'root2', username: 'root2', passwordHash: 'h', role: 'super_admin', createdAt: '2026-01-01T00:00:00.000Z', isActive: true });
    await users.save({ id: 'tenant', username: 'tenant_admin', passwordHash: 'h', role: 'restaurant_admin', restaurantId: 'burger-craft', createdAt: '2026-01-01T00:00:00.000Z', isActive: true });
  });

  it('create restaurant: records restaurant.create with slug, currency, template and the admin USERNAME only', async () => {
    const uc = new CreateRestaurantUseCase(restaurants, new InMemoryCategoryRepository(), users, hasher, undefined, undefined, recorder);
    const created = await uc.execute(
      { name: 'Nuevo', slug: 'nuevo', currency: 'MXN', adminPassword: 'supersecret1' } as any,
      'super_admin',
      actor
    );
    const [e] = await entries();
    expect(e).toMatchObject({
      action: 'restaurant.create',
      targetType: 'restaurant',
      targetId: created.id,
      targetLabel: 'Nuevo',
      restaurantId: created.id,
      actorUserId: 'root',
      actorUsername: 'root',
    });
    expect(e.details).toMatchObject({ slug: 'nuevo', currency: 'MXN', adminUsername: 'admin_nuevo' });
    expect(JSON.stringify(e)).not.toContain('supersecret1');
    expect(JSON.stringify(e)).not.toContain(created.adminPassword as string);
  });

  it('create restaurant: a failed create records nothing', async () => {
    const uc = new CreateRestaurantUseCase(restaurants, undefined, users, hasher, undefined, undefined, recorder);
    await expect(uc.execute({ name: 'Dup', slug: 'burger-craft' } as any, 'super_admin', actor)).rejects.toThrow();
    expect(await entries()).toEqual([]);
  });

  it('update restaurant: records restaurant.update with changed field names and scalar before/after', async () => {
    const uc = new UpdateRestaurantUseCase(restaurants, undefined, users, hasher, recorder);
    await uc.execute('burger-craft', { name: 'Renombrado', slug: 'otro-slug', timezone: 'America/Mexico_City', currency: 'MXN' }, 'super_admin', actor);
    const [e] = await entries();
    expect(e.action).toBe('restaurant.update');
    expect(e.targetId).toBe('burger-craft');
    expect(e.targetLabel).toBe('Renombrado');
    expect((e.details.changedFields as string[]).sort()).toEqual(['currency', 'name', 'slug', 'timezone']);
    expect(e.details.changes).toMatchObject({
      slug: { from: 'burger-craft', to: 'otro-slug' },
      timezone: { to: 'America/Mexico_City' },
      currency: { to: 'MXN' },
    });
  });

  it('update restaurant: pause and activate are their own actions; a no-op records nothing', async () => {
    const uc = new UpdateRestaurantUseCase(restaurants, undefined, users, hasher, recorder);
    await uc.execute('burger-craft', { isActive: false }, 'super_admin', actor);
    await uc.execute('burger-craft', { isActive: true }, 'super_admin', actor);
    await uc.execute('burger-craft', { isActive: true }, 'super_admin', actor);
    await uc.execute('burger-craft', { tagline: (await restaurants.findById('burger-craft'))!.tagline }, 'super_admin', actor);
    expect(await actions()).toEqual(['restaurant.pause', 'restaurant.activate']);
  });

  it('update restaurant: pause plus an edit in one request records both actions', async () => {
    const uc = new UpdateRestaurantUseCase(restaurants, undefined, users, hasher, recorder);
    await uc.execute('burger-craft', { isActive: false, tagline: 'Cerrado por obras' }, 'super_admin', actor);
    expect((await actions()).sort()).toEqual(['restaurant.pause', 'restaurant.update']);
  });

  it('update restaurant: an admin password rotation names the field but never stores the value', async () => {
    const uc = new UpdateRestaurantUseCase(restaurants, undefined, users, hasher, recorder);
    await users.save({ id: 'adm', username: 'adm', passwordHash: 'h', role: 'restaurant_admin', restaurantId: 'tenant-a', createdAt: '2026-01-01T00:00:00.000Z', isActive: true });
    await uc.execute('tenant-a', { adminPassword: 'rotated-secret-9' }, 'super_admin', actor);
    const [e] = await entries();
    expect(e.action).toBe('restaurant.update');
    expect(e.details.changedFields).toEqual(['adminPassword']);
    expect(JSON.stringify(e)).not.toContain('rotated-secret-9');
  });

  it('update restaurant: a restaurant admin edit is NOT audited (only super admin actions are)', async () => {
    const uc = new UpdateRestaurantUseCase(restaurants, undefined, users, hasher, recorder);
    await uc.execute('burger-craft', { name: 'Mi local' }, 'restaurant_admin', { userId: 'tenant', username: 'tenant_admin', role: 'restaurant_admin' });
    expect(await entries()).toEqual([]);
  });

  it('delete and restore restaurant', async () => {
    await new DeleteRestaurantUseCase(restaurants, users, recorder).execute('burger-craft', actor);
    await new RestoreRestaurantUseCase(restaurants, users, recorder).execute({ id: 'burger-craft', actor });
    const [del, res] = await entries();
    expect(del).toMatchObject({ action: 'restaurant.delete', targetId: 'burger-craft', restaurantId: 'burger-craft' });
    expect(del.details).toMatchObject({ slug: 'burger-craft' });
    expect(res).toMatchObject({ action: 'restaurant.restore', targetId: 'burger-craft', restaurantId: 'burger-craft' });
    expect(res.details).toMatchObject({ slug: 'burger-craft', renamedUsers: [] });
  });

  it('create user records user.create with username, role and restaurant, never the password', async () => {
    const uc = new CreateUserUseCase(users, hasher, restaurants, recorder);
    const u = await uc.execute({ username: 'nuevo', password: 'password-123', role: 'restaurant_admin', restaurantId: 'burger-craft' }, 'super_admin', actor);
    const [e] = await entries();
    expect(e).toMatchObject({ action: 'user.create', targetType: 'user', targetId: u.id, targetLabel: 'nuevo', restaurantId: 'burger-craft' });
    expect(e.details).toMatchObject({ username: 'nuevo', role: 'restaurant_admin' });
    expect(JSON.stringify(e)).not.toContain('password-123');
    expect(JSON.stringify(e)).not.toContain(u.passwordHash);
  });

  it('update user records user.update with before/after and splits activate/deactivate', async () => {
    const uc = new UpdateUserUseCase(users, restaurants, recorder);
    await uc.execute({ actorId: 'root', actor, targetId: 'tenant', username: 'renamed', isActive: false });
    await uc.execute({ actorId: 'root', actor, targetId: 'tenant', isActive: true });
    const [upd, deact, act] = (await entries()).sort((a, b) => a.action.localeCompare(b.action)).reverse();
    // sorted descending by action: user.update, user.deactivate, user.activate
    expect(upd.action).toBe('user.update');
    expect(upd.targetLabel).toBe('renamed');
    expect(upd.restaurantId).toBe('burger-craft');
    expect(upd.details.changes).toMatchObject({ username: { from: 'tenant_admin', to: 'renamed' } });
    expect(deact.action).toBe('user.deactivate');
    expect(act.action).toBe('user.activate');
  });

  it('update user: a refused change (guard) records nothing', async () => {
    const uc = new UpdateUserUseCase(users, restaurants, recorder);
    await expect(uc.execute({ actorId: 'root', actor, targetId: 'tenant', username: 'root2' })).rejects.toThrow(ConflictError);
    expect(await entries()).toEqual([]);
  });

  it('delete user keeps a snapshot of the username and role', async () => {
    await new DeleteUserUseCase(users, recorder).execute({ actorId: 'root', actor, targetId: 'tenant' });
    const [e] = await entries();
    expect(e).toMatchObject({ action: 'user.delete', targetId: 'tenant', targetLabel: 'tenant_admin', restaurantId: 'burger-craft' });
    expect(e.details).toMatchObject({ username: 'tenant_admin', role: 'restaurant_admin' });
    expect(await users.findById('tenant')).toBeNull();
  });

  it('reset password records user.reset_password without the temporary password', async () => {
    const uc = new ResetUserPasswordUseCase(users, hasher, () => 'TEMP-PASS-xyz', recorder);
    const { temporaryPassword } = await uc.execute({ targetId: 'tenant', actor });
    expect(temporaryPassword).toBe('TEMP-PASS-xyz');
    const [e] = await entries();
    expect(e).toMatchObject({ action: 'user.reset_password', targetId: 'tenant', targetLabel: 'tenant_admin', restaurantId: 'burger-craft' });
    expect(JSON.stringify(e)).not.toContain('TEMP-PASS-xyz');
  });

  it('a mutation still succeeds when the audit write fails (fail-open) and the write was attempted', async () => {
    let attempts = 0;
    const failing = new AdminAuditRecorder(
      { record: async () => { attempts++; throw new Error('db down'); }, list: async () => ({ items: [], nextCursor: null }) },
      { error: () => {} }
    );
    await new DeleteUserUseCase(users, failing).execute({ actorId: 'root', actor, targetId: 'tenant' });
    expect(attempts).toBe(1);
    expect(await users.findById('tenant')).toBeNull();
  });

  it('without an actor (scripts) nothing is recorded and nothing breaks', async () => {
    await new DeleteUserUseCase(users, recorder).execute({ actorId: 'root', targetId: 'tenant' });
    expect(await entries()).toEqual([]);
  });
});
