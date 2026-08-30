import React, { useState, Suspense } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBag,
  Users,
  Palette,
  Eye,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Store,
  Menu as MenuIcon,
  X,
  ChevronRight,
  Building2,
  Boxes,
  LogOut,
  Crown,
  BarChart3,
  Plus,
  ArrowLeft,
  UserPlus,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AdminSwitcher, CreateRestaurantModal, CreateUserModal } from "@/features/superadmin"
import { useAppRouter } from "@/core/router/useAppRouter"
import { AdminContentFallback } from "@/components/ui/LoadingFallbacks"
import { ManualSaleModal } from "./ManualSaleModal"

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const {
    storeConfig,
    activeRestaurant,
    adminTab,
    adminTheme,
    toggleAdminTheme,
    soundEnabled,
    setSoundEnabled,
    pendingOrdersCount,
    lowStockCount,
    session,
    logout,
  } = useRestaurant()

  const { navigateTo } = useAppRouter()

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isManualSaleOpen, setIsManualSaleOpen] = useState(false)
  const [isCreateRestaurantOpen, setIsCreateRestaurantOpen] = useState(false)
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("burger_page_sidebar_collapsed") === "true"
    } catch {
      return false
    }
  })

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem("burger_page_sidebar_collapsed", String(next))
      } catch {}
      return next
    })
  }

  const isDark = adminTheme === "dark"
  const isSuper = session.role === "super"
  const isSuperGlobalMode = isSuper && adminTab === "restaurants"
  const isSuperTenantMode = isSuper && adminTab !== "restaurants"

  // Global SaaS navigation items for platform-wide management
  const globalNavItems = [
    {
      id: "restaurants" as const,
      label: "Directorio Global SaaS",
      icon: Building2,
      description: "Gestión de inquilinos y métricas globales",
      badge: "SaaS",
    },
  ]

  // Local operational modules for tenant administration
  const restaurantNavItems = [
    {
      id: "dashboard" as const,
      label: "Dashboard",
      icon: LayoutDashboard,
      description: "Métricas y rendimiento",
      badge: undefined,
    },
    {
      id: "orders" as const,
      label: "Pedidos en Vivo",
      icon: ShoppingBag,
      description: "Flujo Kanban de cocina",
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
    },
    {
      id: "menu" as const,
      label: "Menú & Carta",
      icon: UtensilsCrossed,
      description: "Platos, stock y adiciones",
      badge: undefined,
    },
    {
      id: "inventory" as const,
      label: "Stock & Insumos",
      icon: Boxes,
      description: "Control de inventario y proveedores",
      badge: lowStockCount > 0 ? lowStockCount : undefined,
    },
    {
      id: "customers" as const,
      label: "Clientes CRM",
      icon: Users,
      description: "Base de datos y fidelización",
      badge: undefined,
    },
    {
      id: "reports" as const,
      label: "Reportes & Cierre",
      icon: BarChart3,
      description: "Cierre de caja y exportación de datos",
      badge: undefined,
    },
    {
      id: "customizer" as const,
      label: "Personalizador UI/UX",
      icon: Palette,
      description: "Diseño no-code de tienda",
      badge: "No-Code",
    },
  ]

  const navItems = isSuperGlobalMode ? globalNavItems : restaurantNavItems
  const activeItem = navItems.find((item) => item.id === adminTab) || navItems[0]

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        isDark ? "dark admin-dark bg-[#0B0F19] text-slate-100" : "admin-light bg-[#F8FAFC] text-slate-900"
      }`}
    >
      {/* Mobile Drawer Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div className="flex min-h-screen">
        {/* ======================================================== */}
        {/* DESKTOP & MOBILE SIDEBAR                                  */}
        {/* ======================================================== */}
        <aside
          role="complementary"
          aria-label="Sidebar de navegación"
          className={`fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r transition-all duration-300 ease-in-out lg:sticky lg:top-0 lg:translate-x-0 ${
            isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } ${
            isSidebarCollapsed ? "w-64 lg:w-20" : "w-64 lg:w-64"
          } ${
            isDark
              ? "border-slate-800 bg-[#0E1322] shadow-xl"
              : "border-slate-200/80 bg-white shadow-xs"
          }`}
        >
          {/* Sidebar Top: Logo & Branding (Cleanly centered when collapsed) */}
          <div
            className={`flex h-14 shrink-0 items-center border-b px-3.5 border-slate-200/60 dark:border-slate-800 ${
              isSidebarCollapsed ? "justify-center" : "justify-between"
            }`}
          >
            {isSuperGlobalMode ? (
              <div className={`flex items-center gap-2.5 min-w-0 ${isSidebarCollapsed ? "justify-center" : ""}`}>
                <div
                  title={isSidebarCollapsed ? "SaaS Platform (Super Admin)" : undefined}
                  className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-indigo-600 text-white font-bold text-xs shrink-0 shadow-md"
                >
                  <Crown className="size-4" />
                </div>
                {!isSidebarCollapsed && (
                  <div className="flex flex-col min-w-0 leading-tight">
                    <span className="font-bold tracking-tight text-xs truncate text-slate-900 dark:text-white">
                      SaaS Platform
                    </span>
                    <span className="text-[9px] font-bold tracking-wider uppercase text-amber-500">
                      Super Admin
                    </span>
                  </div>
                )}
              </div>
            ) : isSuperTenantMode ? (
              <div className={`flex items-center gap-2.5 min-w-0 ${isSidebarCollapsed ? "justify-center" : ""}`}>
                {storeConfig.logoUrl ? (
                  <img
                    src={storeConfig.logoUrl}
                    alt=""
                    title={isSidebarCollapsed ? `${storeConfig.name} (Super Admin)` : undefined}
                    className="size-8 rounded-lg object-cover border border-amber-500/40 shrink-0"
                  />
                ) : (
                  <div
                    title={isSidebarCollapsed ? `${storeConfig.name} (Super Admin)` : undefined}
                    className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-indigo-600 text-white font-bold text-xs shrink-0"
                  >
                    <Crown className="size-4" />
                  </div>
                )}
                {!isSidebarCollapsed && (
                  <div className="flex flex-col min-w-0 leading-tight">
                    <span className="font-bold tracking-tight text-xs truncate text-slate-900 dark:text-white">
                      {storeConfig.name}
                    </span>
                    <span className="text-[9px] font-bold tracking-wider uppercase text-amber-500">
                      👑 Super Admin
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className={`flex items-center gap-2.5 min-w-0 ${isSidebarCollapsed ? "justify-center" : ""}`}>
                {storeConfig.logoUrl ? (
                  <img
                    src={storeConfig.logoUrl}
                    alt=""
                    title={isSidebarCollapsed ? `${storeConfig.name} (Panel Local)` : undefined}
                    className="size-8 rounded-lg object-cover border border-indigo-500/30 shrink-0"
                  />
                ) : (
                  <div
                    title={isSidebarCollapsed ? `${storeConfig.name} (Panel Local)` : undefined}
                    className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-xs shrink-0"
                  >
                    <Store className="size-4" />
                  </div>
                )}
                {!isSidebarCollapsed && (
                  <div className="flex flex-col min-w-0 leading-tight">
                    <span className="font-bold tracking-tight text-xs truncate text-slate-900 dark:text-white">
                      {storeConfig.name}
                    </span>
                    <span className="text-[9px] font-semibold tracking-wider uppercase text-indigo-600 dark:text-indigo-400">
                      Panel Local
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Close Button (Only visible inside mobile drawer) */}
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Restaurant Switcher Widget */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
            <AdminSwitcher collapsed={isSidebarCollapsed} />
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1 p-2 overflow-y-auto" aria-label="Menú Lateral">
            {!isSidebarCollapsed && (
              <div className="px-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                {isSuperGlobalMode ? "Administración SaaS" : "Módulos del Restaurante"}
              </div>
            )}

            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = adminTab === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  aria-label={item.label}
                  onClick={() => {
                    navigateTo(`/admin/${item.id}`)
                    setIsMobileSidebarOpen(false)
                  }}
                  className={`group relative flex w-full items-center rounded-xl transition-all ${
                    isSidebarCollapsed
                      ? "justify-center p-2.5"
                      : "justify-between px-2.5 py-2 text-xs font-semibold"
                  } ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-xs"
                      : isDark
                      ? "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <div className={`flex items-center gap-2.5 ${isSidebarCollapsed ? "justify-center" : "truncate"}`}>
                    <Icon
                      className={`size-4 shrink-0 transition-colors ${
                        isActive
                          ? "text-white"
                          : isDark
                          ? "text-slate-400 group-hover:text-white"
                          : "text-slate-500 group-hover:text-slate-900"
                      }`}
                    />
                    {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {item.badge !== undefined && (
                    isSidebarCollapsed ? (
                      <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-slate-900" />
                    ) : (
                      <span
                        className={`ml-1.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-indigo-500/15 text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-300"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )
                  )}
                </button>
              )
            })}

            {/* Quick Actions in Sidebar for Super Admin in Global Mode */}
            {isSuperGlobalMode && (
              <div className="pt-3 space-y-1.5">
                {!isSidebarCollapsed && (
                  <div className="px-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Acciones Rápidas SaaS
                  </div>
                )}
                <button
                  type="button"
                  title="+ Nuevo Restaurante"
                  aria-label="+ Nuevo Restaurante"
                  onClick={() => {
                    setIsCreateRestaurantOpen(true)
                    setIsMobileSidebarOpen(false)
                  }}
                  className={`flex w-full items-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-all cursor-pointer font-bold ${
                    isSidebarCollapsed
                      ? "justify-center p-2.5"
                      : "gap-2 px-2.5 py-2 text-xs"
                  }`}
                >
                  <Plus className="size-4 shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">+ Nuevo Restaurante</span>}
                </button>
                <button
                  type="button"
                  title="+ Nuevo Usuario"
                  aria-label="+ Nuevo Usuario"
                  onClick={() => {
                    setIsCreateUserOpen(true)
                    setIsMobileSidebarOpen(false)
                  }}
                  className={`flex w-full items-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 transition-all cursor-pointer font-bold ${
                    isSidebarCollapsed
                      ? "justify-center p-2.5"
                      : "gap-2 px-2.5 py-2 text-xs"
                  }`}
                >
                  <UserPlus className="size-4 shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">+ Nuevo Usuario</span>}
                </button>
              </div>
            )}
          </nav>

          {/* Sidebar Footer Controls */}
          <div className="border-t p-2 space-y-1.5 border-slate-200/60 dark:border-slate-800 shrink-0">
            {/* Context Return Button for Super Admin managing a restaurant */}
            {isSuperTenantMode && (
              <button
                type="button"
                title="Volver al Panel Super Admin"
                aria-label="Volver al Panel Super Admin"
                onClick={() => {
                  navigateTo("/admin/restaurants")
                  setIsMobileSidebarOpen(false)
                }}
                className={`flex w-full items-center rounded-xl border border-amber-500/40 bg-amber-500/10 font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-all shadow-xs cursor-pointer ${
                  isSidebarCollapsed
                    ? "justify-center p-2.5"
                    : "justify-center gap-1.5 py-2 text-xs"
                }`}
              >
                <ArrowLeft className="size-4 shrink-0" />
                {!isSidebarCollapsed && <span className="truncate">Volver al Panel Super Admin</span>}
              </button>
            )}

            {/* Quick Switch to Public Storefront */}
            {!isSuperGlobalMode && (
              <Button
                type="button"
                title="Ver Tienda Pública"
                aria-label="Ver Tienda Pública"
                onClick={() => navigateTo(`/${activeRestaurant.slug}`)}
                className={`flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 font-bold text-white shadow-sm shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 cursor-pointer ${
                  isSidebarCollapsed ? "p-2.5 h-10" : "gap-1.5 py-2 text-xs"
                }`}
              >
                <Eye className="size-4 shrink-0" />
                {!isSidebarCollapsed && <span>Ver Tienda</span>}
              </Button>
            )}

            {/* Logout button */}
            {session.role !== "guest" && (
              <button
                type="button"
                title="Cerrar Sesión"
                aria-label="Cerrar Sesión"
                onClick={() => {
                  logout()
                  navigateTo("/")
                }}
                className={`flex w-full items-center justify-center rounded-lg text-[11px] font-semibold text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 transition-colors cursor-pointer ${
                  isSidebarCollapsed ? "p-2 h-9" : "gap-1 py-1.5"
                }`}
              >
                <LogOut className="size-3.5 shrink-0" />
                {!isSidebarCollapsed && <span>Cerrar Sesión</span>}
              </button>
            )}
          </div>
        </aside>

        {/* ======================================================== */}
        {/* RIGHT MAIN CONTENT AREA                                   */}
        {/* ======================================================== */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {/* Top Header Bar */}
          <header
            className={`sticky top-0 z-30 flex h-16 items-center justify-between border-b px-4 backdrop-blur-md transition-colors sm:px-6 lg:px-8 ${
              isDark
                ? "border-slate-800 bg-[#0B0F19]/90 shadow-sm"
                : "border-slate-200/80 bg-white/90 shadow-xs"
            }`}
          >
            {/* Left: Mobile Drawer Trigger & Desktop Sidebar Toggle & Breadcrumb */}
            <div className="flex items-center gap-3 min-w-0">
              {/* Mobile Drawer Open Toggle */}
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="rounded-xl border p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden cursor-pointer"
                aria-label="Abrir menú"
              >
                <MenuIcon className="size-5" />
              </button>

              {/* Single Desktop Sidebar Collapse/Expand Toggle Button */}
              <button
                type="button"
                onClick={toggleSidebarCollapse}
                aria-label={isSidebarCollapsed ? "Expandir menú" : "Contraer menú"}
                title={isSidebarCollapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
                className="hidden lg:inline-flex items-center justify-center rounded-xl border p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="size-4.5" />
                ) : (
                  <PanelLeftClose className="size-4.5" />
                )}
              </button>

              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
                <span className="font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline truncate">
                  {isSuperGlobalMode ? "SaaS Platform" : storeConfig.name}
                </span>
                <ChevronRight className="size-3.5 text-slate-400 hidden sm:inline shrink-0" />
                <span className="font-bold text-slate-900 dark:text-white truncate">
                  {activeItem.label}
                </span>
              </div>
            </div>

            {/* Right: Quick Action Controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Context Banner & Return button for Super Admin in Tenant Mode */}
              {isSuperTenantMode && (
                <div className="flex items-center gap-2">
                  <div className="hidden xl:flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300 font-semibold shadow-xs">
                    <Crown className="size-3.5 text-amber-500 shrink-0" />
                    <span>Modo Super Admin: <strong>{activeRestaurant.config.name}</strong></span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigateTo("/admin/restaurants")}
                    className="flex items-center gap-1.5 rounded-xl border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 font-bold text-xs cursor-pointer shadow-xs"
                  >
                    <ArrowLeft className="size-3.5" />
                    <span className="hidden sm:inline">Volver al Panel Super Admin</span>
                    <span className="sm:hidden">Volver a SaaS</span>
                  </Button>
                </div>
              )}

              {/* Sound notification toggle icon (Only for restaurant kitchens) */}
              {!isSuperGlobalMode && (
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? "Silenciar alertas" : "Activar sonido"}
                  className={`hidden sm:inline-flex size-9 items-center justify-center rounded-xl border transition-all ${
                    isDark
                      ? "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {soundEnabled ? (
                    <Volume2 className="size-4 text-emerald-500" />
                  ) : (
                    <VolumeX className="size-4 text-slate-400" />
                  )}
                </button>
              )}

              {/* Light / Dark Mode Toggle Button */}
              <button
                type="button"
                onClick={toggleAdminTheme}
                title={`Cambiar a modo ${isDark ? "claro" : "oscuro"}`}
                className={`inline-flex size-9 items-center justify-center rounded-xl border transition-all ${
                  isDark
                    ? "border-slate-800 bg-slate-900 text-amber-400 hover:bg-slate-800"
                    : "border-slate-200 bg-slate-50 text-indigo-600 hover:bg-slate-100"
                }`}
              >
                {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>

              {/* New Manual Sale POS Button (When inside a restaurant) */}
              {!isSuperGlobalMode && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsManualSaleOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span className="hidden sm:inline">Nueva Venta</span>
                  <span className="sm:hidden">Venta</span>
                </Button>
              )}

              {/* View Storefront button on top bar (When inside a restaurant) */}
              {!isSuperGlobalMode && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigateTo(`/${activeRestaurant.slug}`)}
                  className={`hidden md:flex items-center gap-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                    isDark
                      ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Eye className="size-3.5" />
                  <span>Tienda Pública</span>
                </Button>
              )}
            </div>
          </header>

          {/* Content Body */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            <Suspense fallback={<AdminContentFallback isDark={isDark} />}>
              {children}
            </Suspense>
          </main>
        </div>
      </div>

      {/* Manual Sale POS Modal */}
      {!isSuperGlobalMode && (
        <ManualSaleModal
          isOpen={isManualSaleOpen}
          onClose={() => setIsManualSaleOpen(false)}
        />
      )}

      {/* Super Admin Quick Creation Modals */}
      {isSuper && (
        <>
          <CreateRestaurantModal
            isOpen={isCreateRestaurantOpen}
            onClose={() => setIsCreateRestaurantOpen(false)}
          />
          <CreateUserModal
            isOpen={isCreateUserOpen}
            onClose={() => setIsCreateUserOpen(false)}
          />
        </>
      )}
    </div>
  )
}
