import { FastifyInstance } from 'fastify';
import { RestaurantController } from '../controllers/RestaurantController.js';
import { requireSuperAdmin, tryAuth, requireAnyAdmin, requireAuth, requirePermission } from '../middleware/auth.middleware.js';
import { createRestaurantSchema, updateRestaurantSchema } from '@burger-page/contracts';
import { jsonSchemaFromZod } from '../zodSchemas.js';

export async function restaurantsRoutes(fastify: FastifyInstance, opts: { controller: RestaurantController }) {
  fastify.get('/', {
    preHandler: [requireAnyAdmin],
    schema: {
      tags: ['Restaurant'],
      summary: 'List restaurants',
      description: 'Private. Anonymous callers get 401. Super admins list all tenants; restaurant admins only see their own tenant.',
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
              schedule: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    dayOfWeek: { type: 'integer' },
                    open: { type: 'string' },
                    close: { type: 'string' },
                  },
                },
              },
              timezone: { type: 'string' },
              ordersPaused: { type: 'boolean' },
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
            schedule: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  dayOfWeek: { type: 'integer' },
                  open: { type: 'string' },
                  close: { type: 'string' },
                },
              },
            },
            timezone: { type: 'string' },
            ordersPaused: { type: 'boolean' },
            categories: { type: 'array', items: { type: 'string' } },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string' },
          }
        }
      }
    }
  }, opts.controller.create.bind(opts.controller));

  fastify.get('/templates', {
    preHandler: [requireSuperAdmin],
    schema: {
      tags: ['Restaurant'],
      summary: 'List restaurant templates',
      description: 'Super admin only. The templates selectable as templateType when creating a restaurant, with the number of sample products and additions each one creates (derived from the template data).',
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              productCount: { type: 'integer' },
              additionCount: { type: 'integer' },
              supportedCurrencies: { type: 'array', nullable: true, items: { type: 'string' } },
            },
          },
        },
      },
    },
  }, opts.controller.listTemplates.bind(opts.controller));

  fastify.get('/deleted', {
    preHandler: [requireSuperAdmin],
    schema: {
      tags: ['Restaurant'],
      summary: 'List deleted restaurant tenants',
      description: 'Super admin only. Soft-deleted tenants with their original slug and deletion time, newest first.',
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              slug: { type: 'string' },
              deletedAt: { type: 'string' },
            },
          },
        },
      },
    },
  }, opts.controller.listDeleted.bind(opts.controller));

  fastify.post('/:id/restore', {
    preHandler: [requireSuperAdmin],
    schema: {
      tags: ['Restaurant'],
      summary: 'Restore a deleted restaurant tenant',
      description: 'Super admin only. Brings the tenant back PAUSED (isActive=false) so it is reactivated explicitly, with its original slug (or the optional body.slug), and reactivates its users with their original usernames. 404 if it is not deleted, 409 if the slug is taken. A user whose original username was taken meanwhile is restored as <username>-restored-<restaurantId> and reported in renamedUsers.',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, opts.controller.restore.bind(opts.controller));

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
            schedule: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  dayOfWeek: { type: 'integer' },
                  open: { type: 'string' },
                  close: { type: 'string' },
                },
              },
            },
            timezone: { type: 'string' },
            ordersPaused: { type: 'boolean' },
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
    preHandler: [requireAuth, requirePermission('settings.manage')],
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
