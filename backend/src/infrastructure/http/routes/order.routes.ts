import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OrderController } from '../controllers/OrderController.js';
import { globalOrderEventBus, registerStream, unregisterStream } from '../../events/OrderEventBus.js';
import { requireAuth, requireStreamToken, tryAuth } from '../middleware/auth.middleware.js';
import { isOriginAllowed } from '../middleware/cors.js';

export async function orderRoutes(fastify: FastifyInstance, opts: { controller: OrderController }) {
  // 1. List Orders (Protected - Tenant Scoped)
  fastify.get('/', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Orders'],
      summary: 'List restaurant orders',
      description: 'Fetch all orders belonging to the authenticated restaurant.',
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
              customer: { type: 'object', additionalProperties: true },
              items: { type: 'array', items: { type: 'object', additionalProperties: true } },
              createdAt: { type: 'string' },
            },
            additionalProperties: true
          }
        }
      }
    }
  }, opts.controller.list.bind(opts.controller));

  // 1b. Issue a short-lived SSE-scoped token (Bearer only, never in URLs)
  fastify.post('/stream-token', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Orders'],
      summary: 'Issue short-lived token for the SSE stream',
      description: 'Returns a token scoped to the orders stream (valid 60s by default) so browsers can connect via EventSource without leaking the full session JWT into URLs.',
      response: {
        200: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            expiresInSeconds: { type: 'number' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const ctx = req.authContext;
    if (!ctx) {
      return reply.status(401).send({ title: 'Unauthorized', detail: 'Authentication required.' });
    }
    const ttl = Number(process.env.STREAM_TOKEN_TTL_SECONDS) || 60;
    const streamToken = opts.controller.issueStreamToken({ ...ctx, scope: 'sse' }, ttl);
    return reply.status(200).send({ token: streamToken, expiresInSeconds: ttl });
  });

  // 2. Real-time SSE stream (Protected - Strictly Tenant Filtered)
  fastify.get('/stream', {
    preHandler: [requireStreamToken],
    schema: {
      tags: ['Orders'],
      summary: 'Real-time SSE stream for tenant orders',
      description: 'Streams live order status updates and creations strictly filtered by the authenticated restaurant.',
      querystring: {
        type: 'object',
        properties: {
          restaurantId: { type: 'string', description: 'Target restaurant identifier for super_admin filter' },
          token: { type: 'string', description: 'Short-lived SSE-scoped token obtained from POST /api/orders/stream-token' },
        },
      },
    }
  }, (req: FastifyRequest, reply: FastifyReply) => {
    let tenantId = req.authContext?.restaurantId;
    if (!tenantId && req.authContext?.role === 'super_admin') {
      tenantId = (req.query as any)?.restaurantId;
    }
    if (!tenantId && req.authContext?.role !== 'super_admin') {
      return reply.status(401).send({ title: 'Unauthorized', detail: 'Missing restaurant context in token.' });
    }

    // H3: bound concurrent streams per process. Must run BEFORE
    // reply.hijack(): the refusal is a normal JSON reply. Every connection
    // then reserves a slot that is released exactly once on teardown.
    if (!registerStream()) {
      return reply.status(503).send({
        title: 'Stream Capacity Exceeded',
        status: 503,
        detail: 'Stream capacity exceeded: too many active order streams. Retry shortly.',
      });
    }
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      unregisterStream();
    };

    reply.hijack();
    if (!isOriginAllowed(req.headers.origin)) {
      reply.raw.statusCode = 403;
      reply.raw.end('Origin not allowed');
      release();
      return;
    }
    reply.raw.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    reply.raw.setHeader('Vary', 'Origin');
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders?.();

    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected to live orders stream', restaurantId: tenantId || 'all' })}\n\n`);

    // Guard writes after the client disconnects: writes to a destroyed
    // socket emit an 'error' on the raw response stream which, unhandled,
    // surfaces as an uncaughtException. Mark the stream as ended on the
    // first write failure and stop pinging/subscribing.
    let streamEnded = false;
    const safeWrite = (chunk: string) => {
      if (streamEnded) return;
      try {
        // Backpressure note (H3): reply.raw.write() returning false (socket
        // buffer full) is intentionally NOT queued here — a slow client only
        // receives the 15s heartbeat until its socket errors out, which the
        // 'error' handler below turns into teardown. A full drain-queue
        // backpressure implementation is out of scope.
        reply.raw.write(chunk);
      } catch {
        streamEnded = true;
        release();
        clearInterval(pingInterval);
        unsubscribe();
      }
    };
    reply.raw.on('error', () => {
      streamEnded = true;
      release();
      clearInterval(pingInterval);
      unsubscribe();
    });

    const pingInterval = setInterval(() => {
      safeWrite(': ping\n\n');
    }, 15000);

    const unsubscribe = globalOrderEventBus.subscribe((event: any) => {
      const eventRestaurantId = event.payload?.restaurantId || event.restaurantId;
      if (!tenantId || eventRestaurantId === tenantId) {
        safeWrite(`event: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`);
      }
    });

    req.raw.on('close', () => {
      streamEnded = true;
      release();
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
      querystring: {
        type: 'object',
        properties: {
          restaurantId: { type: 'string', description: 'Target restaurant identifier for super_admin override' },
        },
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
            paymentMethod: { type: 'string' },
            paymentAmount: { type: 'number' },
            changeAmount: { type: 'number' },
            comment: { type: 'string' },
            receiptUrl: { type: 'string' },
            customer: { type: 'object', additionalProperties: true },
            items: { type: 'array', items: { type: 'object', additionalProperties: true } }
          },
          additionalProperties: true
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

  // 4. Create Order (Public Storefront - NO requireAuth; tryAuth is opt-in,
  //    non-blocking: a valid Bearer token marks the caller as an authenticated
  //    staff session so the POS keeps fee-waiver/CRM-update capabilities, while
  //    anonymous callers stay public and are charged the configured fee)
  fastify.post('/', {
    preHandler: [tryAuth],
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
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
      querystring: {
        type: 'object',
        properties: {
          restaurantId: { type: 'string', description: 'Target restaurant identifier for super_admin override' },
        },
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
      querystring: {
        type: 'object',
        properties: {
          restaurantId: { type: 'string', description: 'Target restaurant identifier for super_admin override' },
        },
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

  // 7. Delete Order (Protected - Tenant Scoped)
  fastify.delete('/:id', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Orders'],
      summary: 'Delete order permanently',
      description: 'Deletes an order and its associated items. Strictly scoped to the authenticated tenant.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID' },
        },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          restaurantId: { type: 'string', description: 'Target restaurant identifier for super_admin override' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            id: { type: 'string' },
            message: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            status: { type: 'number' },
            detail: { type: 'string' },
          },
        },
      },
    },
  }, opts.controller.delete.bind(opts.controller));

  // 8. Update Order (Protected - Tenant Scoped)
  fastify.put('/:id', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Orders'],
      summary: 'Update order details',
      description: 'Update customer info, comment, paymentMethod, deliveryFee, and items with additions.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID' },
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
          customer: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              phone: { type: 'string' },
              address: { type: 'string' },
              barrio: { type: 'string' },
              email: { type: 'string' },
            },
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
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
                      quantity: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
          deliveryFee: { type: 'number' },
          paymentMethod: { type: 'string', enum: ['Efectivo', 'Transferencia'] },
          paymentAmount: { type: 'number' },
          changeAmount: { type: 'number' },
          comment: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'cooking', 'delivering', 'delivered', 'cancelled'] },
        },
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true,
        },
        404: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            status: { type: 'number' },
            detail: { type: 'string' },
          },
        },
      },
    },
  }, opts.controller.update.bind(opts.controller));
}
