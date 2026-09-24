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

    it('keeps the current dev behavior when NODE_ENV is unset (detail exposed) (M5)', async () => {
      vi.stubEnv('NODE_ENV', '');
      vi.stubEnv('API_EXPOSE_ERRORS', '');
      const app = buildApp();
      app.get('/boom-unset', async () => {
        throw new Error('SECRET_DEV_DETAIL_LEAK');
      });
      await app.ready();
      const res = await app.inject({ method: 'GET', url: '/boom-unset' });
      expect(res.statusCode).toBe(500);
      // Dev parity: the 500 detail is not part of the prod surface.
      expect(res.json().detail).toContain('SECRET_DEV_DETAIL_LEAK');
      vi.unstubAllEnvs();
      await app.close();
    });

    it('forces internal detail exposure in production only via explicit API_EXPOSE_ERRORS=true (M5)', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('API_EXPOSE_ERRORS', 'true');
      const app = buildApp();
      app.get('/boom-exposed', async () => {
        throw new Error('SECRET_FORCED_DETAIL_XYZ');
      });
      await app.ready();
      const res = await app.inject({ method: 'GET', url: '/boom-exposed' });
      expect(res.statusCode).toBe(500);
      expect(res.json().detail).toContain('SECRET_FORCED_DETAIL_XYZ');
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