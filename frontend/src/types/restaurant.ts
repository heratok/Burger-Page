// Restaurant & CRM Domain Types

export type CardStyle = "elevated" | "bordered" | "glass" | "minimal"
export type CardRadius = "sm" | "md" | "lg" | "full"
export type StoreBgTheme = "dark-charcoal" | "deep-midnight" | "warm-cream" | "clean-white"
export type FontFamily = "sans" | "serif" | "mono" | "display"

export interface StorefrontConfig {
  name: string
  tagline: string
  logoUrl: string
  bannerUrl: string
  showBanner: boolean
  announcementText: string
  showAnnouncement: boolean
  whatsappNumber: string
  currency: string
  currencySymbol: string
  deliveryFee: number
  minOrderAmount: number
  estimatedDeliveryTime: string
  openingHours: string
  address: string

  // Theme & UI/UX Customization
  primaryColor: string
  primaryHoverColor: string
  bgTheme: StoreBgTheme
  fontFamily: FontFamily
  cardRadius: CardRadius
  cardStyle: CardStyle
  compactGrid: boolean
  showBadges: boolean
}

export interface MenuItem {
  id: string
  name: string
  price: number
  category: string
  src: string
  description: string
  inStock: boolean
  isPopular?: boolean
  isNew?: boolean
  preparationTimeMinutes?: number
}

export interface AdditionItem {
  id: string
  name: string
  price: number
  available: boolean
}

export type OrderStatus = "pending" | "cooking" | "delivering" | "delivered" | "cancelled"

export interface OrderItem {
  id?: string
  name: string
  price: number
  cantidad: number
  total: number
  observacion?: string
  src?: string
  adiciones?: Array<{
    name: string
    price: number
    cantidad: number
  }>
}

export interface Order {
  id: string
  orderNumber: number
  customer: {
    nombre: string
    telefono: string
    direccion: string
    barrio: string
  }
  items: OrderItem[]
  total: number
  deliveryFee: number
  finalTotal: number
  metodo: "Efectivo" | "Transferencia"
  pagoCon?: string
  cambio?: number
  comentario?: string
  status: OrderStatus
  createdAt: string
  updatedAt: string
}

export type LoyaltyTier = "bronze" | "silver" | "gold" | "vip"

export interface Customer {
  id: string
  nombre: string
  telefono: string
  direccion: string
  barrio: string
  totalOrders: number
  totalSpent: number
  lastOrderDate: string
  loyaltyTier: LoyaltyTier
  notes?: string
}

// ==========================================
// INVENTORY & SUPPLIERS DOMAIN ENTITIES
// ==========================================

export type InventoryCategory = "ingredients" | "beverages" | "packaging" | "cleaning" | "other"
export type InventoryUnit = "unidades" | "kg" | "g" | "litros" | "paquetes" | "cajas"

export interface InventoryItem {
  id: string
  name: string
  category: InventoryCategory
  currentStock: number
  minStockAlert: number
  unit: InventoryUnit
  costPerUnit: number
  supplierId?: string
  lastRestockedAt?: string
}

export interface Supplier {
  id: string
  name: string
  category: string
  contactName: string
  phone: string
  email?: string
  notes?: string
}

// ==========================================
// MULTI-TENANT & SUPER ADMIN DOMAIN ENTITIES
// ==========================================

export interface RestaurantRecord {
  id: string
  slug: string
  adminPassword?: string
  config: StorefrontConfig
  products: MenuItem[]
  additions: AdditionItem[]
  inventory?: InventoryItem[]
  suppliers?: Supplier[]
  orders: Order[]
  customers: Customer[]
  isActive: boolean
  createdAt: string
}

export type UserRole = "super" | "restaurant" | "guest"

export interface AdminSession {
  role: UserRole
  restaurantId?: string
  authenticatedAt?: string
}

export interface StorageEnvelopeV2 {
  version: 2
  superAdminPassword: string
  restaurants: RestaurantRecord[]
}

export type AdminTab = "dashboard" | "orders" | "menu" | "inventory" | "customers" | "reports" | "customizer" | "restaurants"
export type AdminTheme = "light" | "dark"
export type AppView = "landing" | "store" | "admin" | "not-found"
