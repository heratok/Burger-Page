import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListInventoryUseCase } from '../../src/application/use-cases/ListInventoryUseCase.js';
import { GetInventoryItemByIdUseCase } from '../../src/application/use-cases/GetInventoryItemByIdUseCase.js';
import { CreateInventoryItemUseCase } from '../../src/application/use-cases/CreateInventoryItemUseCase.js';
import { UpdateInventoryStockUseCase } from '../../src/application/use-cases/UpdateInventoryStockUseCase.js';
import { UpdateInventoryItemUseCase } from '../../src/application/use-cases/UpdateInventoryItemUseCase.js';
import { DeleteInventoryItemUseCase } from '../../src/application/use-cases/DeleteInventoryItemUseCase.js';
import { InventoryRepository } from '../../src/domain/ports/out/InventoryRepository.js';
import { EntityNotFoundError, ValidationError } from '../../src/domain/errors/DomainErrors.js';
import { Inventory } from '../../src/domain/models/Inventory.js';

describe('Inventory Use Cases (Unit)', () => {
  let mockInventoryRepo: InventoryRepository;

  beforeEach(() => {
    mockInventoryRepo = {
      findById: vi.fn(),
      findByRestaurantId: vi.fn(),
      save: vi.fn(),
      adjustStock: vi.fn(),
      delete: vi.fn(),
    };
  });

  describe('CreateInventoryItemUseCase', () => {
    it('1. should create inventory item associated with the correct tenant', async () => {
      const useCase = new CreateInventoryItemUseCase(mockInventoryRepo);
      const item = await useCase.execute({
        name: 'Pan Brioche Artesanal',
        category: 'ingredients',
        quantity: 100,
        unit: 'unidades',
        minStockAlert: 20,
        alertThreshold: 20,
        costPerUnit: 1500,
      }, 'burger-craft');

      expect(item.id).toBeDefined();
      expect(item.restaurantId).toBe('burger-craft');
      expect(item.name).toBe('Pan Brioche Artesanal');
      expect(item.category).toBe('ingredients');
      expect(item.quantity).toBe(100);
      expect(item.unit).toBe('unidades');
      expect(item.minStockAlert).toBe(20);
      expect(item.costPerUnit).toBe(1500);
      expect(mockInventoryRepo.save).toHaveBeenCalledWith(item);
    });

    it('2. should reject item creation without name or with empty name', async () => {
      const useCase = new CreateInventoryItemUseCase(mockInventoryRepo);
      await expect(useCase.execute({
        name: '',
        category: 'ingredients',
        unit: 'unidades',
      }, 'burger-craft')).rejects.toThrow(ValidationError);
    });

    it('3. should reject negative cost per unit', async () => {
      const useCase = new CreateInventoryItemUseCase(mockInventoryRepo);
      await expect(useCase.execute({
        name: 'Carne Molida',
        category: 'ingredients',
        unit: 'kg',
        costPerUnit: -500,
      }, 'burger-craft')).rejects.toThrow(ValidationError);
    });

    it('4. should reject negative initial quantity', async () => {
      const useCase = new CreateInventoryItemUseCase(mockInventoryRepo);
      await expect(useCase.execute({
        name: 'Carne Molida',
        category: 'ingredients',
        unit: 'kg',
        quantity: -10,
      }, 'burger-craft')).rejects.toThrow(ValidationError);
    });

    it('5. should reject invalid category', async () => {
      const useCase = new CreateInventoryItemUseCase(mockInventoryRepo);
      await expect(useCase.execute({
        name: 'Insumo X',
        category: 'invalid_category' as any,
        unit: 'unidades',
      }, 'burger-craft')).rejects.toThrow(ValidationError);
    });

    it('6. should reject invalid unit', async () => {
      const useCase = new CreateInventoryItemUseCase(mockInventoryRepo);
      await expect(useCase.execute({
        name: 'Insumo Y',
        category: 'ingredients',
        unit: 'invalid_unit' as any,
      }, 'burger-craft')).rejects.toThrow(ValidationError);
    });
  });

  describe('UpdateInventoryStockUseCase', () => {
    it('7. should update stock only within the tenant', async () => {
      const useCase = new UpdateInventoryStockUseCase(mockInventoryRepo);
      const updatedItem: Inventory = {
        id: 'inv-1',
        restaurantId: 'burger-craft',
        name: 'Queso Cheddar',
        category: 'ingredients',
        quantity: 35,
        unit: 'kg',
        minStockAlert: 10,
        alertThreshold: 10,
        costPerUnit: 25000,
      };
      vi.mocked(mockInventoryRepo.adjustStock).mockResolvedValue(updatedItem);

      const result = await useCase.execute('inv-1', -15, 'burger-craft');
      expect(result.quantity).toBe(35);
      expect(mockInventoryRepo.adjustStock).toHaveBeenCalledWith('inv-1', 'burger-craft', -15);
    });

    it('8. should reject stock adjustment that results in negative stock', async () => {
      const useCase = new UpdateInventoryStockUseCase(mockInventoryRepo);
      vi.mocked(mockInventoryRepo.adjustStock).mockRejectedValue(
        new ValidationError('Insufficient stock for item \'Queso Cheddar\'. Current stock is 10, cannot reduce by 20.')
      );

      await expect(useCase.execute('inv-1', -20, 'burger-craft')).rejects.toThrow(ValidationError);
    });

    it('should throw EntityNotFoundError if item belongs to another tenant', async () => {
      const useCase = new UpdateInventoryStockUseCase(mockInventoryRepo);
      vi.mocked(mockInventoryRepo.adjustStock).mockRejectedValue(
        new EntityNotFoundError('Inventory item \'inv-1\' not found for restaurant \'other-tenant\'.')
      );

      await expect(useCase.execute('inv-1', 10, 'other-tenant')).rejects.toThrow(EntityNotFoundError);
    });

    it('should allow restocking (delta > 0) even when current stock is 0', async () => {
      const useCase = new UpdateInventoryStockUseCase(mockInventoryRepo);
      const restockedItem: Inventory = {
        id: 'inv-1',
        restaurantId: 'burger-craft',
        name: 'Queso Cheddar',
        category: 'ingredients',
        quantity: 50,
        unit: 'kg',
        minStockAlert: 10,
        alertThreshold: 10,
        costPerUnit: 25000,
      };
      // Repo returns the item after adjustment — stock guard does NOT apply for positive deltas
      vi.mocked(mockInventoryRepo.adjustStock).mockResolvedValue(restockedItem);

      const result = await useCase.execute('inv-1', 50, 'burger-craft');
      expect(result.quantity).toBe(50);
      expect(mockInventoryRepo.adjustStock).toHaveBeenCalledWith('inv-1', 'burger-craft', 50);
    });
  });

  describe('UpdateInventoryItemUseCase', () => {
    it('9. should update item attributes only within the tenant', async () => {
      const useCase = new UpdateInventoryItemUseCase(mockInventoryRepo);
      const item: Inventory = {
        id: 'inv-1',
        restaurantId: 'burger-craft',
        name: 'Salsa BBQ',
        category: 'ingredients',
        quantity: 20,
        unit: 'litros',
        minStockAlert: 5,
        alertThreshold: 5,
        costPerUnit: 12000,
      };
      vi.mocked(mockInventoryRepo.findById).mockResolvedValue(item);

      const updated = await useCase.execute('inv-1', {
        name: 'Salsa BBQ Ahumada Premium',
        costPerUnit: 14000,
      }, 'burger-craft');

      expect(updated.name).toBe('Salsa BBQ Ahumada Premium');
      expect(updated.costPerUnit).toBe(14000);
      expect(mockInventoryRepo.save).toHaveBeenCalledWith(item);
    });
  });

  describe('DeleteInventoryItemUseCase', () => {
    it('10. should delete item only within the tenant', async () => {
      const useCase = new DeleteInventoryItemUseCase(mockInventoryRepo);
      const item: Inventory = {
        id: 'inv-1',
        restaurantId: 'burger-craft',
        name: 'Vasos Plásticos',
        category: 'packaging',
        quantity: 200,
        unit: 'unidades',
        minStockAlert: 50,
        alertThreshold: 50,
        costPerUnit: 150,
      };
      vi.mocked(mockInventoryRepo.findById).mockResolvedValue(item);

      await useCase.execute('inv-1', 'burger-craft');
      expect(mockInventoryRepo.delete).toHaveBeenCalledWith('inv-1', 'burger-craft');
    });

    it('should throw EntityNotFoundError when trying to delete item from foreign tenant', async () => {
      const useCase = new DeleteInventoryItemUseCase(mockInventoryRepo);
      vi.mocked(mockInventoryRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute('inv-1', 'foreign-tenant')).rejects.toThrow(EntityNotFoundError);
      expect(mockInventoryRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('ListInventoryUseCase', () => {
    it('11. should list inventory items scoped exclusively to the restaurant', async () => {
      const useCase = new ListInventoryUseCase(mockInventoryRepo);
      const items: Inventory[] = [
        {
          id: 'i1',
          restaurantId: 'burger-craft',
          name: 'Pan',
          category: 'ingredients',
          quantity: 50,
          unit: 'unidades',
          minStockAlert: 10,
          alertThreshold: 10,
          costPerUnit: 1000,
        }
      ];
      vi.mocked(mockInventoryRepo.findByRestaurantId).mockResolvedValue(items);

      const res = await useCase.execute('burger-craft');
      expect(res.length).toBe(1);
      expect(res[0].restaurantId).toBe('burger-craft');
      expect(mockInventoryRepo.findByRestaurantId).toHaveBeenCalledWith('burger-craft');
    });
  });
});
