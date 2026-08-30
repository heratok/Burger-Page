import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';
import { createAuthMiddlewares } from '../../src/infrastructure/http/middleware/auth.middleware.js';

describe('Auth Middleware & JWT Suite', () => {
  let app: FastifyInstance;
  const jwtService = new JwtService('test-secret-key-12345');
  const { requireAuth, requireSuperAdmin } = createAuthMiddlewares(jwtService);

  beforeAll(async () => {
    app = fastify();

    // 1. Ruta pública
    app.get('/public-route', async () => ({ status: 'public' }));

    // 2. Ruta protegida (requiere auth)
    app.get('/protected-route', { preHandler: [requireAuth] }, async (req) => ({
      status: 'protected',
      context: req.authContext,
    }));

    // 3. Ruta de Super Admin
    app.get('/superadmin-route', { preHandler: [requireSuperAdmin] }, async (req) => ({
      status: 'superadmin',
      context: req.authContext,
    }));

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('permite acceso sin autenticación a la ruta pública', async () => {
    const res = await app.inject({ method: 'GET', url: '/public-route' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'public' });
  });

  it('rechaza con 401 si no se envía header Authorization en ruta protegida', async () => {
    const res = await app.inject({ method: 'GET', url: '/protected-route' });
    expect(res.statusCode).toBe(401);
    expect(res.json().detail).toMatch(/Missing or invalid Authorization header/i);
  });

  it('rechaza con 401 si el token es inválido', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/protected-route',
      headers: { authorization: 'Bearer invalid.token.payload' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('permite acceso y propaga authContext en ruta protegida con token válido', async () => {
    const token = jwtService.generateToken({
      id: 'usr-1',
      username: 'manager_craft',
      role: 'restaurant_admin',
      restaurantId: 'rest-craft',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/protected-route',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.context).toEqual({
      userId: 'usr-1',
      username: 'manager_craft',
      role: 'restaurant_admin',
      restaurantId: 'rest-craft',
    });
  });

  it('rechaza con 403 en ruta super_admin si el usuario es restaurant_admin', async () => {
    const token = jwtService.generateToken({
      id: 'usr-2',
      username: 'manager_rosto',
      role: 'restaurant_admin',
      restaurantId: 'rest-rosto',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/superadmin-route',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().detail).toMatch(/Super Administrator privileges required/i);
  });

  it('permite acceso en ruta super_admin si el usuario es super_admin', async () => {
    const token = jwtService.generateToken({
      id: 'usr-super',
      username: 'root_admin',
      role: 'super_admin',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/superadmin-route',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.context.role).toBe('super_admin');
  });
});
