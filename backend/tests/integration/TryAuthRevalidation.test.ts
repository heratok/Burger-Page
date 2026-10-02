import { describe, it, expect, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';
import { createAuthMiddlewares } from '../../src/infrastructure/http/middleware/auth.middleware.js';
import { InMemoryUserRepository } from '../../src/infrastructure/persistence/InMemoryUserRepository.js';
import { InMemoryRestaurantRepository } from '../../src/infrastructure/persistence/InMemoryRestaurantRepository.js';
import { User } from '../../src/domain/models/User.js';

// tryAuth guards storefront routes that behave differently for staff (e.g.
// GET /restaurants/:id exposes inactive/private data to the owner). It must
// apply the same account rules as requireAuth, but degrade to anonymous
// instead of rejecting.
describe('tryAuth applies the same account rules as requireAuth', () => {
  let app: FastifyInstance;
  const jwt = new JwtService();
  afterEach(async () => { await app?.close(); });

  const claims = { id: 'u1', username: 'u1', role: 'restaurant_admin' as const, restaurantId: 'r1' };
  const baseUser: User = {
    id: 'u1', username: 'u1', passwordHash: 'h', role: 'restaurant_admin', restaurantId: 'r1',
    createdAt: '', isActive: true, mustChangePassword: false,
  };

  async function build(opts: { users?: User[]; restaurants?: boolean } = {}) {
    let deps: any;
    if (opts.users) {
      const userRepo = new InMemoryUserRepository();
      for (const u of await userRepo.findAll()) await userRepo.delete(u.id);
      for (const u of opts.users) await userRepo.save(u);
      deps = { userRepo };
      if (opts.restaurants !== undefined) {
        const restaurantRepo = new InMemoryRestaurantRepository();
        deps.restaurantRepo = restaurantRepo;
      }
    }
    const mw = createAuthMiddlewares(jwt, deps);
    app = fastify();
    app.get('/s', { preHandler: [mw.tryAuth] }, async (req) => ({ ctx: req.authContext ?? null }));
    await app.ready();
    return deps;
  }
  const get = (token: string) => app.inject({ method: 'GET', url: '/s', headers: { authorization: `Bearer ${token}` } });

  it('treats a token with the mustChangePassword claim as anonymous', async () => {
    await build();
    const res = await get(jwt.generateToken({ ...claims, mustChangePassword: true }));
    expect(res.json().ctx).toBeNull();
  });

  it('still authenticates a normal token without revalidation deps', async () => {
    await build();
    expect((await get(jwt.generateToken(claims))).json().ctx.userId).toBe('u1');
  });

  it('with revalidation, a stored must-change flag makes an old token anonymous', async () => {
    await build({ users: [{ ...baseUser, mustChangePassword: true }] });
    expect((await get(jwt.generateToken(claims))).json().ctx).toBeNull();
  });

  it('with revalidation, an inactive or deleted account is anonymous', async () => {
    await build({ users: [{ ...baseUser, isActive: false }] });
    expect((await get(jwt.generateToken(claims))).json().ctx).toBeNull();
    await app.close();
    await build({ users: [] });
    expect((await get(jwt.generateToken(claims))).json().ctx).toBeNull();
  });

  it('with revalidation, the stored role wins over a stale token role', async () => {
    await build({ users: [{ ...baseUser, role: 'restaurant_admin' }] });
    const res = await get(jwt.generateToken({ ...claims, role: 'super_admin' }));
    expect(res.json().ctx.role).toBe('restaurant_admin');
  });

  it('with revalidation, a tenant that is missing or paused makes the token anonymous', async () => {
    const deps = await build({ users: [baseUser], restaurants: true });
    // r1 does not exist in the repository: tenant gone.
    expect((await get(jwt.generateToken(claims))).json().ctx).toBeNull();
    expect(deps.restaurantRepo).toBeDefined();
  });
});
