export interface CreateProductDTO {
  name: string;
  description: string;
  price: number;
  category: string;
  isAvailable: boolean;
  additions: string[];
}

export interface UpdateProductDTO extends Partial<CreateProductDTO> {}

export interface OrderItemDTO {
  productId: string;
  quantity: number;
  additions: string[];
}

export interface CreateOrderDTO {
  customerId: string;
  items: OrderItemDTO[];
  deliveryFee?: number;
}

export interface UpdateOrderStatusDTO {
  status: 'pending' | 'cooking' | 'delivering' | 'delivered' | 'cancelled';
}

export interface CreateUserDTO {
  username: string;
  password: string;
  role: 'super_admin' | 'restaurant_admin';
  restaurantId?: string;
}

export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    username: string;
    role: 'super_admin' | 'restaurant_admin';
    restaurantId?: string;
  };
  error?: string;
}
