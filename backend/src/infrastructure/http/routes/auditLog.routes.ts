import { FastifyInstance } from 'fastify';
import { AuditLogController } from '../controllers/AuditLogController.js';
import { requireSuperAdmin } from '../middleware/auth.middleware.js';

interface AuditLogRoutesOptions {
  prefix: string;
  controller: AuditLogController;
}

/** Read-only on purpose: the audit trail has no write, update or delete endpoint. */
export async function auditLogRoutes(app: FastifyInstance, opts: AuditLogRoutesOptions) {
  app.get('/', {
    preHandler: [requireSuperAdmin],
    schema: {
      tags: ['Audit log'],
      summary: 'List super admin actions',
      description:
        'Super admin only. Newest first, keyset-paginated: pass the returned nextCursor as cursor to get the next page (null on the last one). Filters combine with AND. from/to are inclusive ISO 8601 timestamps. limit defaults to 50, max 200.',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'string', description: '1-200, default 50' },
          cursor: { type: 'string' },
          action: { type: 'string', description: 'e.g. restaurant.create, user.reset_password' },
          restaurantId: { type: 'string' },
          actorUserId: { type: 'string' },
          from: { type: 'string', description: 'ISO 8601, inclusive' },
          to: { type: 'string', description: 'ISO 8601, inclusive' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  createdAt: { type: 'string' },
                  actorUserId: { type: ['string', 'null'] },
                  actorUsername: { type: 'string' },
                  action: { type: 'string' },
                  targetType: { type: 'string', enum: ['restaurant', 'user'] },
                  targetId: { type: 'string' },
                  targetLabel: { type: 'string' },
                  restaurantId: { type: ['string', 'null'] },
                  details: { type: 'object', additionalProperties: true },
                },
              },
            },
            nextCursor: { type: ['string', 'null'] },
          },
        },
      },
    },
  }, opts.controller.list.bind(opts.controller));
}
