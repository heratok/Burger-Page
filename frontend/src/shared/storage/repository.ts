import type {
  Modifier,
  Order,
  OrderStatus,
  Product,
  Restaurant,
  RestaurantConfig,
  RestaurantPalette,
} from "../domain/domain"

/**
 * Repository contract for the restaurant CRM (design contract, exact).
 * One local-first implementation (LocalStorageRepository) today; the
 * interface is the backend-swap seam.
 */
export interface RestaurantRepository {
  getConfig(): RestaurantConfig
  saveConfig(config: RestaurantConfig): void

  getPalette(): RestaurantPalette
  savePalette(patch: Partial<RestaurantPalette>): void

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

/** Input for creating a restaurant (flattened; stored nested under `config`). */
export interface RestaurantInput {
  name: string
  whatsapp: string
  logo: string
  adminPassword: string
  palette: RestaurantPalette
  slug?: string
}

/** Partial update for an existing restaurant; slug and collections never change here. */
export interface RestaurantPatch {
  name?: string
  whatsapp?: string
  logo?: string
  adminPassword?: string
  palette?: RestaurantPalette
}

/**
 * Directory-level contract across all restaurants (design D2, spec MT-2/SA-2/SA-3).
 * getBySlug never throws for unknown slugs; deleteRestaurant refuses the last one.
 */
export interface DirectoryRepository {
  listRestaurants(): Restaurant[]
  getBySlug(slug: string): Restaurant | undefined
  /** Scoped view factory (design D2): one repository per restaurant. */
  getRepositoryFor(id: string): RestaurantRepository
  createRestaurant(input: RestaurantInput): Restaurant
  deleteRestaurant(id: string): boolean
  updateRestaurant(id: string, patch: RestaurantPatch): void
  getSuperAdminPassword(): string
  setSuperAdminPassword(next: string): void
}