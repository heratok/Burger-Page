import { describe, it, expect, vi } from 'vitest';
import { SupabaseUserRepository } from '../../src/infrastructure/persistence/supabase/SupabaseUserRepository.js';
import { User } from '../../src/domain/models/User.js';

describe('SupabaseUserRepository', () => {
  const mockClient: any = {
    from: vi.fn(),
  };

  const repo = new SupabaseUserRepository(mockClient);

  it('findByUsername returns user when found', async () => {
    mockClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'u-1',
              username: 'admin',
              password_hash: 'salt:hash123',
              role: 'super_admin',
              restaurant_id: null,
              created_at: '2026-08-30T00:00:00.000Z',
            },
            error: null,
          }),
        }),
      }),
    });

    const user = await repo.findByUsername('admin');
    expect(user).not.toBeNull();
    expect(user?.id).toBe('u-1');
    expect(user?.username).toBe('admin');
    expect(user?.role).toBe('super_admin');
  });

  it('save calls upsert with mapped payload', async () => {
    const upsertSpy = vi.fn().mockResolvedValue({ error: null });
    mockClient.from.mockReturnValue({
      upsert: upsertSpy,
    });

    const user: User = {
      id: 'u-2',
      username: 'manager',
      passwordHash: 'salt:pass123',
      role: 'restaurant_admin',
      restaurantId: 'rest-1',
      createdAt: '2026-08-30T00:00:00.000Z',
    };

    await repo.save(user);

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'u-2',
        username: 'manager',
        password_hash: 'salt:pass123',
        role: 'restaurant_admin',
        restaurant_id: 'rest-1',
      }),
      { onConflict: 'id' }
    );
  });

  it('delete calls delete on supabase client', async () => {
    const eqSpy = vi.fn().mockResolvedValue({ error: null });
    mockClient.from.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: eqSpy,
      }),
    });

    await repo.delete('u-2');
    expect(eqSpy).toHaveBeenCalledWith('id', 'u-2');
  });
});
