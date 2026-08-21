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
  LogOut,
  Crown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AdminSwitcher } from "@/features/superadmin"

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const {
    storeConfig,
    setActiveView,
    adminTab,
    setAdminTab,
    adminTheme,
    toggleAdminTheme,
    soundEnabled,
    setSoundEnabled,
    simulateIncomingOrder,
    pendingOrdersCount,
    session,
    logout,
  } = useRestaurant()

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const isDark = adminTheme === "dark"
  const isSuper = session.role === "super"

  const navItems = [
    ...(isSuper
      ? [
          {
            id: "restaurants" as const,
            label: "Directorio Global",
            icon: Building2,
            description: "Gestión SaaS de locales",
            badge: "Super Admin",
          },
        ]
      : []),
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
      id: "customers" as const,
      label: "Clientes CRM",
      icon: Users,
      description: "Base de datos y fidelización",
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
          className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
            isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } ${
            isDark
              ? "border-slate-800 bg-[#0E1322] shadow-xl"
              : "border-slate-200/80 bg-white shadow-xs"
          }`}
        >
          {/* Sidebar Top: Logo & Branding */}
          <div className="flex h-16 items-center justify-between border-b px-5 border-slate-200/60 dark:border-slate-800">
            <div className="flex items-center gap-3">
              {storeConfig.logoUrl ? (
                <img
                  src={storeConfig.logoUrl}
                  alt=""
                  className="size-9 rounded-xl object-cover border border-indigo-500/30 shadow-xs"
                />
              ) : (
                <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/20">
                  <Store className="size-4" />
                </div>
              )}
              <div className="flex flex-col leading-tight truncate">
                <span className="font-bold tracking-tight text-sm truncate text-slate-900 dark:text-white">
                  {storeConfig.name}
                </span>
                <span className="text-[10px] font-semibold tracking-wider uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  {isSuper && <Crown className="size-2.5" />}
                  <span>{isSuper ? "Super Admin" : "Panel Local"}</span>
                </span>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Restaurant Switcher Widget (Multi-Tenant) */}
          <div className="p-3 pb-1 border-b border-slate-100 dark:border-slate-800/60">
            <AdminSwitcher />
          </div>

          {/* Restaurant Status Widget */}
          <div className="p-3 pb-1">
            <div
              className={`flex items-center justify-between rounded-xl p-2.5 text-xs ${
                isDark ? "bg-slate-900 border border-slate-800" : "bg-slate-50 border border-slate-200/60"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Tienda Abierta
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {storeConfig.estimatedDeliveryTime}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1.5 px-3 py-2 overflow-y-auto" aria-label="Menú Lateral">
            <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
              Módulos del Sistema
            </div>

            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = adminTab === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setAdminTab(item.id)
                    setIsMobileSidebarOpen(false)
                  }}
                  className={`group relative flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-bold"
                      : isDark
                      ? "text-slate-200 hover:bg-slate-800 hover:text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon
                      className={`size-4.5 shrink-0 transition-transform group-hover:scale-110 ${
                        isActive ? "text-white" : isDark ? "text-slate-300" : "text-slate-500"
                      }`}
                    />
                    <div className="flex flex-col text-left truncate leading-tight">
                      <span className="truncate">{item.label}</span>
                      <span
                        className={`text-[10px] font-normal truncate ${
                          isActive
                            ? "text-indigo-100"
                            : isDark
                            ? "text-slate-400"
                            : "text-slate-500"
                        }`}
                      >
                        {item.description}
                      </span>
                    </div>
                  </div>

                  {item.badge && (
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold shrink-0 ${
                        isActive
                          ? "bg-white/20 text-white"
                          : typeof item.badge === "number"
                          ? "bg-amber-500 text-white animate-pulse"
                          : "bg-indigo-500/20 text-indigo-600 dark:text-indigo-300"
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
          <div className="border-t p-3.5 space-y-2.5 border-slate-200/60 dark:border-slate-800">
            {/* Quick Switch to Public Storefront */}
            <Button
              type="button"
              onClick={() => setActiveView("store")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600"
            >
              <Eye className="size-4" />
              <span>Ver Tienda de Ventas</span>
            </Button>

            {/* Dark Mode & Sound Toggles in Footer */}
            <div className="flex items-center justify-between rounded-xl border p-1.5 border-slate-200/60 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900">
              <button
                type="button"
                onClick={toggleAdminTheme}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all hover:bg-white hover:shadow-xs dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                title={`Cambiar a modo ${isDark ? "claro" : "oscuro"}`}
              >
                {isDark ? (
                  <>
                    <Sun className="size-3.5 text-amber-400" />
                    <span>Claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="size-3.5 text-indigo-600" />
                    <span>Oscuro</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all hover:bg-white hover:shadow-xs dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                title={soundEnabled ? "Silenciar alertas" : "Activar sonido"}
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="size-3.5 text-emerald-500" />
                    <span>Sonido</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="size-3.5 text-slate-400" />
                    <span>Mudo</span>
                  </>
                )}
              </button>
            </div>

            {/* Logout button */}
            {session.role !== "guest" && (
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1 text-xs font-semibold text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
              >
                <LogOut className="size-3.5" />
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
                  {storeConfig.name}
                </span>
                <ChevronRight className="size-3.5 text-slate-400 hidden sm:inline" />
                <span className="font-bold text-slate-900 dark:text-white">
                  {activeItem.label}
                </span>
              </div>
            </div>

            {/* Right: Quick Action Controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Simulate order quick button */}
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

              {/* Sound notification toggle icon */}
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

              {/* View Storefront button on top bar */}
              <Button
                type="button"
                onClick={() => setActiveView("store")}
                className="hidden md:flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-xs font-semibold text-white shadow-xs hover:from-orange-600 hover:to-amber-600"
              >
                <Eye className="size-3.5" />
                <span>Tienda Pública</span>
              </Button>
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
