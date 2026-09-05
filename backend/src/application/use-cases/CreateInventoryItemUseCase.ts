import { randomUUID } from 'node:crypto';
import { InventoryRepository } from '../../domain/ports/out/InventoryRepository.js';
import { Inventory, InventoryCategory, InventoryUnit } from '../../domain/models/Inventory.js';
import { CreateInventoryItemDTO } from '../dtos/index.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';

const VALID_CATEGORIES: InventoryCategory[] = ['ingredients', 'beverages', 'packaging', 'cleaning', 'other'];
const VALID_UNITS: InventoryUnit[] = ['unidades', 'kg', 'g', 'litros', 'paquetes', 'cajas'];

export class CreateInventoryItemUseCase {
  constructor(private inventoryRepo: InventoryRepository) {}

  async execute(dto: CreateInventoryItemDTO, restaurantId: string): Promise<Inventory> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to create an inventory item.');
    }
    if (!dto.name || dto.name.trim() === '') {
      throw new ValidationError('Inventory item name is required.');
    }
    if (!dto.category || !VALID_CATEGORIES.includes(dto.category)) {
      throw new ValidationError(`Invalid category '${dto.category}'. Allowed categories: ${VALID_CATEGORIES.join(', ')}.`);
    }
    if (!dto.unit || !VALID_UNITS.includes(dto.unit)) {
      throw new ValidationError(`Invalid unit '${dto.unit}'. Allowed units: ${VALID_UNITS.join(', ')}.`);
    }

    const quantity = dto.quantity !== undefined ? Number(dto.quantity) : 0;
    if (isNaN(quantity) || quantity < 0) {
      throw new ValidationError('Initial quantity cannot be negative.');
    }

    const costPerUnit = dto.costPerUnit !== undefined ? Number(dto.costPerUnit) : 0;
    if (isNaN(costPerUnit) || costPerUnit < 0) {
      throw new ValidationError('Cost per unit cannot be negative.');
    }

    const minAlert = dto.minStockAlert !== undefined
      ? Number(dto.minStockAlert)
      : (dto.alertThreshold !== undefined ? Number(dto.alertThreshold) : 5);

    if (isNaN(minAlert) || minAlert < 0) {
      throw new ValidationError('Min stock alert cannot be negative.');
    }

    const alertThresh = dto.alertThreshold !== undefined ? Number(dto.alertThreshold) : minAlert;
    if (isNaN(alertThresh) || alertThresh < 0) {
      throw new ValidationError('Alert threshold cannot be negative.');
    }

    const item: Inventory = {
      id: `inv_${randomUUID()}`,
      restaurantId,
      name: dto.name.trim(),
      category: dto.category,
      quantity,
      unit: dto.unit,
      minStockAlert: minAlert,
      alertThreshold: alertThresh,
      costPerUnit,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.inventoryRepo.save(item);
    return item;
  }
}
