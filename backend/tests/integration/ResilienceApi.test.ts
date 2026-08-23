import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';

describe('Server Resilience & Fault Tolerance API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    // Register a route that throws an unexpected internal runtime error
    app.get('/api/test-crash', async () => {
      throw new Error('Simulated internal unexpected server failure');
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should capture unexpected runtime errors, return 500 JSON, and NOT crash the server', async () => {
    // 1. Request that throws an internal error
    const failedResponse = await app.inject({
      method: 'GET',
      url: '/api/test-crash'
    });

    expect(failedResponse.statusCode).toBe(500);
    const body = failedResponse.json();
    expect(body.title).toBe('Internal Server Error');
    expect(body.status).toBe(500);
    expect(body.detail).toBe('Simulated internal unexpected server failure');

    // 2. Immediate next request must work normally (demonstrating server resilience)
    const healthyResponse = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(healthyResponse.statusCode).toBe(200);
    expect(healthyResponse.json()).toEqual({ status: 'ok' });
  });
});
