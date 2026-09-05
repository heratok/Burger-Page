import { FastifyInstance } from 'fastify';
import { CustomerController } from '../controllers/CustomerController.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export async function customerRoutes(fastify: FastifyInstance, opts: { controller: CustomerController }) {
  // 1. List Customers (Protected - Restaurant Scoped)
  fastify.get('/', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Customers'],
      summary: 'List all restaurant customers',
      description: 'Fetch buyers for the authenticated restaurant (name, phone, address, barrio, notes, email).',
      querystring: {
        type: 'object',
        properties: {
          restaurantId: { type: 'string', description: 'Target restaurant identifier for super_admin override' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              restaurantId: { type: 'string' },
              name: { type: 'string' },
              phone: { type: 'string' },
              address: { type: 'string' },
              barrio: { type: 'string' },
              notes: { type: 'string' },
              email: { type: 'string' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' }
            }
          }
        }
      }
    }
  }, opts.controller.list.bind(opts.controller));

  // 2. Get Customer by ID (Protected - Restaurant Scoped)
  fastify.get('/:id', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Customers'],
      summary: 'Get customer by ID',
      description: 'Fetch buyer details for the authenticated restaurant.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Customer ID' }
        },
        required: ['id']
      },
      querystring: {
        type: 'object',
        properties: {
          restaurantId: { type: 'string', description: 'Target restaurant identifier for super_admin override' },
        },
      },
    }
  }, opts.controller.getById.bind(opts.controller));

  // 3. Create Customer (Protected - Restaurant Scoped)
  fastify.post('/', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Customers'],
      summary: 'Create or register a restaurant customer',
      description: 'Add or update buyer information for the authenticated restaurant.',
      body: {
        type: 'object',
        required: ['name', 'phone'],
        properties: {
          restaurantId: { type: 'string', description: 'Target restaurant identifier for super_admin override' },
          name: { type: 'string', example: 'Carlos Gómez' },
          phone: { type: 'string', example: '+57 300 123 4567' },
          address: { type: 'string', example: 'Calle 45 # 12-34' },
          barrio: { type: 'string', example: 'El Poblado' },
          notes: { type: 'string', example: 'Timbre no funciona, llamar al llegar' },
          email: { type: 'string', example: 'carlos@example.com' }
        }
      }
    }
  }, opts.controller.create.bind(opts.controller));

  // 4. Update Customer (Protected - Restaurant Scoped)
  fastify.put('/:id', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Customers'],
      summary: 'Update customer details',
      description: 'Modify buyer details (address, notes, phone) for the authenticated restaurant.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Customer ID' }
        },
        required: ['id']
      },
      querystring: {
        type: 'object',
        properties: {
          restaurantId: { type: 'string', description: 'Target restaurant identifier for super_admin override' },
        },
      },
    }
  }, opts.controller.update.bind(opts.controller));

  // 5. Delete Customer (Protected - Restaurant Scoped)
  fastify.delete('/:id', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Customers'],
      summary: 'Delete customer',
      description: 'Remove customer record for the authenticated restaurant.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Customer ID' }
        },
        required: ['id']
      },
      querystring: {
        type: 'object',
        properties: {
          restaurantId: { type: 'string', description: 'Target restaurant identifier for super_admin override' },
        },
      },
    }
  }, opts.controller.delete.bind(opts.controller));
}
