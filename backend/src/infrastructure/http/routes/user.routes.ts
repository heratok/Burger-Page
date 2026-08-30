import { FastifyInstance } from 'fastify';
import { UserController } from '../controllers/UserController.js';

interface UserRoutesOptions {
  prefix: string;
  controller: UserController;
}

export async function userRoutes(
  app: FastifyInstance,
  opts: UserRoutesOptions
) {
  const ctrl = opts.controller;

  app.post('/', {
    schema: {
      tags: ['Users'],
      summary: 'Create a new user',
      description: 'Super admin creates a user with username/password for a restaurant or as super admin.',
      body: {
        type: 'object',
        required: ['username', 'password', 'role'],
        properties: {
          username: { type: 'string', minLength: 1, example: 'admin_rosto' },
          password: { type: 'string', minLength: 6, example: 'securePass123' },
          role: { type: 'string', enum: ['super_admin', 'restaurant_admin'], example: 'restaurant_admin' },
          restaurantId: { type: 'string', example: 'rosto' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            role: { type: 'string' },
            restaurantId: { type: 'string' },
            createdAt: { type: 'string' },
          },
        },
      },
    },
  }, ctrl.create.bind(ctrl));

  app.post('/login', {
    schema: {
      tags: ['Users'],
      summary: 'Authenticate user',
      description: 'Login with username and password. Returns user info on success.',
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', example: 'admin_rosto' },
          password: { type: 'string', example: 'securePass123' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                username: { type: 'string' },
                role: { type: 'string' },
                restaurantId: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, ctrl.login.bind(ctrl));

  app.get('/', {
    schema: {
      tags: ['Users'],
      summary: 'List users',
      description: 'List all users. Optionally filter by restaurantId.',
      querystring: {
        type: 'object',
        properties: {
          restaurantId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              username: { type: 'string' },
              role: { type: 'string' },
              restaurantId: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
  }, ctrl.list.bind(ctrl));
}
