import { FastifyInstance } from 'fastify';
import { RoleController } from '../controllers/RoleController.js';
import { requireAuth, requirePermission } from '../middleware/auth.middleware.js';

const restaurantIdQuery = {
  type: 'object',
  properties: {
    restaurantId: { type: 'string', description: 'Target restaurant identifier for super_admin override' },
  },
};

const permissionsSchema = {
  type: 'array',
  items: { type: 'string' },
  description: 'Permissions from the catalog in @burger-page/contracts (e.g. orders.view).',
};

// Requires roles.manage: restaurant_admin of the tenant and super_admin (with a
// restaurantId override) always hold it; staff only when their role grants it,
// and then they can never grant more than they hold nor edit their own role
// (checked in RoleController).
export async function roleRoutes(fastify: FastifyInstance, opts: { controller: RoleController }) {
  const c = opts.controller;

  fastify.get('/', {
    preHandler: [requireAuth, requirePermission('roles.manage')],
    schema: {
      tags: ['Roles'],
      summary: 'List the restaurant roles',
      description: 'Custom roles of the authenticated restaurant, ordered by name.',
      querystring: restaurantIdQuery,
    },
  }, c.list.bind(c));

  fastify.post('/', {
    preHandler: [requireAuth, requirePermission('roles.manage')],
    schema: {
      tags: ['Roles'],
      summary: 'Create a role',
      description: 'Define a named set of permissions. The name is unique per restaurant (case-insensitive).',
      body: {
        type: 'object',
        required: ['name', 'permissions'],
        properties: {
          restaurantId: { type: 'string', description: 'Target restaurant identifier for super_admin override' },
          name: { type: 'string' },
          description: { type: 'string' },
          permissions: permissionsSchema,
        },
      },
    },
  }, c.create.bind(c));

  fastify.put('/:id', {
    preHandler: [requireAuth, requirePermission('roles.manage')],
    schema: {
      tags: ['Roles'],
      summary: 'Update a role',
      description: 'Rename a role, change its description or its permissions. Applies to every user holding the role.',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      querystring: restaurantIdQuery,
      body: {
        type: 'object',
        properties: {
          restaurantId: { type: 'string', description: 'Target restaurant identifier for super_admin override' },
          name: { type: 'string' },
          description: { type: 'string' },
          permissions: permissionsSchema,
        },
      },
    },
  }, c.update.bind(c));

  fastify.delete('/:id', {
    preHandler: [requireAuth, requirePermission('roles.manage')],
    schema: {
      tags: ['Roles'],
      summary: 'Delete a role',
      description: 'Remove a role. 409 while any user still holds it.',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      querystring: restaurantIdQuery,
    },
  }, c.delete.bind(c));
}
