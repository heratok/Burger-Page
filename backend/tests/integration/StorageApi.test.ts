import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { FastifyInstance } from 'fastify';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

describe('Storage API (Presigned Upload URLs)', () => {
  let app: FastifyInstance;
  const jwt = new JwtService();
  let adminToken: string;

  beforeAll(async () => {
    app = buildApp({}, { driver: 'memory' });
    await app.ready();

    adminToken = jwt.generateToken({
      sub: 'usr_test_admin',
      username: 'admin',
      role: 'restaurant_admin',
      restaurantId: 'burger-craft',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests to /api/storage/upload-url with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/storage/upload-url',
      payload: {
        folder: 'products',
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns upload-url descriptor when authenticated as admin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/storage/upload-url',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        folder: 'products',
        filename: 'my-product-photo',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.mode).toBeDefined();
    expect(body.path).toContain('burger-craft/products/my-product-photo.webp');
  });
});
