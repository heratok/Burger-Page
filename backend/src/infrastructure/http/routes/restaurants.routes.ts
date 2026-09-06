import { FastifyInstance } from 'fastify';
import { RestaurantController } from '../controllers/RestaurantController.js';
import { requireSuperAdmin, tryAuth } from '../middleware/auth.middleware.js';

export async function restaurantsRoutes(fastify: FastifyInstance, opts: { controller: RestaurantController }) {
  fastify.get('/', {
    preHandler: [tryAuth],
    schema: {
      tags: ['Restaurant'],
      summary: 'List restaurants',
      description: 'Super admins list all tenants; restaurant admins only see their own tenant.',
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              slug: { type: 'string' },
              tagline: { type: 'string' },
              theme: { type: 'string' },
              config: { type: 'object', additionalProperties: true },
              openingHours: { type: 'object', additionalProperties: true },
              categories: { type: 'array', items: { type: 'string' } },
              isActive: { type: 'boolean' },
              createdAt: { type: 'string' },
            }
          }
        }
      }
    }
  }, opts.controller.list.bind(opts.controller));

  fastify.post('/', {
    preHandler: [requireSuperAdmin],
    schema: {
      tags: ['Restaurant'],
      summary: 'Create a new restaurant tenant',
      description: 'Registers a new restaurant tenant in the platform.',
      body: {
        type: 'object',
        required: ['name', 'slug'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          slug: { type: 'string' },
          tagline: { type: 'string' },
          whatsappNumber: { type: 'string' },
          adminPassword: { type: 'string' },
          primaryColor: { type: 'string' },
          templateType: { type: 'string', enum: ['burger', 'pizza', 'tacos', 'blank'] },
          theme: { type: 'string' },
          categories: { type: 'array', items: { type: 'string' } },
          config: { type: 'object', additionalProperties: true }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            tagline: { type: 'string' },
            theme: { type: 'string' },
            config: { type: 'object', additionalProperties: true },
            openingHours: { type: 'object', additionalProperties: true },
            categories: { type: 'array', items: { type: 'string' } },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string' },
          }
        }
      }
    }
  }, opts.controller.create.bind(opts.controller));

  fastify.get('/:idOrSlug', {
    schema: {
      tags: ['Restaurant'],
      summary: 'Get restaurant by id or slug',
      params: {
        type: 'object',
        properties: {
          idOrSlug: { type: 'string' }
        },
        required: ['idOrSlug']
      }
    }
  }, opts.controller.get.bind(opts.controller));

  fastify.put('/:id', {
    preHandler: [requireSuperAdmin],
    schema: {
      tags: ['Restaurant'],
      summary: 'Update restaurant tenant',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, opts.controller.update.bind(opts.controller));

  fastify.patch('/:id', {
    preHandler: [requireSuperAdmin],
    schema: {
      tags: ['Restaurant'],
      summary: 'Partially update restaurant tenant',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, opts.controller.update.bind(opts.controller));

  fastify.delete('/:id', {
    preHandler: [requireSuperAdmin],
    schema: {
      tags: ['Restaurant'],
      summary: 'Delete restaurant tenant',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, opts.controller.delete.bind(opts.controller));
}
