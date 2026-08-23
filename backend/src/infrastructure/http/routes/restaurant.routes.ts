import { FastifyInstance } from 'fastify';
import { RestaurantController } from '../controllers/RestaurantController.js';

export async function restaurantRoutes(fastify: FastifyInstance, opts: { controller: RestaurantController }) {
  fastify.get('/', {
    schema: {
      tags: ['Restaurant'],
      summary: 'Get active restaurant details',
      description: 'Returns storefront configuration, branding colors, opening hours, and theme settings.',
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            config: { type: 'object', additionalProperties: true },
            openingHours: { type: 'object', additionalProperties: true },
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
}
