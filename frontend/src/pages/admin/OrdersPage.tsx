import { useState } from "react"
import { toast } from "sonner"
import { PackageOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { storage } from "@/lib/storage"
import { formatCOP } from "@/lib/whatsapp"
import type { Order, OrderStatus } from "@/lib/domain"
import type { RestaurantRepository } from "@/lib/repository"

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Nuevo",
  confirmed: "Confirmado",
  delivered: "Entregado",
  cancelled: "Cancelado",
}

/** Transition buttons per status, mirroring ALLOWED_TRANSITIONS (orders.ts). */
const TRANSITION_ACTIONS: Record<
  OrderStatus,
  { to: OrderStatus; label: string; variant: "default" | "destructive" }[]
> = {
  new: [
    { to: "confirmed", label: "Confirmar", variant: "default" },
    { to: "cancelled", label: "Cancelar", variant: "destructive" },
  ],
  confirmed: [
    { to: "delivered", label: "Entregar", variant: "default" },
    { to: "cancelled", label: "Cancelar", variant: "destructive" },
  ],
  delivered: [],
  cancelled: [],
}

interface OrdersPageProps {
  repo?: RestaurantRepository
}

export default function OrdersPage({ repo = storage }: OrdersPageProps) {
  const [orders, setOrders] = useState<Order[]>(() => repo.listOrders())

  const transition = (order: Order, next: OrderStatus) => {
    if (!repo.updateOrderStatus(order.id, next)) {
      toast.error("Transición no permitida para este pedido")
      return
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: next } : o))
    )
    toast.success(`Pedido #${order.id} marcado como ${STATUS_LABELS[next].toLowerCase()}`)
  }

  return (
    <section aria-labelledby="orders-title">
      <header className="mb-6">
        <h1
          id="orders-title"
          className="text-2xl font-bold tracking-tight text-text-primary"
        >
          Pedidos
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Bandeja de entrada: confirma, entrega o cancela pedidos. Los cambios
          persisten al recargar.
        </p>
      </header>

      {orders.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageOpen aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No hay pedidos</EmptyTitle>
            <EmptyDescription>
              Los pedidos enviados desde la tienda aparecerán aquí.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul
          role="list"
          aria-label="Lista de pedidos"
          className="flex flex-col gap-2"
        >
          {orders.map((order) => {
            const actions = TRANSITION_ACTIONS[order.status]
            return (
              <li
                key={order.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-primary">
                    <span className="font-bold">#{order.id}</span>
                    <span className="text-text-secondary">
                      {order.customer.nombre} · {order.items.length}{" "}
                      {order.items.length === 1 ? "producto" : "productos"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    {new Date(order.createdAt).toLocaleString("es-CO", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <span className="text-base font-bold text-primary">
                  {formatCOP(order.total)}
                </span>
                <Badge variant={order.status === "cancelled" ? "secondary" : "default"}>
                  {STATUS_LABELS[order.status]}
                </Badge>
                {actions.map(({ to, label, variant }) => (
                  <Button
                    key={to}
                    variant={variant}
                    size="sm"
                    onClick={() => transition(order, to)}
                  >
                    {label}
                  </Button>
                ))}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}