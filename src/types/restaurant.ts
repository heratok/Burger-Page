export type CurrencyCode = "COP" | "USD" | "EUR" | "MXN"

export type StoreBgTheme = "dark-charcoal" | "warm-cream" | "clean-white" | "deep-midnight"

export type CardStyle = "elevated" | "bordered" | "glass" | "minimal"

export type CardRadius = "sm" | "md" | "lg" | "full"

export type FontFamily = "sans" | "serif" | "rounded" | "mono"

export interface StorefrontConfig {
  name: string
  tagline: string
  logoUrl: string
  bannerUrl: string
  showBanner: boolean
  announcementText: string
  showAnnouncement: boolean
  whatsappNumber: string
  currency: CurrencyCode
  currencySymbol: string
  deliveryFee: number
  minOrderAmount: number
  estimatedDeliveryTime: string
  openingHours: string
  address: string
  
  // Theme & UI/UX Customization
  primaryColor: string
  primaryHoverColor?: string
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
  description: string
  price: number
  src: string
  category: string
  inStock: boolean
  isPopular?: boolean
  isNew?: boolean
  preparationTimeMinutes?: number
}

export interface AdditionItem {
  id: string
  name: string
  price: number
  src?: string
  available: boolean
}

export type OrderStatus = "pending" | "cooking" | "delivering" | "delivered" | "cancelled"

export type PaymentMethod = "Efectivo" | "Transferencia" | "Tarjeta"

export interface OrderItem {
  name: string
  price: number
  cantidad: number
  total: number
  src?: string
  adiciones?: Array<{
    name: string
    price: number
    cantidad: number
  }>
  observacion?: string
}

export interface OrderCustomer {
  nombre: string
  telefono: string
  direccion: string
  barrio: string
}

export interface Order {
  id: string
  orderNumber: number
  customer: OrderCustomer
  items: OrderItem[]
  total: number
  deliveryFee: number
  finalTotal: number
  metodo: PaymentMethod
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
  loyaltyTier: LoyaltyTier
  lastOrderDate: string
  notes?: string
}

export type AdminTab = "dashboard" | "orders" | "menu" | "customers" | "customizer"

export type AdminTheme = "light" | "dark"

export type AppView = "store" | "admin"
