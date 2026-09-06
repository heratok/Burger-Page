import React, { useState, useMemo } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Users,
  ChevronRight,
  Flame,
  Plus,
} from "lucide-react"
import { OrderStatusBadge } from "@/components/ui/status-badge"
import { StatCard } from "@/components/ui/stat-card"
import { MetricCardsSkeleton } from "@/components/ui/Skeletons"
import { Button } from "@/components/ui/button"
import { useAppRouter } from "@/core/router/useAppRouter"
import { ManualSaleModal } from "./ManualSaleModal"
import { formatCurrency } from "@/lib/utils"

export const DashboardOverview: React.FC = () => {
  const {
    orders,
    products,
    customers,
    storeConfig,
    adminTheme,
    isLoadingOrders,
    updateOrderStatus,
  } = useRestaurant()

  const { navigateTo } = useAppRouter()
  const [isManualSaleOpen, setIsManualSaleOpen] = useState(false)

  // Calculate Metrics
  const metrics = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== "cancelled")
    const totalSales = validOrders.reduce((sum, o) => sum + o.finalTotal, 0)
    const activeOrders = orders.filter(
      (o) => o.status === "pending" || o.status === "cooking" || o.status === "delivering"
    )
    const avgTicket = validOrders.length > 0 ? Math.round(totalSales / validOrders.length) : 0
    const vipCount = customers.filter((c) => c.loyaltyTier === "vip" || c.loyaltyTier === "gold").length

    const ordersLast24h = orders.filter((o) => {
      if (!o.createdAt) return false
      const d = new Date(o.createdAt).getTime()
      return !isNaN(d) && Date.now() - d <= 24 * 60 * 60 * 1000
    }).length

    const repeatCustomers = customers.filter((c) => c.totalOrders > 1).length
    const repeatRate = customers.length > 0 ? Math.round((repeatCustomers / customers.length) * 100) : 0

    return {
      totalSales,
      validOrdersCount: validOrders.length,
      totalOrdersCount: orders.length,
      activeOrdersCount: activeOrders.length,
      ordersLast24h,
      avgTicket,
      totalCustomers: customers.length,
      vipCount,
      repeatRate,
    }
  }, [orders, customers])

  // Top Products Ranking
  const topProducts = useMemo(() => {
    const counts: Record<string, { name: string; count: number; revenue: number; src?: string }> = {}

    orders
      .filter((o) => o.status !== "cancelled")
      .forEach((ord) => {
        ord.items.forEach((item) => {
          if (!counts[item.name]) {
            counts[item.name] = {
              name: item.name,
              count: 0,
              revenue: 0,
              src: item.src,
            }
          }
          counts[item.name].count += item.cantidad
          counts[item.name].revenue += item.total
        })
      })

    const sorted = Object.values(counts).sort((a, b) => b.count - a.count)
    return sorted.slice(0, 4)
  }, [orders])

  const maxProductCount = topProducts.length > 0 ? Math.max(...topProducts.map((p) => p.count), 1) : 1

  // 7-day Sales Bar dynamic calculation
  const chartDays = useMemo(() => {
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    const now = new Date()
    const daysWindow: { dateKey: string; day: string; amount: number }[] = []

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, "0")
      const day = String(d.getDate()).padStart(2, "0")
      const dateKey = `${year}-${month}-${day}`
      const dayLabel = i === 0 ? "Hoy" : dayNames[d.getDay()]
      daysWindow.push({ dateKey, day: dayLabel, amount: 0 })
    }

    orders
      .filter((o) => o.status !== "cancelled")
      .forEach((ord) => {
        if (!ord.createdAt) return
        const ordDate = new Date(ord.createdAt)
        if (isNaN(ordDate.getTime())) return
        const year = ordDate.getFullYear()
        const month = String(ordDate.getMonth() + 1).padStart(2, "0")
        const day = String(ordDate.getDate()).padStart(2, "0")
        const ordDateKey = `${year}-${month}-${day}`

        const match = daysWindow.find((dw) => dw.dateKey === ordDateKey)
        if (match) {
          match.amount += ord.finalTotal
        }
      })

    const maxAmount = Math.max(...daysWindow.map((d) => d.amount), 0)
    const hasData = maxAmount > 0

    return {
      hasData,
      items: daysWindow.map((d) => ({
        day: d.day,
        amount: d.amount,
        height: hasData ? Math.max(Math.round((d.amount / maxAmount) * 100), 4) : 0,
      })),
    }
  }, [orders])

  const isDark = adminTheme === "dark"

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div
        className={`relative overflow-hidden rounded-2xl border p-6 shadow-sm transition-all ${
          isDark
            ? "border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900"
            : "border-slate-200/80 bg-gradient-to-r from-indigo-50/70 via-violet-50/40 to-white"
        }`}
      >
        <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Sistema en Línea &middot; Recibiendo Pedidos
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl text-slate-900 dark:text-white">
              Panel de Control — {storeConfig.name}
            </h1>
            <p className={`mt-1 text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              {metrics.activeOrdersCount > 0
                ? `Tienes ${metrics.activeOrdersCount} pedido(s) en curso en la cocina y despacho.`
                : "Todo al día. Listo para nuevos pedidos desde la tienda pública."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => setIsManualSaleOpen(true)}
              className="gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 font-bold text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Nueva Venta</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigateTo("/admin/orders")}
              className={`rounded-xl cursor-pointer ${
                isDark
                  ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>Ver Kanban</span>
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      {isLoadingOrders && orders.length === 0 ? (
        <MetricCardsSkeleton count={4} isDark={isDark} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Sales */}
          <StatCard
            title="Ventas Totales"
          value={formatCurrency(metrics.totalSales)}
          variant="success"
          icon={<DollarSign className="size-5" />}
          isDark={isDark}
          description={
            metrics.validOrdersCount > 0 ? (
              <>
                <span className="font-semibold">{metrics.validOrdersCount}</span>
                <span className={isDark ? "text-slate-400" : "text-slate-500"}>órdenes completadas</span>
              </>
            ) : (
              <span className={isDark ? "text-slate-400" : "text-slate-500"}>Sin órdenes completadas aún</span>
            )
          }
        />

        {/* Active & Total Orders */}
        <StatCard
          title="Pedidos Totales"
          value={metrics.totalOrdersCount}
          variant="indigo"
          icon={<ShoppingBag className="size-5" />}
          isDark={isDark}
          badge={
            metrics.activeOrdersCount > 0 ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                {metrics.activeOrdersCount} activos
              </span>
            ) : undefined
          }
          description={
            <>
              <span className="font-semibold">{metrics.ordersLast24h} pedidos</span>
              <span className={isDark ? "text-slate-400" : "text-slate-500"}>en últimas 24h</span>
            </>
          }
        />

        {/* Average Ticket */}
        <StatCard
          title="Ticket Promedio"
          value={formatCurrency(metrics.avgTicket)}
          variant="info"
          icon={<TrendingUp className="size-5" />}
          isDark={isDark}
          description={
            <span className={isDark ? "text-slate-400" : "text-slate-500"}>
              {metrics.validOrdersCount > 0 ? "Promedio por orden cobrada" : "Sin órdenes cobradas"}
            </span>
          }
        />

        {/* Customer Base */}
        <StatCard
          title="Clientes CRM"
          value={metrics.totalCustomers}
          variant="warning"
          icon={<Users className="size-5" />}
          isDark={isDark}
          badge={
            <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-bold text-purple-600 dark:text-purple-300">
              {metrics.vipCount} VIP/Oro
            </span>
          }
          description={
            <>
              <span className="font-semibold">{metrics.repeatRate}%</span>
              <span className={isDark ? "text-slate-400" : "text-slate-500"}>tasa de recompra</span>
            </>
          }
        />
      </div>
    )}

      {/* Main Charts & Rankings Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sales Trend Chart */}
        <div
          className={`rounded-2xl border p-6 shadow-xs lg:col-span-2 ${
            isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Rendimiento de Ventas Semanal
              </h2>
              <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Ingresos diarios acumulados por canal de venta
              </p>
            </div>
            <span className="rounded-lg bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
              Últimos 7 días
            </span>
          </div>

          {/* Bar Chart Visualizer */}
          {!chartDays.hasData ? (
            <div className="mt-6 flex h-48 flex-col items-center justify-center gap-2 pt-4 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                <TrendingUp className="size-5" />
              </div>
              <p className="text-xs font-medium text-slate-400">
                No hay ventas registradas en los últimos 7 días.
              </p>
            </div>
          ) : (
            <div className="mt-6 flex h-48 items-end justify-between gap-2 sm:gap-4 pt-4">
              {chartDays.items.map((item, idx) => (
                <div key={idx} className="group relative flex flex-1 flex-col items-center gap-2">
                  {/* Tooltip on hover */}
                  <div className="pointer-events-none absolute -top-8 hidden rounded-md bg-slate-900 px-2 py-1 text-[11px] font-bold text-white shadow-md group-hover:block dark:bg-slate-800 border dark:border-slate-700">
                    {formatCurrency(item.amount)}
                  </div>
                  {/* Bar */}
                  <div className="w-full max-w-[44px] rounded-t-lg bg-slate-100 dark:bg-slate-800 overflow-hidden h-36 flex items-end">
                    <div
                      style={{ height: `${item.height}%` }}
                      className={`w-full rounded-t-lg transition-all duration-500 group-hover:opacity-80 ${
                        idx === chartDays.items.length - 1
                          ? "bg-gradient-to-t from-orange-500 to-amber-400"
                          : "bg-gradient-to-t from-indigo-600 to-violet-400"
                      }`}
                    />
                  </div>
                  <span className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {item.day}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Products */}
        <div
          className={`rounded-2xl border p-6 shadow-xs ${
            isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Platos Más Vendidos
              </h2>
              <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Ranking por volumen de pedidos
              </p>
            </div>
            <Flame className="size-4 text-orange-500" />
          </div>

          <div className="mt-4 space-y-4">
            {topProducts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No hay ventas registradas aún.
              </p>
            ) : (
              topProducts.map((prod, idx) => {
                const percentage = Math.round((prod.count / maxProductCount) * 100)
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="flex size-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {idx + 1}
                        </span>
                        <span className="font-semibold truncate text-slate-900 dark:text-slate-200">
                          {prod.name}
                        </span>
                      </div>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {prod.count} {prod.count === 1 ? "pedido" : "pedidos"}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
                      <div
                        style={{ width: `${percentage}%` }}
                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => navigateTo("/admin/menu")}
              className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer"
            >
              <span>Gestionar Catálogo Completo ({products.length} productos)</span>
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Orders Table Preview */}
      <div
        className={`rounded-2xl border p-6 shadow-xs ${
          isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              Actividad de Pedidos Recientes
            </h2>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Monitoreo y despacho en tiempo real
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigateTo("/admin/orders")}
            className="text-xs font-semibold cursor-pointer"
          >
            Ver todos los pedidos en Kanban
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`border-b ${isDark ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-500"}`}>
                <th className="py-2.5 px-3 font-semibold">Orden</th>
                <th className="py-2.5 px-3 font-semibold">Cliente</th>
                <th className="py-2.5 px-3 font-semibold">Productos</th>
                <th className="py-2.5 px-3 font-semibold">Total</th>
                <th className="py-2.5 px-3 font-semibold">Pago</th>
                <th className="py-2.5 px-3 font-semibold">Estado</th>
                <th className="py-2.5 px-3 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No hay pedidos registrados en el sistema.
                  </td>
                </tr>
              ) : (
                orders.slice(0, 5).map((ord) => (
                  <tr
                    key={ord.id}
                    className={`transition-colors ${
                      isDark ? "hover:bg-slate-800/60" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="py-3 px-3 font-bold text-indigo-600 dark:text-indigo-400">
                      #{ord.orderNumber}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{ord.customer.nombre}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{ord.customer.barrio}</div>
                    </td>
                    <td className="py-3 px-3 max-w-[200px] truncate text-slate-700 dark:text-slate-300">
                      {ord.items.map((i) => `${i.cantidad}× ${i.name}`).join(", ")}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(ord.finalTotal)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300 border dark:border-slate-700">
                        {ord.metodo}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <OrderStatusBadge status={ord.status} pulse />
                    </td>
                    <td className="py-3 px-3 text-right">
                      {ord.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => updateOrderStatus(ord.id, "cooking")}
                          className="rounded-lg bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-600 hover:bg-orange-500/20 dark:bg-orange-500/20 dark:text-orange-300"
                        >
                          Pasar a Cocina
                        </button>
                      )}
                      {ord.status === "cooking" && (
                        <button
                          type="button"
                          onClick={() => updateOrderStatus(ord.id, "delivering")}
                          className="rounded-lg bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-500/20 dark:bg-blue-500/20 dark:text-blue-300"
                        >
                          Enviar en Reparto
                        </button>
                      )}
                      {ord.status === "delivering" && (
                        <button
                          type="button"
                          onClick={() => updateOrderStatus(ord.id, "delivered")}
                          className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-300"
                        >
                          Completar Entrega
                        </button>
                      )}
                      {ord.status === "delivered" && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Finalizado</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ManualSaleModal
        isOpen={isManualSaleOpen}
        onClose={() => setIsManualSaleOpen(false)}
      />
    </div>
  )
}
