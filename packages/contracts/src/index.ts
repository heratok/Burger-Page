import { z } from 'zod';

// ==========================================
// RESTAURANT / STOREFRONT CONTRACTS
// ==========================================

export const storefrontConfigSchema = z.object({
  name: z.string().min(1),
  tagline: z.string(),
  logoUrl: z.string().url().or(z.string()),
  bannerUrl: z.string().url().or(z.string()),
  showBanner: z.boolean(),
  announcementText: z.string(),
  showAnnouncement: z.boolean(),
  whatsappNumber: z.string(),
  currency: z.string(),
  currencySymbol: z.string(),
  deliveryFee: z.number().nonnegative(),
  minOrderAmount: z.number().nonnegative(),
  estimatedDeliveryTime: z.string(),
  openingHours: z.string(),
  address: z.string(),
  primaryColor: z.string(),
  primaryHoverColor: z.string(),
  bgTheme: z.enum(['dark-charcoal', 'deep-midnight', 'warm-cream', 'clean-white']),
  fontFamily: z.enum(['sans', 'serif', 'mono', 'display']),
  cardRadius: z.enum(['sm', 'md', 'lg', 'full']),
  cardStyle: z.enum(['elevated', 'bordered', 'glass', 'minimal']),
  compactGrid: z.boolean(),
  showBadges: z.boolean(),
});

export type StorefrontConfigDTO = z.infer<typeof storefrontConfigSchema>;

export const createRestaurantSchema = z.object({
  name: z.string().min(1, 'Restaurant name is required'),
  slug: z.string().min(1, 'Restaurant slug is required'),
  tagline: z.string().optional(),
  whatsappNumber: z.string().optional(),
  adminPassword: z.string().optional(),
  primaryColor: z.string().optional(),
  templateType: z.enum(['burger', 'pizza', 'tacos', 'blank']).optional(),
  categories: z.array(z.string()).optional(),
  theme: z.string().optional(),
  config: storefrontConfigSchema.partial().optional(),
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;

export const updateRestaurantSchema = createRestaurantSchema.partial();
export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;

export const restaurantDTOSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string().optional(),
  theme: z.string().optional(),
  adminPassword: z.string().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.string().optional(),
  categories: z.array(z.string()).default([]),
  config: storefrontConfigSchema.partial().optional(),
  openingHours: z.object({ open: z.string(), close: z.string() }).optional(),
});

export type RestaurantDTO = z.infer<typeof restaurantDTOSchema>;

export const updateRestaurantCategoriesSchema = z.object({
  categories: z.array(z.string().min(1, 'Category name cannot be empty')).min(1, 'At least one category is required'),
});
export type UpdateRestaurantCategoriesInput = z.infer<typeof updateRestaurantCategoriesSchema>;

// ==========================================
// PRODUCT / MENU CONTRACTS
// ==========================================

export const createProductSchema = z.object({
  restaurantId: z.string().optional(), // Injected from JWT on backend
  name: z.string().min(1, 'Product name is required'),
  description: z.string().default(''),
  price: z.number().nonnegative('Price must be greater than or equal to 0'),
  category: z.string().min(1, 'Category is required'),
  categoryId: z.string().optional(),
  imageUrl: z.string().optional(),
  isAvailable: z.boolean().default(true),
  isPopular: z.boolean().optional(),
  isNew: z.boolean().optional(),
  preparationTimeMinutes: z.number().nonnegative().optional(),
  displayOrder: z.number().optional(),
  additions: z.array(z.string()).default([]),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const productDTOSchema = createProductSchema.extend({
  id: z.string(),
  restaurantId: z.string(),
});
export type ProductDTO = z.infer<typeof productDTOSchema>;

// ==========================================
// ORDER CONTRACTS
// ==========================================

export const orderStatusEnum = z.enum([
  'pending',
  'cooking',
  'delivering',
  'delivered',
  'cancelled',
]);
export type OrderStatusType = z.infer<typeof orderStatusEnum>;

export const orderItemAdditionInputSchema = z.object({
  additionId: z.string().min(1, 'Addition ID is required'),
  quantity: z.number().int().positive().optional().default(1),
});
export type OrderItemAdditionInput = z.infer<typeof orderItemAdditionInputSchema>;

export const orderItemInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  observation: z.string().optional(),
  additions: z.array(z.union([z.string(), orderItemAdditionInputSchema])).default([]),
});
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

export const createOrderSchema = z.object({
  restaurantId: z.string().min(1, 'Restaurant ID is required'),
  customerId: z.string().optional(),
  items: z.array(orderItemInputSchema).min(1, 'Order must have at least one item'),
  deliveryFee: z.number().nonnegative().optional(),
  paymentMethod: z.enum(['Efectivo', 'Transferencia']).optional(),
  paymentAmount: z.number().nonnegative().optional(),
  changeAmount: z.number().nonnegative().optional(),
  comment: z.string().optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  status: orderStatusEnum,
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

// ==========================================
// INVENTORY CONTRACTS
// ==========================================

export const updateInventoryStockSchema = z.object({
  quantityChange: z.number(),
});
export type UpdateInventoryStockInput = z.infer<typeof updateInventoryStockSchema>;

// ==========================================
// REAL-TIME ORDER EVENTS (SSE)
// ==========================================

export const orderEventSchema = z.object({
  eventType: z.enum(['ORDER_CREATED', 'ORDER_STATUS_UPDATED', 'ORDER_CANCELLED']),
  orderId: z.string(),
  orderNumber: z.number().optional(),
  status: orderStatusEnum,
  timestamp: z.string(),
  payload: z.record(z.string(), z.any()).optional(),
});
export type OrderEvent = z.infer<typeof orderEventSchema>;
