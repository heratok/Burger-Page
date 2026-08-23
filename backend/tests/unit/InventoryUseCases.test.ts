import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateInventoryStockUseCase } from '../../src/application/use-cases/UpdateInventoryStockUseCase.js';
import { GetInventoryUseCase } from '../../src/application/use-cases/GetInventoryUseCase.js';
import { InventoryRepository } from '../../src/domain/ports/out/InventoryRepository.js';
import { EntityNotFoundError } from '../../src/domain/errors/DomainErrors.js';

describe('Inventory Use Cases', () => {
  let mockInventoryRepo: InventoryRepository;

  beforeEach(() => {
    mockInventoryRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      save: vi.fn(),
    };
  });

  describe('UpdateInventoryStockUseCase', () => {
    it('should update inventory stock', async () => {
      const useCase = new UpdateInventoryStockUseCase(mockInventoryRepo);
      const inventory = { id: 'i1', name: 'Buns', quantity: 100, unit: 'pcs', alertThreshold: 10 };
      
      vi.mocked(mockInventoryRepo.findById).mockResolvedValue(inventory);
      
      await useCase.execute('i1', -20);
      
      expect(inventory.quantity).toBe(80);
      expect(mockInventoryRepo.save).toHaveBeenCalledWith(inventory);
    });

    it('should throw EntityNotFoundError if inventory item not found', async () => {
      const useCase = new UpdateInventoryStockUseCase(mockInventoryRepo);
      vi.mocked(mockInventoryRepo.findById).mockResolvedValue(null);
      
      await expect(useCase.execute('i1', 10)).rejects.toThrow(EntityNotFoundError);
    });
  });

  describe('GetInventoryUseCase', () => {
    it('should return all inventory items', async () => {
      const useCase = new GetInventoryUseCase(mockInventoryRepo);
      const inventoryList = [{ id: 'i1', name: 'Buns', quantity: 100, unit: 'pcs', alertThreshold: 10 }];
      
      vi.mocked(mockInventoryRepo.findAll).mockResolvedValue(inventoryList);
      
      const result = await useCase.execute();
      expect(result).toEqual(inventoryList);
    });
  });
});
