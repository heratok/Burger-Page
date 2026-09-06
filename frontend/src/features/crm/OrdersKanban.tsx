import React, { useState, useMemo, useCallback } from "react"
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
  LayoutGrid,
  Columns3,
  Archive,
  UtensilsCrossed,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Pagination } from "@/components/ui/pagination"
import { KanbanBoardSkeleton } from "@/components/ui/Skeletons"
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal"
import { buildWhatsAppUrl } from "@/features/cart"
import { ManualSaleModal } from "./ManualSaleModal"
import { Select } from "@/components/ui/select"
import { formatCurrency, formatWhatsAppPhone } from "@/lib/utils"
import { resolveModalOrder } from "@/lib/orderMatching"
import { KanbanOrderCard, LiveOrderCard, OrderDetailModal } from "./orders"

export const OrdersKanban: React.FC = () => {
  const {
    orders,
    isLoadingOrders,
    updateOrderStatus,
    updateOrderReceipt,
    deleteOrder,
    adminTheme,
    storeConfig,
  } = useRestaurant()

  const [isManualSaleOpen, setIsManualSaleOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [methodFilter, setMethodFilter] = useState<string>("ALL")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)

  // View mode: streamlined "feed" (default) or classic 5-column "kanban"
  const [viewMode, setViewMode] = useState<"feed" | "kanban">(() => {
    try {
      return (localStorage.getItem("burger_page_orders_view_mode") as "feed" | "kanban") || "feed"
    } catch {
      return "feed"
    }
  })

  // In feed mode: active commands vs completed history
  const [feedTab, setFeedTab] = useState<"active" | "history">("active")
  const [activeStatusFilter, setActiveStatusFilter] = useState<"ALL" | "pending" | "cooking" | "delivering">("ALL")
  const [activePage, setActivePage] = useState(1)
  const [activePageSize, setActivePageSize] = useState(12)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(12)

  const handleViewModeChange = (mode: "feed" | "kanban") => {
    setViewMode(mode)
    try {
      localStorage.setItem("burger_page_orders_view_mode", mode)
    } catch (err) {
      console.warn("Could not persist orders view mode", err)
    }
  }

  const isDark = adminTheme === "dark"

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return orders.filter((ord) => {
      const matchSearch =
        !term ||
        (ord.orderNumber != null && ord.orderNumber.toString().includes(term)) ||
        Boolean(ord.customer?.nombre?.toLowerCase().includes(term)) ||
        Boolean(ord.customer?.direccion?.toLowerCase().includes(term)) ||
        Boolean(ord.customer?.barrio?.toLowerCase().includes(term))

      const matchMethod = methodFilter === "ALL" || ord.metodo === methodFilter

      return matchSearch && matchMethod
    })
  }, [orders, searchTerm, methodFilter])

  const activeOrders = useMemo(() => {
    return filteredOrders.filter(
      (o) => o.status === "pending" || o.status === "cooking" || o.status === "delivering"
    )
  }, [filteredOrders])

  const displayedActiveOrders = useMemo(() => {
    if (activeStatusFilter === "ALL") return activeOrders
    return activeOrders.filter((o) => o.status === activeStatusFilter)
  }, [activeOrders, activeStatusFilter])

  const totalActivePages = Math.max(1, Math.ceil(displayedActiveOrders.length / activePageSize))
  const safeActivePage = Math.min(activePage, totalActivePages)

  const paginatedActiveOrders = useMemo(() => {
    const start = (safeActivePage - 1) * activePageSize
    return displayedActiveOrders.slice(start, start + activePageSize)
  }, [displayedActiveOrders, safeActivePage, activePageSize])

  const historyOrders = useMemo(() => {
    return filteredOrders.filter(
      (o) => o.status === "delivered" || o.status === "cancelled"
    )
  }, [filteredOrders])

  const totalHistoryPages = Math.max(1, Math.ceil(historyOrders.length / historyPageSize))
  const safeHistoryPage = Math.min(historyPage, totalHistoryPages)

  const paginatedHistoryOrders = useMemo(() => {
    const start = (safeHistoryPage - 1) * historyPageSize
    return historyOrders.slice(start, start + historyPageSize)
  }, [historyOrders, safeHistoryPage, historyPageSize])

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

  const openCustomerWhatsApp = useCallback(
    (order: Order, customText?: string) => {
      const fullPhone = formatWhatsAppPhone(order.customer?.telefono || "")
      const defaultMsg =
        customText ||
        `¡Hola ${order.customer?.nombre || "Cliente"}! Te escribimos de *${storeConfig.name}* sobre tu pedido #${order.orderNumber}.`
      window.open(buildWhatsAppUrl(fullPhone, defaultMsg), "_blank", "noreferrer")
    },
    [storeConfig.name]
  )

  return (
    <div className="space-y-5">
      {/* Search, Filter & Actions Toolbar */}
      <div
        className={`flex flex-col gap-3 rounded-2xl border p-3.5 sm:p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between ${
          isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          {/* Search Box */}
          <div className="relative flex-1 w-full max-w-none lg:max-w-md">
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
          <div className="w-full sm:w-52">
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

        {/* View Mode Toggle & New Sale Button */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full lg:w-auto pt-1 sm:pt-0">
          <div
            className={`flex items-center rounded-xl border p-1 shrink-0 ${
              isDark ? "border-slate-800 bg-slate-800/80" : "border-slate-200 bg-slate-100"
            }`}
          >
            <button
              type="button"
              onClick={() => handleViewModeChange("feed")}
              className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                viewMode === "feed"
                  ? isDark
                    ? "bg-slate-700 text-white shadow-xs"
                    : "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
              title="Feed directo de comandas"
            >
              <LayoutGrid className="size-3.5 shrink-0" />
              <span>Comandas</span>
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange("kanban")}
              className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                viewMode === "kanban"
                  ? isDark
                    ? "bg-slate-700 text-white shadow-xs"
                    : "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
              title="Tablero Kanban de 5 columnas"
            >
              <Columns3 className="size-3.5 shrink-0" />
              <span>Kanban</span>
            </button>
          </div>

          <Button
            type="button"
            onClick={() => setIsManualSaleOpen(true)}
            className="gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 cursor-pointer shrink-0"
          >
            <Plus className="size-4 shrink-0" />
            <span className="hidden sm:inline">Nueva Venta</span>
            <span className="sm:hidden">Venta</span>
          </Button>
        </div>
      </div>

      {/* VIEW MODE: STREAMLINED COMMAND FEED */}
      {viewMode === "feed" && (
        <div className="space-y-4">
          {/* Feed Subtabs: Active vs History */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setFeedTab("active")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                  feedTab === "active"
                    ? isDark
                      ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                      : "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                }`}
              >
                <UtensilsCrossed className="size-3.5" />
                <span>Comandas Activas</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                    activeOrders.length > 0
                      ? isDark
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-amber-100 text-amber-800 border border-amber-300"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                  }`}
                >
                  {activeOrders.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFeedTab("history")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                  feedTab === "history"
                    ? isDark
                      ? "bg-slate-800 text-slate-200 border border-slate-700"
                      : "bg-slate-100 text-slate-800 border border-slate-300 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                }`}
              >
                <Archive className="size-3.5" />
                <span>Historial</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {historyOrders.length}
                </span>
              </button>
            </div>

            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              {feedTab === "active"
                ? "Órdenes en preparación y despacho con acción de 1 clic"
                : "Órdenes entregadas y canceladas"}
            </span>
          </div>

          {/* Tab Content: Active Commands */}
          {feedTab === "active" && (
            <div className="space-y-3">
              {isLoadingOrders && orders.length === 0 ? (
                <KanbanBoardSkeleton isDark={isDark} columns={3} />
              ) : (
                <>
                  {/* Sub-status filter chips */}
                  {activeOrders.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pb-1">
                  {[
                    { id: "ALL", label: "Todas", count: activeOrders.length, icon: null },
                    {
                      id: "pending",
                      label: "Por Preparar",
                      count: activeOrders.filter((o) => o.status === "pending").length,
                      icon: <Clock className="size-3 text-amber-500" />,
                    },
                    {
                      id: "cooking",
                      label: "En Cocina",
                      count: activeOrders.filter((o) => o.status === "cooking").length,
                      icon: <ChefHat className="size-3 text-orange-500" />,
                    },
                    {
                      id: "delivering",
                      label: "En Reparto",
                      count: activeOrders.filter((o) => o.status === "delivering").length,
                      icon: <Bike className="size-3 text-blue-500" />,
                    },
                  ].map((chip) => {
                    const isSelected = activeStatusFilter === chip.id
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => {
                          setActiveStatusFilter(chip.id as "ALL" | "pending" | "cooking" | "delivering")
                          setActivePage(1)
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                          isSelected
                            ? isDark
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "bg-indigo-600 text-white shadow-xs"
                            : isDark
                            ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {chip.icon}
                        <span>{chip.label}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : isDark
                              ? "bg-slate-700 text-slate-300"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {chip.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {activeOrders.length === 0 ? (
                <div
                  className={`flex flex-col items-center justify-center rounded-2xl border border-dashed p-12 text-center ${
                    isDark ? "border-slate-800 bg-[#0E1322]/50" : "border-slate-200 bg-slate-50/50"
                  }`}
                >
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 mb-3">
                    <UtensilsCrossed className="size-7" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    ¡Cocina al día! No hay comandas pendientes
                  </h3>
                  <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                    Los pedidos que entren desde la tienda web o las ventas que cargues a mano aparecerán aquí en tiempo real.
                  </p>
                  <Button
                    type="button"
                    onClick={() => setIsManualSaleOpen(true)}
                    className="mt-4 gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>Cargar Venta Manual</span>
                  </Button>
                </div>
              ) : displayedActiveOrders.length === 0 ? (
                <div
                  className={`flex flex-col items-center justify-center rounded-2xl border border-dashed p-10 text-center text-xs text-slate-400 ${
                    isDark ? "border-slate-800" : "border-slate-200"
                  }`}
                >
                  <span>No hay pedidos con el estado seleccionado.</span>
                  <button
                    type="button"
                    onClick={() => setActiveStatusFilter("ALL")}
                    className="mt-2 text-indigo-500 hover:underline font-semibold"
                  >
                    Ver todas las comandas activas ({activeOrders.length})
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {paginatedActiveOrders.map((ord) => (
                      <LiveOrderCard
                        key={ord.id}
                        order={ord}
                        isDark={isDark}
                        onViewDetails={setSelectedOrder}
                        onUpdateStatus={updateOrderStatus}
                        onWhatsApp={openCustomerWhatsApp}
                      />
                    ))}
                  </div>

                  {displayedActiveOrders.length > activePageSize && (
                    <div className="pt-2">
                      <Pagination
                        currentPage={safeActivePage}
                        totalItems={displayedActiveOrders.length}
                        pageSize={activePageSize}
                        onPageChange={setActivePage}
                        onPageSizeChange={(size) => {
                          setActivePageSize(size)
                          setActivePage(1)
                        }}
                        pageSizeOptions={[12, 24, 48]}
                      />
                    </div>
                  )}
                </>
              )}
                </>
              )}
            </div>
          )}

          {/* Tab Content: History */}
          {feedTab === "history" && (
            <div className="space-y-3">
              {isLoadingOrders && orders.length === 0 ? (
                <KanbanBoardSkeleton isDark={isDark} columns={3} />
              ) : historyOrders.length === 0 ? (
                <div
                  className={`flex flex-col items-center justify-center rounded-2xl border border-dashed p-10 text-center text-xs text-slate-400 ${
                    isDark ? "border-slate-800" : "border-slate-200"
                  }`}
                >
                  <span>No hay pedidos en el historial todavía.</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {paginatedHistoryOrders.map((ord) => (
                      <LiveOrderCard
                        key={ord.id}
                        order={ord}
                        isDark={isDark}
                        onViewDetails={setSelectedOrder}
                        onUpdateStatus={updateOrderStatus}
                        onWhatsApp={openCustomerWhatsApp}
                      />
                    ))}
                  </div>

                  {historyOrders.length > historyPageSize && (
                    <div className="pt-2">
                      <Pagination
                        currentPage={safeHistoryPage}
                        totalItems={historyOrders.length}
                        pageSize={historyPageSize}
                        onPageChange={setHistoryPage}
                        onPageSizeChange={(size) => {
                          setHistoryPageSize(size)
                          setHistoryPage(1)
                        }}
                        pageSizeOptions={[12, 24, 48]}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE: CLASSIC KANBAN BOARD */}
      {viewMode === "kanban" && (
        isLoadingOrders && orders.length === 0 ? (
          <KanbanBoardSkeleton isDark={isDark} columns={5} />
        ) : (
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
      ))}

      <OrderDetailModal
        isOpen={!!selectedOrder}
        order={resolveModalOrder(orders, selectedOrder)}
        isDark={isDark}
        onClose={() => setSelectedOrder(null)}
        onUpdateStatus={updateOrderStatus}
        onUpdateReceipt={updateOrderReceipt}
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
        targetName={orderToDelete ? `Pedido #${orderToDelete.orderNumber} — ${orderToDelete.customer?.nombre || "Cliente"}` : undefined}
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
