import { useState } from "react"
import { formatCOP } from "@/shared/domain/whatsapp"
import {
  computeResumen,
  KpiCard,
  PaymentSplitCard,
  ResumenEmptyState,
  RevenueByDayCard,
  StatusBreakdownCard,
} from "@/shared/domain/resumen"
import type { ResumenRange } from "@/shared/domain/analytics"
import type { RestaurantRepository } from "@/shared/storage/repository"

interface ResumenDashboardProps {
  repo: RestaurantRepository
  /** Test seam: default is the real current time. */
  now?: Date
}

/** Non-grant sessionStorage UI key (design DR-2): selection persists, is not auth. */
const RANGE_KEY = "burger-page:resumen-range"

const RANGES: Array<{ value: ResumenRange; label: string }> = [
  { value: "today", label: "Hoy" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "all", label: "Todo" },
]

function readStoredRange(): ResumenRange {
  const stored = sessionStorage.getItem(RANGE_KEY)
  if (stored === "today" || stored === "7d" || stored === "30d" || stored === "all") {
    return stored
  }
  return "7d"
}

/**
 * Restaurant Resumen dashboard (design D2/D3, spec DR-1/2/3, AC-1/2/3): range
 * selector filtering every KPI and chart, revenue/status/payment/ticket/customer
 * metrics derived from Order data through the shared resumen module (RS-1),
 * Recharts charts referencing the runtime chart tokens, and teaching empty
 * states for fresh or empty ranges. Replaces the retired SalesPage (DR-1).
 */
export default function ResumenDashboard({ repo, now = new Date() }: ResumenDashboardProps) {
  const [range, setRange] = useState<ResumenRange>(readStoredRange)

  const metrics = computeResumen(repo.listOrders() ?? [], range, now)

  const handleRange = (next: ResumenRange) => {
    setRange(next)
    sessionStorage.setItem(RANGE_KEY, next)
  }

  return (
    <section aria-labelledby="resumen-title">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="resumen-title" className="text-2xl font-bold tracking-tight text-text-primary">
            Resumen
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Métricas de pedidos; los cancelados no se cuentan en ingresos.
          </p>
        </div>
        <div role="group" aria-label="Rango de fechas" className="flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={range === r.value}
              onClick={() => handleRange(r.value)}
              className="rounded-md border border-border-subtle px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-foreground"
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Ingresos" value={formatCOP(metrics.revenue)} />
        <KpiCard label="Pedidos" value={String(metrics.orderCount)} />
        <KpiCard label="Ticket promedio" value={formatCOP(metrics.ticket)} />
        <KpiCard label="Clientes únicos" value={String(metrics.customers)} />
      </div>

      {metrics.hasData ? (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RevenueByDayCard
            buckets={metrics.buckets}
            description="Pedidos confirmados y entregados en el rango."
          />
          <StatusBreakdownCard status={metrics.status} />
          <PaymentSplitCard payments={metrics.payments} />
        </div>
      ) : (
        <ResumenEmptyState
          title="No hay pedidos en este rango"
          description="Cuando llegue un pedido se reflejará aquí automáticamente con sus ingresos y métricas."
        />
      )}
    </section>
  )
}
