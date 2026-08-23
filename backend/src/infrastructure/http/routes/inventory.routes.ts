import { FastifyInstance } from 'fastify';
import { InventoryController } from '../controllers/InventoryController.js';

export async function inventoryRoutes(fastify: FastifyInstance, opts: { controller: InventoryController }) {
  fastify.get('/', {
    schema: {
      tags: ['Inventory'],
      summary: 'List all inventory items',
      description: 'Get ingredients, packaging, and beverage inventory stock levels and alert thresholds.',
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              category: { type: 'string' },
              currentStock: { type: 'number' },
              minStockAlert: { type: 'number' },
              unit: { type: 'string' },
              costPerUnit: { type: 'number' }
            }
          }
        }
      }
    }
  }, opts.controller.list.bind(opts.controller));

  fastify.patch('/:id/stock', {
    schema: {
      tags: ['Inventory'],
      summary: 'Update inventory stock quantity',
      description: 'Adjust current stock quantity by delta (positive or negative).',
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
            currentStock: { type: 'number' }
          }
        },
        400: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            status: { type: 'number' },
            detail: { type: 'string' }
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
  }, opts.controller.updateStock.bind(opts.controller));
}
