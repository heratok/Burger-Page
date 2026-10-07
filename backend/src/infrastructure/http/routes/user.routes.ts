import { FastifyInstance } from 'fastify';
import { UserController } from '../controllers/UserController.js';
import { requireAuth, requireAuthAllowingPasswordChange, requirePermission } from '../middleware/auth.middleware.js';

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
    preHandler: [requireAuth, requirePermission('users.manage')],
    schema: {
      tags: ['Users'],
      summary: 'Create a new user',
      description: 'Requires users.manage. A super admin creates any account (restaurantId is required for restaurant_admin and restaurant_staff). A restaurant admin (or staff holding users.manage) can only create restaurant_staff accounts in its own restaurant, with a roleId of that restaurant whose permissions the caller holds; 403 for any other role or restaurant, 404 for a role of another restaurant.',
      body: {
        type: 'object',
        required: ['username', 'password', 'role'],
        properties: {
          username: { type: 'string', minLength: 1, example: 'admin_local' },
          password: { type: 'string', minLength: 8, example: 'securePass123' },
          role: { type: 'string', enum: ['super_admin', 'restaurant_admin', 'restaurant_staff'], example: 'restaurant_staff' },
          restaurantId: { type: 'string', example: 'tienda-pruebas' },
          roleId: { type: 'string', description: 'Required for restaurant_staff: a role of the same restaurant.' },
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
            roleId: { type: 'string' },
            createdAt: { type: 'string' },
          },
        },
      },
    },
  }, ctrl.create.bind(ctrl));

  app.post('/login', {
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      tags: ['Users'],
      summary: 'Authenticate user',
      description: 'Login with username and password. Returns user info on success.',
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', example: 'admin_local' },
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
                roleId: { type: 'string' },
                permissions: { type: 'array', items: { type: 'string' } },
                mustChangePassword: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, ctrl.login.bind(ctrl));

  app.get('/me', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Users'],
      summary: 'Current session',
      description: 'The authenticated user with the permissions resolved from storage on this request (administrators hold the whole catalog; staff hold what their role grants). The frontend uses it to gate the UI; the server enforces the same permissions on every route.',
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            role: { type: 'string' },
            restaurantId: { type: 'string' },
            roleId: { type: 'string' },
            permissions: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  }, ctrl.me.bind(ctrl));

  app.get('/', {
    preHandler: [requireAuth, requirePermission('users.manage')],
    schema: {
      tags: ['Users'],
      summary: 'List users',
      description: 'Requires users.manage. A super admin lists all users (optionally filtered by restaurantId); everyone else only sees the users of their own restaurant.',
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
              roleId: { type: 'string' },
              createdAt: { type: 'string' },
              isActive: { type: 'boolean' },
              mustChangePassword: { type: 'boolean' },
            },
          },
        },
      },
    },
  }, ctrl.list.bind(ctrl));

  const idParams = {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', minLength: 1 } },
  };

  app.patch('/:id', {
    preHandler: [requireAuth, requirePermission('users.manage')],
    schema: {
      tags: ['Users'],
      summary: 'Edit a user',
      description: 'Requires users.manage. A restaurant admin (or delegated staff) can only edit staff of its own restaurant: username, isActive and roleId (403 for admins or role/restaurant changes, 404 for other tenants). A super admin edits anyone: username, role, restaurantId, roleId and/or isActive (at least one). A restaurant_admin needs an existing, non-deleted restaurant; a super_admin has none. 409 on a taken username, on demoting or deactivating yourself, and on demoting or deactivating the last active super admin. The password is never changed here (use reset-password). Role and restaurant changes apply to tokens already issued.',
      params: idParams,
      body: {
        type: 'object',
        minProperties: 1,
        properties: {
          username: { type: 'string', minLength: 1 },
          role: { type: 'string', enum: ['super_admin', 'restaurant_admin', 'restaurant_staff'] },
          restaurantId: { type: ['string', 'null'] },
          roleId: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            role: { type: 'string' },
            restaurantId: { type: 'string' },
            roleId: { type: 'string' },
            createdAt: { type: 'string' },
            isActive: { type: 'boolean' },
            mustChangePassword: { type: 'boolean' },
          },
        },
      },
    },
  }, ctrl.update.bind(ctrl));

  app.delete('/:id', {
    preHandler: [requireAuth, requirePermission('users.manage')],
    schema: {
      tags: ['Users'],
      summary: 'Delete a user',
      description: 'Requires users.manage; tenant callers are confined to staff of their own restaurant. Permanently removes the user. Cannot target yourself or the last active super admin.',
      params: idParams,
    },
  }, ctrl.remove.bind(ctrl));

  app.post('/:id/reset-password', {
    preHandler: [requireAuth, requirePermission('users.manage')],
    schema: {
      tags: ['Users'],
      summary: 'Reset a user password',
      description: 'Requires users.manage; tenant callers are confined to staff of their own restaurant. Replaces the password with a generated temporary one, returned once. The user must change it at next login.',
      params: idParams,
      response: {
        200: {
          type: 'object',
          properties: { temporaryPassword: { type: 'string' } },
        },
      },
    },
  }, ctrl.resetPassword.bind(ctrl));

  app.post('/me/password', {
    preHandler: [requireAuthAllowingPasswordChange],
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      tags: ['Users'],
      summary: 'Change own password',
      description: 'Verifies the current password and sets a new one (min 8 characters, different from the current). Returns a fresh session token. Also the only authenticated route open to accounts that must change a temporary password.',
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', minLength: 1 },
          newPassword: { type: 'string', minLength: 8 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, token: { type: 'string' } },
        },
      },
    },
  }, ctrl.changePassword.bind(ctrl));
}
