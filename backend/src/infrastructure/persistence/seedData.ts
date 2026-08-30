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
    passwordHash: 'd8dd8711ff8d1c3b8a1a0838ab1d5e83:c6af99fae6089674b5a7f1820c589a3bceca1e591d75d9a2cdce86c3ca18ff0930c3fb9c8f9849f4ea9bb30df8ae1bedb35c4d7fa77ac86f9fc24c09ae81a6e3',
    role: 'super_admin',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-admin-craft',
    username: 'admin_craft',
    passwordHash: '167de5152b6db195443496ece8fd9b5e:5abcfc2ee3875d31d36cf74bd59c961ec2b176e906dbf4c176a1dd105d82f499b237e18d43e69b3eb779a4945c4211ea0e3b24174b7a23b5243fad63b930d487',
    role: 'restaurant_admin',
    restaurantId: 'rest-burger-craft',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-admin-rosto',
    username: 'admin_rosto',
    passwordHash: 'd721ab4e2acea329aa2faecba40104db:41b0fee55161c432b0691edd16df4680d53d97d79439642169a5bacf2bb78706b47a7ae40a11221fa7000511660fcf875557a903ef3cdc8b8bb708564b79ddf1',
    role: 'restaurant_admin',
    restaurantId: 'rosto',
    createdAt: new Date().toISOString(),
  }
];
