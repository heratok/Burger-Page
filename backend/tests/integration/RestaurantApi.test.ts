import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';

describe('Restaurant API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/restaurant should return restaurant details', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/restaurant'
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('name');
    expect(body).toHaveProperty('categories');
  });

  it('PUT /api/restaurant/categories should update and return categories', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/restaurant/categories',
      payload: {
        categories: ['Entradas', 'Platos Fuertes', 'Bebidas', 'Postres']
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.message).toContain('updated');
    expect(body.categories).toEqual(['Entradas', 'Platos Fuertes', 'Bebidas', 'Postres']);

    // Verify GET reflects the updated categories
    const getResponse = await app.inject({
      method: 'GET',
      url: '/api/restaurant'
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().categories).toEqual(['Entradas', 'Platos Fuertes', 'Bebidas', 'Postres']);
  });

  it('PUT /api/restaurant/categories should return 400 for empty categories array', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/restaurant/categories',
      payload: {
        categories: []
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.detail || body.message).toBeDefined();
  });

  it('PUT /api/restaurant/categories should return 400 for empty category string or invalid payload', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/restaurant/categories',
      payload: {
        categories: ['']
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it('GET /api/restaurants should return all registered restaurants', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/restaurants'
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('id');
    expect(body[0]).toHaveProperty('slug');
  });

  it('POST /api/restaurants should create a new restaurant tenant and persist it', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/restaurants',
      payload: {
        name: 'Pizzería Napoli Test',
        slug: 'pizzeria-napoli-test',
        tagline: 'Auténtica pizza italiana',
        whatsappNumber: '573009998877',
        primaryColor: '#E63946',
        templateType: 'pizza',
        categories: ['Pizzas', 'Pastas', 'Bebidas']
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.name).toBe('Pizzería Napoli Test');
    expect(body.slug).toBe('pizzeria-napoli-test');
    expect(body.categories).toEqual(['Pizzas', 'Pastas', 'Bebidas']);

    // Verify it appears in list
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/restaurants'
    });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json();
    expect(list.some((r: any) => r.slug === 'pizzeria-napoli-test')).toBe(true);

    // Verify delete endpoint
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/restaurants/${body.id}`
    });
    expect(deleteRes.statusCode).toBe(200);

    const listAfterDelete = await app.inject({
      method: 'GET',
      url: '/api/restaurants'
    });
    expect(listAfterDelete.json().some((r: any) => r.slug === 'pizzeria-napoli-test')).toBe(false);
  });
});
