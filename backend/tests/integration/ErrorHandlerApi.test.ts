import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/app.js';

// RED unit 3: internal error messages must not leak and status codes must be honored.
describe('Error Handler Suite', () => {
  describe('generic 500 in production', () => {
    it('returns a generic detail without internal error.message', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const app = buildApp();
      app.get('/boom', async () => {
        throw new Error('SECRET_INTERNAL_DETAIL_XYZ');
      });
      await app.ready();
      const res = await app.inject({ method: 'GET', url: '/boom' });
      expect(res.statusCode).toBe(500);
      const body = res.json();
      expect(body.detail).not.toContain('SECRET_INTERNAL_DETAIL_XYZ');
      vi.unstubAllEnvs();
      await app.close();
    });
  });

  describe('rate limit response shape', () => {
    it('returns 429 (not 500) when the rate limit kicks in', async () => {
      const app = buildApp(undefined, { rateLimit: { max: 5, loginMax: 5 } });
      await app.ready();
      const statuses: number[] = [];
      for (let i = 0; i < 6; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/users/login',
          payload: { username: `probe-${i}`, password: 'wrong' },
        });
        statuses.push(res.statusCode);
      }
      expect(statuses[5]).toBe(429);
      await app.close();
    });
  });
});