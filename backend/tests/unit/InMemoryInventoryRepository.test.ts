import { describe, it, expect } from 'vitest';
import { InMemoryInventoryRepository } from '../../src/infrastructure/persistence/InMemoryInventoryRepository.js';
import { ConflictError } from '../../src/domain/errors/DomainErrors.js';
import { Inventory } from '../../src/domain/models/Inventory.js';

const mk = (id: string, name: string, quantity: number, restaurantId = 'rest-x'): Inventory => ({
  id, restaurantId, name, category: 'ingredients', quantity, unit: 'unidades',
  minStockAlert: 1, alertThreshold: 1, costPerUnit: 1,
});

describe('InMemoryInventoryRepository.save (5.2)', () => {
  it('rejects duplicate names per tenant and keeps existing stock on edit', async () => {
    const repo = new InMemoryInventoryRepository();
    await repo.save(mk('a', 'Pan', 10));
    await repo.save(mk('b', 'Queso', 20));

    await expect(repo.save(mk('c', 'Pan', 99))).rejects.toThrow(ConflictError);
    await expect(repo.save(mk('b', 'Pan', 99))).rejects.toThrow(ConflictError);
    expect((await repo.findById('a', 'rest-x'))?.quantity).toBe(10);

    await repo.save(mk('b', 'Queso Suizo', 777));
    const edited = await repo.findById('b', 'rest-x');
    expect(edited?.name).toBe('Queso Suizo');
    expect(edited?.quantity).toBe(20);
  });

  it('allows the same name in different tenants', async () => {
    const repo = new InMemoryInventoryRepository();
    await repo.save(mk('a', 'Pan', 10, 'rest-x'));
    await expect(repo.save(mk('z', 'Pan', 5, 'rest-y'))).resolves.toBeUndefined();
  });
});
