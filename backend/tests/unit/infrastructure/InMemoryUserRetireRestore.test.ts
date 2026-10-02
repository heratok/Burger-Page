import { describe, it, expect } from 'vitest';
import { InMemoryUserRepository } from '../../../src/infrastructure/persistence/InMemoryUserRepository.js';
import { User } from '../../../src/domain/models/User.js';

const mk = (id: string, isActive: boolean): User => ({
  id,
  username: id,
  passwordHash: 'h',
  role: 'restaurant_admin',
  restaurantId: 'rest-x',
  createdAt: new Date().toISOString(),
  isActive,
});

describe('InMemoryUserRepository retire/restore keeps the prior active state', () => {
  it('a user deactivated before the delete stays inactive after the restore', async () => {
    const repo = new InMemoryUserRepository();
    await repo.save(mk('active-admin', true));
    await repo.save(mk('off-admin', false));

    await repo.retireByRestaurantId('rest-x');
    await repo.retireByRestaurantId('rest-x'); // idempotent: must not capture the retired state
    const restored = await repo.restoreByRestaurantId('rest-x');

    expect(restored.map((r) => r.id).sort()).toEqual(['active-admin', 'off-admin']);
    expect((await repo.findById('active-admin'))?.isActive).toBe(true);
    expect((await repo.findById('off-admin'))?.isActive).toBe(false);
    expect((await repo.findById('off-admin'))?.username).toBe('off-admin');
  });
});
