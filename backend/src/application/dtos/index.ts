import { InventoryCategory, InventoryUnit } from '../../domain/models/Inventory.js';

export interface CreateProductDTO {
  restaurantId?: string;
  name: string;
  description: string;
  price: number;
  category: string;
  categoryId?: string;
  imageUrl?: string;
  isAvailable?: boolean;
  isPopular?: boolean;
  isNew?: boolean;
  preparationTimeMinutes?: number;
  displayOrder?: number;
  additions?: string[];
}

export interface UpdateProductDTO extends Partial<CreateProductDTO> {}

export interface CreateProductAdditionDTO {
  restaurantId?: string;
  productId?: string;
  name: string;
  price: number;
  isAvailable?: boolean;
  displayOrder?: number;
}

export interface UpdateProductAdditionDTO extends Partial<CreateProductAdditionDTO> {}

export interface OrderItemAdditionDTO {
  additionId: string;
  quantity?: number;
}

export interface OrderItemDTO {
  productId: string;
  quantity: number;
  observation?: string;
  additions?: Array<string | OrderItemAdditionDTO>;
}

export interface CreateOrderDTO {
  restaurantId: string;
  customerId?: string;
  items: OrderItemDTO[];
  deliveryFee?: number;
  paymentMethod?: 'Efectivo' | 'Transferencia';
  paymentAmount?: number;
  changeAmount?: number;
  comment?: string;
}

export interface UpdateOrderStatusDTO {
  status: 'pending' | 'cooking' | 'delivering' | 'delivered' | 'cancelled';
}

export interface CreateCustomerDTO {
  restaurantId?: string;
  name: string;
  phone: string;
  address?: string;
  barrio?: string;
  notes?: string;
  email?: string;
}

export interface UpdateCustomerDTO extends Partial<CreateCustomerDTO> {}

export interface CreateInventoryItemDTO {
  name: string;
  category: InventoryCategory;
  quantity?: number;
  unit: InventoryUnit;
  minStockAlert?: number;
  alertThreshold?: number;
  costPerUnit?: number;
}

export interface UpdateInventoryItemDTO extends Partial<CreateInventoryItemDTO> {}

export interface UpdateInventoryStockDTO {
  quantityChange: number;
}

export interface CreateUserDTO {
  username: string;
  password: string;
  role: 'super_admin' | 'restaurant_admin';
  restaurantId?: string;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    username: string;
    role: 'super_admin' | 'restaurant_admin';
    restaurantId?: string;
  };
  error?: string;
}
