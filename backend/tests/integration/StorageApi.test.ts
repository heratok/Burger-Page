import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { FastifyInstance } from 'fastify';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';
import { sanitizeStorageObjectName } from '../../src/infrastructure/http/routes/storage.routes.js';

describe('Storage API (Presigned Upload URLs)', () => {
  let app: FastifyInstance;
  const jwt = new JwtService();
  let adminToken: string;

  beforeAll(async () => {
    app = buildApp({}, { driver: 'memory' });
    await app.ready();

    adminToken = jwt.generateToken({
      id: 'usr_test_admin',
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

  it('sanitizes traversal/malicious filenames into a safe single-segment key (JD-CONF-02)', () => {
    expect(sanitizeStorageObjectName('../../other-tenant/branding/logo')).toBe('other-tenant-branding-logo');
    expect(sanitizeStorageObjectName('..\\..\\evil\\logo')).not.toContain('..');
    expect(sanitizeStorageObjectName('..')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(sanitizeStorageObjectName('logo')).toBe('logo');
    expect(sanitizeStorageObjectName('.hidden')).toBe('hidden');
  });

  it('keeps the object path tenant-scoped and free of traversal segments for malicious filenames (JD-CONF-02)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/storage/upload-url',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        folder: 'products',
        filename: '../../other-tenant/logo',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.path).not.toContain('..');
    expect(body.path).not.toContain('/other-tenant/');
    expect(body.path).toContain('burger-craft/products/');
    expect(body.path.endsWith('.webp')).toBe(true);
  });
});
