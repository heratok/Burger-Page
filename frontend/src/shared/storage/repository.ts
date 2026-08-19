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
 *
 * Scoped reads return `undefined` on a scoped miss (spec MT-3) — a repository
 * built for an unknown `restaurantId` never falls back to another tenant's
 * data; writes become no-ops (`saveOrder` → `undefined`, `updateOrderStatus`
 * → `false`).
 */
export interface RestaurantRepository {
  getConfig(): RestaurantConfig | undefined
  saveConfig(config: RestaurantConfig): void

  getPalette(): RestaurantPalette | undefined
  savePalette(patch: Partial<RestaurantPalette>): void

  listProducts(): Product[] | undefined
  saveProduct(product: Product): void
  deleteProduct(id: string): void

  listModifiers(): Modifier[] | undefined
  saveModifier(modifier: Modifier): void
  deleteModifier(id: string): void

  listOrders(): Order[] | undefined
  saveOrder(order: Omit<Order, "id" | "status" | "createdAt">): Order | undefined
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