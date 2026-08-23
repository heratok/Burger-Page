import { FastifyInstance } from 'fastify';
import { ProductController } from '../controllers/ProductController.js';

export async function productRoutes(fastify: FastifyInstance, opts: { controller: ProductController }) {
  fastify.get('/', {
    schema: {
      tags: ['Products'],
      summary: 'List all menu products',
      description: 'Returns the full catalog of available burgers, sides, and specialties.',
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              price: { type: 'number' },
              category: { type: 'string' },
              isAvailable: { type: 'boolean' },
              additions: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    }
  }, opts.controller.list.bind(opts.controller));

  fastify.get('/:id', {
    schema: {
      tags: ['Products'],
      summary: 'Get product by ID',
      description: 'Fetch details for a specific menu product.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Product ID' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            category: { type: 'string' },
            isAvailable: { type: 'boolean' },
            additions: { type: 'array', items: { type: 'string' } }
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
      tags: ['Products'],
      summary: 'Create a new menu product',
      description: 'Add a new burger or item to the restaurant catalog.',
      body: {
        type: 'object',
        required: ['name', 'description', 'price', 'category', 'isAvailable'],
        properties: {
          name: { type: 'string', example: 'Classic Truffle Burger' },
          description: { type: 'string', example: '180g Angus beef with truffle mayo' },
          price: { type: 'number', example: 28000 },
          category: { type: 'string', example: 'Gourmet' },
          isAvailable: { type: 'boolean', example: true },
          additions: { type: 'array', items: { type: 'string' }, example: ['Bacon', 'Extra Cheese'] }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            price: { type: 'number' },
            category: { type: 'string' },
            isAvailable: { type: 'boolean' }
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

  fastify.put('/:id', {
    schema: {
      tags: ['Products'],
      summary: 'Update existing product',
      description: 'Modify product price, description, category, or availability.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Product ID' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          price: { type: 'number' },
          category: { type: 'string' },
          isAvailable: { type: 'boolean' },
          additions: { type: 'array', items: { type: 'string' } }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' }
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
  }, opts.controller.update.bind(opts.controller));

  fastify.delete('/:id', {
    schema: {
      tags: ['Products'],
      summary: 'Delete product by ID',
      description: 'Remove a product from the restaurant menu catalog.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Product ID' }
        },
        required: ['id']
      },
      response: {
        204: {
          type: 'null',
          description: 'Product deleted successfully'
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
  }, opts.controller.delete.bind(opts.controller));
}
