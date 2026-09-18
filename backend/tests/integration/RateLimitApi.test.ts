import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/app.js';

// RED unit 2: login and public order creation must be rate-limited.
describe('Rate Limiting Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = buildApp(undefined, { rateLimit: { max: 5 } });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('limits repeated login attempts per IP (429 after burst)', async () => {
    // Warm up below the limit: 5 requests pass through (401 or 200), the 6th is limited.
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/users/login',
        payload: { username: `probe-${i}`, password: 'wrong-password' },
      });
      statuses.push(res.statusCode);
    }
    expect(statuses.slice(0, 5)).not.toContain(429);
    expect(statuses[5]).toBe(429);
  });

  it('limits public storefront order creation per IP', async () => {
    const attempts = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        app.inject({
          method: 'POST',
          url: '/api/orders',
          payload: { restaurantId: 'rest-rate', items: [{ productId: `p-${i}`, quantity: 1 }] },
        })
      )
    );
    const statuses = attempts.map((r) => r.statusCode);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
  });
});