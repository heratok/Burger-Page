import { Restaurant } from '../../domain/models/Restaurant.js';
import { Product } from '../../domain/models/Product.js';
import { Order, OrderItem } from '../../domain/models/Order.js';
import { Customer } from '../../domain/models/Customer.js';
import { Inventory } from '../../domain/models/Inventory.js';

export const defaultRestaurant: Restaurant = {
  id: 'burger-craft',
  slug: 'burger-craft',
  name: 'Burger Craft',
  theme: 'dark',
  openingHours: { open: '10:00', close: '22:00' },
  isActive: true,
  categories: ['Burgers', 'Sides', 'Bebidas'],
};

export const initialProducts: Product[] = [
  {
    id: 'p1',
    name: 'Classic Burger',
    description: 'A classic beef burger',
    price: 9.99,
    category: 'Burgers',
    isAvailable: true,
    additions: ['Extra Cheese', 'Bacon']
  },
  {
    id: 'p2',
    name: 'Fries',
    description: 'Crispy golden fries',
    price: 3.99,
    category: 'Sides',
    isAvailable: true,
    additions: ['Cheese Sauce']
  }
];

export const initialCustomers: Customer[] = [
  new Customer('c1', 'John Doe', 'john@example.com', '+1-555-9876', 0, 0)
];

const item: OrderItem = {
  productId: 'p1',
  quantity: 2,
  price: 9.99,
  additions: ['Bacon']
};

export const initialOrders: Order[] = [
  new Order('o1', 'c1', [item], 'pending', new Date(), 2.0)
];

export const initialInventory: Inventory[] = [
  {
    id: 'i1',
    name: 'Beef Patty',
    category: 'ingredients',
    quantity: 50,
    unit: 'units',
    alertThreshold: 10,
    minStockAlert: 10,
    costPerUnit: 4500
  }
];
