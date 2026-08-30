import React from "react"
import type {
  StorefrontConfig,
  MenuItem,
  AdditionItem,
  Order,
  OrderStatus,
  Customer,
  AdminTab,
  AdminTheme,
  AppView,
  RestaurantRecord,
  AdminSession,
} from "@/types/restaurant"
import { UiProvider, useUi } from "./slices/UiContext"
import { TenantProvider, useTenant, type GlobalPlatformStats } from "./slices/TenantContext"
import { AuthProvider, useAuth } from "./slices/AuthContext"
import { CatalogProvider, useCatalog } from "./slices/CatalogContext"
import { OrderProvider, useOrders } from "./slices/OrderContext"
import { InventoryProvider, useInventory } from "./slices/InventoryContext"
import type { InventoryItem, Supplier } from "@/types/restaurant"
import type { TenantRepository } from "@/core/storage/TenantRepository"

// Export individual slice hooks for fine-grained subscriptions
export { useUi } from "./slices/UiContext"
export { useTenant } from "./slices/TenantContext"
export { useAuth } from "./slices/AuthContext"
export { useCatalog } from "./slices/CatalogContext"
export { useOrders } from "./slices/OrderContext"
export { useInventory } from "./slices/InventoryContext"

export interface RestaurantContextType {
  // Global Multi-Tenant State
  restaurants: RestaurantRecord[]
  activeRestaurant: RestaurantRecord
  activeRestaurantId: string
  activeRestaurantSlug: string
  switchRestaurant: (idOrSlug: string) => void

  // Super Admin Directory Actions
  createRestaurant: (data: {
    name: string
    slug: string
    tagline: string
    whatsappNumber: string
    adminPassword?: string
    primaryColor?: string
    templateType?: "burger" | "pizza" | "tacos" | "blank"
  }) => RestaurantRecord
  updateRestaurant: (id: string, updates: Partial<RestaurantRecord>) => void
  deleteRestaurant: (id: string) => void
  globalStats: GlobalPlatformStats

  // Auth & Session
  session: AdminSession
  login: (password: string, targetRestaurantIdOrSlug?: string) => {
    success: boolean
    role: "super" | "restaurant" | null
    restaurantId?: string
    error?: string
  }
  logout: () => void

  // Scoped Data of Active Restaurant
  storeConfig: StorefrontConfig
  updateStoreConfig: (newConfig: Partial<StorefrontConfig>) => void
  resetStoreConfig: () => void

  categories: string[]
  addCategory: (categoryName: string) => void
  updateCategory: (oldName: string, newName: string) => void
  deleteCategory: (categoryName: string) => void

  products: MenuItem[]
  addProduct: (item: Omit<MenuItem, "id">) => void
  updateProduct: (id: string, updates: Partial<MenuItem>) => void
  deleteProduct: (id: string) => void
  toggleProductStock: (id: string) => void

  additions: AdditionItem[]
  addAddition: (item: Omit<AdditionItem, "id">) => void
  updateAddition: (id: string, updates: Partial<AdditionItem>) => void
  deleteAddition: (id: string) => void

  orders: Order[]
  addOrder: (orderData: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt">) => Order
  updateOrderStatus: (orderId: string, newStatus: OrderStatus) => void
  deleteOrder: (orderId: string) => void

  customers: Customer[]
  updateCustomer: (id: string, updates: Partial<Customer>) => void

  // Inventory & Suppliers
  inventory: InventoryItem[]
  suppliers: Supplier[]
  addInventoryItem: (item: Omit<InventoryItem, "id">) => void
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void
  deleteInventoryItem: (id: string) => void
  adjustStock: (id: string, deltaQuantity: number) => void
  addSupplier: (supplier: Omit<Supplier, "id">) => void
  updateSupplier: (id: string, updates: Partial<Supplier>) => void
  deleteSupplier: (id: string) => void
  lowStockCount: number
  totalInventoryValue: number

  // App Navigation & Admin Theme
  activeView: AppView
  setActiveView: (view: AppView) => void
  adminTab: AdminTab
  setAdminTab: (tab: AdminTab) => void
  adminTheme: AdminTheme
  setAdminTheme: (theme: AdminTheme) => void
  toggleAdminTheme: () => void

  // Audio alerts toggle
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void

  // Summary Metrics
  pendingOrdersCount: number
}

/**
 * Composed Provider wrapping all domain slices.
 */
export const RestaurantProvider: React.FC<{
  children: React.ReactNode
  repository?: TenantRepository
}> = ({ children, repository }) => {
  return (
    <UiProvider>
      <TenantProvider repository={repository}>
        <AuthProvider>
          <CatalogProvider>
            <InventoryProvider>
              <OrderProvider>{children}</OrderProvider>
            </InventoryProvider>
          </CatalogProvider>
        </AuthProvider>
      </TenantProvider>
    </UiProvider>
  )
}

/**
 * Universal Facade hook combining slices for components that need broad access,
 * maintaining full backwards compatibility with existing UI.
 */
export const useRestaurant = (): RestaurantContextType => {
  const ui = useUi()
  const tenant = useTenant()
  const auth = useAuth()
  const catalog = useCatalog()
  const inventorySlice = useInventory()
  const orders = useOrders()

  return {
    restaurants: tenant.restaurants,
    activeRestaurant: tenant.activeRestaurant,
    activeRestaurantId: tenant.activeRestaurantId,
    activeRestaurantSlug: tenant.activeRestaurantSlug,
    switchRestaurant: tenant.switchRestaurant,

    createRestaurant: tenant.createRestaurant,
    updateRestaurant: tenant.updateRestaurant,
    deleteRestaurant: tenant.deleteRestaurant,
    globalStats: tenant.globalStats,

    session: auth.session,
    login: (password: string, targetRestaurantIdOrSlug?: string) => {
      const res = auth.login(
        password,
        tenant.restaurants,
        tenant.superAdminPassword,
        tenant.activeRestaurant,
        targetRestaurantIdOrSlug
      )
      if (res.success) {
        if (res.role === "super") {
          const isDeepRoute = window.location.pathname.toLowerCase().startsWith("/admin/") && window.location.pathname.toLowerCase() !== "/admin"
          if (!isDeepRoute) {
            ui.setAdminTab("restaurants")
          }
        } else if (res.role === "restaurant" && res.restaurantId) {
          tenant.switchRestaurant(res.restaurantId)
          const isDeepRoute = window.location.pathname.toLowerCase().startsWith("/admin/") && window.location.pathname.toLowerCase() !== "/admin"
          if (!isDeepRoute) {
            ui.setAdminTab("dashboard")
          }
        }
        ui.setActiveView("admin")
      }
      return res
    },
    logout: auth.logout,

    storeConfig: catalog.storeConfig,
    updateStoreConfig: catalog.updateStoreConfig,
    resetStoreConfig: catalog.resetStoreConfig,

    categories: catalog.categories,
    addCategory: catalog.addCategory,
    updateCategory: catalog.updateCategory,
    deleteCategory: catalog.deleteCategory,

    products: catalog.products,
    addProduct: catalog.addProduct,
    updateProduct: catalog.updateProduct,
    deleteProduct: catalog.deleteProduct,
    toggleProductStock: catalog.toggleProductStock,

    additions: catalog.additions,
    addAddition: catalog.addAddition,
    updateAddition: catalog.updateAddition,
    deleteAddition: catalog.deleteAddition,

    inventory: inventorySlice.inventory,
    suppliers: inventorySlice.suppliers,
    addInventoryItem: inventorySlice.addInventoryItem,
    updateInventoryItem: inventorySlice.updateInventoryItem,
    deleteInventoryItem: inventorySlice.deleteInventoryItem,
    adjustStock: inventorySlice.adjustStock,
    addSupplier: inventorySlice.addSupplier,
    updateSupplier: inventorySlice.updateSupplier,
    deleteSupplier: inventorySlice.deleteSupplier,
    lowStockCount: inventorySlice.lowStockCount,
    totalInventoryValue: inventorySlice.totalInventoryValue,

    orders: orders.orders,
    addOrder: orders.addOrder,
    updateOrderStatus: orders.updateOrderStatus,
    deleteOrder: orders.deleteOrder,

    customers: orders.customers,
    updateCustomer: orders.updateCustomer,

    activeView: ui.activeView,
    setActiveView: ui.setActiveView,
    adminTab: ui.adminTab,
    setAdminTab: ui.setAdminTab,
    adminTheme: ui.adminTheme,
    setAdminTheme: ui.setAdminTheme,
    toggleAdminTheme: ui.toggleAdminTheme,

    soundEnabled: ui.soundEnabled,
    setSoundEnabled: ui.setSoundEnabled,

    pendingOrdersCount: orders.pendingOrdersCount,
  }
}
