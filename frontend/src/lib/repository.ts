import type {
  Modifier,
  Order,
  OrderStatus,
  Product,
  RestaurantConfig,
} from "./domain"

/**
 * Repository contract for the restaurant CRM (design contract, exact).
 * One local-first implementation (LocalStorageRepository) today; the
 * interface is the backend-swap seam.
 */
export interface RestaurantRepository {
  getConfig(): RestaurantConfig
  saveConfig(config: RestaurantConfig): void

  listProducts(): Product[]
  saveProduct(product: Product): void
  deleteProduct(id: string): void

  listModifiers(): Modifier[]
  saveModifier(modifier: Modifier): void
  deleteModifier(id: string): void

  listOrders(): Order[]
  saveOrder(order: Omit<Order, "id" | "status" | "createdAt">): Order
  updateOrderStatus(id: number, next: OrderStatus): boolean
}