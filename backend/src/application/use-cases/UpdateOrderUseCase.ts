import { randomUUID } from 'node:crypto';
import { Order, OrderItem, OrderItemAddition } from '../../domain/models/Order.js';
import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { ProductAdditionRepository } from '../../domain/ports/out/ProductAdditionRepository.js';
import { CustomerRepository } from '../../domain/ports/out/CustomerRepository.js';
import { UpdateOrderDTO } from '../dtos/index.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

export class UpdateOrderUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly productRepo?: ProductRepository,
    private readonly additionRepo?: ProductAdditionRepository,
    private readonly customerRepo?: CustomerRepository
  ) {}

  async execute(id: string, dto: UpdateOrderDTO, restaurantId: string): Promise<Order> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant context is required to update an order.');
    }

    // 1. Validate order exists for restaurantId (with altRestId fallback for rest- prefix variations)
    let order = await this.orderRepo.findById(id, restaurantId);
    let resolvedRestId = restaurantId;

    if (!order) {
      const altRestId = restaurantId.startsWith('rest-')
        ? restaurantId.replace(/^rest-/, '')
        : `rest-${restaurantId}`;
      const altOrder = await this.orderRepo.findById(id, altRestId);
      if (altOrder) {
        order = altOrder;
        resolvedRestId = altRestId;
      }
    }

    if (!order) {
      throw new EntityNotFoundError(`Order '${id}' not found for restaurant '${restaurantId}'.`);
    }

    // 2. Update customer info if provided
    if (dto.customer) {
      order.customer = {
        name: dto.customer.name ?? order.customer?.name ?? '',
        nombre: dto.customer.name ?? order.customer?.nombre ?? '',
        phone: dto.customer.phone ?? order.customer?.phone ?? '',
        telefono: dto.customer.phone ?? order.customer?.telefono ?? '',
        address: dto.customer.address ?? order.customer?.address ?? '',
        direccion: dto.customer.address ?? order.customer?.direccion ?? '',
        barrio: dto.customer.barrio ?? order.customer?.barrio ?? '',
        email: dto.customer.email ?? order.customer?.email ?? '',
      };

      if (this.customerRepo) {
        try {
          const rawPhone = dto.customer.phone?.trim();
          if (rawPhone) {
            const existingWithPhone = await this.customerRepo.findByPhone(rawPhone, resolvedRestId);
            if (existingWithPhone) {
              // Re-link order to the customer that already owns this phone number
              (order as any).customerId = existingWithPhone.id;
              if (dto.customer.name) existingWithPhone.name = dto.customer.name;
              if (dto.customer.address) existingWithPhone.address = dto.customer.address;
              if (dto.customer.barrio) existingWithPhone.barrio = dto.customer.barrio;
              if (dto.customer.email) existingWithPhone.email = dto.customer.email;
              existingWithPhone.updatedAt = new Date().toISOString();
              await this.customerRepo.save(existingWithPhone);
            } else if (order.customerId) {
              const currentCust = await this.customerRepo.findById(order.customerId, resolvedRestId);
              if (currentCust) {
                if (dto.customer.name) currentCust.name = dto.customer.name;
                currentCust.phone = rawPhone;
                if (dto.customer.address) currentCust.address = dto.customer.address;
                if (dto.customer.barrio) currentCust.barrio = dto.customer.barrio;
                if (dto.customer.email) currentCust.email = dto.customer.email;
                currentCust.updatedAt = new Date().toISOString();
                await this.customerRepo.save(currentCust);
              }
            }
          } else if (order.customerId) {
            const currentCust = await this.customerRepo.findById(order.customerId, resolvedRestId);
            if (currentCust) {
              if (dto.customer.name) currentCust.name = dto.customer.name;
              if (dto.customer.address) currentCust.address = dto.customer.address;
              if (dto.customer.barrio) currentCust.barrio = dto.customer.barrio;
              if (dto.customer.email) currentCust.email = dto.customer.email;
              currentCust.updatedAt = new Date().toISOString();
              await this.customerRepo.save(currentCust);
            }
          }
        } catch {
          // Gracefully continue without failing order update
        }
      }
    }

    // 3. Update delivery fee if provided
    if (dto.deliveryFee !== undefined) {
      order.deliveryFee = dto.deliveryFee;
    }

    // 4. Update payment method and amounts
    if (dto.paymentMethod !== undefined) {
      (order as any).paymentMethod = dto.paymentMethod;
    }

    if (dto.comment !== undefined) {
      (order as any).comment = dto.comment;
    }

    if (dto.receiptUrl !== undefined) {
      order.receiptUrl = dto.receiptUrl;
    }

    if (dto.status !== undefined) {
      order.status = dto.status;
    }

    // 5. Update items & additions and recalculate subtotal / finalTotal
    if (dto.items !== undefined) {
      const validatedItems: OrderItem[] = [];

      for (const itemDto of dto.items) {
        if (!itemDto.quantity || itemDto.quantity <= 0) {
          throw new ValidationError(`Invalid quantity for product ${itemDto.productId}`);
        }

        let product = this.productRepo ? await this.productRepo.findById(itemDto.productId, resolvedRestId) : null;
        if (!product && this.productRepo && typeof this.productRepo.findByRestaurantId === 'function') {
          const allProducts = await this.productRepo.findByRestaurantId(resolvedRestId);
          product =
            allProducts.find(
              (p) =>
                p.id === itemDto.productId ||
                p.name.toLowerCase() === itemDto.productId.toLowerCase() ||
                p.name.toLowerCase() === (itemDto as any).productName?.toLowerCase() ||
                p.name.toLowerCase() === (itemDto as any).name?.toLowerCase()
            ) || null;
        }

        // If product was not directly found in catalog, check if existing order already had this item
        let resolvedProductId = product ? product.id : itemDto.productId;
        if (!product) {
          const existingItem = order.items.find(
            (i) =>
              i.id === itemDto.productId ||
              i.id === (itemDto as any).id ||
              i.productName?.toLowerCase() === (itemDto as any).productName?.toLowerCase() ||
              i.productName?.toLowerCase() === (itemDto as any).name?.toLowerCase()
          );
          if (existingItem?.productId) {
            resolvedProductId = existingItem.productId;
            if (this.productRepo) {
              product = await this.productRepo.findById(existingItem.productId, resolvedRestId);
            }
          }
        }

        const unitPrice = product
          ? Number(product.price)
          : ((itemDto as any).unitPrice ?? (itemDto as any).price ?? 0);
        const productName = product
          ? product.name
          : ((itemDto as any).productName ?? (itemDto as any).name ?? 'Product');

        const validatedAdditions: OrderItemAddition[] = [];
        if (itemDto.additions && itemDto.additions.length > 0) {
          for (const rawAdd of itemDto.additions) {
            const additionId = typeof rawAdd === 'string' ? rawAdd : rawAdd.additionId;
            const addQuantity = typeof rawAdd === 'string' ? 1 : (rawAdd.quantity || 1);

            let addition = this.additionRepo ? await this.additionRepo.findById(additionId, resolvedRestId) : null;
            if (!addition && this.additionRepo && typeof this.additionRepo.findByRestaurantId === 'function') {
              const allAdditions = await this.additionRepo.findByRestaurantId(resolvedRestId);
              addition = allAdditions.find((a) => a.id === additionId || a.name.toLowerCase() === additionId.toLowerCase()) || null;
            }

            let additionPrice = 0;
            if (addition) {
              additionPrice = Number(addition.price);
            } else if (typeof rawAdd !== 'string' && (rawAdd as any).unitPrice !== undefined) {
              additionPrice = Number((rawAdd as any).unitPrice);
            }

            let additionName = additionId;
            if (addition) {
              additionName = addition.name;
            } else if (typeof rawAdd !== 'string' && (rawAdd as any).additionName) {
              additionName = (rawAdd as any).additionName;
            }

            validatedAdditions.push({
              id: (rawAdd as any).id || `ord_add_${randomUUID()}`,
              additionId,
              additionName,
              unitPrice: additionPrice,
              quantity: addQuantity,
            });
          }
        }

        validatedItems.push({
          id: (itemDto as any).id || `ord_item_${randomUUID()}`,
          productId: resolvedProductId,
          productName,
          unitPrice,
          quantity: itemDto.quantity,
          observation: itemDto.observation || undefined,
          additions: validatedAdditions,
        });
      }

      order.items = validatedItems;
    }

    // 6. Recalculate payment & change if cash
    if (order.paymentMethod === 'Efectivo') {
      const paymentAmount = dto.paymentAmount ?? order.paymentAmount;
      (order as any).paymentAmount = paymentAmount;
      if (paymentAmount !== undefined) {
        (order as any).changeAmount = Math.max(0, paymentAmount - order.finalTotal);
      }
    } else if (order.paymentMethod === 'Transferencia') {
      (order as any).paymentAmount = undefined;
      (order as any).changeAmount = undefined;
    }

    // 7. Save via orderRepository.update(updatedOrder, resolvedRestId)
    const updated = await this.orderRepo.update(order, resolvedRestId);

    // Return updated Order
    return updated || order;
  }
}
