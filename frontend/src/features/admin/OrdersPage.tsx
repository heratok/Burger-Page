import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Eye, PackageOpen, Search } from "lucide-react"
import { Button } from "@/shared/ui/ui/button"
import { Badge } from "@/shared/ui/ui/badge"
import { Input } from "@/shared/ui/ui/input"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/shared/ui/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/ui/empty"
import { storage } from "@/shared/storage/storage"
import { formatCOP } from "@/shared/domain/whatsapp"
import type { Order, OrderStatus } from "@/shared/domain/domain"
import type { RestaurantRepository } from "@/shared/storage/repository"

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Nuevo",
  confirmed: "Confirmado",
  delivered: "Entregado",
  cancelled: "Cancelado",
}

/** Status filter tabs: "all" shows every order (AS-1 pending badge unaffected). */
type OrderFilter = "all" | OrderStatus

const FILTER_TABS: { value: OrderFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "new", label: "Nuevo" },
  { value: "confirmed", label: "Confirmado" },
  { value: "delivered", label: "Entregado" },
  { value: "cancelled", label: "Cancelado" },
]

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

/**
 * Pure filter used by the inbox: narrows orders by status tab and by a query
 * that matches the customer name or any item name. Kept pure so the search and
 * tab behaviour stay deterministic and unit-testable.
 */
export function filterOrders(
  orders: Order[],
  status: OrderFilter,
  query: string
): Order[] {
  const q = query.trim().toLowerCase()
  return orders.filter((order) => {
    if (status !== "all" && order.status !== status) return false
    if (q === "") return true
    if (order.customer.nombre.toLowerCase().includes(q)) return true
    return order.items.some((item) => item.name.toLowerCase().includes(q))
  })
}

interface OrdersPageProps {
  repo?: RestaurantRepository
}

export default function OrdersPage({ repo = storage }: OrdersPageProps) {
  const [orders, setOrders] = useState<Order[]>(() => repo.listOrders())
  const [statusFilter, setStatusFilter] = useState<OrderFilter>("all")
  const [query, setQuery] = useState("")
  const [detail, setDetail] = useState<Order | null>(null)

  const visibleOrders = useMemo(
    () => filterOrders(orders, statusFilter, query),
    [orders, statusFilter, query]
  )

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
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as OrderFilter)}
            >
              <TabsList>
                {FILTER_TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="relative w-full sm:w-64">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Buscar pedidos"
                placeholder="Buscar por cliente o producto…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {visibleOrders.length === 0 ? (
            <p className="py-10 text-center text-sm text-text-secondary">
              No hay pedidos que coincidan con el filtro.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleOrders.map((order) => {
                  const actions = TRANSITION_ACTIONS[order.status]
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">#{order.id}</TableCell>
                      <TableCell>{order.customer.nombre}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(order.createdAt).toLocaleString("es-CO", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell className="font-semibold text-primary">
                        {formatCOP(order.total)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={order.status === "cancelled" ? "secondary" : "default"}
                        >
                          {STATUS_LABELS[order.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Ver detalle del pedido #${order.id}`}
                            onClick={() => setDetail(order)}
                          >
                            <Eye aria-hidden="true" />
                            Ver detalle
                          </Button>
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
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      <OrderDetailDialog order={detail} onClose={() => setDetail(null)} />
    </section>
  )
}

/** Order detail dialog: items, customer, payment and notes (design Slice 3). */
function OrderDetailDialog({
  order,
  onClose,
}: {
  order: Order | null
  onClose: () => void
}) {
  return (
    <Dialog open={order !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Pedido #{order?.id ?? ""}
          </DialogTitle>
          <DialogDescription>
            Detalle del pedido recibido en la tienda.
          </DialogDescription>
        </DialogHeader>

        {order && (
          <div className="flex flex-col gap-4 text-sm">
            <div>
              <h3 className="mb-1 font-medium text-text-primary">Productos</h3>
              <ul className="flex flex-col gap-1">
                {order.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-baseline justify-between gap-2"
                  >
                    <span className="text-text-primary">
                      {item.cantidad} × {item.name}
                      {item.observacion ? ` (${item.observacion})` : ""}
                    </span>
                    <span className="font-medium">{formatCOP(item.total)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 border-t pt-2 text-right font-semibold text-text-primary">
                Total: {formatCOP(order.total)}
              </p>
            </div>

            <div>
              <h3 className="mb-1 font-medium text-text-primary">Cliente</h3>
              <p>{order.customer.nombre}</p>
              <p className="text-text-secondary">
                {order.customer.telefono} · {order.customer.direccion},{" "}
                {order.customer.barrio}
              </p>
            </div>

            <div>
              <h3 className="mb-1 font-medium text-text-primary">Pago</h3>
              <p>
                {order.metodo}
                {order.pagoCon ? ` · ${order.pagoCon}` : ""}
              </p>
            </div>

            {(order.comentario || order.items.some((i) => i.observacion)) && (
              <div>
                <h3 className="mb-1 font-medium text-text-primary">Notas</h3>
                {order.comentario && <p>{order.comentario}</p>}
                {order.items
                  .filter((i) => i.observacion)
                  .map((i) => (
                    <p key={i.id}>
                      {i.name}: {i.observacion}
                    </p>
                  ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
