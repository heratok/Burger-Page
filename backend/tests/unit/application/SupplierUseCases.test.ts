import { describe, it, expect, beforeEach } from 'vitest';
import { SupplierRepository } from '../../../src/domain/ports/out/SupplierRepository.js';
import { Supplier } from '../../../src/domain/models/Supplier.js';
import { ListSuppliersUseCase } from '../../../src/application/use-cases/ListSuppliersUseCase.js';
import { CreateSupplierUseCase } from '../../../src/application/use-cases/CreateSupplierUseCase.js';
import { UpdateSupplierUseCase } from '../../../src/application/use-cases/UpdateSupplierUseCase.js';
import { DeleteSupplierUseCase } from '../../../src/application/use-cases/DeleteSupplierUseCase.js';
import { EntityNotFoundError, ValidationError } from '../../../src/domain/errors/DomainErrors.js';

class FakeSupplierRepository implements SupplierRepository {
  suppliers: Map<string, Supplier> = new Map();

  async findByRestaurantId(restaurantId: string): Promise<Supplier[]> {
    return Array.from(this.suppliers.values()).filter((s) => s.restaurantId === restaurantId);
  }

  async findById(id: string, restaurantId: string): Promise<Supplier | null> {
    const s = this.suppliers.get(id);
    if (!s || s.restaurantId !== restaurantId) return null;
    return { ...s };
  }

  async save(supplier: Supplier): Promise<void> {
    this.suppliers.set(supplier.id, { ...supplier });
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    const s = this.suppliers.get(id);
    if (s && s.restaurantId === restaurantId) {
      this.suppliers.delete(id);
    }
  }
}

describe('Supplier Use Cases', () => {
  let repo: FakeSupplierRepository;
  let listUseCase: ListSuppliersUseCase;
  let createUseCase: CreateSupplierUseCase;
  let updateUseCase: UpdateSupplierUseCase;
  let deleteUseCase: DeleteSupplierUseCase;

  beforeEach(() => {
    repo = new FakeSupplierRepository();
    listUseCase = new ListSuppliersUseCase(repo);
    createUseCase = new CreateSupplierUseCase(repo);
    updateUseCase = new UpdateSupplierUseCase(repo);
    deleteUseCase = new DeleteSupplierUseCase(repo);
  });

  it('creates and lists suppliers scoped by restaurantId', async () => {
    const sup1 = await createUseCase.execute('rest-1', {
      name: 'Carnes Premium',
      category: 'ingredients',
      contactName: 'Juan Pérez',
      phone: '3001234567',
      email: 'juan@carnes.com',
    });

    await createUseCase.execute('rest-2', {
      name: 'Verduras del Campo',
      category: 'ingredients',
    });

    expect(sup1.id).toBeDefined();
    expect(sup1.restaurantId).toBe('rest-1');
    expect(sup1.name).toBe('Carnes Premium');

    const rest1List = await listUseCase.execute('rest-1');
    expect(rest1List).toHaveLength(1);
    expect(rest1List[0].name).toBe('Carnes Premium');

    const rest2List = await listUseCase.execute('rest-2');
    expect(rest2List).toHaveLength(1);
    expect(rest2List[0].name).toBe('Verduras del Campo');
  });

  it('rejects creating supplier without a name', async () => {
    await expect(
      createUseCase.execute('rest-1', { name: '   ' } as any)
    ).rejects.toThrow(ValidationError);
  });

  it('updates an existing supplier', async () => {
    const sup = await createUseCase.execute('rest-1', {
      name: 'Panadería Central',
      phone: '3109876543',
    });

    const updated = await updateUseCase.execute(sup.id, 'rest-1', {
      name: 'Panadería Central SAS',
      contactName: 'Marta Díaz',
    });

    expect(updated.name).toBe('Panadería Central SAS');
    expect(updated.contactName).toBe('Marta Díaz');
    expect(updated.phone).toBe('3109876543');

    const fetched = await repo.findById(sup.id, 'rest-1');
    expect(fetched?.name).toBe('Panadería Central SAS');
  });

  it('throws EntityNotFoundError when updating nonexistent or other tenant supplier', async () => {
    const sup = await createUseCase.execute('rest-1', { name: 'Quesos del Norte' });

    await expect(
      updateUseCase.execute('unknown-id', 'rest-1', { name: 'Nuevo Nombre' })
    ).rejects.toThrow(EntityNotFoundError);

    await expect(
      updateUseCase.execute(sup.id, 'rest-2', { name: 'Hijacked' })
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('deletes an existing supplier within tenant context', async () => {
    const sup = await createUseCase.execute('rest-1', { name: 'Salsas y Aderezos' });

    await deleteUseCase.execute(sup.id, 'rest-1');

    const remaining = await listUseCase.execute('rest-1');
    expect(remaining).toHaveLength(0);
  });

  it('throws EntityNotFoundError when deleting nonexistent supplier', async () => {
    await expect(deleteUseCase.execute('unknown-id', 'rest-1')).rejects.toThrow(
      EntityNotFoundError
    );
  });
});
