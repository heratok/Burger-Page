import { randomUUID } from 'node:crypto';
import { Order, OrderItem, OrderItemAddition } from '../../domain/models/Order.js';
import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { ProductAdditionRepository } from '../../domain/ports/out/ProductAdditionRepository.js';
import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { CustomerRepository } from '../../domain/ports/out/CustomerRepository.js';
import { CreateOrderDTO } from '../dtos/index.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

export class CreateOrderUseCase {
  constructor(
    private orderRepo: OrderRepository,
    private productRepo: ProductRepository,
    private restaurantRepo: RestaurantRepository,
    private additionRepo: ProductAdditionRepository,
    private customerRepo?: CustomerRepository
  ) {}

  async execute(dto: CreateOrderDTO): Promise<Order> {
    if (!dto.restaurantId) {
      throw new ValidationError('Restaurant ID is required to create an order.');
    }

    // 1. Validar que el restaurante exista y esté ACTIVO
    const restaurant =
      (await this.restaurantRepo.findById(dto.restaurantId)) ||
      (await this.restaurantRepo.findBySlug(dto.restaurantId));
    if (!restaurant) {
      throw new EntityNotFoundError(`Restaurant '${dto.restaurantId}' not found.`);
    }
    if (!restaurant.isActive) {
      throw new ValidationError(`Restaurant '${restaurant.name}' is currently inactive.`);
    }

    if (!dto.items || dto.items.length === 0) {
      throw new ValidationError('The order must contain at least one item.');
    }

    // 2. Validar customer_id ANTES de procesar productos si fue provisto
    let validatedCustomerId: string | undefined = undefined;
    if (dto.customerId) {
      if (this.customerRepo) {
        const customer = await this.customerRepo.findById(dto.customerId, restaurant.id);
        if (customer) {
          if (customer.restaurantId !== restaurant.id) {
            throw new ValidationError(`Customer '${dto.customerId}' does not belong to restaurant '${restaurant.name}'.`);
          }
          validatedCustomerId = customer.id;
        } else {
          validatedCustomerId = dto.customerId;
        }
      } else {
        validatedCustomerId = dto.customerId;
      }
    }

    // 3. Validar productos, adiciones y calcular precios autoritativos desde la BD
    let calculatedSubtotal = 0;
    const validatedItems: OrderItem[] = [];

    for (const itemDto of dto.items) {
      if (!itemDto.quantity || itemDto.quantity <= 0) {
        throw new ValidationError(`Invalid quantity for product ${itemDto.productId}`);
      }
      if (itemDto.quantity > 100) {
        throw new ValidationError(`Quantity exceeds maximum limit of 100 for product ${itemDto.productId}`);
      }

      // Validar Producto en BD
      let product = await this.productRepo.findById(itemDto.productId, restaurant.id);
      if (!product && typeof this.productRepo.findByRestaurantId === 'function') {
        const allProducts = await this.productRepo.findByRestaurantId(restaurant.id);
        product = allProducts.find(p => p.name.toLowerCase() === itemDto.productId.toLowerCase() || p.id === itemDto.productId) || null;
      }
      if (!product) {
        throw new EntityNotFoundError(`Product '${itemDto.productId}' not found.`);
      }
      if (product.restaurantId && product.restaurantId !== restaurant.id) {
        throw new ValidationError(`Product '${product.name}' does not belong to restaurant '${restaurant.name}'.`);
      }
      if (!product.isAvailable) {
        throw new ValidationError(`Product '${product.name}' is currently not available.`);
      }

      const verifiedProductPrice = Number(product.price);
      let itemAdditionsPrice = 0;
      const validatedAdditions: OrderItemAddition[] = [];

      // Validar Adiciones si fueron provistas
      if (itemDto.additions && itemDto.additions.length > 0) {
        for (const rawAdd of itemDto.additions) {
          const additionId = typeof rawAdd === 'string' ? rawAdd : rawAdd.additionId;
          const addQuantity = typeof rawAdd === 'string' ? 1 : (rawAdd.quantity || 1);

          if (addQuantity <= 0 || addQuantity > 10) {
            throw new ValidationError(`Invalid addition quantity for addition '${additionId}'`);
          }

          let addition = await this.additionRepo.findById(additionId, restaurant.id);
          if (!addition && typeof this.additionRepo.findByRestaurantId === 'function') {
            const allAdditions = await this.additionRepo.findByRestaurantId(restaurant.id);
            addition = allAdditions.find(a => a.name.toLowerCase() === additionId.toLowerCase() || a.id === additionId) || null;
          }
          if (!addition) {
            throw new EntityNotFoundError(`Addition '${additionId}' not found for restaurant '${restaurant.name}'.`);
          }
          if (addition.restaurantId !== restaurant.id) {
            throw new ValidationError(`Addition '${addition.name}' does not belong to restaurant '${restaurant.name}'.`);
          }
          if (addition.productId && addition.productId !== product.id) {
            throw new ValidationError(`Addition '${addition.name}' is not applicable to product '${product.name}'.`);
          }
          if (!addition.isAvailable) {
            throw new ValidationError(`Addition '${addition.name}' is currently not available.`);
          }

          const verifiedAdditionPrice = Number(addition.price);
          itemAdditionsPrice += verifiedAdditionPrice * addQuantity;

          validatedAdditions.push({
            id: `ord_add_${randomUUID()}`,
            additionId: addition.id,
            additionName: addition.name,
            unitPrice: verifiedAdditionPrice,
            quantity: addQuantity,
          });
        }
      }

      const lineItemSubtotal = (verifiedProductPrice + itemAdditionsPrice) * itemDto.quantity;
      calculatedSubtotal += lineItemSubtotal;

      validatedItems.push({
        id: `ord_item_${randomUUID()}`,
        productId: product.id,
        productName: product.name,
        unitPrice: verifiedProductPrice,
        quantity: itemDto.quantity,
        observation: itemDto.observation || undefined,
        additions: validatedAdditions,
      });
    }

    // 4. Validar monto mínimo de compra
    const minOrderAmount = Number(restaurant.minOrderAmount ?? restaurant.config?.minOrderAmount ?? 0);
    if (minOrderAmount > 0 && calculatedSubtotal < minOrderAmount) {
      throw new ValidationError(
        `The order subtotal (${calculatedSubtotal}) is below the minimum required for ${restaurant.name} (${minOrderAmount}).`
      );
    }

    // 5. Tarifa de delivery oficial
    const deliveryFee = Number(restaurant.deliveryFee ?? restaurant.config?.deliveryFee ?? 0);
    const finalTotal = calculatedSubtotal + deliveryFee;

    // 6. Validar método de pago y montos
    const paymentMethod = dto.paymentMethod || 'Efectivo';
    let paymentAmount = dto.paymentAmount;
    let changeAmount = dto.changeAmount;

    if (paymentMethod === 'Efectivo' && paymentAmount !== undefined) {
      if (paymentAmount < finalTotal) {
        throw new ValidationError(`Payment amount (${paymentAmount}) is less than final total (${finalTotal}).`);
      }
      changeAmount = paymentAmount - finalTotal;
    } else if (paymentMethod === 'Transferencia') {
      paymentAmount = undefined;
      changeAmount = undefined;
    }

    // 7. Instanciar Entidad de Dominio
    const orderId = `ord_${randomUUID()}`;
    const order = new Order(
      orderId,
      restaurant.id,
      validatedCustomerId,
      validatedItems,
      'pending',
      new Date(),
      deliveryFee,
      undefined,
      paymentMethod,
      paymentAmount,
      changeAmount,
      dto.comment
    );

    // 8. Guardar de forma atómica en BD
    await this.orderRepo.save(order);

    return order;
  }
}
