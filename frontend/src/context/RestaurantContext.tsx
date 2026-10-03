import React, { useCallback, useMemo } from "react"
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
import { OrderProvider, useOrders, type PlacedOrder } from "./slices/OrderContext"
import { InventoryProvider, useInventory } from "./slices/InventoryContext"
import type { InventoryItem, Supplier } from "@/types/restaurant"
import type { TenantRepository } from "@/core/storage/TenantRepository"
import { defaultTenantRepository } from "@/core/storage/TenantRepository"
import { resolveRoute } from "@/core/router/useAppRouter"

// Tabs exclusive to the platform super admin (kept in sync with the
// GlobalModuleAccessDenied gate in App.tsx and SupportModeBanner's guard).
const SUPER_ONLY_ADMIN_TABS = new Set<AdminTab>(["restaurants", "users", "metrics", "audit"])

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
  /**
   * Session-aware tenant id: session.restaurantId when the session is a
   * restaurant admin, else the raw persisted activeRestaurantId. Data
   * providers key every fetch/SSE/mutation on this value so a stale persisted
   * active restaurant can never leak cross-tenant traffic (A1/A2).
   */
  effectiveRestaurantId: string
  activeRestaurantId: string
  activeRestaurantSlug: string
  isSyncing: boolean
  switchRestaurant: (idOrSlug: string) => void
  loadRestaurant: (idOrSlug: string) => Promise<"ok" | "not-found" | "error">

  // Super Admin Directory Actions
  createRestaurant: (data: {
    name: string
    slug: string
    tagline: string
    whatsappNumber: string
    adminPassword?: string
    primaryColor?: string
    templateType?: "burger" | "pizza" | "tacos" | "blank"
  }) => RestaurantRecord | undefined
  updateRestaurant: (id: string, updates: Partial<RestaurantRecord>) => Promise<void>
  deleteRestaurant: (id: string) => Promise<void>
  refreshRestaurants: () => Promise<void>
  refreshStoreStatus: () => Promise<void>
  globalStats: GlobalPlatformStats

  // Auth & Session
  session: AdminSession
  setSession: React.Dispatch<React.SetStateAction<AdminSession>>
  login: (
    username: string,
    password: string,
    targetRestaurantIdOrSlug?: string
  ) => Promise<{
    success: boolean
    role: "super" | "restaurant" | null
    restaurantId?: string
    error?: string
  }>
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ success: boolean; error?: string }>
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
  addOrder: (orderData: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt">) => PlacedOrder
  updateOrder: (orderId: string, updates: Partial<Order>) => void
  updateOrderStatus: (orderId: string, newStatus: OrderStatus) => void
  updateOrderReceipt: (orderId: string, receiptUrl: string) => Promise<void>
  deleteOrder: (orderId: string) => void

  customers: Customer[]
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void> | void

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

  // Loading & Sync States
  isLoadingOrders: boolean
  isLoadingInventory: boolean
  isLoadingCatalog: boolean

  // Summary Metrics
  pendingOrdersCount: number
  refreshOrders: () => Promise<void>
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
      <AuthProvider
        onLogout={() => (repository ?? defaultTenantRepository).purgeTenantData()}
      >
        <TenantProvider repository={repository}>
          <CatalogProvider>
            <InventoryProvider>
              <OrderProvider>{children}</OrderProvider>
            </InventoryProvider>
          </CatalogProvider>
        </TenantProvider>
      </AuthProvider>
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

  const login = useCallback(
    async (username: string, password: string, targetRestaurantIdOrSlug?: string) => {
      const res = await auth.login(username, password, targetRestaurantIdOrSlug)
      if (res.success) {
        if (res.role === "super") {
          // A super admin session never inherits the previous session's tenant:
          // activeRestaurantId lives in TenantProvider state, which survives
          // logout/login in the same tab, so without this reset a stale tenant
          // from a prior restaurant-admin session would render in
          // SupportModeBanner/AdminLayout until manually switched.
          tenant.switchRestaurant("")
          const isDeepRoute = window.location.pathname.toLowerCase().startsWith("/admin/") && window.location.pathname.toLowerCase() !== "/admin"
          if (!isDeepRoute) {
            ui.setAdminTab("restaurants")
          }
        } else if (res.role === "restaurant" && res.restaurantId) {
          tenant.switchRestaurant(res.restaurantId)
          const pathname = window.location.pathname.toLowerCase()
          const isDeepRoute = pathname.startsWith("/admin/") && pathname !== "/admin"
          // A deep route left over from a previous session (e.g. a super
          // admin was on /admin/audit) must not be honored for this role:
          // resolve it and fall back to dashboard when it is super-only,
          // otherwise the stale adminTab briefly renders GlobalModuleAccessDenied.
          const resolvedTab = isDeepRoute ? resolveRoute(pathname, tenant.restaurants).adminTab : undefined
          const isSuperOnlyDeepRoute = resolvedTab !== undefined && SUPER_ONLY_ADMIN_TABS.has(resolvedTab)
          if (!isDeepRoute || isSuperOnlyDeepRoute) {
            ui.setAdminTab("dashboard")
          }
        }
        ui.setActiveView("admin")
      }
      return res
    },
    [auth.login, tenant.switchRestaurant, tenant.restaurants, ui.setAdminTab, ui.setActiveView]
  )

  return useMemo<RestaurantContextType>(
    () => ({
    restaurants: tenant.restaurants,
    activeRestaurant: tenant.activeRestaurant,
    effectiveRestaurantId: tenant.effectiveRestaurantId,
    activeRestaurantId: tenant.activeRestaurantId,
    activeRestaurantSlug: tenant.activeRestaurantSlug,
    isSyncing: tenant.isSyncing,
    switchRestaurant: tenant.switchRestaurant,
    loadRestaurant: tenant.loadRestaurant,

    createRestaurant: tenant.createRestaurant,
    updateRestaurant: tenant.updateRestaurant,
    deleteRestaurant: tenant.deleteRestaurant,
    refreshRestaurants: tenant.refreshRestaurants,
    refreshStoreStatus: tenant.refreshStoreStatus,
    globalStats: tenant.globalStats,

    session: auth.session,
    setSession: auth.setSession,
    changePassword: auth.changePassword,
    login,
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
    updateOrder: orders.updateOrder,
    updateOrderStatus: orders.updateOrderStatus,
    updateOrderReceipt: orders.updateOrderReceipt,
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

    isLoadingOrders: orders.isLoadingOrders,
    isLoadingInventory: inventorySlice.isLoadingInventory,
    isLoadingCatalog: catalog.isLoadingCatalog,

    pendingOrdersCount: orders.pendingOrdersCount,
    refreshOrders: orders.refreshOrders,
    }),
    [ui, tenant, auth, catalog, inventorySlice, orders, login]
  )
}
