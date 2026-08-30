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
    restaurantId: 'burger-craft',
    name: 'Classic Burger',
    description: 'A classic beef burger',
    price: 9.99,
    category: 'Burgers',
    isAvailable: true,
    additions: ['Extra Cheese', 'Bacon']
  },
  {
    id: 'p2',
    restaurantId: 'burger-craft',
    name: 'Fries',
    description: 'Crispy golden fries',
    price: 3.99,
    category: 'Sides',
    isAvailable: true,
    additions: ['Cheese Sauce']
  }
];

export const initialCustomers: Customer[] = [
  new Customer('c1', 'burger-craft', 'John Doe', '+1-555-9876', '123 Main St', 'Downtown', 'Likes extra sauce', 'john@example.com')
];

const item: OrderItem = {
  productId: 'p1',
  productName: 'Classic Burger',
  unitPrice: 9.99,
  quantity: 2,
  additions: [{ additionId: 'add-bacon', additionName: 'Bacon', unitPrice: 1.50, quantity: 1 }]
};

export const initialOrders: Order[] = [
  new Order('o1', 'burger-craft', 'c1', [item], 'pending', new Date(), 2.0, 1001)
];

export const initialInventory: Inventory[] = [
  {
    id: 'i1',
    restaurantId: 'burger-craft',
    name: 'Beef Patty',
    category: 'ingredients',
    quantity: 50,
    unit: 'unidades',
    alertThreshold: 10,
    minStockAlert: 10,
    costPerUnit: 4500,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

import { User } from '../../domain/models/User.js';

export const initialUsers: User[] = [
  {
    id: 'user-superadmin',
    username: 'admin',
    passwordHash: 'eb356f3e46e688997a48c45a54d29576:5656678fd8a5220d943d90fda6d15397272e0e10a0deef9ae5bccba56b77f9e3ba0734ff7cc783a9dc37d9862dc111de125b0ba91667153a9fe67c28298bc5ad',
    role: 'super_admin',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-admin-craft',
    username: 'admin_craft',
    passwordHash: '2fc1a065424c0b2945fd36a6866d3d63:43e98ce95f6d6898353e9be1233c1d04e34e6e43dbc90be750f05ffdc78111d4ae9b386e01fa45a44e0594830fcf4d868efe84337b2132b46a78d2d997297618',
    role: 'restaurant_admin',
    restaurantId: 'burger-craft',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-admin-rosto',
    username: 'admin_rosto',
    passwordHash: '32bd7035a7dae04f396caaac0738bfc9:7c39ae0ae432afba20fd04ef23c891ada873f0cad06bdf85d5f885c29f65bf1bae7e957a15facf432e6649789eedb9e1549e1ffb8257fe684d544627f6fb081f',
    role: 'restaurant_admin',
    restaurantId: 'rosto',
    createdAt: new Date().toISOString(),
  }
];
