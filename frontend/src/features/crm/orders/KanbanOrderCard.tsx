import React from "react"
import type { Order, OrderStatus } from "@/types/restaurant"
import {
  ChefHat,
  Bike,
  CheckCircle2,
  MapPin,
  Eye,
  MessageCircle,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export interface KanbanOrderCardProps {
  order: Order
  isDark?: boolean
  onViewDetails: (order: Order) => void
  onUpdateStatus: (orderId: string, status: OrderStatus) => void
  onWhatsApp: (order: Order) => void
}

const formatElapsed = (isoString: string) => {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)))
  if (diffMins < 60) return `hace ${diffMins} min`
  const diffHours = Math.floor(diffMins / 60)
  return `hace ${diffHours}h ${diffMins % 60}m`
}

export const KanbanOrderCard: React.FC<KanbanOrderCardProps> = ({
  order,
  isDark = false,
  onViewDetails,
  onUpdateStatus,
  onWhatsApp,
}) => {
  return (
    <div
      className={`group relative rounded-xl border p-3.5 shadow-xs transition-all duration-150 hover:shadow-md ${
        order.status === "pending"
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
            #{order.orderNumber}
          </span>
          <h4 className="mt-0.5 text-xs font-bold leading-tight line-clamp-1 text-slate-900 dark:text-white">
            {order.customer.nombre}
          </h4>
        </div>
        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-400 whitespace-nowrap">
          {formatElapsed(order.createdAt)}
        </span>
      </div>

      {/* Address preview */}
      <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
        <MapPin className="size-3 shrink-0 text-slate-400" />
        <span className="truncate">
          {order.customer.barrio} - {order.customer.direccion}
        </span>
      </div>

      {/* Items Summary */}
      <div
        className={`mt-2.5 rounded-lg p-2 text-[11px] ${
          isDark ? "bg-slate-800/80 text-slate-200" : "bg-slate-50 text-slate-700"
        }`}
      >
        <div className="space-y-1 font-medium">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between truncate">
              <span className="truncate">
                {item.cantidad}× {item.name}
              </span>
            </div>
          ))}
        </div>
        {order.comentario && (
          <p className="mt-1.5 border-t border-slate-200/40 dark:border-slate-700/60 pt-1 text-[10px] italic text-amber-600 dark:text-amber-300 line-clamp-2">
            &quot;{order.comentario}&quot;
          </p>
        )}
      </div>

      {/* Totals & Payment */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2.5">
        <span className="text-xs font-black text-slate-900 dark:text-white">
          {formatCurrency(order.finalTotal)}
        </span>
        <span
          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
            order.metodo === "Efectivo"
              ? "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
              : "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
          }`}
        >
          {order.metodo}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="mt-3 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onViewDetails(order)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          title="Ver detalles completos del pedido"
        >
          <Eye className="size-3.5" />
        </button>

        {order.status === "pending" && (
          <button
            type="button"
            onClick={() => onUpdateStatus(order.id, "cooking")}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-orange-500 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-orange-600 cursor-pointer"
          >
            <ChefHat className="size-3.5" />
            <span>A Cocina</span>
          </button>
        )}
        {order.status === "cooking" && (
          <button
            type="button"
            onClick={() => onUpdateStatus(order.id, "delivering")}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 cursor-pointer"
          >
            <Bike className="size-3.5" />
            <span>Despachar</span>
          </button>
        )}
        {order.status === "delivering" && (
          <button
            type="button"
            onClick={() => onUpdateStatus(order.id, "delivered")}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
          >
            <CheckCircle2 className="size-3.5" />
            <span>Entregado</span>
          </button>
        )}
        {order.status !== "cancelled" && order.status !== "delivered" && (
          <button
            type="button"
            onClick={() => onWhatsApp(order)}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-1.5 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400 cursor-pointer"
            title="Chat WhatsApp con cliente"
          >
            <MessageCircle className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
