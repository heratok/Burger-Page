import { describe, it, expect } from 'vitest';
import { Order } from '../../src/domain/models/Order.js';
import { Customer } from '../../src/domain/models/Customer.js';
import { InvalidOrderStateError } from '../../src/domain/errors/DomainErrors.js';

describe('Order Domain Entity', () => {
  const createMockOrder = () => new Order(
    '1',
    'burger-craft',
    'customer-1',
    [
      { productId: 'p1', productName: 'Burger A', unitPrice: 10, quantity: 2, additions: [] },
      { productId: 'p2', productName: 'Burger B', unitPrice: 15, quantity: 1, additions: [{ additionId: 'add-cheese', additionName: 'Cheese', unitPrice: 0, quantity: 1 }] }
    ],
    'pending',
    new Date(),
    5 // deliveryFee
  );

  it('should calculate subtotal correctly', () => {
    const order = createMockOrder();
    // 2 * 10 + 1 * 15 = 35
    expect(order.subtotal).toBe(35);
  });

  it('should calculate total correctly (subtotal + deliveryFee)', () => {
    const order = createMockOrder();
    // 35 + 5 = 40
    expect(order.total).toBe(40);
  });

  it('should transition to valid states', () => {
    const order = createMockOrder();
    order.transitionTo('cooking');
    expect(order.status).toBe('cooking');

    order.transitionTo('delivering');
    expect(order.status).toBe('delivering');

    order.transitionTo('delivered');
    expect(order.status).toBe('delivered');
  });

  it('should throw InvalidOrderStateError for invalid state transitions', () => {
    const order = createMockOrder();
    expect(() => order.transitionTo('delivered')).toThrow(InvalidOrderStateError);
    expect(() => order.transitionTo('delivered')).toThrow('Cannot transition from pending to delivered');

    order.transitionTo('cooking');
    expect(() => order.transitionTo('pending')).toThrow(InvalidOrderStateError);
  });
});

describe('Customer Buyer Entity', () => {
  it('should instantiate customer buyer profile with mandatory tenant and contact data', () => {
    const customer = new Customer('1', 'burger-craft', 'John Doe', '123456', 'Calle 10 # 5-20', 'Centro', 'Timbre 201', 'john@example.com');
    expect(customer.id).toBe('1');
    expect(customer.restaurantId).toBe('burger-craft');
    expect(customer.name).toBe('John Doe');
    expect(customer.phone).toBe('123456');
    expect(customer.address).toBe('Calle 10 # 5-20');
    expect(customer.barrio).toBe('Centro');
    expect(customer.notes).toBe('Timbre 201');
    expect(customer.email).toBe('john@example.com');
  });
});
