import { FastifyInstance } from 'fastify';
import { ProductAdditionController } from '../controllers/ProductAdditionController.js';
import { requireAuth, tryAuth } from '../middleware/auth.middleware.js';

export async function additionRoutes(fastify: FastifyInstance, opts: { controller: ProductAdditionController }) {
  // 1. List Product Additions (Public with ?restaurantId / ?slug, or Authenticated tenant admin; supports ?productId)
  fastify.get('/', {
    preHandler: [tryAuth],
    schema: {
      tags: ['Additions'],
      summary: 'List product additions',
      description: 'Fetch modifiers / extras available for products in a restaurant.',
      querystring: {
        type: 'object',
        properties: {
          restaurantId: { type: 'string' },
          slug: { type: 'string' },
          productId: { type: 'string' },
        },
      },
    },
  }, opts.controller.list.bind(opts.controller));

  // 2. Get Product Addition by ID (Public with context or Authenticated)
  fastify.get('/:id', {
    preHandler: [tryAuth],
    schema: {
      tags: ['Additions'],
      summary: 'Get product addition by ID',
      description: 'Fetch details of a single product addition modifier.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Product Addition ID' },
        },
        required: ['id'],
      },
    },
  }, opts.controller.getById.bind(opts.controller));

  // 3. Create Product Addition (Protected - Tenant Admin)
  fastify.post('/', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Additions'],
      summary: 'Create product addition',
      description: 'Create a new modifier / extra for the authenticated restaurant.',
    },
  }, opts.controller.create.bind(opts.controller));

  // 4. Update Product Addition (Protected - Tenant Admin)
  fastify.put('/:id', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Additions'],
      summary: 'Update product addition',
      description: 'Modify price, name, availability, or association of an existing product addition.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Product Addition ID' },
        },
        required: ['id'],
      },
    },
  }, opts.controller.update.bind(opts.controller));

  // 5. Delete Product Addition (Protected - Tenant Admin)
  fastify.delete('/:id', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Additions'],
      summary: 'Delete product addition',
      description: 'Remove a product addition modifier for the authenticated restaurant.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Product Addition ID' },
        },
        required: ['id'],
      },
    },
  }, opts.controller.delete.bind(opts.controller));
}
