import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { RoleController } from '../../src/infrastructure/http/controllers/RoleController.js';
import { EntityNotFoundError, UnauthorizedError } from '../../src/domain/errors/DomainErrors.js';
import type { RestaurantRepository } from '../../src/domain/ports/out/RestaurantRepository.js';
import type { Restaurant } from '../../src/domain/models/Restaurant.js';

function makeRestaurant(id: string, slug = id): Restaurant {
  return {
    id,
    name: id,
    slug,
    theme: 'light',
    openingHours: { open: '09:00', close: '22:00' },
    isActive: true,
  };
}

function makeReply() {
  const res = {
    statusCode: 0,
    payload: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(body?: unknown) {
      this.payload = body;
      return this;
    },
  };
  return res as typeof res & FastifyReply;
}

describe('RoleController read fast path (skip duplicate tenant lookup when authContext.restaurantId is set)', () => {
  const sampleRoles = [{ id: 'role_1', restaurantId: 'rest-a', name: 'Cashier', permissions: ['orders.view'], isSystem: false }];

  let listRolesUseCase: { execute: ReturnType<typeof vi.fn> };
  let createRoleUseCase: { execute: ReturnType<typeof vi.fn> };
  let updateRoleUseCase: { execute: ReturnType<typeof vi.fn> };
  let deleteRoleUseCase: { execute: ReturnType<typeof vi.fn> };
  let restaurantRepo: RestaurantRepository & {
    findById: ReturnType<typeof vi.fn>;
    findBySlug: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
  };
  let controller: RoleController;

  beforeEach(() => {
    listRolesUseCase = { execute: vi.fn(async () => sampleRoles) };
    createRoleUseCase = { execute: vi.fn(async (restaurantId, input) => ({ id: 'role_new', restaurantId, ...input, isSystem: false })) };
    updateRoleUseCase = { execute: vi.fn(async (id, restaurantId, input) => ({ id, restaurantId, ...input, isSystem: false })) };
    deleteRoleUseCase = { execute: vi.fn(async () => {}) };

    const restA = makeRestaurant('rest-a');
    const rest1 = makeRestaurant('rest-1', 'mi-restaurante');
    restaurantRepo = {
      findById: vi.fn(async (id: string) => (id === 'rest-a' ? restA : id === 'rest-1' ? rest1 : null)),
      findBySlug: vi.fn(async (slug: string) => (slug === 'mi-restaurante' ? rest1 : null)),
      findAll: vi.fn(async () => [restA, rest1]),
      save: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
    };

    controller = new RoleController(
      listRolesUseCase as any,
      createRoleUseCase as any,
      updateRoleUseCase as any,
      deleteRoleUseCase as any,
      restaurantRepo
    );
  });

  it('skips restaurantRepo lookup on list when authContext.restaurantId is present and returns roles unchanged', async () => {
    const req = {
      authContext: {
        userId: 'usr-1',
        username: 'admin_a',
        role: 'restaurant_admin',
        restaurantId: 'rest-a',
        permissions: ['roles.manage'],
      },
      query: { restaurantId: 'rest-b' },
      headers: {},
    } as unknown as FastifyRequest;
    const reply = makeReply();

    await controller.list(req, reply);

    expect(restaurantRepo.findById).not.toHaveBeenCalled();
    expect(restaurantRepo.findBySlug).not.toHaveBeenCalled();
    expect(restaurantRepo.findAll).not.toHaveBeenCalled();
    expect(listRolesUseCase.execute).toHaveBeenCalledWith('rest-a');
    expect(reply.statusCode).toBe(200);
    expect(reply.payload).toEqual(sampleRoles);
  });

  it('still resolves and canonicalizes via restaurantRepo when super_admin targets a tenant by query/header', async () => {
    const req = {
      authContext: {
        userId: 'usr-root',
        username: 'root',
        role: 'super_admin',
        permissions: ['roles.manage'],
      },
      query: { restaurantId: 'rest-mi-restaurante' },
      headers: {},
    } as unknown as FastifyRequest;
    const reply = makeReply();

    await controller.list(req, reply);

    expect(restaurantRepo.findById).toHaveBeenCalledWith('rest-mi-restaurante');
    expect(restaurantRepo.findBySlug).toHaveBeenCalledWith('mi-restaurante');
    expect(listRolesUseCase.execute).toHaveBeenCalledWith('rest-1');
    expect(reply.statusCode).toBe(200);
    expect(reply.payload).toEqual(sampleRoles);
  });

  it('rejects with UnauthorizedError when authContext lacks restaurantId and no tenant is targeted', async () => {
    const unboundReq = {
      authContext: {
        userId: 'usr-unbound',
        username: 'unbound',
        role: 'restaurant_admin',
        permissions: ['roles.manage'],
      },
      query: { restaurantId: 'rest-a' },
      headers: {},
    } as unknown as FastifyRequest;

    await expect(controller.list(unboundReq, makeReply())).rejects.toBeInstanceOf(UnauthorizedError);
    expect(listRolesUseCase.execute).not.toHaveBeenCalled();

    const superNoTargetReq = {
      authContext: {
        userId: 'usr-root',
        username: 'root',
        role: 'super_admin',
        permissions: ['roles.manage'],
      },
      query: {},
      headers: {},
    } as unknown as FastifyRequest;

    await expect(controller.list(superNoTargetReq, makeReply())).rejects.toBeInstanceOf(UnauthorizedError);
    expect(listRolesUseCase.execute).not.toHaveBeenCalled();
  });

  it('still resolves and validates through restaurantRepo on mutations even when authContext.restaurantId is set', async () => {
    const createReq = {
      authContext: {
        userId: 'usr-1',
        username: 'admin_a',
        role: 'restaurant_admin',
        restaurantId: 'rest-a',
        permissions: ['roles.manage'],
      },
      body: { name: 'Cashier', permissions: ['orders.view'] },
      query: {},
      headers: {},
    } as unknown as FastifyRequest;

    await controller.create(createReq, makeReply());
    expect(restaurantRepo.findById).toHaveBeenCalledWith('rest-a');
    expect(createRoleUseCase.execute).toHaveBeenCalledWith(
      'rest-a',
      { name: 'Cashier', permissions: ['orders.view'] },
      expect.anything()
    );

    const missingTenantReq = {
      authContext: {
        userId: 'usr-ghost',
        username: 'ghost',
        role: 'restaurant_admin',
        restaurantId: 'rest-missing',
        permissions: ['roles.manage'],
      },
      body: { name: 'Cashier', permissions: ['orders.view'] },
      query: {},
      headers: {},
    } as unknown as FastifyRequest;

    await expect(controller.create(missingTenantReq, makeReply())).rejects.toBeInstanceOf(EntityNotFoundError);
  });
});
