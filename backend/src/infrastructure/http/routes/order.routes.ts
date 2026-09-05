import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OrderController } from '../controllers/OrderController.js';
import { globalOrderEventBus } from '../../events/OrderEventBus.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export async function orderRoutes(fastify: FastifyInstance, opts: { controller: OrderController }) {
  // 1. List Orders (Protected - Tenant Scoped)
  fastify.get('/', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Orders'],
      summary: 'List restaurant orders',
      description: 'Fetch all orders belonging to the authenticated restaurant.',
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              restaurantId: { type: 'string' },
              orderNumber: { type: 'number' },
              customerId: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'cooking', 'delivering', 'delivered', 'cancelled'] },
              subtotal: { type: 'number' },
              deliveryFee: { type: 'number' },
              finalTotal: { type: 'number' },
              total: { type: 'number' },
              paymentMethod: { type: 'string' },
              paymentAmount: { type: 'number' },
              changeAmount: { type: 'number' },
              comment: { type: 'string' },
              receiptUrl: { type: 'string' },
              items: { type: 'array', items: { type: 'object', additionalProperties: true } },
              createdAt: { type: 'string' },
            }
          }
        }
      }
    }
  }, opts.controller.list.bind(opts.controller));

  // 2. Real-time SSE stream (Protected - Strictly Tenant Filtered)
  fastify.get('/stream', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Orders'],
      summary: 'Real-time SSE stream for tenant orders',
      description: 'Streams live order status updates and creations strictly filtered by the authenticated restaurant.',
    }
  }, (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = req.authContext?.restaurantId;
    if (!tenantId) {
      return reply.status(401).send({ title: 'Unauthorized', detail: 'Missing restaurant context in token.' });
    }

    reply.hijack();
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders?.();

    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected to live orders stream', restaurantId: tenantId })}\n\n`);

    const pingInterval = setInterval(() => {
      try {
        reply.raw.write(': ping\n\n');
      } catch {
        clearInterval(pingInterval);
      }
    }, 15000);

    const unsubscribe = globalOrderEventBus.subscribe((event: any) => {
      const eventRestaurantId = event.payload?.restaurantId || event.restaurantId;
      if (eventRestaurantId === tenantId) {
        reply.raw.write(`event: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`);
      }
    });

    req.raw.on('close', () => {
      clearInterval(pingInterval);
      unsubscribe();
    });
  });

  // 3. Get Order by ID (Protected - Tenant Scoped)
  fastify.get('/:id', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Orders'],
      summary: 'Get order details by ID',
      description: 'Fetch detailed order state for the authenticated restaurant.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            restaurantId: { type: 'string' },
            orderNumber: { type: 'number' },
            customerId: { type: 'string' },
            status: { type: 'string' },
            subtotal: { type: 'number' },
            deliveryFee: { type: 'number' },
            finalTotal: { type: 'number' },
            total: { type: 'number' },
            receiptUrl: { type: 'string' },
            items: { type: 'array', items: { type: 'object', additionalProperties: true } }
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
  }, opts.controller.getById.bind(opts.controller));

  // 4. Create Order (Public Storefront - NO requireAuth)
  fastify.post('/', {
    schema: {
      tags: ['Orders'],
      summary: 'Create and place a new order',
      description: 'Public storefront endpoint to place an order. Totals are calculated authoritatively by the backend and database.',
      body: {
        type: 'object',
        required: ['restaurantId', 'items'],
        properties: {
          restaurantId: { type: 'string', example: 'burger-craft' },
          customerId: { type: 'string', example: 'cust-1' },
          paymentMethod: { type: 'string', enum: ['Efectivo', 'Transferencia'] },
          paymentAmount: { type: 'number' },
          changeAmount: { type: 'number' },
          comment: { type: 'string' },
          receiptUrl: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['productId', 'quantity'],
              properties: {
                productId: { type: 'string' },
                quantity: { type: 'number' },
                observation: { type: 'string' },
                additions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      additionId: { type: 'string' },
                      quantity: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, opts.controller.create.bind(opts.controller));

  // 5. Update Order Status (Protected - Tenant Scoped)
  fastify.patch('/:id/status', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Orders'],
      summary: 'Update order status',
      description: 'Transition an order status with state machine validation and actor audit log.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['pending', 'cooking', 'delivering', 'delivered', 'cancelled'] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            restaurantId: { type: 'string' },
            orderNumber: { type: 'number' },
            status: { type: 'string' }
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
  }, opts.controller.updateStatus.bind(opts.controller));

  // 6. Update Order Receipt (Protected - Tenant Scoped)
  fastify.patch('/:id/receipt', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Orders'],
      summary: 'Update order transfer receipt',
      description: 'Attach or update transfer payment receipt image URL for an order.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        required: ['receiptUrl'],
        properties: {
          receiptUrl: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            restaurantId: { type: 'string' },
            orderNumber: { type: 'number' },
            status: { type: 'string' },
            receiptUrl: { type: 'string' }
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
  }, opts.controller.updateReceipt.bind(opts.controller));
}
