import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/shared/ui/ui/chart"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from "@/shared/ui/ui/empty"
import { formatCOP } from "@/shared/domain/whatsapp"
import {
  averageTicket,
  paymentSplit,
  revenueByDay,
  statusBreakdown,
  uniqueCustomers,
} from "@/shared/domain/analytics"
import type { MetodoPago, OrderStatus } from "@/shared/domain/domain"
import type { DirectoryRepository } from "@/shared/storage/repository"
import { storage } from "@/shared/storage/storage"

interface GlobalSummaryProps {
  /** Test seam: default is the app-wide directory repository. */
  directory?: DirectoryRepository
  /** Test seam: default is the real current time. */
  now?: Date
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Nuevos",
  confirmed: "Confirmados",
  delivered: "Entregados",
  cancelled: "Cancelados",
}

const PAYMENT_LABELS: Record<MetodoPago, string> = {
  Efectivo: "Efectivo",
  Transferencia: "Transferencia",
}

// Chart tokens (design D4, AS-4): reference the runtime --chart-1..5 ramp,
// never hardcoded hex.
const chartConfig = {
  revenue: { label: "Ingresos", color: "var(--chart-1)" },
  new: { label: "Nuevos", color: "var(--chart-1)" },
  confirmed: { label: "Confirmados", color: "var(--chart-2)" },
  delivered: { label: "Entregados", color: "var(--chart-3)" },
  cancelled: { label: "Cancelados", color: "var(--chart-4)" },
  Efectivo: { label: "Efectivo", color: "var(--chart-2)" },
  Transferencia: { label: "Transferencia", color: "var(--chart-3)" },
} as const

/**
 * Super global summary (design D2/SG-1, spec SG-2): aggregates KPIs and charts
 * across every restaurant through `DirectoryRepository.listRestaurants` +
 * `getRepositoryFor(id).listOrders()`, applying the AC-1 rules (cancelled
 * excluded from revenue/ticket/count/customers, kept visible in the status
 * breakdown). Exposes a per-restaurant comparison and a teaching empty state
 * when no restaurant has orders.
 */
export default function GlobalSummary({
  directory = storage,
  now = new Date(),
}: GlobalSummaryProps) {
  const restaurants = directory.listRestaurants()

  const perRestaurant = restaurants.map((restaurant) => {
    const orders = directory.getRepositoryFor(restaurant.id).listOrders()
    const counted = orders.filter(
      (o) => o.status === "confirmed" || o.status === "delivered"
    )
    return {
      restaurant,
      orders,
      revenue: counted.reduce((sum, o) => sum + o.total, 0),
      count: counted.length,
    }
  })

  const allOrders = perRestaurant.flatMap((r) => r.orders)
  const revenue = perRestaurant.reduce((sum, r) => sum + r.revenue, 0)
  const orderCount = perRestaurant.reduce((sum, r) => sum + r.count, 0)
  const status = statusBreakdown(allOrders)
  const payments = paymentSplit(allOrders)
  const ticket = averageTicket(allOrders)
  const customers = uniqueCustomers(allOrders)

  // All range = last 14 days (design D3, AC-2), aggregated across restaurants.
  const buckets = revenueByDay(allOrders, "all", now)
  const statusData = (Object.keys(status) as OrderStatus[]).map((s) => ({
    status: s,
    label: STATUS_LABELS[s],
    value: status[s],
    fill: `var(--color-${s})`,
  }))
  const paymentData = (Object.keys(payments) as MetodoPago[]).map((m) => ({
    metodo: m,
    label: PAYMENT_LABELS[m],
    value: payments[m],
    fill: `var(--color-${m})`,
  }))

  const hasData = allOrders.length > 0

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
        <KpiCard label="Ingresos" value={formatCOP(revenue)} />
        <KpiCard label="Pedidos" value={String(orderCount)} />
        <KpiCard label="Ticket promedio" value={formatCOP(ticket)} />
        <KpiCard label="Clientes únicos" value={String(customers)} />
      </div>

      {hasData ? (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ingresos por día</CardTitle>
              <CardDescription>
                Pedidos confirmados y entregados de todos los restaurantes (últimos 14 días).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[260px]">
                <BarChart data={buckets} margin={{ left: 4, right: 4 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => v.slice(8)}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v: number) => (v === 0 ? "0" : `${Math.round(v / 1000)}k`)}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent formatter={(v) => formatCOP(Number(v))} />}
                  />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estado de pedidos</CardTitle>
              <CardDescription>Desglose por estado, incluidos los cancelados.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                <ChartContainer config={chartConfig} className="h-[220px] w-full max-w-[260px]">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="label" innerRadius={50} outerRadius={80}>
                      {statusData.map((entry) => (
                        <Cell key={entry.status} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
                <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {(Object.keys(status) as OrderStatus[]).map((s) => (
                    <li key={s} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-text-secondary">
                        <span
                          className="size-2.5 shrink-0 rounded-[2px]"
                          style={{ backgroundColor: `var(--color-${s})` }}
                        />
                        {STATUS_LABELS[s]}
                      </span>
                      <span className="font-medium tabular-nums text-text-primary">{status[s]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Método de pago</CardTitle>
              <CardDescription>Cantidad de pedidos por método de pago.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                <ChartContainer config={chartConfig} className="h-[220px] w-full max-w-[260px]">
                  <PieChart>
                    <Pie data={paymentData} dataKey="value" nameKey="label" innerRadius={50} outerRadius={80}>
                      {paymentData.map((entry) => (
                        <Cell key={entry.metodo} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
                <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {(Object.keys(payments) as MetodoPago[]).map((m) => (
                    <li key={m} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-text-secondary">
                        <span
                          className="size-2.5 shrink-0 rounded-[2px]"
                          style={{ backgroundColor: `var(--color-${m})` }}
                        />
                        {PAYMENT_LABELS[m]}
                      </span>
                      <span className="font-medium tabular-nums text-text-primary">{payments[m]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

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
        <Empty className="mt-6 border border-border-subtle bg-card">
          <EmptyContent>
            <EmptyTitle>No hay pedidos en ningún restaurante</EmptyTitle>
            <EmptyDescription>
              Cuando llegue el primer pedido de cualquier restaurante, se reflejará aquí
              automáticamente con sus ingresos y métricas.
            </EmptyDescription>
          </EmptyContent>
        </Empty>
      )}
    </section>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tracking-tight text-text-primary tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}
