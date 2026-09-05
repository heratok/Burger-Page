import { FastifyInstance } from 'fastify';
import { ProductController } from '../controllers/ProductController.js';
import { requireAuth, tryAuth } from '../middleware/auth.middleware.js';

export async function productRoutes(fastify: FastifyInstance, opts: { controller: ProductController }) {
  // 1. List Products (Storefront public with ?restaurantId or ?slug, or Authenticated tenant admin)
  fastify.get('/', {
    preHandler: [tryAuth],
    schema: {
      tags: ['Products'],
      summary: 'List all menu products',
      description: 'Returns the full catalog of available burgers, sides, and specialties for a restaurant.',
      querystring: {
        type: 'object',
        properties: {
          restaurantId: { type: 'string' },
          slug: { type: 'string' },
        },
      },
    },
  }, opts.controller.list.bind(opts.controller));

  // 2. Get Product by ID (Public with context or Authenticated)
  fastify.get('/:id', {
    preHandler: [tryAuth],
    schema: {
      tags: ['Products'],
      summary: 'Get product by ID',
      description: 'Fetch details for a specific menu product.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Product ID' },
        },
        required: ['id'],
      },
    },
  }, opts.controller.getById.bind(opts.controller));

  // 3. Create Product (Protected - Tenant Admin)
  fastify.post('/', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Products'],
      summary: 'Create a new menu product',
      description: 'Add a new burger or item to the authenticated restaurant catalog.',
    },
  }, opts.controller.create.bind(opts.controller));

  // 4. Update Product (Protected - Tenant Admin)
  fastify.put('/:id', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Products'],
      summary: 'Update existing product',
      description: 'Modify product price, description, category, or availability for the authenticated restaurant.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Product ID' },
        },
        required: ['id'],
      },
    },
  }, opts.controller.update.bind(opts.controller));

  // 5. Delete Product (Protected - Tenant Admin)
  fastify.delete('/:id', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Products'],
      summary: 'Delete product by ID',
      description: 'Remove a product from the authenticated restaurant menu catalog.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Product ID' },
        },
        required: ['id'],
      },
    },
  }, opts.controller.delete.bind(opts.controller));
}
