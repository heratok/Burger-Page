import { describe, it, expect, vi } from 'vitest';
import { CreateRestaurantUseCase } from '../../../src/application/use-cases/CreateRestaurantUseCase.js';
import { UpdateRestaurantUseCase } from '../../../src/application/use-cases/UpdateRestaurantUseCase.js';
import { RestaurantRepository } from '../../../src/domain/ports/out/RestaurantRepository.js';
import { InMemoryRestaurantRepository } from '../../../src/infrastructure/persistence/InMemoryRestaurantRepository.js';

function mockRepo() {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findBySlug: vi.fn().mockResolvedValue(null),
    slugExists: vi.fn().mockResolvedValue(false),
    findAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as RestaurantRepository & { save: ReturnType<typeof vi.fn> };
}

describe('CreateRestaurantUseCase - optional WhatsApp number (no fake placeholder)', () => {
  it('stores no WhatsApp number when omitted, empty, or whitespace (never 573001234567)', async () => {
    for (const whatsappInput of [undefined, '', '   ']) {
      const repo = mockRepo();
      const created = await new CreateRestaurantUseCase(repo).execute({
        name: 'Sin WhatsApp',
        slug: 'sin-whatsapp',
        ...(whatsappInput !== undefined ? { whatsappNumber: whatsappInput } : {}),
      });

      expect(created.whatsappNumber).toBeUndefined();
      expect(created.config?.whatsappNumber).toBe('');
      expect(created.whatsappNumber).not.toBe('573001234567');
      expect(created.config?.whatsappNumber).not.toBe('573001234567');

      const saved = repo.save.mock.calls[0][0];
      expect(saved.whatsappNumber).toBeUndefined();
      expect(saved.config?.whatsappNumber).toBe('');
    }
  });

  it('stores an explicit whatsappNumber verbatim on the restaurant and its config', async () => {
    const repo = mockRepo();
    const created = await new CreateRestaurantUseCase(repo).execute({
      name: 'Con WhatsApp',
      slug: 'con-whatsapp',
      whatsappNumber: '573119998877',
    });

    expect(created.whatsappNumber).toBe('573119998877');
    expect(created.config?.whatsappNumber).toBe('573119998877');

    const saved = repo.save.mock.calls[0][0];
    expect(saved.whatsappNumber).toBe('573119998877');
    expect(saved.config?.whatsappNumber).toBe('573119998877');
  });

  it('keeps WhatsApp empty when a restaurant created without one is updated without setting it', async () => {
    const repo = new InMemoryRestaurantRepository();
    const created = await new CreateRestaurantUseCase(repo).execute({
      name: 'Bistro Vacio',
      slug: 'bistro-vacio',
    });

    const updated = await new UpdateRestaurantUseCase(repo).execute(
      created.id,
      { tagline: 'Nuevo eslogan' },
      'super_admin'
    );

    expect(updated.whatsappNumber).toBeUndefined();
    expect(updated.config?.whatsappNumber).toBe('');
    expect(updated.whatsappNumber).not.toBe('573001234567');
    expect(updated.config?.whatsappNumber).not.toBe('573001234567');
  });
});
