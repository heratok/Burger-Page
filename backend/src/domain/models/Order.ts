import { InvalidOrderStateError } from '../errors/DomainErrors.js';

export type OrderStatus = 'pending' | 'cooking' | 'delivering' | 'delivered' | 'cancelled';

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
  additions: string[];
}

export class Order {
  constructor(
    public readonly id: string,
    public readonly customerId: string,
    public items: OrderItem[],
    public status: OrderStatus,
    public createdAt: Date,
    public deliveryFee: number = 0
  ) {}

  public get subtotal(): number {
    return this.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }

  public get total(): number {
    return this.subtotal + this.deliveryFee;
  }

  public transitionTo(newStatus: OrderStatus): void {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      'pending': ['cooking', 'cancelled'],
      'cooking': ['delivering', 'cancelled'],
      'delivering': ['delivered', 'cancelled'],
      'delivered': [],
      'cancelled': []
    };

    if (!validTransitions[this.status].includes(newStatus)) {
      throw new InvalidOrderStateError(`Cannot transition from ${this.status} to ${newStatus}`);
    }

    this.status = newStatus;
  }
}
