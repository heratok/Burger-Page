import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

describe('User Module Multi-Tenant & Security Suite (Integration)', () => {
  let app: FastifyInstance;
  let tokenSuperAdmin: string;
  let tokenTenantA: string;
  let tokenTenantB: string;
  const jwtService = new JwtService();

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    tokenSuperAdmin = jwtService.generateToken({
      id: 'usr-superadmin',
      username: 'superadmin',
      role: 'super_admin',
    });

    tokenTenantA = jwtService.generateToken({
      id: 'usr-admin-a',
      username: 'admin_a',
      role: 'restaurant_admin',
      restaurantId: 'burger-craft',
    });

    tokenTenantB = jwtService.generateToken({
      id: 'usr-admin-b',
      username: 'admin_b',
      role: 'restaurant_admin',
      restaurantId: 'tacos-el-rey',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. GET /api/users without auth token must return 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
    });
    expect(res.statusCode).toBe(401);
  });

  it('2. GET /api/users with restaurant_admin token returns only users for its tenant, ignoring query param hijack', async () => {
    // Tenant A attempts to spy on tacos-el-rey users via query param
    const res = await app.inject({
      method: 'GET',
      url: '/api/users?restaurantId=tacos-el-rey',
      headers: { authorization: `Bearer ${tokenTenantA}` },
    });

    expect(res.statusCode).toBe(200);
    const users = res.json();
    expect(Array.isArray(users)).toBe(true);
    // Every returned user must belong exclusively to burger-craft
    for (const u of users) {
      expect(u.restaurantId).toBe('burger-craft');
      expect((u as any).passwordHash).toBeUndefined();
      expect((u as any).password_hash).toBeUndefined();
    }
  });

  it('3. GET /api/users with super_admin token can list all users or filter by query param', async () => {
    // Super admin lists all
    const resAll = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { authorization: `Bearer ${tokenSuperAdmin}` },
    });
    expect(resAll.statusCode).toBe(200);
    const allUsers = resAll.json();
    expect(allUsers.length).toBeGreaterThan(0);

    // Super admin filters by specific tenant
    const resFiltered = await app.inject({
      method: 'GET',
      url: '/api/users?restaurantId=burger-craft',
      headers: { authorization: `Bearer ${tokenSuperAdmin}` },
    });
    expect(resFiltered.statusCode).toBe(200);
    const filteredUsers = resFiltered.json();
    for (const u of filteredUsers) {
      expect(u.restaurantId).toBe('burger-craft');
    }
  });

  it('4. POST /api/users with restaurant_admin token must return 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { authorization: `Bearer ${tokenTenantA}` },
      payload: {
        username: 'unauthorized_creation',
        password: 'securePass123',
        role: 'restaurant_admin',
        restaurantId: 'burger-craft',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('5. POST /api/users without token must return 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: {
        username: 'anon_creation',
        password: 'securePass123',
        role: 'super_admin',
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('6. POST /api/users with super_admin token but invalid restaurantId throws Domain EntityNotFoundError (404)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { authorization: `Bearer ${tokenSuperAdmin}` },
      payload: {
        username: 'admin_fake_restaurant',
        password: 'securePass123',
        role: 'restaurant_admin',
        restaurantId: 'invented-non-existent-restaurant-id',
      },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.message || body.detail).toMatch(/not found/i);
  });

  it('7. POST /api/users with super_admin token and valid restaurant creates user and does NOT leak password_hash', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { authorization: `Bearer ${tokenSuperAdmin}` },
      payload: {
        username: 'new_craft_manager',
        password: 'securePass123',
        role: 'restaurant_admin',
        restaurantId: 'burger-craft',
      },
    });

    expect(res.statusCode).toBe(201);
    const user = res.json();
    expect(user.username).toBe('new_craft_manager');
    expect(user.restaurantId).toBe('burger-craft');
    expect(user.role).toBe('restaurant_admin');
    expect(user.passwordHash).toBeUndefined();
    expect(user.password_hash).toBeUndefined();
  });
});
