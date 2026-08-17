import { useState } from "react"
import { TrendingUp } from "lucide-react"
import { storage } from "@/lib/storage"
import { computeSalesMetrics } from "@/lib/orders"
import { formatCOP } from "@/lib/whatsapp"
import type { RestaurantRepository } from "@/lib/repository"

interface SalesPageProps {
  repo?: RestaurantRepository
}

/**
 * Sales summary (spec sales-summary): today's count/revenue plus all-time
 * totals via computeSalesMetrics (confirmed|delivered, cancelled excluded).
 */
export default function SalesPage({ repo = storage }: SalesPageProps) {
  const [metrics] = useState(() => computeSalesMetrics(repo.listOrders(), new Date()))

  const cards = [
    {
      label: "Ventas de hoy",
      count: metrics.today.count,
      revenue: metrics.today.revenue,
    },
    {
      label: "Histórico total",
      count: metrics.allTime.count,
      revenue: metrics.allTime.revenue,
    },
  ]

  return (
    <section aria-labelledby="sales-title">
      <header className="mb-6">
        <h1
          id="sales-title"
          className="text-2xl font-bold tracking-tight text-text-primary"
        >
          Ventas
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Pedidos confirmados y entregados; los cancelados no se cuentan.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <article
            key={card.label}
            className="rounded-lg border border-border-subtle bg-card p-5"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <TrendingUp className="size-4 text-primary" aria-hidden="true" />
              {card.label}
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-text-primary">
              {card.count}
            </p>
            <p className="text-lg font-semibold text-primary">
              {formatCOP(card.revenue)}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}