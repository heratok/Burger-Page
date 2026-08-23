import React from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import { DollarSign, ShoppingBag, Store, Users, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface GlobalPlatformSummaryProps {
  onOpenCreateModal: () => void
}

export const GlobalPlatformSummary: React.FC<GlobalPlatformSummaryProps> = ({ onOpenCreateModal }) => {
  const { globalStats, adminTheme } = useRestaurant()
  const isDark = adminTheme === "dark"

  const cards = [
    {
      title: "Facturación Global Plataforma",
      value: `$${globalStats.totalRevenue.toLocaleString()}`,
      sub: "Ventas acumuladas de todos los restaurantes",
      icon: <DollarSign className="size-5 text-emerald-500" />,
      badge: "+24.8% este mes",
      badgeColor: "text-emerald-500 bg-emerald-500/10",
    },
    {
      title: "Órdenes Procesadas",
      value: globalStats.totalOrders.toString(),
      sub: "Total de pedidos registrados en red",
      icon: <ShoppingBag className="size-5 text-indigo-500" />,
      badge: "100% en tiempo real",
      badgeColor: "text-indigo-500 bg-indigo-500/10",
    },
    {
      title: "Restaurantes Activos",
      value: `${globalStats.activeRestaurants} / ${globalStats.totalRestaurants}`,
      sub: "Locales gastronómicos operando",
      icon: <Store className="size-5 text-amber-500" />,
      badge: "SaaS Multi-Tenant",
      badgeColor: "text-amber-500 bg-amber-500/10",
    },
    {
      title: "Clientes en Base de Datos",
      value: globalStats.totalCustomers.toString(),
      sub: "Contactos consolidados para WhatsApp",
      icon: <Users className="size-5 text-purple-500" />,
      badge: "Fidelización activa",
      badgeColor: "text-purple-500 bg-purple-500/10",
    },
  ]

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div
        className={`flex flex-col gap-4 rounded-2xl border p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between ${
          isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Super Administrador &middot; SaaS Hub
            </span>
          </div>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900 dark:text-white">
            Directorio Global de Restaurantes
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Administra franquicias, inquilinos, tiendas públicas y sus configuraciones individuales.
          </p>
        </div>

        <Button
          type="button"
          onClick={onOpenCreateModal}
          className="gap-2 rounded-xl bg-indigo-600 font-bold text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-700"
        >
          <Plus className="size-4" />
          <span>Nuevo Restaurante</span>
        </Button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <div
            key={i}
            className={`rounded-2xl border p-4.5 shadow-xs transition-colors ${
              isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {c.title}
              </span>
              <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                {c.icon}
              </div>
            </div>
            <div className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {c.value}
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2 text-[11px]">
              <span className="text-slate-400 truncate max-w-[150px]">{c.sub}</span>
              <span className={`rounded-full px-2 py-0.5 font-bold ${c.badgeColor}`}>
                {c.badge}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
