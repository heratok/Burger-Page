import { FastifyInstance } from 'fastify';
import { SupplierController } from '../controllers/SupplierController.js';
import { requireAuth, requirePermission } from '../middleware/auth.middleware.js';

export async function supplierRoutes(fastify: FastifyInstance, opts: { controller: SupplierController }) {
  // 1. List Suppliers (Protected - Restaurant Scoped)
  fastify.get('/', {
    preHandler: [requireAuth, requirePermission('menu.manage')],
    schema: {
      tags: ['Suppliers'],
      summary: 'List all restaurant suppliers',
      description: 'Fetch suppliers for the authenticated restaurant.',
      querystring: {
        type: 'object',
        properties: {
          restaurantId: { type: 'string', description: 'Target restaurant identifier for super_admin override' },
        },
      },
    },
  }, opts.controller.list.bind(opts.controller));

  // 2. Create Supplier (Protected - Restaurant Scoped)
  fastify.post('/', {
    preHandler: [requireAuth, requirePermission('menu.manage')],
    schema: {
      tags: ['Suppliers'],
      summary: 'Create a supplier',
      description: 'Add a new supplier for the authenticated restaurant.',
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          restaurantId: { type: 'string', description: 'Target restaurant identifier for super_admin override' },
          name: { type: 'string' },
          category: { type: 'string' },
          contactName: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          notes: { type: 'string' },
        },
      },
    },
  }, opts.controller.create.bind(opts.controller));

  // 3. Update Supplier (Protected - Restaurant Scoped)
  fastify.put('/:id', {
    preHandler: [requireAuth, requirePermission('menu.manage')],
    schema: {
      tags: ['Suppliers'],
      summary: 'Update a supplier',
      description: 'Modify supplier details for the authenticated restaurant.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Supplier ID' },
        },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          restaurantId: { type: 'string', description: 'Target restaurant identifier for super_admin override' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          category: { type: 'string' },
          contactName: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          notes: { type: 'string' },
        },
      },
    },
  }, opts.controller.update.bind(opts.controller));

  // 4. Delete Supplier (Protected - Restaurant Scoped)
  fastify.delete('/:id', {
    preHandler: [requireAuth, requirePermission('menu.manage')],
    schema: {
      tags: ['Suppliers'],
      summary: 'Delete a supplier',
      description: 'Remove a supplier record for the authenticated restaurant.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Supplier ID' },
        },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          restaurantId: { type: 'string', description: 'Target restaurant identifier for super_admin override' },
        },
      },
    },
  }, opts.controller.delete.bind(opts.controller));
}
