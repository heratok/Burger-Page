import { randomUUID } from 'node:crypto';
import { Order, OrderItem, OrderItemAddition, PaymentMethod } from '../../domain/models/Order.js';
import { Customer } from '../../domain/models/Customer.js';
import { Restaurant } from '../../domain/models/Restaurant.js';
import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { ProductAdditionRepository } from '../../domain/ports/out/ProductAdditionRepository.js';
import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { CustomerRepository } from '../../domain/ports/out/CustomerRepository.js';
import { CreateOrderDTO } from '../dtos/index.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

export class CreateOrderUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly productRepo: ProductRepository,
    private readonly restaurantRepo: RestaurantRepository,
    private readonly additionRepo: ProductAdditionRepository,
    private readonly customerRepo?: CustomerRepository
  ) {}

  async execute(dto: CreateOrderDTO): Promise<Order> {
    const restaurant = await this.validateAndGetRestaurant(dto.restaurantId);
    const validatedCustomerId = await this.resolveCustomerId(dto, restaurant);
    const { validatedItems, calculatedSubtotal } = await this.validateAndCalculateItems(dto.items, restaurant);

    this.validateMinOrderAmount(calculatedSubtotal, restaurant);

    const deliveryFee = Number(restaurant.deliveryFee ?? restaurant.config?.deliveryFee ?? 0);
    const finalTotal = calculatedSubtotal + deliveryFee;

    const payment = this.resolvePaymentDetails(
      dto.paymentMethod,
      dto.paymentAmount,
      dto.changeAmount,
      finalTotal
    );

    const order = this.buildOrderPayload({
      restaurantId: restaurant.id,
      customerId: validatedCustomerId,
      items: validatedItems,
      deliveryFee,
      payment,
      dto,
    });

    await this.orderRepo.save(order);
    return order;
  }

  private async validateAndGetRestaurant(restaurantId?: string): Promise<Restaurant> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to create an order.');
    }

    const restaurant =
      (await this.restaurantRepo.findById(restaurantId)) ||
      (await this.restaurantRepo.findBySlug(restaurantId));

    if (!restaurant) {
      throw new EntityNotFoundError(`Restaurant '${restaurantId}' not found.`);
    }
    if (!restaurant.isActive) {
      throw new ValidationError(`Restaurant '${restaurant.name}' is currently inactive.`);
    }

    return restaurant;
  }

  private async resolveCustomerId(dto: CreateOrderDTO, restaurant: Restaurant): Promise<string | undefined> {
    let validatedCustomerId = await this.validateExistingCustomerId(dto.customerId, restaurant);

    if (!validatedCustomerId && dto.customer?.phone && dto.customer?.name && this.customerRepo) {
      validatedCustomerId = await this.findOrCreateCustomer(dto.customer, restaurant.id);
    }

    return validatedCustomerId;
  }

  private async validateExistingCustomerId(
    customerId: string | undefined,
    restaurant: Restaurant
  ): Promise<string | undefined> {
    if (!customerId) return undefined;

    if (!this.customerRepo) {
      return customerId.startsWith('cust-') ? undefined : customerId;
    }

    const customer = await this.customerRepo.findById(customerId, restaurant.id);
    if (customer) {
      if (customer.restaurantId !== restaurant.id) {
        throw new ValidationError(`Customer '${customerId}' does not belong to restaurant '${restaurant.name}'.`);
      }
      return customer.id;
    }

    return customerId.startsWith('cust-') ? undefined : customerId;
  }

  private async findOrCreateCustomer(
    customerDto: NonNullable<CreateOrderDTO['customer']>,
    restaurantId: string
  ): Promise<string | undefined> {
    if (!this.customerRepo) return undefined;

    try {
      const phone = customerDto.phone?.trim();
      if (!phone) return undefined;

      let customer = await this.customerRepo.findByPhone(phone, restaurantId);
      if (customer) {
        if (customerDto.name) customer.name = customerDto.name.trim();
        if (customerDto.address) customer.address = customerDto.address.trim();
        if (customerDto.barrio) customer.barrio = customerDto.barrio.trim();
        customer.updatedAt = new Date().toISOString();
        await this.customerRepo.save(customer);
        return customer.id;
      }

      const newCustomer = new Customer(
        `cust_${randomUUID()}`,
        restaurantId,
        customerDto.name?.trim() || '',
        phone,
        customerDto.address?.trim() || '',
        customerDto.barrio?.trim() || '',
        '',
        customerDto.email?.trim() || '',
        new Date().toISOString(),
        new Date().toISOString()
      );
      await this.customerRepo.save(newCustomer);
      return newCustomer.id;
    } catch {
      // Fallback gracefully without blocking order creation
      return undefined;
    }
  }

  private async validateAndCalculateItems(
    items: CreateOrderDTO['items'],
    restaurant: Restaurant
  ): Promise<{ validatedItems: OrderItem[]; calculatedSubtotal: number }> {
    if (!items || items.length === 0) {
      throw new ValidationError('The order must contain at least one item.');
    }

    let calculatedSubtotal = 0;
    const validatedItems: OrderItem[] = [];

    for (const itemDto of items) {
      const { item, lineItemTotal } = await this.validateAndBuildItem(itemDto, restaurant);
      calculatedSubtotal += lineItemTotal;
      validatedItems.push(item);
    }

    return { validatedItems, calculatedSubtotal };
  }

  private async validateAndBuildItem(
    itemDto: NonNullable<CreateOrderDTO['items']>[number],
    restaurant: Restaurant
  ): Promise<{ item: OrderItem; lineItemTotal: number }> {
    if (!itemDto.quantity || itemDto.quantity <= 0) {
      throw new ValidationError(`Invalid quantity for product ${itemDto.productId}`);
    }
    if (itemDto.quantity > 100) {
      throw new ValidationError(`Quantity exceeds maximum limit of 100 for product ${itemDto.productId}`);
    }

    const product = await this.fetchAndValidateProduct(itemDto.productId, restaurant);
    const verifiedProductPrice = Number(product.price);

    const { additions, additionsTotal } = await this.validateAndBuildAdditions(
      itemDto.additions,
      product,
      restaurant
    );

    const lineItemTotal = (verifiedProductPrice + additionsTotal) * itemDto.quantity;

    const item: OrderItem = {
      id: `ord_item_${randomUUID()}`,
      productId: product.id,
      productName: product.name,
      unitPrice: verifiedProductPrice,
      quantity: itemDto.quantity,
      observation: itemDto.observation || undefined,
      additions,
    };

    return { item, lineItemTotal };
  }

  private async fetchAndValidateProduct(productId: string, restaurant: Restaurant): Promise<any> {
    let product = await this.productRepo.findById(productId, restaurant.id);
    if (!product && typeof this.productRepo.findByRestaurantId === 'function') {
      const allProducts = await this.productRepo.findByRestaurantId(restaurant.id);
      product = allProducts.find(p => p.name.toLowerCase() === productId.toLowerCase() || p.id === productId) || null;
    }
    if (!product) {
      throw new EntityNotFoundError(`Product '${productId}' not found.`);
    }
    if (product.restaurantId && product.restaurantId !== restaurant.id) {
      throw new ValidationError(`Product '${product.name}' does not belong to restaurant '${restaurant.name}'.`);
    }
    if (!product.isAvailable) {
      throw new ValidationError(`Product '${product.name}' is currently not available.`);
    }
    return product;
  }

  private async validateAndBuildAdditions(
    rawAdditions: any[] | undefined,
    product: any,
    restaurant: Restaurant
  ): Promise<{ additions: OrderItemAddition[]; additionsTotal: number }> {
    if (!rawAdditions || rawAdditions.length === 0) {
      return { additions: [], additionsTotal: 0 };
    }

    let additionsTotal = 0;
    const additions: OrderItemAddition[] = [];

    for (const rawAdd of rawAdditions) {
      const { addition, additionTotal } = await this.validateSingleAddition(rawAdd, product, restaurant);
      additionsTotal += additionTotal;
      additions.push(addition);
    }

    return { additions, additionsTotal };
  }

  private async validateSingleAddition(
    rawAdd: any,
    product: any,
    restaurant: Restaurant
  ): Promise<{ addition: OrderItemAddition; additionTotal: number }> {
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
    const additionTotal = verifiedAdditionPrice * addQuantity;

    return {
      addition: {
        id: `ord_add_${randomUUID()}`,
        additionId: addition.id,
        additionName: addition.name,
        unitPrice: verifiedAdditionPrice,
        quantity: addQuantity,
      },
      additionTotal,
    };
  }

  private validateMinOrderAmount(calculatedSubtotal: number, restaurant: Restaurant): void {
    const minOrderAmount = Number(restaurant.minOrderAmount ?? restaurant.config?.minOrderAmount ?? 0);
    if (minOrderAmount > 0 && calculatedSubtotal < minOrderAmount) {
      throw new ValidationError(
        `The order subtotal (${calculatedSubtotal}) is below the minimum required for ${restaurant.name} (${minOrderAmount}).`
      );
    }
  }

  private resolvePaymentDetails(
    dtoPaymentMethod: PaymentMethod | undefined,
    dtoPaymentAmount: number | undefined,
    dtoChangeAmount: number | undefined,
    finalTotal: number
  ): { paymentMethod: PaymentMethod; paymentAmount?: number; changeAmount?: number } {
    const paymentMethod: PaymentMethod = dtoPaymentMethod || 'Efectivo';
    let paymentAmount = dtoPaymentAmount;
    let changeAmount = dtoChangeAmount;

    if (paymentMethod === 'Efectivo' && paymentAmount !== undefined) {
      if (paymentAmount < finalTotal) {
        throw new ValidationError(`Payment amount (${paymentAmount}) is less than final total (${finalTotal}).`);
      }
      changeAmount = paymentAmount - finalTotal;
    } else if (paymentMethod === 'Transferencia') {
      paymentAmount = undefined;
      changeAmount = undefined;
    }

    return { paymentMethod, paymentAmount, changeAmount };
  }

  private buildOrderPayload(params: {
    restaurantId: string;
    customerId?: string;
    items: OrderItem[];
    deliveryFee: number;
    payment: { paymentMethod: PaymentMethod; paymentAmount?: number; changeAmount?: number };
    dto: CreateOrderDTO;
  }): Order {
    const { restaurantId, customerId, items, deliveryFee, payment, dto } = params;
    const order = new Order(
      `ord_${randomUUID()}`,
      restaurantId,
      customerId,
      items,
      'pending',
      new Date(),
      deliveryFee,
      undefined,
      payment.paymentMethod,
      payment.paymentAmount,
      payment.changeAmount,
      dto.comment,
      dto.receiptUrl
    );

    if (dto.customer) {
      (order as any).customer = {
        nombre: dto.customer.name || '',
        telefono: dto.customer.phone || '',
        direccion: dto.customer.address || '',
        barrio: dto.customer.barrio || '',
      };
    }

    return order;
  }
}
