import React, { useState } from "react"
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
  Sparkles,
  Store,
  Menu as MenuIcon,
  X,
  ChevronRight,
  Building2,
  Boxes,
  LogOut,
  Crown,
  BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AdminSwitcher } from "@/features/superadmin"
import { useAppRouter } from "@/core/router/useAppRouter"

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
    simulateIncomingOrder,
    pendingOrdersCount,
    lowStockCount,
    session,
    logout,
  } = useRestaurant()

  const { navigateTo } = useAppRouter()

  const isMobileSidebarOpenState = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = isMobileSidebarOpenState
  const isDark = adminTheme === "dark"
  const isSuper = session.role === "super"

  // Strict role navigation: Super Admin only sees SaaS Directory; Restaurant Admin sees store operations
  const navItems = isSuper
    ? [
        {
          id: "restaurants" as const,
          label: "Directorio Global SaaS",
          icon: Building2,
          description: "Gestión de inquilinos y métricas globales",
          badge: "SaaS",
        },
      ]
    : [
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
          className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:translate-x-0 ${
            isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } ${
            isDark
              ? "border-slate-800 bg-[#0E1322] shadow-xl"
              : "border-slate-200/80 bg-white shadow-xs"
          }`}
        >
          {/* Sidebar Top: Logo & Branding */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b px-4 border-slate-200/60 dark:border-slate-800">
            {isSuper ? (
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-indigo-600 text-white font-bold text-xs shrink-0 shadow-md">
                  <Crown className="size-4" />
                </div>
                <div className="flex flex-col min-w-0 leading-tight">
                  <span className="font-bold tracking-tight text-xs truncate text-slate-900 dark:text-white">
                    SaaS Platform
                  </span>
                  <span className="text-[9px] font-bold tracking-wider uppercase text-amber-500">
                    Super Admin
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 min-w-0">
                {storeConfig.logoUrl ? (
                  <img
                    src={storeConfig.logoUrl}
                    alt=""
                    className="size-8 rounded-lg object-cover border border-indigo-500/30 shrink-0"
                  />
                ) : (
                  <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-xs shrink-0">
                    <Store className="size-4" />
                  </div>
                )}
                <div className="flex flex-col min-w-0 leading-tight">
                  <span className="font-bold tracking-tight text-xs truncate text-slate-900 dark:text-white">
                    {storeConfig.name}
                  </span>
                  <span className="text-[9px] font-semibold tracking-wider uppercase text-indigo-600 dark:text-indigo-400">
                    Panel Local
                  </span>
                </div>
              </div>
            )}

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Restaurant Switcher Widget (Only for local multi-tenant testing or when not in superadmin) */}
          {!isSuper && (
            <div className="p-2.5 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
              <AdminSwitcher />
            </div>
          )}

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1 p-2.5 overflow-y-auto" aria-label="Menú Lateral">
            <div className="px-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
              {isSuper ? "Administración SaaS" : "Módulos del Restaurante"}
            </div>

            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = adminTab === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    navigateTo(`/admin/${item.id}`)
                    setIsMobileSidebarOpen(false)
                  }}
                  className={`group flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-xs"
                      : isDark
                      ? "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`size-4 shrink-0 transition-colors ${
                        isActive
                          ? "text-white"
                          : isDark
                          ? "text-slate-400 group-hover:text-white"
                          : "text-slate-500 group-hover:text-slate-900"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`ml-1.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-indigo-500/15 text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-300"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Sidebar Footer Controls */}
          <div className="border-t p-2.5 space-y-2 border-slate-200/60 dark:border-slate-800 shrink-0">
            {/* Quick Switch to Public Storefront (Only for restaurant admins) */}
            {!isSuper && (
              <Button
                type="button"
                onClick={() => navigateTo(`/${activeRestaurant.slug}`)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2 text-xs font-bold text-white shadow-sm shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 cursor-pointer"
              >
                <Eye className="size-3.5" />
                <span>Ver Tienda</span>
              </Button>
            )}

            {/* Logout button */}
            {session.role !== "guest" && (
              <button
                type="button"
                onClick={() => {
                  logout()
                  navigateTo("/")
                }}
                className="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 transition-colors cursor-pointer"
              >
                <LogOut className="size-3" />
                <span>Cerrar Sesión</span>
              </button>
            )}
          </div>
        </aside>

        {/* ======================================================== */}
        {/* RIGHT MAIN CONTENT AREA                                   */}
        {/* ======================================================== */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Header Bar */}
          <header
            className={`sticky top-0 z-30 flex h-16 items-center justify-between border-b px-4 backdrop-blur-md transition-colors sm:px-6 lg:px-8 ${
              isDark
                ? "border-slate-800 bg-[#0B0F19]/90 shadow-sm"
                : "border-slate-200/80 bg-white/90 shadow-xs"
            }`}
          >
            {/* Left: Mobile Toggle & Breadcrumb */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="rounded-xl border p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
                aria-label="Abrir menú"
              >
                <MenuIcon className="size-5" />
              </button>

              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <span className="font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline">
                  {isSuper ? "SaaS Platform" : storeConfig.name}
                </span>
                <ChevronRight className="size-3.5 text-slate-400 hidden sm:inline" />
                <span className="font-bold text-slate-900 dark:text-white">
                  {activeItem.label}
                </span>
              </div>
            </div>

            {/* Right: Quick Action Controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Simulate order quick button (Only for restaurant kitchen testing) */}
              {!isSuper && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={simulateIncomingOrder}
                  className={`items-center gap-1.5 border-dashed font-medium text-xs rounded-xl transition-all ${
                    isDark
                      ? "border-amber-500/40 text-amber-300 hover:bg-amber-500/10 hover:border-amber-400"
                      : "border-amber-400 text-amber-800 hover:bg-amber-50 hover:border-amber-500"
                  }`}
                >
                  <Sparkles className="size-3.5 text-amber-500 animate-pulse" />
                  <span className="hidden sm:inline">Simular Pedido</span>
                  <span className="sm:hidden">Simular</span>
                </Button>
              )}

              {/* Sound notification toggle icon (Only for restaurant kitchens) */}
              {!isSuper && (
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

              {/* View Storefront button on top bar (Only for restaurant admin) */}
              {!isSuper && (
                <Button
                  type="button"
                  onClick={() => navigateTo(`/${activeRestaurant.slug}`)}
                  className="hidden md:flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-xs font-semibold text-white shadow-xs hover:from-orange-600 hover:to-amber-600 cursor-pointer"
                >
                  <Eye className="size-3.5" />
                  <span>Tienda Pública</span>
                </Button>
              )}
            </div>
          </header>

          {/* Content Body */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
