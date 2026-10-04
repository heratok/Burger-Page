import { FastifyInstance } from 'fastify';
import { PlatformStatsController } from '../controllers/PlatformStatsController.js';
import { requireSuperAdmin } from '../middleware/auth.middleware.js';

interface PlatformStatsRoutesOptions {
  prefix: string;
  controller: PlatformStatsController;
}

/** Read-only on purpose: platform totals are derived, never written. */
export async function platformStatsRoutes(app: FastifyInstance, opts: PlatformStatsRoutesOptions) {
  app.get('/', {
    preHandler: [requireSuperAdmin],
    schema: {
      tags: ['Platform stats'],
      summary: 'Platform-wide totals',
      description:
        'Super admin only. Totals across live restaurants (soft-deleted ones and their orders and customers are excluded). totalRevenue sums final_total of non-cancelled orders; totalOrders counts every order, cancelled included. from/to are inclusive UTC calendar days (YYYY-MM-DD) that only narrow the orders counted; restaurant and customer totals are never filtered.',
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'YYYY-MM-DD, inclusive' },
          to: { type: 'string', description: 'YYYY-MM-DD, inclusive' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            totalRevenue: { type: 'number' },
            totalOrders: { type: 'integer' },
            totalCustomers: { type: 'integer' },
            totalRestaurants: { type: 'integer' },
            activeRestaurants: { type: 'integer' },
          },
        },
      },
    },
  }, opts.controller.get.bind(opts.controller));
}
