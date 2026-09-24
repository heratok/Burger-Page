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

  it('cannot bypass login rate limit using query parameters or trailing slashes (JD-CONFIRMED-001)', async () => {
    const testApp = buildApp(undefined, { rateLimit: { max: 50, loginMax: 3, orderMax: 3 } });
    await testApp.ready();
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await testApp.inject({
          method: 'POST',
          url: `/api/users/login?probe=${i}`,
          payload: { username: `probe-${i}`, password: 'wrong-password' },
        });
        statuses.push(res.statusCode);
      }
      expect(statuses.slice(0, 3)).not.toContain(429);
      expect(statuses.slice(3)).toContain(429);
    } finally {
      await testApp.close();
    }
  });

  it('cannot bypass order rate limit using query parameters or trailing slashes (JD-CONFIRMED-001)', async () => {
    const testApp = buildApp(undefined, { rateLimit: { max: 50, loginMax: 3, orderMax: 3 } });
    await testApp.ready();
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await testApp.inject({
          method: 'POST',
          url: `/api/orders/?table=${i}`,
          payload: { restaurantId: 'rest-rate', items: [{ productId: `p-${i}`, quantity: 1 }] },
        });
        statuses.push(res.statusCode);
      }
      expect(statuses.slice(0, 3)).not.toContain(429);
      expect(statuses.slice(3)).toContain(429);
    } finally {
      await testApp.close();
    }
  });

  it('keys the rate limit on each forwarded client IP when trustProxy is enabled', async () => {
    const testApp = buildApp(undefined, { trustProxy: true, rateLimit: { max: 5 } });
    await testApp.ready();
    try {
      // Two different X-Forwarded-For clients must NOT share a bucket: each can
      // burn its full limit (5) without ever hitting 429.
      for (const client of ['1.2.3.4', '5.6.7.8']) {
        const statuses: number[] = [];
        for (let i = 0; i < 5; i++) {
          const res = await testApp.inject({
            method: 'POST',
            url: '/api/users/login',
            headers: { 'x-forwarded-for': client },
            payload: { username: `probe-${client}-${i}`, password: 'wrong-password' },
          });
          statuses.push(res.statusCode);
        }
        expect(statuses).not.toContain(429);
      }
    } finally {
      await testApp.close();
    }
  });

  it('ignores X-Forwarded-For and shares one bucket when trustProxy is off (default)', async () => {
    const testApp = buildApp(undefined, { rateLimit: { max: 5 } });
    await testApp.ready();
    try {
      // Header cannot spoof a fresh bucket: both forwarded values hit the same
      // socket-IP bucket, so the 6th request overall returns 429.
      const statuses: number[] = [];
      for (let i = 0; i < 6; i++) {
        const spoofedClient = i % 2 === 0 ? '1.2.3.4' : '5.6.7.8';
        const res = await testApp.inject({
          method: 'POST',
          url: '/api/users/login',
          headers: { 'x-forwarded-for': spoofedClient },
          payload: { username: `probe-${i}`, password: 'wrong-password' },
        });
        statuses.push(res.statusCode);
      }
      expect(statuses.slice(0, 5)).not.toContain(429);
      expect(statuses[5]).toBe(429);
    } finally {
      await testApp.close();
    }
  });
});
