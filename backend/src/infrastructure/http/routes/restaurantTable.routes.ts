import { FastifyInstance } from 'fastify';
import { RestaurantTableController } from '../controllers/RestaurantTableController.js';
import { requireAuth, requireAnyPermission, requirePermission } from '../middleware/auth.middleware.js';

const restaurantIdQuery = {
  type: 'object',
  properties: {
    restaurantId: { type: 'string', description: 'Target restaurant identifier for super_admin override' },
  },
};

export async function restaurantTableRoutes(fastify: FastifyInstance, opts: { controller: RestaurantTableController }) {
  const c = opts.controller;

  fastify.get('/', {
    preHandler: [requireAuth, requireAnyPermission('tables.manage', 'orders.view', 'orders.manage')],
    schema: {
      tags: ['Tables'],
      summary: 'List the restaurant tables',
      description: 'Dine-in tables of the authenticated restaurant, ordered for display.',
      querystring: restaurantIdQuery,
    },
  }, c.list.bind(c));

  fastify.post('/', {
    preHandler: [requireAuth, requirePermission('tables.manage')],
    schema: {
      tags: ['Tables'],
      summary: 'Create a table',
      description: 'Add a table. The name is unique per restaurant (case-insensitive).',
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          restaurantId: { type: 'string', description: 'Target restaurant identifier for super_admin override' },
          name: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
    },
  }, c.create.bind(c));

  // Registered before '/:id' so "order" is never read as a table id.
  fastify.put('/order', {
    preHandler: [requireAuth, requirePermission('tables.manage')],
    schema: {
      tags: ['Tables'],
      summary: 'Reorder tables',
      description: 'Places the given table ids first, in that order.',
      body: {
        type: 'object',
        required: ['ids'],
        properties: {
          restaurantId: { type: 'string', description: 'Target restaurant identifier for super_admin override' },
          ids: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, c.reorder.bind(c));

  fastify.put('/:id', {
    preHandler: [requireAuth, requirePermission('tables.manage')],
    schema: {
      tags: ['Tables'],
      summary: 'Update a table',
      description: 'Rename a table or activate/deactivate it.',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      querystring: restaurantIdQuery,
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
    },
  }, c.update.bind(c));

  fastify.delete('/:id', {
    preHandler: [requireAuth, requirePermission('tables.manage')],
    schema: {
      tags: ['Tables'],
      summary: 'Delete a table',
      description: 'Remove a table. Past orders keep the table name they were sold with.',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      querystring: restaurantIdQuery,
    },
  }, c.delete.bind(c));
}
