import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';

describe('Login per-account lockout (HTTP)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Per-IP rate limiting is off in tests: only the per-account guard applies.
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 429 with Retry-After once an account collected 10 failures', async () => {
    const attempt = () =>
      app.inject({
        method: 'POST',
        url: '/api/users/login',
        payload: { username: 'lockout-probe', password: 'wrong-password' },
      });

    for (let i = 0; i < 10; i++) {
      expect((await attempt()).statusCode).toBe(401);
    }
    const locked = await attempt();
    expect(locked.statusCode).toBe(429);
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
    expect(locked.json().title).toBe('Too Many Requests');
  });
});
