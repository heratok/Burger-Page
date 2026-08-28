import React, { useState, useMemo } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import type { Order, OrderStatus } from "@/types/restaurant"
import {
  Clock,
  ChefHat,
  Bike,
  CheckCircle2,
  XCircle,
  MapPin,
  Search,
  Filter,
  Eye,
  MessageCircle,
  X,
  Plus,
  Trash2,
} from "lucide-react"
import { OrderStatusBadge } from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
import { buildWhatsAppUrl } from "@/features/cart"
import { ManualSaleModal } from "./ManualSaleModal"

export const OrdersKanban: React.FC = () => {
  const { orders, updateOrderStatus, deleteOrder, adminTheme, storeConfig } =
    useRestaurant()

  const [isManualSaleOpen, setIsManualSaleOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [methodFilter, setMethodFilter] = useState<string>("ALL")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const isDark = adminTheme === "dark"

  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      const matchSearch =
        ord.orderNumber.toString().includes(searchTerm) ||
        ord.customer.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ord.customer.direccion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ord.customer.barrio.toLowerCase().includes(searchTerm.toLowerCase())

      const matchMethod = methodFilter === "ALL" || ord.metodo === methodFilter

      return matchSearch && matchMethod
    })
  }, [orders, searchTerm, methodFilter])

  const columns: Array<{
    id: OrderStatus
    title: string
    icon: React.ReactNode
  }> = [
    {
      id: "pending",
      title: "Nuevos / Pendientes",
      icon: <Clock className="size-4 text-amber-500" />,
    },
    {
      id: "cooking",
      title: "En Cocina",
      icon: <ChefHat className="size-4 text-orange-500" />,
    },
    {
      id: "delivering",
      title: "En Reparto",
      icon: <Bike className="size-4 text-blue-500" />,
    },
    {
      id: "delivered",
      title: "Entregados",
      icon: <CheckCircle2 className="size-4 text-emerald-500" />,
    },
    {
      id: "cancelled",
      title: "Cancelados",
      icon: <XCircle className="size-4 text-rose-500" />,
    },
  ]

  const formatElapsed = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime()
    const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)))
    if (diffMins < 60) return `hace ${diffMins} min`
    const diffHours = Math.floor(diffMins / 60)
    return `hace ${diffHours}h ${diffMins % 60}m`
  }

  const openCustomerWhatsApp = (order: Order, customText?: string) => {
    const phone = order.customer.telefono.replace(/\D/g, "")
    const fullPhone = phone.startsWith("57") ? phone : `57${phone}`
    const defaultMsg =
      customText ||
      `¡Hola ${order.customer.nombre}! Te escribimos de *${storeConfig.name}* sobre tu pedido #${order.orderNumber}.`
    window.open(buildWhatsAppUrl(fullPhone, defaultMsg), "_blank", "noreferrer")
  }

  return (
    <div className="space-y-5">
      {/* Search & Actions Strip */}
      <div
        className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between ${
          isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por # orden, cliente, dirección o barrio..."
              className={`w-full rounded-xl border pl-9 pr-4 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDark
                  ? "border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-400"
                  : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400"
              }`}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Payment filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="size-3.5 text-slate-400 ml-1" />
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className={`rounded-xl border px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDark
                  ? "border-slate-700 bg-slate-800 text-slate-100"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              <option value="ALL">Todos los métodos</option>
              <option value="Efectivo">💵 Efectivo</option>
              <option value="Transferencia">💳 Transferencia</option>
            </select>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => setIsManualSaleOpen(true)}
          className="gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 font-bold text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 cursor-pointer"
        >
          <Plus className="size-4" />
          <span>Nueva Venta</span>
        </Button>
      </div>

      {/* Kanban Board Columns Container */}
      <div className="flex gap-4 overflow-x-auto pb-4 items-start xl:grid xl:grid-cols-5 min-w-full">
        {columns.map((col) => {
          const colOrders = filteredOrders.filter((o) => o.status === col.id)
          const isTerminalCol = col.id === "delivered" || col.id === "cancelled"
          const maxVisible = 25
          const visibleOrders = isTerminalCol ? colOrders.slice(0, maxVisible) : colOrders

          return (
            <div
              key={col.id}
              className={`flex flex-col rounded-2xl border p-3.5 shadow-xs transition-colors min-w-[280px] sm:min-w-[300px] xl:min-w-0 flex-1 shrink-0 ${
                isDark
                  ? "border-slate-800 bg-[#0E1322]"
                  : "border-slate-200/80 bg-slate-100/60"
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-white shadow-xs dark:bg-slate-800">
                    {col.icon}
                  </span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                    {col.title}
                  </h3>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    colOrders.length > 0
                      ? isDark
                        ? "bg-slate-800 text-slate-100 border border-slate-700"
                        : "bg-white text-slate-800 shadow-xs"
                      : "text-slate-400"
                  }`}
                >
                  {colOrders.length}
                </span>
              </div>

              {/* Order Cards List (Internal smooth scroll for heavy load) */}
              <div className="mt-3 flex-1 space-y-3 min-h-[300px] max-h-[calc(100vh-270px)] overflow-y-auto pr-1">
                {colOrders.length === 0 ? (
                  <div
                    className={`flex h-40 flex-col items-center justify-center rounded-xl border border-dashed text-center text-xs ${
                      isDark
                        ? "border-slate-800 text-slate-400"
                        : "border-slate-200 text-slate-400"
                    }`}
                  >
                    <span>Sin pedidos en esta fase</span>
                  </div>
                ) : (
                  <>
                    {visibleOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className={`group relative rounded-xl border p-3.5 shadow-xs transition-all duration-150 hover:shadow-md ${
                          col.id === "pending"
                            ? isDark
                              ? "border-amber-500/40 bg-slate-900 hover:border-amber-400"
                              : "border-amber-400/60 bg-amber-50/40 hover:border-amber-500"
                            : isDark
                            ? "border-slate-800 bg-slate-900 hover:border-slate-700"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                              #{ord.orderNumber}
                            </span>
                            <h4 className="mt-0.5 text-xs font-bold leading-tight line-clamp-1 text-slate-900 dark:text-white">
                              {ord.customer.nombre}
                            </h4>
                          </div>
                          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-400 whitespace-nowrap">
                            {formatElapsed(ord.createdAt)}
                          </span>
                        </div>

                        {/* Address preview */}
                        <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                          <MapPin className="size-3 shrink-0 text-slate-400" />
                          <span className="truncate">
                            {ord.customer.barrio} - {ord.customer.direccion}
                          </span>
                        </div>

                        {/* Items Summary */}
                        <div
                          className={`mt-2.5 rounded-lg p-2 text-[11px] ${
                            isDark ? "bg-slate-800/80 text-slate-200" : "bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div className="space-y-1 font-medium">
                            {ord.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between truncate">
                                <span className="truncate">
                                  {item.cantidad}× {item.name}
                                </span>
                              </div>
                            ))}
                          </div>
                          {ord.comentario && (
                            <p className="mt-1.5 border-t border-slate-200/40 dark:border-slate-700/60 pt-1 text-[10px] italic text-amber-600 dark:text-amber-300 line-clamp-2">
                              &quot;{ord.comentario}&quot;
                            </p>
                          )}
                        </div>

                        {/* Totals & Payment */}
                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2.5">
                          <span className="text-xs font-black text-slate-900 dark:text-white">
                            ${ord.finalTotal.toLocaleString()}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              ord.metodo === "Efectivo"
                                ? "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                                : "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
                            }`}
                          >
                            {ord.metodo}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-3 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(ord)}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            title="Ver detalles completos del pedido"
                          >
                            <Eye className="size-3.5" />
                          </button>

                          {ord.status === "pending" && (
                            <button
                              type="button"
                              onClick={() => updateOrderStatus(ord.id, "cooking")}
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-orange-500 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-orange-600"
                            >
                              <ChefHat className="size-3.5" />
                              <span>A Cocina</span>
                            </button>
                          )}
                          {ord.status === "cooking" && (
                            <button
                              type="button"
                              onClick={() => updateOrderStatus(ord.id, "delivering")}
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                            >
                              <Bike className="size-3.5" />
                              <span>Despachar</span>
                            </button>
                          )}
                          {ord.status === "delivering" && (
                            <button
                              type="button"
                              onClick={() => updateOrderStatus(ord.id, "delivered")}
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="size-3.5" />
                              <span>Entregado</span>
                            </button>
                          )}
                          {ord.status !== "cancelled" && ord.status !== "delivered" && (
                            <button
                              type="button"
                              onClick={() => openCustomerWhatsApp(ord)}
                              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-1.5 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                              title="Chat WhatsApp con cliente"
                            >
                              <MessageCircle className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {isTerminalCol && colOrders.length > maxVisible && (
                      <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-2.5 text-center text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/50">
                        Mostrando las {maxVisible} órdenes más recientes ({colOrders.length} en total). Para consultar el histórico completo, ve a <strong>Reportes</strong>.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
          <div
            className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl transition-all ${
              isDark ? "border-slate-800 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b pb-4 border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                    Orden #{selectedOrder.orderNumber}
                  </span>
                  <OrderStatusBadge status={selectedOrder.status} />
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Registrada el {new Date(selectedOrder.createdAt).toLocaleString("es-CO")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Customer Information */}
            <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800 p-3.5 text-xs space-y-2 border dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {selectedOrder.customer.nombre}
                </span>
                <button
                  type="button"
                  onClick={() => openCustomerWhatsApp(selectedOrder)}
                  className="flex items-center gap-1 font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  <MessageCircle className="size-3.5" />
                  <span>WhatsApp: {selectedOrder.customer.telefono}</span>
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <MapPin className="size-3.5 text-slate-400" />
                <span>
                  {selectedOrder.customer.direccion}, Barrio {selectedOrder.customer.barrio}
                </span>
              </div>
            </div>

            {/* Items Breakdown */}
            <div className="mt-4 space-y-2.5 max-h-56 overflow-y-auto pr-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Detalle del Pedido
              </h4>
              {selectedOrder.items.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-xs space-y-1.5 bg-slate-50/70 dark:bg-slate-800"
                >
                  <div className="flex justify-between font-bold text-slate-900 dark:text-white">
                    <span>
                      {item.cantidad || (item as any).quantity || 1}× {item.name}
                    </span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">
                      ${(item.total ?? item.price * (item.cantidad || (item as any).quantity || 1)).toLocaleString()}
                    </span>
                  </div>
                  {item.adiciones && item.adiciones.length > 0 && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 pl-3 border-l-2 border-slate-300 dark:border-slate-600 space-y-0.5">
                      {item.adiciones.map((a, i) => (
                        <div key={i}>
                          + {a.cantidad}× {a.name} (${(a.price * a.cantidad).toLocaleString()})
                        </div>
                      ))}
                    </div>
                  )}
                  {item.observacion && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-300 italic pt-0.5">
                      Nota: {item.observacion}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Payment & Totals */}
            <div className="mt-4 border-t pt-3 border-slate-100 dark:border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Subtotal productos</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  ${(selectedOrder.total ?? (selectedOrder as any).subtotal ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Costo de domicilio</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  ${(selectedOrder.deliveryFee ?? (selectedOrder as any).costoEnvio ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white">
                <span>Total a Pagar</span>
                <span className="text-indigo-600 dark:text-indigo-400 text-base font-black">
                  ${(selectedOrder.finalTotal || 0).toLocaleString()}
                </span>
              </div>
              <div className="mt-2 rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5 text-[11px] flex justify-between border dark:border-slate-700 text-slate-800 dark:text-slate-200">
                <span>Método: <strong>{selectedOrder.metodo}</strong></span>
                {selectedOrder.pagoCon && (
                  <span>
                    Paga con: ${Number(selectedOrder.pagoCon).toLocaleString()}{" "}
                    {selectedOrder.cambio ? `(Cambio: $${selectedOrder.cambio.toLocaleString()})` : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Modal Status Advancer Controls */}
            <div className="mt-5 flex flex-wrap gap-2 border-t pt-4 border-slate-100 dark:border-slate-800">
              <div className="text-xs font-semibold w-full text-slate-500 dark:text-slate-400">
                Cambiar estado de orden:
              </div>
              <button
                type="button"
                onClick={() => {
                  updateOrderStatus(selectedOrder.id, "pending")
                  setSelectedOrder(null)
                }}
                className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                🟡 Pendiente
              </button>
              <button
                type="button"
                onClick={() => {
                  updateOrderStatus(selectedOrder.id, "cooking")
                  setSelectedOrder(null)
                }}
                className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                🟠 En Cocina
              </button>
              <button
                type="button"
                onClick={() => {
                  updateOrderStatus(selectedOrder.id, "delivering")
                  setSelectedOrder(null)
                }}
                className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                🔵 En Reparto
              </button>
              <button
                type="button"
                onClick={() => {
                  updateOrderStatus(selectedOrder.id, "delivered")
                  setSelectedOrder(null)
                }}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-300"
              >
                🟢 Entregado
              </button>
              <button
                type="button"
                onClick={() => {
                  updateOrderStatus(selectedOrder.id, "cancelled")
                  setSelectedOrder(null)
                }}
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-500/20 dark:bg-rose-500/20 dark:text-rose-300"
              >
                🔴 Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteOrder(selectedOrder.id)
                  setSelectedOrder(null)
                }}
                className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-500 hover:bg-rose-500/20 ml-auto cursor-pointer"
                title="Eliminar orden definitivamente"
              >
                <Trash2 className="size-3" />
                <span>Eliminar Orden</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ManualSaleModal
        isOpen={isManualSaleOpen}
        onClose={() => setIsManualSaleOpen(false)}
      />
    </div>
  )
}
