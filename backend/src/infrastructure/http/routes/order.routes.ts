import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OrderController } from '../controllers/OrderController.js';
import { globalOrderEventBus } from '../../events/OrderEventBus.js';

export async function orderRoutes(fastify: FastifyInstance, opts: { controller: OrderController }) {
  fastify.get('/', {
    schema: {
      tags: ['Orders'],
      summary: 'List all restaurant orders',
      description: 'Fetch all incoming and historical customer orders with order statuses.',
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              orderNumber: { type: 'number' },
              customerId: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'cooking', 'delivering', 'delivered', 'cancelled'] },
              total: { type: 'number' },
              deliveryFee: { type: 'number' },
              finalTotal: { type: 'number' },
              items: { type: 'array', items: { type: 'object', additionalProperties: true } },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' }
            }
          }
        }
      }
    }
  }, opts.controller.list.bind(opts.controller));

  // Server-Sent Events (SSE) stream
  fastify.get('/stream', {
    schema: {
      tags: ['Orders'],
      summary: 'Real-time SSE stream for order updates',
      description: 'Streams live order status updates and creations to kitchen and customer screens.',
    }
  }, (req: FastifyRequest, reply: FastifyReply) => {
    reply.hijack();
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders?.();

    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected to live orders stream' })}\n\n`);

    const pingInterval = setInterval(() => {
      try {
        reply.raw.write(': ping\n\n');
      } catch {
        clearInterval(pingInterval);
      }
    }, 15000);

    const unsubscribe = globalOrderEventBus.subscribe((event) => {
      reply.raw.write(`event: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`);
    });

    req.raw.on('close', () => {
      clearInterval(pingInterval);
      unsubscribe();
    });
  });

  fastify.get('/:id', {
    schema: {
      tags: ['Orders'],
      summary: 'Get order details by ID',
      description: 'Fetch detailed order state, customer info, and items.',
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
            orderNumber: { type: 'number' },
            customerId: { type: 'string' },
            status: { type: 'string' },
            total: { type: 'number' },
            deliveryFee: { type: 'number' },
            finalTotal: { type: 'number' },
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

  fastify.post('/', {
    schema: {
      tags: ['Orders'],
      summary: 'Create and place a new order',
      description: 'Processes a new order, calculates totals from verified product prices, and updates customer spend.',
      body: {
        type: 'object',
        required: ['customerId', 'items'],
        properties: {
          customerId: { type: 'string', example: 'cust-1' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['productId', 'quantity'],
              properties: {
                productId: { type: 'string', example: 'prod-1' },
                quantity: { type: 'number', example: 2 },
                additions: { type: 'array', items: { type: 'string' }, example: ['add-1'] }
              }
            }
          },
          deliveryFee: { type: 'number', example: 4500 }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            orderNumber: { type: 'number' },
            customerId: { type: 'string' },
            status: { type: 'string' },
            total: { type: 'number' },
            deliveryFee: { type: 'number' },
            finalTotal: { type: 'number' }
          }
        },
        400: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            status: { type: 'number' },
            detail: { type: 'string' }
          }
        }
      }
    }
  }, opts.controller.create.bind(opts.controller));

  fastify.patch('/:id/status', {
    schema: {
      tags: ['Orders'],
      summary: 'Update order lifecycle status',
      description: 'Transitions order state machine (pending -> cooking -> delivering -> delivered / cancelled).',
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
          status: { type: 'string', enum: ['pending', 'cooking', 'delivering', 'delivered', 'cancelled'], example: 'cooking' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string' },
            message: { type: 'string' },
            updatedAt: { type: 'string' }
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
  }, opts.controller.updateStatus.bind(opts.controller));
}
