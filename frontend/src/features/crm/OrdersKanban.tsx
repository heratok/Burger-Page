import React, { useState, useMemo } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import type { Order, OrderStatus } from "@/types/restaurant"
import {
  Clock,
  ChefHat,
  Bike,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  X,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal"
import { buildWhatsAppUrl } from "@/features/cart"
import { ManualSaleModal } from "./ManualSaleModal"
import { Select } from "@/components/ui/select"
import { formatCurrency, formatWhatsAppPhone } from "@/lib/utils"
import { KanbanOrderCard, OrderDetailModal } from "./orders"

export const OrdersKanban: React.FC = () => {
  const { orders, updateOrderStatus, deleteOrder, adminTheme, storeConfig } =
    useRestaurant()

  const [isManualSaleOpen, setIsManualSaleOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [methodFilter, setMethodFilter] = useState<string>("ALL")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)

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

  const openCustomerWhatsApp = (order: Order, customText?: string) => {
    const fullPhone = formatWhatsAppPhone(order.customer.telefono)
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Payment filter */}
          <div className="w-48">
            <Select
              size="md"
              leftIcon={<Filter className="size-3.5 text-slate-400" />}
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              aria-label="Filtrar por método de pago"
              options={[
                { value: "ALL", label: "Todos los métodos" },
                { value: "Efectivo", label: "💵 Efectivo" },
                { value: "Transferencia", label: "💳 Transferencia" },
              ]}
            />
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

              {/* Order Cards List */}
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
                      <KanbanOrderCard
                        key={ord.id}
                        order={ord}
                        isDark={isDark}
                        onViewDetails={setSelectedOrder}
                        onUpdateStatus={updateOrderStatus}
                        onWhatsApp={openCustomerWhatsApp}
                      />
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

      <OrderDetailModal
        isOpen={!!selectedOrder}
        order={selectedOrder}
        isDark={isDark}
        onClose={() => setSelectedOrder(null)}
        onUpdateStatus={updateOrderStatus}
        onDeleteOrder={setOrderToDelete}
        onWhatsApp={openCustomerWhatsApp}
      />

      {/* Delete Order Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!orderToDelete}
        onClose={() => setOrderToDelete(null)}
        onConfirm={() => {
          if (orderToDelete) {
            deleteOrder(orderToDelete.id)
            setOrderToDelete(null)
          }
        }}
        title="¿Eliminar orden permanentemente?"
        targetName={orderToDelete ? `Pedido #${orderToDelete.orderNumber} — ${orderToDelete.customer.nombre}` : undefined}
        description={
          orderToDelete
            ? `¿Estás seguro de que deseas eliminar permanentemente el Pedido #${orderToDelete.orderNumber} (${formatCurrency(orderToDelete.finalTotal)})? Esta acción no se puede deshacer.`
            : undefined
        }
        confirmText="Eliminar orden"
      />

      <ManualSaleModal
        isOpen={isManualSaleOpen}
        onClose={() => setIsManualSaleOpen(false)}
      />
    </div>
  )
}
