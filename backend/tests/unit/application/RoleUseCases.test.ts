import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryRoleRepository } from '../../../src/infrastructure/persistence/InMemoryRoleRepository.js';
import { InMemoryUserRepository } from '../../../src/infrastructure/persistence/InMemoryUserRepository.js';
import { InMemoryAuditLogRepository } from '../../../src/infrastructure/persistence/InMemoryAuditLogRepository.js';
import { AdminAuditRecorder } from '../../../src/application/services/AdminAuditRecorder.js';
import { ListRolesUseCase } from '../../../src/application/use-cases/ListRolesUseCase.js';
import { CreateRoleUseCase } from '../../../src/application/use-cases/CreateRoleUseCase.js';
import { UpdateRoleUseCase } from '../../../src/application/use-cases/UpdateRoleUseCase.js';
import { DeleteRoleUseCase } from '../../../src/application/use-cases/DeleteRoleUseCase.js';
import { ConflictError, EntityNotFoundError, ValidationError } from '../../../src/domain/errors/DomainErrors.js';
import type { Role } from '../../../src/domain/models/Role.js';

const REST_A = 'rest-a';
const REST_B = 'rest-b';

describe('role use cases', () => {
  let roles: InMemoryRoleRepository;
  let users: InMemoryUserRepository;
  let auditRepo: InMemoryAuditLogRepository;
  let create: CreateRoleUseCase;
  let update: UpdateRoleUseCase;
  let remove: DeleteRoleUseCase;
  let list: ListRolesUseCase;

  beforeEach(() => {
    roles = new InMemoryRoleRepository();
    users = new InMemoryUserRepository();
    auditRepo = new InMemoryAuditLogRepository();
    const audit = new AdminAuditRecorder(auditRepo, { error: vi.fn() });
    create = new CreateRoleUseCase(roles, audit);
    update = new UpdateRoleUseCase(roles, audit);
    remove = new DeleteRoleUseCase(roles, users, audit);
    list = new ListRolesUseCase(roles);
  });

  describe('CreateRoleUseCase', () => {
    it('creates a tenant-scoped role with trimmed name, an rol_ id and deduplicated catalog permissions', async () => {
      const role = await create.execute(REST_A, {
        name: '  Cashier  ',
        description: ' Front desk ',
        permissions: ['orders.view', 'orders.manage'],
      });
      expect(role).toMatchObject({
        restaurantId: REST_A,
        name: 'Cashier',
        description: 'Front desk',
        permissions: ['orders.view', 'orders.manage'],
        isSystem: false,
      });
      expect(role.id).toMatch(/^role_/);
      expect(await roles.findById(role.id, REST_A)).toMatchObject({ name: 'Cashier' });
    });

    it('rejects blank and oversized names', async () => {
      await expect(create.execute(REST_A, { name: '   ', permissions: [] })).rejects.toBeInstanceOf(ValidationError);
      await expect(create.execute(REST_A, { name: 'x'.repeat(41), permissions: [] })).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects permissions outside the catalog', async () => {
      await expect(
        create.execute(REST_A, { name: 'Hacker', permissions: ['orders.view', 'db.drop' as any] })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('collapses a repeated permission instead of storing it twice', async () => {
      const role = await create.execute(REST_A, { name: 'Dup', permissions: ['orders.view', 'orders.view'] });
      expect(role.permissions).toEqual(['orders.view']);
    });

    it('keeps names unique per restaurant ignoring case, but allows the same name in another restaurant', async () => {
      await create.execute(REST_A, { name: 'Cashier', permissions: [] });
      await expect(create.execute(REST_A, { name: ' cashier ', permissions: [] })).rejects.toBeInstanceOf(ConflictError);
      await expect(create.execute(REST_B, { name: 'Cashier', permissions: [] })).resolves.toMatchObject({ restaurantId: REST_B });
    });

    it('audits a super admin acting on a tenant and ignores tenant admins', async () => {
      const role = await create.execute(
        REST_A,
        { name: 'Audited', permissions: ['orders.view'] },
        { userId: 'u1', username: 'root', role: 'super_admin' }
      );
      await create.execute(REST_A, { name: 'Silent', permissions: [] }, { userId: 'u2', username: 'owner', role: 'restaurant_admin' });
      const page = await auditRepo.list({ limit: 10 });
      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toMatchObject({
        action: 'role.create',
        targetType: 'role',
        targetId: role.id,
        targetLabel: 'Audited',
        restaurantId: REST_A,
      });
    });
  });

  describe('UpdateRoleUseCase', () => {
    it('updates name, description and permissions, bumping updatedAt', async () => {
      const role = await create.execute(REST_A, { name: 'Cook', permissions: ['orders.view'] });
      await new Promise((r) => setTimeout(r, 2));
      const updated = await update.execute(role.id, REST_A, {
        name: 'Head cook',
        description: 'Kitchen',
        permissions: ['orders.view', 'orders.manage'],
      });
      expect(updated).toMatchObject({ name: 'Head cook', description: 'Kitchen', permissions: ['orders.view', 'orders.manage'] });
      expect(updated.updatedAt >= role.updatedAt).toBe(true);
      expect(updated.createdAt).toBe(role.createdAt);
    });

    it('leaves omitted fields untouched', async () => {
      const role = await create.execute(REST_A, { name: 'Cook', description: 'Hot line', permissions: ['orders.view'] });
      const updated = await update.execute(role.id, REST_A, { name: 'Chef' });
      expect(updated).toMatchObject({ name: 'Chef', description: 'Hot line', permissions: ['orders.view'] });
    });

    it('is not found for another tenant or an unknown id', async () => {
      const role = await create.execute(REST_A, { name: 'Cook', permissions: [] });
      await expect(update.execute(role.id, REST_B, { name: 'X' })).rejects.toBeInstanceOf(EntityNotFoundError);
      await expect(update.execute('role_missing', REST_A, { name: 'X' })).rejects.toBeInstanceOf(EntityNotFoundError);
    });

    it('rejects a rename onto another role of the same restaurant and invalid permissions', async () => {
      await create.execute(REST_A, { name: 'Cook', permissions: [] });
      const waiter = await create.execute(REST_A, { name: 'Waiter', permissions: [] });
      await expect(update.execute(waiter.id, REST_A, { name: 'COOK' })).rejects.toBeInstanceOf(ConflictError);
      await expect(update.execute(waiter.id, REST_A, { permissions: ['nope' as any] })).rejects.toBeInstanceOf(ValidationError);
      await expect(update.execute(waiter.id, REST_A, { name: '' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('allows keeping the same name (case change included) on the same role', async () => {
      const role = await create.execute(REST_A, { name: 'Cook', permissions: [] });
      await expect(update.execute(role.id, REST_A, { name: 'COOK' })).resolves.toMatchObject({ name: 'COOK' });
    });

    it('refuses to edit a system role', async () => {
      const system: Role = {
        id: 'role_sys', restaurantId: REST_A, name: 'Built-in', permissions: [], isSystem: true,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      await roles.save(system);
      await expect(update.execute('role_sys', REST_A, { name: 'Renamed' })).rejects.toBeInstanceOf(ConflictError);
    });

    it('audits a super admin update with the changed field names', async () => {
      const role = await create.execute(REST_A, { name: 'Cook', permissions: [] });
      await update.execute(role.id, REST_A, { permissions: ['orders.view'] }, { userId: 'u1', username: 'root', role: 'super_admin' });
      const page = await auditRepo.list({ limit: 10 });
      expect(page.items[0]).toMatchObject({ action: 'role.update', targetType: 'role', targetId: role.id });
      expect(page.items[0].details).toMatchObject({ changedFields: ['permissions'] });
    });
  });

  describe('DeleteRoleUseCase', () => {
    it('deletes an unused role', async () => {
      const role = await create.execute(REST_A, { name: 'Temp', permissions: [] });
      await remove.execute(role.id, REST_A);
      expect(await roles.findById(role.id, REST_A)).toBeNull();
    });

    it('refuses with ConflictError while a user still holds the role', async () => {
      const role = await create.execute(REST_A, { name: 'Busy', permissions: [] });
      await users.save({
        id: 'usr_staff', username: 'staff1', passwordHash: 'x', role: 'restaurant_staff',
        restaurantId: REST_A, roleId: role.id, createdAt: new Date().toISOString(),
      });
      await expect(remove.execute(role.id, REST_A)).rejects.toBeInstanceOf(ConflictError);
      expect(await roles.findById(role.id, REST_A)).not.toBeNull();
      await users.delete('usr_staff');
      await expect(remove.execute(role.id, REST_A)).resolves.toBeUndefined();
    });

    it('is not found for another tenant or an unknown id', async () => {
      const role = await create.execute(REST_A, { name: 'Temp', permissions: [] });
      await expect(remove.execute(role.id, REST_B)).rejects.toBeInstanceOf(EntityNotFoundError);
      await expect(remove.execute('role_missing', REST_A)).rejects.toBeInstanceOf(EntityNotFoundError);
    });

    it('refuses to delete a system role', async () => {
      await roles.save({
        id: 'role_sys', restaurantId: REST_A, name: 'Built-in', permissions: [], isSystem: true,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
      await expect(remove.execute('role_sys', REST_A)).rejects.toBeInstanceOf(ConflictError);
    });

    it('audits a super admin delete', async () => {
      const role = await create.execute(REST_A, { name: 'Temp', permissions: [] });
      await remove.execute(role.id, REST_A, { userId: 'u1', username: 'root', role: 'super_admin' });
      const page = await auditRepo.list({ limit: 10 });
      expect(page.items[0]).toMatchObject({ action: 'role.delete', targetLabel: 'Temp', restaurantId: REST_A });
    });
  });

  describe('ListRolesUseCase', () => {
    it('lists only the tenant roles ordered by name', async () => {
      await create.execute(REST_A, { name: 'Waiter', permissions: [] });
      await create.execute(REST_A, { name: 'Cook', permissions: [] });
      await create.execute(REST_B, { name: 'Other', permissions: [] });
      expect((await list.execute(REST_A)).map((r) => r.name)).toEqual(['Cook', 'Waiter']);
    });
  });
});
