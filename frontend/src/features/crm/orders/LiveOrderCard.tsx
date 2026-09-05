import React from "react"
import type { Order, OrderStatus } from "@/types/restaurant"
import {
  Clock,
  ChefHat,
  Bike,
  CheckCircle2,
  MapPin,
  Eye,
  MessageCircle,
  AlertCircle,
  Check,
  RotateCcw,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export interface LiveOrderCardProps {
  order: Order
  isDark?: boolean
  onViewDetails: (order: Order) => void
  onUpdateStatus: (orderId: string, status: OrderStatus) => void
  onWhatsApp: (order: Order) => void
}

const formatElapsed = (isoString: string) => {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)))
  if (diffMins < 60) return { text: `hace ${diffMins} min`, mins: diffMins }
  const diffHours = Math.floor(diffMins / 60)
  return { text: `hace ${diffHours}h ${diffMins % 60}m`, mins: diffMins }
}

export const LiveOrderCard: React.FC<LiveOrderCardProps> = ({
  order,
  isDark = false,
  onViewDetails,
  onUpdateStatus,
  onWhatsApp,
}) => {
  const elapsed = formatElapsed(order.createdAt)
  const isDelayed =
    elapsed.mins >= 25 &&
    order.status !== "delivered" &&
    order.status !== "cancelled"

  const statusConfig: Record<
    OrderStatus,
    { label: string; bg: string; text: string; icon: React.ReactNode }
  > = {
    pending: {
      label: "Por Preparar",
      bg: isDark ? "bg-amber-500/20 border-amber-500/30" : "bg-amber-100 border-amber-300",
      text: isDark ? "text-amber-300" : "text-amber-800",
      icon: <Clock className="size-3.5" />,
    },
    cooking: {
      label: "En Cocina",
      bg: isDark ? "bg-orange-500/20 border-orange-500/30" : "bg-orange-100 border-orange-300",
      text: isDark ? "text-orange-300" : "text-orange-800",
      icon: <ChefHat className="size-3.5" />,
    },
    delivering: {
      label: "En Reparto",
      bg: isDark ? "bg-blue-500/20 border-blue-500/30" : "bg-blue-100 border-blue-300",
      text: isDark ? "text-blue-300" : "text-blue-800",
      icon: <Bike className="size-3.5" />,
    },
    delivered: {
      label: "Entregado",
      bg: isDark ? "bg-emerald-500/20 border-emerald-500/30" : "bg-emerald-100 border-emerald-300",
      text: isDark ? "text-emerald-300" : "text-emerald-800",
      icon: <CheckCircle2 className="size-3.5" />,
    },
    cancelled: {
      label: "Cancelado",
      bg: isDark ? "bg-rose-500/20 border-rose-500/30" : "bg-rose-100 border-rose-300",
      text: isDark ? "text-rose-300" : "text-rose-800",
      icon: <AlertCircle className="size-3.5" />,
    },
  }

  const currentStatus = statusConfig[order.status]

  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl border p-4 shadow-xs transition-all duration-150 hover:shadow-md ${
        order.status === "pending"
          ? isDark
            ? "border-amber-500/40 bg-slate-900/90 hover:border-amber-400"
            : "border-amber-300 bg-amber-50/30 hover:border-amber-400"
          : isDark
          ? "border-slate-800 bg-slate-900/90 hover:border-slate-700"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div>
        {/* Ticket Header */}
        <div className="flex items-start justify-between gap-2 border-b pb-3 border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center rounded-xl bg-indigo-50 px-2.5 py-1 text-sm font-black text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              #{order.orderNumber}
            </span>
            <span
              className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${currentStatus.bg} ${currentStatus.text}`}
            >
              {currentStatus.icon}
              <span>{currentStatus.label}</span>
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
            {isDelayed && (
              <span className="flex items-center gap-0.5 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                <AlertCircle className="size-3" />
                Demorado
              </span>
            )}
            <span>{elapsed.text}</span>
          </div>
        </div>

        {/* Customer & Address Information */}
        <div className="mt-3 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {order.customer.nombre}
            </h4>
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 truncate">
              <MapPin className="size-3.5 shrink-0 text-slate-400" />
              <span className="truncate">
                {order.customer.barrio} — {order.customer.direccion}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onWhatsApp(order)}
            className="shrink-0 flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400 cursor-pointer"
            title="Chat WhatsApp con cliente"
          >
            <MessageCircle className="size-3.5" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>
        </div>

        {/* Order Items Breakdown */}
        <div
          className={`mt-3 rounded-xl p-3 text-xs space-y-2 ${
            isDark ? "bg-slate-800/60 text-slate-200" : "bg-slate-50 text-slate-800"
          }`}
        >
          <div className="space-y-1.5 font-medium">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-slate-900 dark:text-white truncate">
                  {item.cantidad}× {item.name}
                </span>
                {item.adiciones && item.adiciones.length > 0 && (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    +{item.adiciones.map((a) => a.name).join(", ")}
                  </span>
                )}
              </div>
            ))}
          </div>

          {order.comentario && (
            <div className="rounded-lg border border-amber-300/40 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-950/30 p-2 text-[11px] text-amber-800 dark:text-amber-200">
              <span className="font-bold">Nota: </span>
              &quot;{order.comentario}&quot;
            </div>
          )}
        </div>

        {/* Totals & Payment Info */}
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2.5 text-xs">
          <div>
            <span className="text-base font-black text-slate-900 dark:text-white">
              {formatCurrency(order.finalTotal)}
            </span>
            {order.deliveryFee > 0 && (
              <span className="ml-1.5 text-[10px] text-slate-400">
                (inc. envío {formatCurrency(order.deliveryFee)})
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                order.metodo === "Efectivo"
                  ? "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                  : "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
              }`}
            >
              {order.metodo}
            </span>
            {order.metodo === "Efectivo" && order.cambio !== undefined && order.cambio > 0 && (
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                Cambio: {formatCurrency(order.cambio)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-3">
        <button
          type="button"
          onClick={() => onViewDetails(order)}
          className="rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          title="Ver detalles completos de la orden"
        >
          <Eye className="size-4" />
        </button>

        {order.status !== "delivered" && order.status !== "cancelled" ? (
          <>
            {/* Primary Fast 1-Click Action */}
            <button
              type="button"
              onClick={() => onUpdateStatus(order.id, "delivered")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              <Check className="size-4" />
              <span>Completar (1 Clic)</span>
            </button>

            {/* Step-by-step secondary transition */}
            {order.status === "pending" && (
              <button
                type="button"
                onClick={() => onUpdateStatus(order.id, "cooking")}
                className="flex items-center gap-1 rounded-xl border border-orange-500/30 bg-orange-500/10 px-2.5 py-2 text-xs font-bold text-orange-600 hover:bg-orange-500/20 dark:text-orange-400 cursor-pointer"
                title="Mover a cocina"
              >
                <ChefHat className="size-4" />
                <span className="hidden sm:inline">A Cocina</span>
              </button>
            )}

            {order.status === "cooking" && (
              <button
                type="button"
                onClick={() => onUpdateStatus(order.id, "delivering")}
                className="flex items-center gap-1 rounded-xl border border-blue-500/30 bg-blue-500/10 px-2.5 py-2 text-xs font-bold text-blue-600 hover:bg-blue-500/20 dark:text-blue-400 cursor-pointer"
                title="Despachar con repartidor"
              >
                <Bike className="size-4" />
                <span className="hidden sm:inline">Despachar</span>
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => onUpdateStatus(order.id, "pending")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            <span>Reabrir Orden</span>
          </button>
        )}
      </div>
    </div>
  )
}
