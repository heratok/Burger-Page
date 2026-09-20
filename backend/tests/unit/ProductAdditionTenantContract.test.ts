import { describe, it, expect } from 'vitest';
import { ProductAdditionController } from '../../src/infrastructure/http/controllers/ProductAdditionController.js';
import { UnauthorizedError } from '../../src/domain/errors/DomainErrors.js';
import { ListProductAdditionsUseCase } from '../../src/application/use-cases/ListProductAdditionsUseCase.js';
import { GetProductAdditionByIdUseCase } from '../../src/application/use-cases/GetProductAdditionByIdUseCase.js';
import { CreateProductAdditionUseCase } from '../../src/application/use-cases/CreateProductAdditionUseCase.js';
import { UpdateProductAdditionUseCase } from '../../src/application/use-cases/UpdateProductAdditionUseCase.js';
import { DeleteProductAdditionUseCase } from '../../src/application/use-cases/DeleteProductAdditionUseCase.js';
import { RestaurantRepository } from '../../src/domain/ports/out/RestaurantRepository.js';

// SUS-11: super-admin mutations on product additions must NOT silently
// default to an arbitrary tenant. The explicit-tenant contract introduced for
// create() (2c4f5f6) must hold for update() and delete() too: without an
// explicit restaurantId, the request is rejected instead of scanning all
// restaurants and mutating whichever tenant owns the addition id.

function buildController(overrides?: {
  findAdditionInAnyTenant?: boolean;
}): {
  controller: ProductAdditionController;
  updated: string[];
  deleted: string[];
} {
  const updated: string[] = [];
  const deleted: string[] = [];

  const restaurantRepo: Partial<RestaurantRepository> = {
    findAll: async () => [
      { id: 'rest-a', name: 'A', tagline: '', whatsappNumber: null, isActive: true, createdAt: '', updatedAt: '', slug: 'a', config: {} },
      { id: 'rest-b', name: 'B', tagline: '', whatsappNumber: null, isActive: true, createdAt: '', updatedAt: '', slug: 'b', config: {} },
    ],
    findById: async (id: string) =>
      ({ id, name: 'X', tagline: '', whatsappNumber: null, isActive: true, createdAt: '', updatedAt: '', slug: id, config: {} }),
  };

  const getAdditionById = {
    execute: async (id: string, _restaurantId: string) => {
      // Simulates the pre-fix scan behavior: the addition exists in one tenant,
      // so the fallback finds it and resolves a tenant silently.
      if (overrides?.findAdditionInAnyTenant) return { id, name: 'found' };
      throw new Error('not found');
    },
  } as unknown as GetProductAdditionByIdUseCase;

  const controller = new ProductAdditionController(
    {} as ListProductAdditionsUseCase,
    getAdditionById,
    {} as CreateProductAdditionUseCase,
    { execute: async (_id: string, _data: unknown, restaurantId: string) => { updated.push(restaurantId); return { id: _id }; } } as unknown as UpdateProductAdditionUseCase,
    { execute: async (_id: string, restaurantId: string) => { deleted.push(restaurantId); } } as unknown as DeleteProductAdditionUseCase,
    restaurantRepo as RestaurantRepository
  );

  return { controller, updated, deleted };
}

function replyStub() {
  return {
    status: (code: number) => ({ send: (body?: unknown) => ({ code, body }) }),
  } as any;
}

function req(role: string, body: Record<string, unknown> = {}) {
  return {
    authContext: { userId: 'usr-super', username: 'root', role },
    body,
    query: {},
    params: { id: 'add-1' },
    headers: {},
  } as any;
}

describe('ProductAdditionController tenant contract (SUS-11)', () => {
  it('rejects even when the addition exists in another tenant (no scan fallback)', async () => {
    const { controller, updated } = buildController({ findAdditionInAnyTenant: true });
    // Pre-fix (vulnerability): the fallback scan found the addition in another
    // tenant and mutated it silently. Post-fix: the request is rejected
    // without any tenant resolution and the use case never runs.
    await expect(controller.update(req('super_admin', { name: 'Nuevo', price: 1 }), replyStub()))
      .rejects.toBeInstanceOf(UnauthorizedError);
    expect(updated.length).toBe(0);
  });

  it('rejects super-admin update without explicit tenant (no scan fallback)', async () => {
    const { controller, updated } = buildController({ findAdditionInAnyTenant: true });
    await expect(controller.update(req('super_admin', { name: 'Nuevo', price: 1 }), replyStub()))
      .rejects.toBeInstanceOf(UnauthorizedError);
    expect(updated.length).toBe(0);
  });

  it('rejects super-admin delete without explicit tenant (no scan fallback)', async () => {
    const { controller, deleted } = buildController({ findAdditionInAnyTenant: true });
    await expect(controller.delete(req('super_admin'), replyStub()))
      .rejects.toBeInstanceOf(UnauthorizedError);
    expect(deleted.length).toBe(0);
  });

  it('allows update with explicit tenant from body', async () => {
    const { controller, updated } = buildController();
    await controller.update(req('super_admin', { restaurantId: 'rest-a', name: 'Nuevo', price: 1 }), replyStub());
    expect(updated).toEqual(['rest-a']);
  });

  it('allows delete with explicit tenant from header', async () => {
    const { controller, deleted } = buildController();
    const r = req('super_admin');
    r.headers = { 'x-restaurant-id': 'rest-b' };
    await controller.delete(r, replyStub());
    expect(deleted).toEqual(['rest-b']);
  });
});