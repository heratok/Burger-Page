import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';
import { createAuthMiddlewares } from '../../src/infrastructure/http/middleware/auth.middleware.js';
import { InMemoryUserRepository } from '../../src/infrastructure/persistence/InMemoryUserRepository.js';
import { InMemoryRestaurantRepository } from '../../src/infrastructure/persistence/InMemoryRestaurantRepository.js';
import { UpdateUserUseCase } from '../../src/application/use-cases/UpdateUserUseCase.js';

describe('Super admin panel API (restaurant edit, deleted tenants, user edit)', () => {
  let app: FastifyInstance;
  const jwt = new JwtService();
  const superToken = jwt.generateToken({ id: 'user-superadmin', username: 'admin', role: 'super_admin' });
  const tenantToken = jwt.generateToken({ id: 'user-admin-craft', username: 'admin_craft', role: 'restaurant_admin', restaurantId: 'burger-craft' });
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  beforeEach(async () => {
    app = buildApp();
    await app.ready();
  });
  afterEach(async () => {
    await app.close();
  });

  const patchRestaurant = (id: string, payload: unknown, token = superToken) =>
    app.inject({ method: 'PATCH', url: `/api/restaurants/${id}`, headers: auth(token), payload: payload as any });

  describe('PATCH /api/restaurants/:id', () => {
    it('persists name, slug, tagline, whatsappNumber, timezone, currency and currencySymbol', async () => {
      const res = await patchRestaurant('tenant-a', {
        name: '  Nuevo Nombre ',
        slug: 'nuevo-slug',
        tagline: 'Nuevo lema',
        whatsappNumber: '573111111111',
        timezone: 'America/Mexico_City',
        currency: 'MXN',
        currencySymbol: 'MX$',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toMatchObject({
        id: 'tenant-a',
        name: 'Nuevo Nombre',
        slug: 'nuevo-slug',
        tagline: 'Nuevo lema',
        whatsappNumber: '573111111111',
        timezone: 'America/Mexico_City',
      });
      expect(body.config).toMatchObject({ currency: 'MXN', currencySymbol: 'MX$' });

      const reread = await app.inject({ method: 'GET', url: '/api/restaurants/tenant-a', headers: auth(superToken) });
      expect(reread.json()).toMatchObject({ slug: 'nuevo-slug', timezone: 'America/Mexico_City' });
      expect(reread.json().config).toMatchObject({ currency: 'MXN', currencySymbol: 'MX$' });
      // The new slug resolves publicly; the old one no longer does.
      expect((await app.inject({ method: 'GET', url: '/api/restaurants/nuevo-slug' })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/api/restaurants/tenant-b' })).statusCode).toBe(200);
    });

    it('answers 409 when the slug belongs to another restaurant and 400 for an unusable slug', async () => {
      const dup = await patchRestaurant('tenant-a', { slug: 'tenant-b' });
      expect(dup.statusCode).toBe(409);
      expect(dup.json().detail).toMatch(/already exists/);
      expect((await patchRestaurant('tenant-a', { slug: '!!!' })).statusCode).toBe(400);
      expect((await patchRestaurant('tenant-a', { slug: 'x'.repeat(64) })).statusCode).toBe(400);
      expect((await patchRestaurant('tenant-a', { timezone: 'Mars/Olympus' })).statusCode).toBe(400);
      expect((await patchRestaurant('tenant-a', { currency: 'EURO' })).statusCode).toBe(400);
      expect((await patchRestaurant('tenant-a', { currencySymbol: '' })).statusCode).toBe(400);
      expect((await patchRestaurant('tenant-a', { slug: 'deleted' })).statusCode).toBe(400);
    });

    it('is super admin only', async () => {
      expect((await app.inject({ method: 'PATCH', url: '/api/restaurants/tenant-a', payload: { name: 'x' } })).statusCode).toBe(401);
      expect((await patchRestaurant('tenant-a', { name: 'x' }, tenantToken)).statusCode).toBe(403);
    });
  });

  describe('deleted restaurants', () => {
    async function createAndDelete(slug: string) {
      const created = await app.inject({
        method: 'POST',
        url: '/api/restaurants',
        headers: auth(superToken),
        payload: { name: 'Borrable', slug },
      });
      expect(created.statusCode).toBe(201);
      const { id, adminUsername, adminPassword } = created.json();
      expect((await app.inject({ method: 'DELETE', url: `/api/restaurants/${id}`, headers: auth(superToken) })).statusCode).toBe(200);
      return { id, adminUsername, adminPassword };
    }

    it('GET /api/restaurants/deleted lists them with the original slug and deletedAt, super admin only', async () => {
      const { id } = await createAndDelete('borrable');
      const res = await app.inject({ method: 'GET', url: '/api/restaurants/deleted', headers: auth(superToken) });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([
        expect.objectContaining({ id, name: 'Borrable', slug: 'borrable', deletedAt: expect.any(String) }),
      ]);
      expect((await app.inject({ method: 'GET', url: '/api/restaurants/deleted' })).statusCode).toBe(401);
      expect((await app.inject({ method: 'GET', url: '/api/restaurants/deleted', headers: auth(tenantToken) })).statusCode).toBe(403);
    });

    it('POST /:id/restore brings it back paused with its slug and lets the admin log in after reactivation', async () => {
      const { id, adminUsername, adminPassword } = await createAndDelete('borrable');
      const res = await app.inject({ method: 'POST', url: `/api/restaurants/${id}/restore`, headers: auth(superToken), payload: {} });
      expect(res.statusCode).toBe(200);
      expect(res.json().restaurant).toMatchObject({ id, slug: 'borrable', isActive: false });
      expect(res.json().renamedUsers).toEqual([]);
      expect(res.json().restaurant.adminPassword).toBeUndefined();

      const login = () => app.inject({ method: 'POST', url: '/api/users/login', payload: { username: adminUsername, password: adminPassword } });
      expect((await login()).statusCode).toBe(401); // paused until reactivated explicitly
      expect((await patchRestaurant(id, { isActive: true })).statusCode).toBe(200);
      expect((await login()).statusCode).toBe(200);
      const deleted = await app.inject({ method: 'GET', url: '/api/restaurants/deleted', headers: auth(superToken) });
      expect(deleted.json()).toEqual([]);
    });

    it('restore answers 409 when the slug was reused, and accepts { slug } to pick another', async () => {
      const { id } = await createAndDelete('borrable');
      expect((await app.inject({
        method: 'POST', url: '/api/restaurants', headers: auth(superToken), payload: { name: 'Otro', slug: 'borrable' },
      })).statusCode).toBe(201);
      const taken = await app.inject({ method: 'POST', url: `/api/restaurants/${id}/restore`, headers: auth(superToken), payload: {} });
      expect(taken.statusCode).toBe(409);
      expect(taken.json().detail).toMatch(/borrable/);

      const chosen = await app.inject({ method: 'POST', url: `/api/restaurants/${id}/restore`, headers: auth(superToken), payload: { slug: 'borrable-2' } });
      expect(chosen.statusCode).toBe(200);
      expect(chosen.json().restaurant.slug).toBe('borrable-2');
      // The default admin username was taken by the new tenant: reported, not blocking.
      expect(chosen.json().renamedUsers).toHaveLength(1);
    });

    it('restore answers 404 for a tenant that is not deleted and is super admin only', async () => {
      expect((await app.inject({ method: 'POST', url: '/api/restaurants/tenant-a/restore', headers: auth(superToken), payload: {} })).statusCode).toBe(404);
      expect((await app.inject({ method: 'POST', url: '/api/restaurants/tenant-a/restore', payload: {} })).statusCode).toBe(401);
      expect((await app.inject({ method: 'POST', url: '/api/restaurants/tenant-a/restore', headers: auth(tenantToken), payload: {} })).statusCode).toBe(403);
    });
  });

  describe('PATCH /api/users/:id (edit)', () => {
    const patchUser = (id: string, payload: unknown, token = superToken) =>
      app.inject({ method: 'PATCH', url: `/api/users/${id}`, headers: auth(token), payload: payload as any });

    it('edits username, role and restaurantId and never returns the hash', async () => {
      const res = await patchUser('user-admin-craft', { username: 'craft_owner', restaurantId: 'tenant-a' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: 'user-admin-craft', username: 'craft_owner', role: 'restaurant_admin', restaurantId: 'tenant-a' });
      expect(res.json().passwordHash).toBeUndefined();
    });

    it('answers 409 for a taken username, 400 for blank, 404 for a missing restaurant', async () => {
      expect((await patchUser('user-admin-craft', { username: 'admin' })).statusCode).toBe(409);
      expect((await patchUser('user-admin-craft', { username: '  ' })).statusCode).toBe(400);
      expect((await patchUser('user-admin-craft', { restaurantId: 'ghost' })).statusCode).toBe(404);
    });

    it('answers 409 when a super admin demotes itself', async () => {
      const res = await patchUser('user-superadmin', { role: 'restaurant_admin', restaurantId: 'burger-craft' });
      expect(res.statusCode).toBe(409);
    });

    it('answers 409 when demoting the last active super admin', async () => {
      const other = jwt.generateToken({ id: 'someone', username: 'someone', role: 'super_admin' });
      const res = await patchUser('user-superadmin', { role: 'restaurant_admin', restaurantId: 'burger-craft' }, other);
      expect(res.statusCode).toBe(409);
      expect(res.json().detail).toMatch(/last active super admin/);
    });

    it('still validates the body: an unknown role is 400', async () => {
      expect((await patchUser('user-admin-craft', { role: 'owner' })).statusCode).toBe(400);
    });
  });

  describe('GET /api/users?restaurantId=', () => {
    it('lists a restaurant\'s admins for the super admin, without hashes', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/users?restaurantId=burger-craft', headers: auth(superToken) });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.map((u: any) => u.username)).toEqual(['admin_craft']);
      expect(body[0]).toMatchObject({ id: 'user-admin-craft', role: 'restaurant_admin', restaurantId: 'burger-craft' });
      expect(body[0].passwordHash).toBeUndefined();
    });
  });
});

describe('a demoted super admin loses access immediately (session revalidation)', () => {
  it('the old token no longer passes requireSuperAdmin after the role edit', async () => {
    const jwt = new JwtService();
    const userRepo = new InMemoryUserRepository();
    const restaurantRepo = new InMemoryRestaurantRepository();
    await userRepo.save({ id: 'boss', username: 'boss', passwordHash: 'h', role: 'super_admin', createdAt: '', isActive: true });
    await userRepo.save({ id: 'boss2', username: 'boss2', passwordHash: 'h', role: 'super_admin', createdAt: '', isActive: true });
    const mw = createAuthMiddlewares(jwt, { userRepo, restaurantRepo });
    const app = fastify();
    app.get('/s', { preHandler: [mw.requireSuperAdmin] }, async () => ({ ok: true }));
    await app.ready();
    const token = jwt.generateToken({ id: 'boss', username: 'boss', role: 'super_admin' });
    const get = () => app.inject({ method: 'GET', url: '/s', headers: { authorization: `Bearer ${token}` } });

    expect((await get()).statusCode).toBe(200);
    await new UpdateUserUseCase(userRepo, restaurantRepo).execute({
      actorId: 'boss2', targetId: 'boss', role: 'restaurant_admin', restaurantId: 'burger-craft',
    });
    expect((await get()).statusCode).toBe(403);
    await app.close();
  });
});
