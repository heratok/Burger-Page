import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

// RED unit 6: JWTs must not travel in URLs; SSE uses short-lived scoped tokens.
describe('SSE & Token Hardening Suite', () => {
  let app: FastifyInstance;
  const jwtService = new JwtService();

  const craftAdmin = {
    id: 'usr-1',
    username: 'craft_manager',
    role: 'restaurant_admin' as const,
    restaurantId: 'burger-craft',
  };

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects full-session JWTs in the query string on protected routes', async () => {
    const fullToken = jwtService.generateToken(craftAdmin);
    const res = await app.inject({
      method: 'GET',
      url: `/api/orders/stream?token=${fullToken}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects query-string tokens on every other protected route (Bearer only)', async () => {
    const fullToken = jwtService.generateToken(craftAdmin);
    for (const url of ['/api/orders', '/api/customers', '/api/products', '/api/users', '/api/inventory']) {
      const res = await app.inject({ method: 'GET', url: `${url}?token=${fullToken}` });
      expect(res.statusCode, url).not.toBe(200);
      expect(res.statusCode, url).toBeGreaterThanOrEqual(400);
    }
  });

  it('issues short-lived SSE-scoped tokens via POST /api/orders/stream-token', async () => {
    const token = jwtService.generateToken(craftAdmin);
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/stream-token',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeDefined();
    const payload = jwtService.verifyToken(body.token) as any;
    expect(payload.scope).toBe('sse');
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(120);
  });

  it('accepts only SSE-scoped tokens on the stream query string', async () => {
    const fullToken = jwtService.generateToken(craftAdmin);
    // Wrong scope (regular session token in URL) must be rejected.
    const streamTokenRes = await app.inject({
      method: 'POST',
      url: '/api/orders/stream-token',
      headers: { authorization: `Bearer ${fullToken}` },
    });
    const sseToken = streamTokenRes.json().token;

    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const abort = new AbortController();
    try {
      const withSseToken = await fetch(`${address}/api/orders/stream?token=${sseToken}`, {
        signal: abort.signal,
      });
      expect(withSseToken.status).toBe(200);
      expect(withSseToken.headers.get('content-type')).toContain('text/event-stream');
      // Close immediately: aborting a 200 stream should not fail the test,
      // but we must not leave a hanging fetch — abort after first byte if needed.
      const reader = withSseToken.body?.getReader();
      await reader?.cancel();
      abort.abort();
    } finally {
      abort.abort();
    }
  });

  it('rejects non-SSE tokens on the stream query string', async () => {
    const fullToken = jwtService.generateToken(craftAdmin);
    const res = await app.inject({
      method: 'GET',
      url: `/api/orders/stream?token=${fullToken}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('blocks unknown origins in production (CORS)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const prodApp = buildApp();
    await prodApp.ready();
    const evil = await prodApp.inject({
      method: 'GET',
      url: '/api/restaurants',
      headers: { origin: 'https://evil.example.com' },
    });
    expect(evil.statusCode).toBeGreaterThanOrEqual(400);
    const allowed = await prodApp.inject({
      method: 'GET',
      url: '/api/restaurants',
      headers: { origin: 'http://localhost:5173' },
    });
    expect(allowed.statusCode).toBe(200);
    vi.unstubAllEnvs();
    await prodApp.close();
  });
});