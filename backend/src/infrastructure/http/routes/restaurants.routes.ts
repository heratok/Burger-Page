import { FastifyInstance } from 'fastify';
import { RestaurantController } from '../controllers/RestaurantController.js';
import { requireSuperAdmin, tryAuth, requireAnyAdmin } from '../middleware/auth.middleware.js';
import { createRestaurantSchema, updateRestaurantSchema } from '@burger-page/contracts';
import { jsonSchemaFromZod } from '../zodSchemas.js';

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
      body: jsonSchemaFromZod(createRestaurantSchema, 'createRestaurantBody'),
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            tagline: { type: 'string' },
            theme: { type: 'string' },
            adminUsername: { type: 'string' },
            adminPassword: { type: 'string' },
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
    preHandler: [tryAuth],
    schema: {
      tags: ['Restaurant'],
      summary: 'Get restaurant by id or slug',
      params: {
        type: 'object',
        properties: {
          idOrSlug: { type: 'string' }
        },
        required: ['idOrSlug']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            slug: { type: 'string' },
            name: { type: 'string' },
            tagline: { type: 'string' },
            whatsappNumber: { type: 'string' },
            primaryColor: { type: 'string' },
            theme: { type: 'string' },
            config: { type: 'object', additionalProperties: true },
            openingHours: { type: 'object', additionalProperties: true },
            categories: { type: 'array', items: { type: 'string' } },
            // A9: operator records are stripped from the public projection.
            // They stay optional here because an authenticated super admin /
            // owning tenant admin receives the full record (minus secrets).
            isActive: { type: 'boolean' },
            createdAt: { type: 'string' },
          },
          // Never declare adminPassword: read paths must not carry it.
          additionalProperties: false
        },
        404: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            status: { type: 'number' },
            detail: { type: 'string' }
          }
        }
      }
    }
  }, opts.controller.get.bind(opts.controller));

  fastify.put('/:id', {
    preHandler: [requireAnyAdmin],
    schema: {
      tags: ['Restaurant'],
      summary: 'Update restaurant tenant',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      body: jsonSchemaFromZod(updateRestaurantSchema, 'updateRestaurantBody'),
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
