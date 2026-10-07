import React, { useCallback, useEffect, useMemo } from "react"
import { QueryClientProvider, useQueryClient, type QueryClient } from "@tanstack/react-query"
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
import { TenantProvider, useTenant } from "./slices/TenantContext"
import { useGlobalStats, type GlobalPlatformStats } from "./slices/directoryCaches"
import { AuthProvider, useAuth } from "./slices/AuthContext"
import { CatalogProvider, useCatalog } from "./slices/CatalogContext"
import { OrderProvider, useOrders, type PlacedOrder } from "./slices/OrderContext"
import { InventoryProvider, useInventory } from "./slices/InventoryContext"
import type { InventoryItem, Supplier } from "@/types/restaurant"
import type { CreateCustomerInput } from "@burger-page/contracts"
import type { TenantRepository } from "@/core/storage/TenantRepository"
import { defaultTenantRepository } from "@/core/storage/TenantRepository"
import { appQueryClient } from "@/core/query/queryClient"

import { clearPersistedQueries, subscribePersistedQueries } from "@/core/query/persistence"

import { resolveRoute, isTabAllowed, getFirstAllowedTab } from "@/core/router/useAppRouter"
import type { Permission } from "@burger-page/contracts"

/**
 * Where a freshly authenticated session lands. A deep /admin/* route is kept
 * only when the new role may open it; otherwise the role's home is used.
 */
function resolveLandingPath(
  pathname: string,
  role: "super" | "restaurant" | "staff" | "guest",
  can?: (permission: Permission) => boolean
): string {
  const home =
    role === "super"
      ? "/admin/restaurants"
      : role === "restaurant"
      ? "/admin/dashboard"
      : `/admin/${getFirstAllowedTab(can, role)}`
  const lower = pathname.toLowerCase().replace(/\/+$/, "")
  if (!lower.startsWith("/admin/")) return home
  const rawTab = resolveRoute(lower, []).adminTab
  if (!rawTab) return home
  if (!isTabAllowed(rawTab, can, role)) return home
  return pathname
}


// Export individual slice hooks for fine-grained subscriptions
export { useUi } from "./slices/UiContext"
export { useTenant } from "./slices/TenantContext"
export { useAuth } from "./slices/AuthContext"
export { useCatalog } from "./slices/CatalogContext"
export { useOrders } from "./slices/OrderContext"
export { useInventory } from "./slices/InventoryContext"
export { useGlobalStats, useOrderBoardsByTenant, ordersOf, useCatalogSizesByTenant } from "./slices/directoryCaches"

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
  permissions: Permission[]
  can: (permission: Permission) => boolean
  login: (
    username: string,
    password: string,
    targetRestaurantIdOrSlug?: string
  ) => Promise<{
    success: boolean
    role: "super" | "restaurant" | "staff" | null
    restaurantId?: string
    error?: string
    /** Set on success: the path the new session must navigate to. */
    landingPath?: string
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
  createCustomer: (data: CreateCustomerInput) => Promise<Customer | null>
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void> | void
  deleteCustomer: (id: string) => Promise<void> | void

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
  queryClient?: QueryClient
}> = ({ children, repository, queryClient = appQueryClient }) => {
  // Only the public storefront (guest restaurant record and menu) is
  // persisted, so a reload while offline still shows the last menu. It is
  // saved on every cache change (TenantProvider restores it before its first
  // read).
  useEffect(() => subscribePersistedQueries(queryClient), [queryClient])
  return (
    <QueryClientProvider client={queryClient}>
      <UiProvider>
        <SessionScopedAuthProvider repository={repository}>
          <TenantProvider repository={repository}>
            <CatalogProvider>
              <InventoryProvider>
                <OrderProvider>{children}</OrderProvider>
              </InventoryProvider>
            </CatalogProvider>
          </TenantProvider>
        </SessionScopedAuthProvider>
      </UiProvider>
    </QueryClientProvider>
  )
}

/**
 * Binds the session lifecycle to session-scoped UI state. Navigation belongs
 * to the session that produced it: it is reset on every session end (logout
 * and expiry) and rebuilt for the new role atomically with every session start.
 */
const SessionScopedAuthProvider: React.FC<{
  children: React.ReactNode
  repository?: TenantRepository
}> = ({ children, repository }) => {
  const { setAdminTab } = useUi()
  const queryClient = useQueryClient()

  const onLogin = useCallback(
    (role: "super" | "restaurant" | "staff") => {
      const landingPath = resolveLandingPath(window.location.pathname, role)
      setAdminTab(resolveRoute(landingPath, []).adminTab ?? getFirstAllowedTab(undefined, role))
    },
    [setAdminTab]
  )


  const onLogout = useCallback(() => {
    // C3: purge the whole-tenant envelope + persisted active restaurant.
    const tenantRepository = repository ?? defaultTenantRepository
    tenantRepository.purgeTenantData()
    // Server-state cache belongs to the ended session: never serve it to the
    // next role, in memory or persisted.
    queryClient.clear()
    void clearPersistedQueries()
    setAdminTab("dashboard")
  }, [repository, setAdminTab, queryClient])

  // Reads made while the password change was pending were refused with 403:
  // refetch the active queries now that the session token is fully privileged.
  const onPasswordChanged = useCallback(() => {
    void queryClient.invalidateQueries()
  }, [queryClient])

  return (
    <AuthProvider onLogin={onLogin} onLogout={onLogout} onPasswordChanged={onPasswordChanged}>
      {children}
    </AuthProvider>
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
  const globalStats = useGlobalStats()

  const login = useCallback(
    async (username: string, password: string, targetRestaurantIdOrSlug?: string) => {
      const res = await auth.login(username, password, targetRestaurantIdOrSlug)
      if (!res.success) return res

      if (res.role === "super") {
        // A super admin session never inherits the previous session's tenant:
        // activeRestaurantId lives in TenantProvider state, which survives
        // logout/login in the same tab.
        tenant.switchRestaurant("")
      } else if ((res.role === "restaurant" || res.role === "staff") && res.restaurantId) {
        tenant.switchRestaurant(res.restaurantId)
      }

      // The landing path and the admin tab are derived together from the NEW
      // role, so they can never disagree. Callers must navigate to landingPath:
      // leaving a previous session's URL in place lets the router re-resolve it
      // (e.g. /admin/audit) and render a module this role cannot access.
      // The admin tab was already set for this landing path by
      // SessionScopedAuthProvider, in the same render as the session write.
      const landingPath = resolveLandingPath(window.location.pathname, res.role ?? "guest", auth.can)
      ui.setActiveView("admin")
      return { ...res, landingPath }
    },
    [auth, tenant, ui]
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
    globalStats,

    session: auth.session,
    setSession: auth.setSession,
    permissions: auth.permissions,
    can: auth.can,
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
    createCustomer: orders.createCustomer,
    updateCustomer: orders.updateCustomer,
    deleteCustomer: orders.deleteCustomer,

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
    [ui, tenant, auth, catalog, inventorySlice, orders, globalStats, login]
  )
}
