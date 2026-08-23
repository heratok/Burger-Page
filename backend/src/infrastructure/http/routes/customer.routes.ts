import { FastifyInstance } from 'fastify';
import { CustomerController } from '../controllers/CustomerController.js';

export async function customerRoutes(fastify: FastifyInstance, opts: { controller: CustomerController }) {
  fastify.get('/', {
    schema: {
      tags: ['Customers'],
      summary: 'List all restaurant customers',
      description: 'Fetch customer profiles, lifetime order count, total spend, and loyalty tier rankings (bronze, silver, gold, vip).',
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              phone: { type: 'string' },
              address: { type: 'string' },
              totalOrders: { type: 'number' },
              totalSpent: { type: 'number' },
              loyaltyTier: { type: 'string', enum: ['bronze', 'silver', 'gold', 'vip'] },
              lastOrderDate: { type: 'string' }
            }
          }
        }
      }
    }
  }, opts.controller.list.bind(opts.controller));
}
