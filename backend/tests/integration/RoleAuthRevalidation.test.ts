import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp, buildDependencies, AppDependencies } from '../../src/infrastructure/http/app.js';
import { configureAuthMiddlewares } from '../../src/infrastructure/http/middleware/auth.middleware.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

describe('GET /api/roles with real requireAuth revalidation + RoleController fast path', () => {
  let app: FastifyInstance;
  let deps: AppDependencies;
  const jwt = new JwtService();
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  const STORED_TENANT = 'rest-stored';
  const CLAIMED_TENANT = 'rest-claimed';
  const INACTIVE_TENANT = 'rest-inactive';

  beforeAll(async () => {
    deps = buildDependencies(undefined, 'memory');
    configureAuthMiddlewares({
      userRepo: deps.userRepo,
      restaurantRepo: deps.restaurantRepo,
      roleRepo: deps.roleRepo,
    });
    app = buildApp(deps);
    await app.ready();

    await deps.restaurantRepo.save({
      id: STORED_TENANT,
      slug: STORED_TENANT,
      name: 'Stored Restaurant',
      theme: 'light',
      openingHours: { open: '09:00', close: '22:00' },
      isActive: true,
    });
    await deps.restaurantRepo.save({
      id: CLAIMED_TENANT,
      slug: CLAIMED_TENANT,
      name: 'Claimed Restaurant',
      theme: 'light',
      openingHours: { open: '09:00', close: '22:00' },
      isActive: true,
    });
    await deps.restaurantRepo.save({
      id: INACTIVE_TENANT,
      slug: INACTIVE_TENANT,
      name: 'Inactive Restaurant',
      theme: 'light',
      openingHours: { open: '09:00', close: '22:00' },
      isActive: false,
    });

    const now = new Date().toISOString();
    await deps.roleRepo.save({
      id: 'role_stored',
      restaurantId: STORED_TENANT,
      name: 'Stored Role',
      permissions: ['orders.view'],
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    });
    await deps.roleRepo.save({
      id: 'role_claimed',
      restaurantId: CLAIMED_TENANT,
      name: 'Claimed Role',
      permissions: ['orders.view'],
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    });
    await deps.roleRepo.save({
      id: 'role_inactive',
      restaurantId: INACTIVE_TENANT,
      name: 'Inactive Role',
      permissions: ['orders.view'],
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    });

    await deps.userRepo.save({
      id: 'usr-revalidated',
      username: 'admin_revalidated',
      passwordHash: 'x',
      role: 'restaurant_admin',
      restaurantId: STORED_TENANT,
      createdAt: now,
      isActive: true,
    });
    await deps.userRepo.save({
      id: 'usr-inactive-tenant',
      username: 'admin_inactive',
      passwordHash: 'x',
      role: 'restaurant_admin',
      restaurantId: INACTIVE_TENANT,
      createdAt: now,
      isActive: true,
    });
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
    configureAuthMiddlewares({});
  });

  it('uses the stored tenant rather than a stale/forged JWT restaurantId claim and skips duplicate lookup', async () => {
    const findByIdSpy = vi.spyOn(deps.restaurantRepo, 'findById');
    const findRolesSpy = vi.spyOn(deps.roleRepo, 'findByRestaurantId');

    const tokenWithStaleClaim = jwt.generateToken({
      id: 'usr-revalidated',
      username: 'admin_revalidated',
      role: 'restaurant_admin',
      restaurantId: CLAIMED_TENANT,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/roles?restaurantId=${CLAIMED_TENANT}`,
      headers: auth(tokenWithStaleClaim),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Array<{ id: string; restaurantId: string; name: string }>;
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: 'role_stored',
      restaurantId: STORED_TENANT,
      name: 'Stored Role',
    });
    expect(body.some((r) => r.restaurantId === CLAIMED_TENANT)).toBe(false);

    // Only requireAuth revalidates the stored tenant once; RoleController does not re-read it.
    expect(findByIdSpy).toHaveBeenCalledTimes(1);
    expect(findByIdSpy).toHaveBeenCalledWith(STORED_TENANT);
    expect(findRolesSpy).toHaveBeenCalledWith(STORED_TENANT);
  });

  it('rejects with 401 before returning any roles when the stored tenant is deactivated', async () => {
    const findRolesSpy = vi.spyOn(deps.roleRepo, 'findByRestaurantId');

    const token = jwt.generateToken({
      id: 'usr-inactive-tenant',
      username: 'admin_inactive',
      role: 'restaurant_admin',
      restaurantId: INACTIVE_TENANT,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/roles',
      headers: auth(token),
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).detail).toBe('Restaurant is deactivated.');
    expect(findRolesSpy).not.toHaveBeenCalled();
  });
});
