import { describe, it, expect, vi } from 'vitest';
import { PERMISSIONS } from '@burger-page/contracts';
import { AuthenticateUserUseCase } from '../../../src/application/use-cases/AuthenticateUserUseCase.js';
import { InMemoryUserRepository } from '../../../src/infrastructure/persistence/InMemoryUserRepository.js';
import { InMemoryRoleRepository } from '../../../src/infrastructure/persistence/InMemoryRoleRepository.js';
import type { PasswordHasher } from '../../../src/domain/ports/out/PasswordHasher.js';
import type { User } from '../../../src/domain/models/User.js';

const hasher: PasswordHasher = { hash: vi.fn(), verify: vi.fn().mockResolvedValue(true) };
const now = new Date().toISOString();

async function setup() {
  const users = new InMemoryUserRepository();
  const roles = new InMemoryRoleRepository();
  await roles.save({ id: 'role-cashier', restaurantId: 'rest-a', name: 'Cashier', permissions: ['orders.view', 'orders.manage'], isSystem: false, createdAt: now, updatedAt: now });
  const staff: User = { id: 'u-staff', username: 'cashier1', passwordHash: 'h', role: 'restaurant_staff', restaurantId: 'rest-a', roleId: 'role-cashier', createdAt: now, isActive: true };
  await users.save(staff);
  return { users, roles };
}

describe('login payload permissions', () => {
  it('returns the stored role permissions and roleId for a staff user', async () => {
    const { users, roles } = await setup();
    const result = await new AuthenticateUserUseCase(users, hasher, undefined, undefined, roles).execute('cashier1', 'pw');
    expect(result.user?.role).toBe('restaurant_staff');
    expect(result.user?.roleId).toBe('role-cashier');
    expect(result.user?.permissions).toEqual(['orders.view', 'orders.manage']);
  });

  it('gives a restaurant_admin and a super_admin the whole catalog', async () => {
    const { users, roles } = await setup();
    const uc = new AuthenticateUserUseCase(users, hasher, undefined, undefined, roles);
    expect((await uc.execute('admin_craft', 'pw')).user?.permissions).toEqual([...PERMISSIONS]);
    expect((await uc.execute('admin', 'pw')).user?.permissions).toEqual([...PERMISSIONS]);
  });

  it('gives staff no permissions when the role cannot be resolved', async () => {
    const { users } = await setup();
    const withoutRoles = await new AuthenticateUserUseCase(users, hasher, undefined, undefined, new InMemoryRoleRepository()).execute('cashier1', 'pw');
    expect(withoutRoles.user?.permissions).toEqual([]);
    const noRepo = await new AuthenticateUserUseCase(users, hasher).execute('cashier1', 'pw');
    expect(noRepo.user?.permissions).toEqual([]);
  });
});
