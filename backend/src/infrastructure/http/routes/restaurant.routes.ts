import { FastifyInstance } from 'fastify';
import { RestaurantController } from '../controllers/RestaurantController.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export async function restaurantRoutes(fastify: FastifyInstance, opts: { controller: RestaurantController }) {
  fastify.get('/', {
    schema: {
      tags: ['Restaurant'],
      summary: 'Get active restaurant details',
      description: 'Returns storefront configuration, branding colors, opening hours, theme settings, and categories.',
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            config: { type: 'object', additionalProperties: true },
            openingHours: { type: 'object', additionalProperties: true },
            categories: { type: 'array', items: { type: 'string' } },
          }
        }
      }
    }
  }, opts.controller.get.bind(opts.controller));

  fastify.get('/:slug', {
    schema: {
      tags: ['Restaurant'],
      summary: 'Get restaurant by slug',
      description: 'Returns restaurant tenant record matching the specified slug identifier.',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Restaurant URL slug' }
        },
        required: ['slug']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            config: { type: 'object', additionalProperties: true },
            openingHours: { type: 'object', additionalProperties: true },
            categories: { type: 'array', items: { type: 'string' } },
          }
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

  fastify.put('/categories', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Restaurant'],
      summary: 'Update categories for default restaurant',
      description: 'Updates active product categories for the default restaurant.',
      body: {
        type: 'object',
        required: ['categories'],
        properties: {
          categories: { type: 'array', items: { type: 'string' } }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            categories: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  }, opts.controller.updateCategories.bind(opts.controller));

  fastify.put('/:slug/categories', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Restaurant'],
      summary: 'Update categories for restaurant tenant',
      description: 'Updates active product categories for the specified restaurant tenant.',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Restaurant URL slug' }
        },
        required: ['slug']
      },
      body: {
        type: 'object',
        required: ['categories'],
        properties: {
          categories: { type: 'array', items: { type: 'string' } }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            categories: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  }, opts.controller.updateCategories.bind(opts.controller));
}
