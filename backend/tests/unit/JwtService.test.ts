import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';
import { createAuthMiddlewares } from '../../src/infrastructure/http/middleware/auth.middleware.js';
import fastify from 'fastify';

// RED unit 1: JWT_SECRET must be mandatory in production and token claims hardened.
describe('JwtService Security Hardening', () => {
  const EXPLICIT_SECRET = 'unit-test-secret-42';

  // Mirrors generateToken output: same header, sub/username/role/iam + iss/aud claims.
  const b64 = (s: string) =>
    Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  function makeToken(
    jwt: JwtService,
    claims: Record<string, unknown>,
    header: Record<string, string> = { alg: 'HS256', typ: 'JWT' }
  ): string {
    const headerEncoded = b64(JSON.stringify(header));
    const payloadEncoded = b64(JSON.stringify(claims));
    const signature = jwt['sign'](headerEncoded, payloadEncoded) as unknown as string;
    return `${headerEncoded}.${payloadEncoded}.${signature}`;
  }

  function validClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    const now = Math.floor(Date.now() / 1000);
    return {
      sub: 'usr-1',
      username: 'root',
      role: 'super_admin',
      iss: 'burger-page',
      aud: 'burger-page-api',
      iat: now,
      exp: now + 3600,
      ...overrides,
    };
  }

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
    const claims = validClaims();
    delete claims.exp;
    const token = makeToken(jwt, claims);
    expect(() => jwt.verifyToken(token)).toThrow(/exp/i);
  });

  it('rejects tokens whose iat is in the future', () => {
    const jwt = new JwtService(EXPLICIT_SECRET);
    const future = Math.floor(Date.now() / 1000) + 3600;
    const token = makeToken(jwt, validClaims({ iat: future, exp: future + 3600 }));
    expect(() => jwt.verifyToken(token)).toThrow(/iat/i);
  });

  it('rejects tokens whose declared header alg is not HS256', () => {
    const jwt = new JwtService(EXPLICIT_SECRET);
    const token = makeToken(jwt, validClaims(), { alg: 'none', typ: 'JWT' });
    expect(() => jwt.verifyToken(token)).toThrow(/alg/i);
  });

  it('mints tokens with the issuer and audience claims (strict single value)', () => {
    const jwt = new JwtService(EXPLICIT_SECRET);
    const token = jwt.generateToken({ id: 'usr-1', username: 'root', role: 'super_admin' });
    const payload = jwt.verifyToken(token);
    expect(payload.iss).toBe('burger-page');
    expect(payload.aud).toBe('burger-page-api');
  });

  it('SSE-scoped tokens carry the same issuer/audience claims', () => {
    const jwt = new JwtService(EXPLICIT_SECRET);
    const token = jwt.generateToken({
      id: 'usr-1',
      username: 'root',
      role: 'super_admin',
      scope: 'sse',
    });
    const payload = jwt.verifyToken(token);
    expect(payload.scope).toBe('sse');
    expect(payload.iss).toBe('burger-page');
    expect(payload.aud).toBe('burger-page-api');
  });

  it('rejects a validly signed token that lacks a sub claim', () => {
    const jwt = new JwtService(EXPLICIT_SECRET);
    const claims = validClaims();
    delete claims.sub;
    const token = makeToken(jwt, claims);
    expect(() => jwt.verifyToken(token)).toThrow('Token is missing required sub claim');
  });

  it('rejects a validly signed token whose sub is not a non-empty string', () => {
    const jwt = new JwtService(EXPLICIT_SECRET);
    expect(() =>
      jwt.verifyToken(makeToken(jwt, validClaims({ sub: '' })))
    ).toThrow('Token is missing required sub claim');
    expect(() =>
      jwt.verifyToken(makeToken(jwt, validClaims({ sub: 42 })))
    ).toThrow('Token is missing required sub claim');
  });

  it('rejects a validly signed token whose issuer does not match', () => {
    const jwt = new JwtService(EXPLICIT_SECRET);
    const token = makeToken(jwt, validClaims({ iss: 'another-app' }));
    expect(() => jwt.verifyToken(token)).toThrow('Token issuer mismatch');
  });

  it('rejects a validly signed token whose audience does not match', () => {
    const jwt = new JwtService(EXPLICIT_SECRET);
    const token = makeToken(jwt, validClaims({ aud: 'another-api' }));
    expect(() => jwt.verifyToken(token)).toThrow('Token audience mismatch');
  });

  it('rejects a token whose nbf is in the future (not yet valid)', () => {
    const jwt = new JwtService(EXPLICIT_SECRET);
    const now = Math.floor(Date.now() / 1000);
    const token = makeToken(jwt, validClaims({ nbf: now + 120 }));
    expect(() => jwt.verifyToken(token)).toThrow('Token is not yet valid');
  });

  it('accepts a token without nbf (absent nbf is valid)', () => {
    const jwt = new JwtService(EXPLICIT_SECRET);
    const token = jwt.generateToken({ id: 'usr-1', username: 'root', role: 'super_admin' });
    expect(jwt.verifyToken(token).sub).toBe('usr-1');
  });

  it('rejects a token expired beyond the 30s clock-drift grace window', () => {
    const jwt = new JwtService(EXPLICIT_SECRET);
    const now = Math.floor(Date.now() / 1000);
    const token = makeToken(jwt, validClaims({ iat: now - 3600, exp: now - 60 }));
    expect(() => jwt.verifyToken(token)).toThrow('Token has expired');
  });

  it('accepts a token expired within the 30s clock-drift grace window', () => {
    const jwt = new JwtService(EXPLICIT_SECRET);
    const now = Math.floor(Date.now() / 1000);
    const token = makeToken(jwt, validClaims({ iat: now - 3600, exp: now - 10 }));
    const payload = jwt.verifyToken(token);
    expect(payload.sub).toBe('usr-1');
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