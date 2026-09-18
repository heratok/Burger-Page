import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';
import { createAuthMiddlewares } from '../../src/infrastructure/http/middleware/auth.middleware.js';
import fastify from 'fastify';

// RED unit 1: JWT_SECRET must be mandatory in production and token claims hardened.
describe('JwtService Security Hardening', () => {
  const EXPLICIT_SECRET = 'unit-test-secret-42';

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('production: refuses to generate tokens when JWT_SECRET is missing (no insecure fallback)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.JWT_SECRET;
    const jwt = new JwtService();
    expect(() =>
      jwt.generateToken({ id: 'usr-1', username: 'root', role: 'super_admin' })
    ).toThrow(/JWT_SECRET/i);
  });

  it('production: refuses to use the hardcoded fallback secret even if env is absent', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.JWT_SECRET = 'burger-page-secure-jwt-secret-key-change-in-prod';
    const jwt = new JwtService();
    expect(() => jwt.generateToken({ id: 'usr-1', username: 'root', role: 'super_admin' })).toThrow(
      /JWT_SECRET/i
    );
  });

  it('production: works when JWT_SECRET is set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.JWT_SECRET = EXPLICIT_SECRET;
    const jwt = new JwtService();
    const token = jwt.generateToken({ id: 'usr-1', username: 'root', role: 'super_admin' });
    const payload = jwt.verifyToken(token);
    expect(payload.sub).toBe('usr-1');
    expect(payload.role).toBe('super_admin');
  });

  it('rejects a validly signed token that lacks exp (tokens must expire)', () => {
    const jwt = new JwtService(EXPLICIT_SECRET);
    // Build a handcrafted token with the same secret but no exp claim.
    const b64 = (s: string) =>
      Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = b64(JSON.stringify({ sub: 'usr-1', username: 'root', role: 'super_admin', iat: Math.floor(Date.now() / 1000) }));
    const signature = jwt['sign'](header, payload) as unknown as string;
    expect(() => jwt.verifyToken(`${header}.${payload}.${signature}`)).toThrow(/exp/i);
  });

  it('rejects tokens whose iat is in the future', () => {
    const jwt = new JwtService(EXPLICIT_SECRET);
    const b64 = (s: string) =>
      Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const future = Math.floor(Date.now() / 1000) + 3600;
    const payload = b64(JSON.stringify({ sub: 'usr-1', username: 'root', role: 'super_admin', iat: future, exp: future + 3600 }));
    const signature = jwt['sign'](header, payload) as unknown as string;
    expect(() => jwt.verifyToken(`${header}.${payload}.${signature}`)).toThrow(/iat/i);
  });

  it('rejects tokens whose declared header alg is not HS256', () => {
    const jwt = new JwtService(EXPLICIT_SECRET);
    const b64 = (s: string) =>
      Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const header = b64(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const payload = b64(JSON.stringify({ sub: 'usr-1', username: 'root', role: 'super_admin', iat: now, exp: now + 3600 }));
    const signature = jwt['sign'](header, payload) as unknown as string;
    expect(() => jwt.verifyToken(`${header}.${payload}.${signature}`)).toThrow(/alg/i);
  });

  it('middleware singleton reads JWT_SECRET lazily after import (env timing fix)', async () => {
    // Simulate the real boot order: auth.middleware was imported before the .env
    // loader ran; the singleton must still pick up JWT_SECRET at verification time.
    process.env.JWT_SECRET = EXPLICIT_SECRET;
    const { requireAuth } = createAuthMiddlewares();
    const app = fastify();
    app.get('/protected', { preHandler: [requireAuth] }, async (req) => ({ ok: true, id: req.authContext?.userId }));
    await app.ready();

    const jwt = new JwtService(EXPLICIT_SECRET);
    const token = jwt.generateToken({ id: 'usr-9', username: 'lazy', role: 'restaurant_admin', restaurantId: 'rest-a' });
    const res = await app.inject({ method: 'GET', url: '/protected', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe('usr-9');
    await app.close();
  });
});