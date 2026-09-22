import { describe, it, expect, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';
import { createAuthMiddlewares } from '../../src/infrastructure/http/middleware/auth.middleware.js';
import { User } from '../../src/domain/models/User.js';
import { Restaurant } from '../../src/domain/models/Restaurant.js';
import { UserRepository } from '../../src/domain/ports/out/UserRepository.js';
import { RestaurantRepository } from '../../src/domain/ports/out/RestaurantRepository.js';

// Minimal fakes: only the members the revalidation path calls are implemented;
// everything else throws so a test can never silently depend on unused ports.
class FakeUserRepository implements UserRepository {
  private users = new Map<string, User>();

  setUser(user: User): void {
    this.users.set(user.id, user);
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByUsername(): Promise<User | null> {
    throw new Error('findByUsername is not used by the revalidation path');
  }
  async findByRestaurantId(): Promise<User[]> {
    throw new Error('findByRestaurantId is not used by the revalidation path');
  }
  async findAll(): Promise<User[]> {
    throw new Error('findAll is not used by the revalidation path');
  }
  async save(): Promise<void> {
    throw new Error('save is not used by the revalidation path');
  }
  async delete(): Promise<void> {
    throw new Error('delete is not used by the revalidation path');
  }
}

class FakeRestaurantRepository implements RestaurantRepository {
  private restaurants = new Map<string, Restaurant>();

  setRestaurant(restaurant: Restaurant): void {
    this.restaurants.set(restaurant.id, restaurant);
  }

  async findById(id: string): Promise<Restaurant | null> {
    return this.restaurants.get(id) ?? null;
  }

  async findBySlug(): Promise<Restaurant | null> {
    throw new Error('findBySlug is not used by the revalidation path');
  }
  async findAll(): Promise<Restaurant[]> {
    throw new Error('findAll is not used by the revalidation path');
  }
  async save(): Promise<void> {
    throw new Error('save is not used by the revalidation path');
  }
  async delete(): Promise<void> {
    throw new Error('delete is not used by the revalidation path');
  }
}

function makeUser(partial: Partial<User> & { id: string; role: User['role'] }): User {
  return {
    username: `username-${partial.id}`,
    passwordHash: 'fake-hash',
    createdAt: new Date().toISOString(),
    isActive: true,
    ...partial,
  };
}

function buildRevalidatingApp(userRepo: UserRepository, restaurantRepo?: RestaurantRepository) {
  const jwtService = new JwtService('test-secret-jwt-revalidation');
  const { requireAuth, requireSuperAdmin, requireStreamToken } = createAuthMiddlewares(jwtService, {
    userRepo,
    ...(restaurantRepo ? { restaurantRepo } : {}),
  });
  const app: FastifyInstance = fastify();
  app.get('/me', { preHandler: [requireAuth] }, async (req) => ({ context: req.authContext }));
  app.get('/super-only', { preHandler: [requireSuperAdmin] }, async (req) => ({ context: req.authContext }));
  app.get('/stream', { preHandler: [requireStreamToken] }, async (req) => ({ context: req.authContext }));
  return { app, jwtService };
}

const activeApps: FastifyInstance[] = [];

async function buildAndTrack(userRepo: UserRepository, restaurantRepo?: RestaurantRepository) {
  const { app, jwtService } = buildRevalidatingApp(userRepo, restaurantRepo);
  activeApps.push(app);
  return { app, jwtService };
}

afterEach(async () => {
  while (activeApps.length > 0) {
    const app = activeApps.pop()!;
    await app.close();
  }
});

describe('JWT revalidation against users.is_active / role / restaurant (SUS-14)', () => {
  it('Seam A: a valid token is revalidated and the STORED user identity governs the auth context', async () => {
    const userRepo = new FakeUserRepository();
    userRepo.setUser(
      makeUser({
        id: 'user-100',
        username: 'stored-username',
        role: 'restaurant_admin',
        restaurantId: 'rest-100',
      })
    );

    const { app, jwtService } = await buildAndTrack(userRepo);
    const token = jwtService.generateToken({
      id: 'user-100',
      username: 'stale-claim-username',
      role: 'restaurant_admin',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().context).toEqual({
      userId: 'user-100',
      username: 'stored-username',
      role: 'restaurant_admin',
      restaurantId: 'rest-100',
    });
  });

  it('Seam B: a token whose subject has no user row anymore is rejected with 401', async () => {
    // Repo deliberately does not contain the token subject (user deleted).
    const { app, jwtService } = await buildAndTrack(new FakeUserRepository());
    const token = jwtService.generateToken({
      id: 'user-ghost',
      username: 'ghost',
      role: 'restaurant_admin',
      restaurantId: 'rest-404',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
  });

  it('Seam C: a token of a deactivated user (is_active=false) is rejected with 401', async () => {
    const userRepo = new FakeUserRepository();
    userRepo.setUser(
      makeUser({
        id: 'user-200',
        username: 'deactivated',
        role: 'restaurant_admin',
        restaurantId: 'rest-200',
        isActive: false,
      })
    );

    const { app, jwtService } = await buildAndTrack(userRepo);
    const token = jwtService.generateToken({
      id: 'user-200',
      username: 'deactivated',
      role: 'restaurant_admin',
      restaurantId: 'rest-200',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
  });

  it('Seam D: a role changed after login (stale JWT claim) is overridden by the STORED role, which governs routing', async () => {
    const userRepo = new FakeUserRepository();
    userRepo.setUser(
      makeUser({
        id: 'user-300',
        username: 'demoted',
        role: 'restaurant_admin',
        restaurantId: 'rest-300',
      })
    );

    const { app, jwtService } = await buildAndTrack(userRepo);
    // Token still claims the OLD, elevated role.
    const token = jwtService.generateToken({
      id: 'user-300',
      username: 'demoted',
      role: 'super_admin',
    });

    const me = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().context.role).toBe('restaurant_admin');

    // The super-admin-only route must not honor the stale elevated claim.
    const superOnly = await app.inject({
      method: 'GET',
      url: '/super-only',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(superOnly.statusCode).toBe(403);
  });

  it('Seam E: an admin of a restaurant deactivated server-side loses access (401)', async () => {
    const userRepo = new FakeUserRepository();
    userRepo.setUser(
      makeUser({
        id: 'user-400',
        username: 'tenant-admin',
        role: 'restaurant_admin',
        restaurantId: 'rest-off',
      })
    );
    const restaurantRepo = new FakeRestaurantRepository();
    restaurantRepo.setRestaurant({
      id: 'rest-off',
      name: 'Closed Tenant',
      theme: 'dark',
      openingHours: { open: '10:00', close: '22:00' },
      isActive: false,
    });

    const { app, jwtService } = await buildAndTrack(userRepo, restaurantRepo);
    const token = jwtService.generateToken({
      id: 'user-400',
      username: 'tenant-admin',
      role: 'restaurant_admin',
      restaurantId: 'rest-off',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
  });

  it('Triangulate: fail closed — a tenant-bound user whose restaurant row is missing is rejected with 401', async () => {
    const userRepo = new FakeUserRepository();
    userRepo.setUser(
      makeUser({
        id: 'user-410',
        username: 'orphan-admin',
        role: 'restaurant_admin',
        restaurantId: 'rest-orphan',
      })
    );
    // RestaurantRepo configured but the tenant row is gone.
    const { app, jwtService } = await buildAndTrack(userRepo, new FakeRestaurantRepository());
    const token = jwtService.generateToken({
      id: 'user-410',
      username: 'orphan-admin',
      role: 'restaurant_admin',
      restaurantId: 'rest-orphan',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
  });

  it('Triangulate: a super_admin without restaurant binding is NOT blocked by the restaurant check', async () => {
    const userRepo = new FakeUserRepository();
    userRepo.setUser(
      makeUser({
        id: 'user-500',
        username: 'root-admin',
        role: 'super_admin',
      })
    );
    const { app, jwtService } = await buildAndTrack(userRepo, new FakeRestaurantRepository());
    const token = jwtService.generateToken({
      id: 'user-500',
      username: 'root-admin',
      role: 'super_admin',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/super-only',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().context.role).toBe('super_admin');
  });

  describe('requireStreamToken SUS-14 parity (JD-CONFIRMED-002)', () => {
    it('rejects with 401 if user in query token no longer exists in repository', async () => {
      const userRepo = new FakeUserRepository();
      const restaurantRepo = new FakeRestaurantRepository();
      const { app, jwtService } = await buildAndTrack(userRepo, restaurantRepo);

      const token = jwtService.generateToken({
        id: 'user-missing',
        username: 'ghost',
        role: 'restaurant_admin',
        restaurantId: 'rest-1',
        scope: 'sse',
      });

      const res = await app.inject({
        method: 'GET',
        url: `/stream?token=${token}`,
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().detail).toBe('Account no longer exists.');
    });

    it('rejects with 401 if user in query token is deactivated in repository', async () => {
      const userRepo = new FakeUserRepository();
      userRepo.setUser(
        makeUser({
          id: 'user-deactivated',
          username: 'disabled_user',
          role: 'restaurant_admin',
          restaurantId: 'rest-1',
          isActive: false,
        })
      );
      const restaurantRepo = new FakeRestaurantRepository();
      const { app, jwtService } = await buildAndTrack(userRepo, restaurantRepo);

      const token = jwtService.generateToken({
        id: 'user-deactivated',
        username: 'disabled_user',
        role: 'restaurant_admin',
        restaurantId: 'rest-1',
        scope: 'sse',
      });

      const res = await app.inject({
        method: 'GET',
        url: `/stream?token=${token}`,
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().detail).toBe('Account is deactivated.');
    });

    it('rejects with 401 if restaurant in query token is deactivated in repository', async () => {
      const userRepo = new FakeUserRepository();
      userRepo.setUser(
        makeUser({
          id: 'user-active',
          username: 'active_admin',
          role: 'restaurant_admin',
          restaurantId: 'rest-off',
          isActive: true,
        })
      );
      const restaurantRepo = new FakeRestaurantRepository();
      restaurantRepo.setRestaurant({
        id: 'rest-off',
        name: 'Deactivated Tenant',
        theme: 'dark',
        openingHours: { open: '10:00', close: '22:00' },
        isActive: false,
      });

      const { app, jwtService } = await buildAndTrack(userRepo, restaurantRepo);

      const token = jwtService.generateToken({
        id: 'user-active',
        username: 'active_admin',
        role: 'restaurant_admin',
        restaurantId: 'rest-off',
        scope: 'sse',
      });

      const res = await app.inject({
        method: 'GET',
        url: `/stream?token=${token}`,
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().detail).toBe('Restaurant is deactivated.');
    });

    it('allows query token with valid active user and restaurant and updates authContext', async () => {
      const userRepo = new FakeUserRepository();
      userRepo.setUser(
        makeUser({
          id: 'user-ok',
          username: 'fresh_username',
          role: 'restaurant_admin',
          restaurantId: 'rest-active',
          isActive: true,
        })
      );
      const restaurantRepo = new FakeRestaurantRepository();
      restaurantRepo.setRestaurant({
        id: 'rest-active',
        name: 'Active Tenant',
        theme: 'dark',
        openingHours: { open: '10:00', close: '22:00' },
        isActive: true,
      });

      const { app, jwtService } = await buildAndTrack(userRepo, restaurantRepo);

      const token = jwtService.generateToken({
        id: 'user-ok',
        username: 'stale_username',
        role: 'restaurant_admin',
        restaurantId: 'rest-active',
        scope: 'sse',
      });

      const res = await app.inject({
        method: 'GET',
        url: `/stream?token=${token}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().context.username).toBe('fresh_username');
    });
  });
});