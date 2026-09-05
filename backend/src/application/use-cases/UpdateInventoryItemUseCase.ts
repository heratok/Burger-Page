import { InventoryRepository } from '../../domain/ports/out/InventoryRepository.js';
import { Inventory, InventoryCategory, InventoryUnit } from '../../domain/models/Inventory.js';
import { UpdateInventoryItemDTO } from '../dtos/index.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

const VALID_CATEGORIES: InventoryCategory[] = ['ingredients', 'beverages', 'packaging', 'cleaning', 'other'];
const VALID_UNITS: InventoryUnit[] = ['unidades', 'kg', 'g', 'litros', 'paquetes', 'cajas'];

export class UpdateInventoryItemUseCase {
  constructor(private inventoryRepo: InventoryRepository) {}

  async execute(id: string, dto: UpdateInventoryItemDTO, restaurantId: string): Promise<Inventory> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to update an inventory item.');
    }
    const item = await this.inventoryRepo.findById(id, restaurantId);
    if (!item) {
      throw new EntityNotFoundError(`Inventory item '${id}' not found for restaurant '${restaurantId}'.`);
    }

    if (dto.name !== undefined) {
      if (!dto.name.trim()) throw new ValidationError('Inventory item name cannot be empty.');
      item.name = dto.name.trim();
    }
    if (dto.category !== undefined) {
      if (!VALID_CATEGORIES.includes(dto.category)) {
        throw new ValidationError(`Invalid category '${dto.category}'. Allowed categories: ${VALID_CATEGORIES.join(', ')}.`);
      }
      item.category = dto.category;
    }
    if (dto.unit !== undefined) {
      if (!VALID_UNITS.includes(dto.unit)) {
        throw new ValidationError(`Invalid unit '${dto.unit}'. Allowed units: ${VALID_UNITS.join(', ')}.`);
      }
      item.unit = dto.unit;
    }
    if (dto.quantity !== undefined) {
      const q = Number(dto.quantity);
      if (isNaN(q) || q < 0) throw new ValidationError('Quantity cannot be negative.');
      item.quantity = q;
    }
    if (dto.costPerUnit !== undefined) {
      const c = Number(dto.costPerUnit);
      if (isNaN(c) || c < 0) throw new ValidationError('Cost per unit cannot be negative.');
      item.costPerUnit = c;
    }
    if (dto.minStockAlert !== undefined) {
      const m = Number(dto.minStockAlert);
      if (isNaN(m) || m < 0) throw new ValidationError('Min stock alert cannot be negative.');
      item.minStockAlert = m;
    }
    if (dto.alertThreshold !== undefined) {
      const a = Number(dto.alertThreshold);
      if (isNaN(a) || a < 0) throw new ValidationError('Alert threshold cannot be negative.');
      item.alertThreshold = a;
    }

    item.updatedAt = new Date().toISOString();
    await this.inventoryRepo.save(item);
    return item;
  }
}
