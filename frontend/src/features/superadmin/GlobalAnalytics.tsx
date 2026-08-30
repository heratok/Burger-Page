import React, { useMemo, useState } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Store,
  ArrowUpRight,
  PieChart,
  BarChart3,
  CreditCard,
  Banknote,
  Eye,
  Sliders,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { useAppRouter } from "@/core/router/useAppRouter"
import { formatCurrency } from "@/lib/utils"

export const GlobalAnalytics: React.FC = () => {
  const { restaurants, orders, adminTheme, switchRestaurant } = useRestaurant()
  const { navigateTo } = useAppRouter()
  const [period, setPeriod] = useState<string>("ALL")

  const isDark = adminTheme === "dark"

  // Aggregate metrics across all restaurants
  const stats = useMemo(() => {
    let totalRevenue = 0
    let totalOrders = 0
    let totalCash = 0
    let totalTransfer = 0

    // Restaurant breakdown
    const breakdown = restaurants.map((r) => {
      // Calculate revenue from mock data in config or orders
      const tenantOrders = orders.filter((o) => o.restaurantId === r.id || (!o.restaurantId && r.id === "burger-craft"))
      const ordersCount = r.metrics?.totalOrders || tenantOrders.length || 0
      const revenue = r.metrics?.revenue || tenantOrders.reduce((sum, o) => sum + (o.total || 0), 0) || 0

      totalRevenue += revenue
      totalOrders += ordersCount

      return {
        id: r.id,
        name: r.config.name,
        slug: r.slug,
        logoUrl: r.config.logoUrl,
        revenue,
        ordersCount,
        category: r.config.category || "Gastronomía",
        status: r.status,
      }
    })

    // Sort by revenue descending
    breakdown.sort((a, b) => b.revenue - a.revenue)

    const avgTicket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0
    const activeCount = restaurants.filter((r) => r.status === "active").length

    return {
      totalRevenue,
      totalOrders,
      avgTicket,
      activeCount,
      totalTenants: restaurants.length,
      breakdown,
    }
  }, [restaurants, orders])

  const handleManage = (restaurantId: string) => {
    switchRestaurant(restaurantId)
    navigateTo("/admin/dashboard")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <BarChart3 className="size-3.5" />
            <span>Métricas & Business Intelligence</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl text-slate-900 dark:text-white">
            Métricas & Rendimiento Global SaaS
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Consolidado financiero, volumen de transacciones y comparativa de ingresos de todos los locales.
          </p>
        </div>

        <div className="w-44 self-start sm:self-auto">
          <Select
            size="md"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            options={[
              { value: "ALL", label: "Histórico Completo" },
              { value: "THIS_MONTH", label: "Este Mes" },
              { value: "THIS_WEEK", label: "Esta Semana" },
            ]}
          />
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <div className={`rounded-2xl border p-5 shadow-xs ${isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Facturación Consolidada</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <DollarSign className="size-4.5" />
            </div>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {formatCurrency(stats.totalRevenue)}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-500 font-semibold">
            <TrendingUp className="size-3.5" />
            <span>100% de locales en línea</span>
          </div>
        </div>

        {/* Total Orders */}
        <div className={`rounded-2xl border p-5 shadow-xs ${isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Órdenes de Plataforma</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              <ShoppingBag className="size-4.5" />
            </div>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {stats.totalOrders}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Pedidos registrados en cocina y delivery
          </div>
        </div>

        {/* Active Tenants */}
        <div className={`rounded-2xl border p-5 shadow-xs ${isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Locales Activos</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Store className="size-4.5" />
            </div>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-black text-amber-500">
            {stats.activeCount} <span className="text-sm font-normal text-slate-400">/ {stats.totalTenants}</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Franquicias operando activamente
          </div>
        </div>

        {/* Average Ticket */}
        <div className={`rounded-2xl border p-5 shadow-xs ${isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Ticket Promedio Global</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500 border border-violet-500/20">
              <TrendingUp className="size-4.5" />
            </div>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {formatCurrency(stats.avgTicket)}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Gasto medio por cliente en la plataforma
          </div>
        </div>
      </div>

      {/* Restaurant Performance Ranking Table */}
      <div className={`overflow-hidden rounded-2xl border shadow-xs ${isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"}`}>
        <div className="border-b p-4 sm:p-5 border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Ranking de Restaurantes por Facturación
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Participación porcentual y volumen de ventas generado por cada local.
            </p>
          </div>
          <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            {stats.breakdown.length} restaurantes
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`border-b text-[11px] font-bold uppercase tracking-wider ${isDark ? "border-slate-800 bg-slate-900/60 text-slate-400" : "border-slate-200 bg-slate-50/80 text-slate-500"}`}>
              <tr>
                <th className="px-4 py-3">Restaurante</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Facturación</th>
                <th className="px-4 py-3">Participación</th>
                <th className="px-4 py-3">Pedidos</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-slate-800/60 text-slate-200" : "divide-slate-100 text-slate-700"}`}>
              {stats.breakdown.map((r, idx) => {
                const percentage = stats.totalRevenue > 0 ? Math.round((r.revenue / stats.totalRevenue) * 100) : 0

                return (
                  <tr key={r.id} className={`transition-colors ${isDark ? "hover:bg-slate-800/40" : "hover:bg-slate-50/80"}`}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex size-6 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-[11px] text-slate-500">
                          #{idx + 1}
                        </span>
                        {r.logoUrl ? (
                          <img
                            src={r.logoUrl}
                            alt=""
                            className="size-8 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-700 shadow-xs"
                          />
                        ) : (
                          <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                            <Store className="size-4" />
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{r.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">/{r.slug}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        r.status === "active"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-amber-500/10 text-amber-500"
                      }`}>
                        <span className={`size-1.5 rounded-full ${r.status === "active" ? "bg-emerald-500" : "bg-amber-500"}`} />
                        <span>{r.status === "active" ? "Operando" : "Pausado"}</span>
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white text-sm">
                      {formatCurrency(r.revenue)}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(percentage, 5)}%` }}
                          />
                        </div>
                        <span className="font-bold text-xs text-slate-600 dark:text-slate-300">{percentage}%</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 font-semibold text-slate-800 dark:text-slate-200">
                      {r.ordersCount} pedidos
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <Button
                        size="sm"
                        onClick={() => handleManage(r.id)}
                        className="gap-1.5 rounded-xl bg-indigo-600 font-bold text-white shadow-xs hover:bg-indigo-700 cursor-pointer"
                      >
                        <Sliders className="size-3.5" />
                        <span>Administrar</span>
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
