import { FastifyInstance } from 'fastify';
import { InventoryController } from '../controllers/InventoryController.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export async function inventoryRoutes(fastify: FastifyInstance, opts: { controller: InventoryController }) {
  // 1. List Inventory (Protected - Restaurant Scoped)
  fastify.get('/', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Inventory'],
      summary: 'List all inventory items',
      description: 'Get ingredients, packaging, and beverage inventory stock levels for the authenticated restaurant.',
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              restaurantId: { type: 'string' },
              name: { type: 'string' },
              category: { type: 'string' },
              currentStock: { type: 'number' },
              quantity: { type: 'number' },
              minStockAlert: { type: 'number' },
              alertThreshold: { type: 'number' },
              unit: { type: 'string' },
              costPerUnit: { type: 'number' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' }
            }
          }
        }
      }
    }
  }, opts.controller.list.bind(opts.controller));

  // 2. Get Inventory Item by ID (Protected - Restaurant Scoped)
  fastify.get('/:id', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Inventory'],
      summary: 'Get inventory item by ID',
      description: 'Fetch details of a single inventory item for the authenticated restaurant.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Inventory Item ID' }
        },
        required: ['id']
      }
    }
  }, opts.controller.getById.bind(opts.controller));

  // 3. Create Inventory Item (Protected - Restaurant Scoped)
  fastify.post('/', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Inventory'],
      summary: 'Create inventory item',
      description: 'Add a new inventory item for the authenticated restaurant.',
      body: {
        type: 'object',
        required: ['name', 'category', 'unit'],
        properties: {
          name: { type: 'string', example: 'Pan Brioche' },
          category: { type: 'string', enum: ['ingredients', 'beverages', 'packaging', 'cleaning', 'other'], example: 'ingredients' },
          quantity: { type: 'number', example: 50 },
          unit: { type: 'string', enum: ['unidades', 'kg', 'g', 'litros', 'paquetes', 'cajas'], example: 'unidades' },
          minStockAlert: { type: 'number', example: 10 },
          alertThreshold: { type: 'number', example: 10 },
          costPerUnit: { type: 'number', example: 1200 }
        }
      }
    }
  }, opts.controller.create.bind(opts.controller));

  // 4. Update Inventory Item (Protected - Restaurant Scoped)
  fastify.put('/:id', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Inventory'],
      summary: 'Update inventory item',
      description: 'Update attributes of an existing inventory item for the authenticated restaurant.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Inventory Item ID' }
        },
        required: ['id']
      }
    }
  }, opts.controller.update.bind(opts.controller));

  // 5. Adjust Stock Quantity (Protected - Restaurant Scoped)
  fastify.patch('/:id/stock', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Inventory'],
      summary: 'Update inventory stock quantity',
      description: 'Adjust current stock quantity by delta (positive or negative) for the authenticated restaurant.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Inventory Item ID' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        required: ['quantityChange'],
        properties: {
          quantityChange: { type: 'number', example: 10 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            restaurantId: { type: 'string' },
            currentStock: { type: 'number' },
            quantity: { type: 'number' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, opts.controller.updateStock.bind(opts.controller));

  // 6. Delete Inventory Item (Protected - Restaurant Scoped)
  fastify.delete('/:id', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Inventory'],
      summary: 'Delete inventory item',
      description: 'Remove an inventory item for the authenticated restaurant.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Inventory Item ID' }
        },
        required: ['id']
      }
    }
  }, opts.controller.delete.bind(opts.controller));
}
