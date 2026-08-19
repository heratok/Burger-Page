import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/ui/card"
import { formatCOP } from "@/shared/domain/whatsapp"
import {
  computeResumen,
  KpiCard,
  PaymentSplitCard,
  ResumenEmptyState,
  RevenueByDayCard,
  StatusBreakdownCard,
} from "@/shared/domain/resumen"
import type { DirectoryRepository } from "@/shared/storage/repository"
import { storage } from "@/shared/storage/storage"

interface GlobalSummaryProps {
  /** Test seam: default is the app-wide directory repository. */
  directory?: DirectoryRepository
  /** Test seam: default is the real current time. */
  now?: Date
}

/**
 * Super global summary (design D2/SG-1, spec SG-2): aggregates KPIs and charts
 * across every restaurant through `DirectoryRepository.listRestaurants` +
 * `getRepositoryFor(id).listOrders()`, applying the AC-1 rules (cancelled
 * excluded from revenue/ticket/count/customers, kept visible in the status
 * breakdown) via the shared resumen module (RS-1). Exposes a per-restaurant
 * comparison and a teaching empty state when no restaurant has orders.
 */
export default function GlobalSummary({
  directory = storage,
  now = new Date(),
}: GlobalSummaryProps) {
  const restaurants = directory.listRestaurants()

  const perRestaurant = restaurants.map((restaurant) => {
    const orders = directory.getRepositoryFor(restaurant.id).listOrders() ?? []
    const metrics = computeResumen(orders, "all", now)
    return {
      restaurant,
      orders,
      revenue: metrics.revenue,
      count: metrics.orderCount,
    }
  })

  const allOrders = perRestaurant.flatMap((r) => r.orders)
  const global = computeResumen(allOrders, "all", now)

  return (
    <section aria-labelledby="global-summary-title">
      <header className="mb-6">
        <h1
          id="global-summary-title"
          className="text-2xl font-bold tracking-tight text-text-primary"
        >
          Resumen global
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Métricas agregadas de todos los restaurantes; los cancelados no se cuentan en ingresos.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Ingresos" value={formatCOP(global.revenue)} />
        <KpiCard label="Pedidos" value={String(global.orderCount)} />
        <KpiCard label="Ticket promedio" value={formatCOP(global.ticket)} />
        <KpiCard label="Clientes únicos" value={String(global.customers)} />
      </div>

      {global.hasData ? (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RevenueByDayCard
            buckets={global.buckets}
            description="Pedidos confirmados y entregados de todos los restaurantes (últimos 14 días)."
          />
          <StatusBreakdownCard status={global.status} />
          <PaymentSplitCard payments={global.payments} />

          <Card>
            <CardHeader>
              <CardTitle>Comparación por restaurante</CardTitle>
              <CardDescription>
                Ingresos y pedidos contabilizados por restaurante (cancelados excluidos).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border-subtle text-sm">
                {perRestaurant.map(({ restaurant, revenue, count }) => (
                  <li
                    key={restaurant.id}
                    className="flex items-center justify-between gap-4 py-2"
                  >
                    <span className="min-w-0 truncate font-medium text-text-primary">
                      {restaurant.config.name}
                    </span>
                    <span className="flex items-center gap-3 tabular-nums">
                      <span className="text-text-secondary">{count} pedidos</span>
                      <span className="w-20 text-right font-semibold text-text-primary">
                        {formatCOP(revenue)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : (
        <ResumenEmptyState
          title="No hay pedidos en ningún restaurante"
          description="Cuando llegue el primer pedido de cualquier restaurante, se reflejará aquí automáticamente con sus ingresos y métricas."
        />
      )}
    </section>
  )
}
