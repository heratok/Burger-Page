import { useState } from "react"
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
  ordersInRange,
  paymentSplit,
  revenueByDay,
  statusBreakdown,
  uniqueCustomers,
} from "@/shared/domain/analytics"
import type { ResumenRange } from "@/shared/domain/analytics"
import type { OrderStatus, MetodoPago } from "@/shared/domain/domain"
import type { RestaurantRepository } from "@/shared/storage/repository"

interface DashboardResumenProps {
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
// never hardcoded hex (task 2.7).
const chartConfig = {
  revenue: { label: "Ingresos", color: "var(--chart-1)" },
  new: { label: "Nuevos", color: "var(--chart-1)" },
  confirmed: { label: "Confirmados", color: "var(--chart-2)" },
  delivered: { label: "Entregados", color: "var(--chart-3)" },
  cancelled: { label: "Cancelados", color: "var(--chart-4)" },
  Efectivo: { label: "Efectivo", color: "var(--chart-2)" },
  Transferencia: { label: "Transferencia", color: "var(--chart-3)" },
} as const

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
 * metrics derived from Order data via the pure analytics layer, Recharts charts
 * referencing the runtime chart tokens, and teaching empty states for fresh or
 * empty ranges. Replaces the retired SalesPage (DR-1).
 */
export default function DashboardResumen({ repo, now = new Date() }: DashboardResumenProps) {
  const [range, setRange] = useState<ResumenRange>(readStoredRange)

  const orders = repo.listOrders()
  const inRange = ordersInRange(orders, range, now)

  const revenue = inRange
    .filter((o) => o.status === "confirmed" || o.status === "delivered")
    .reduce((sum, o) => sum + o.total, 0)
  const status = statusBreakdown(inRange)
  const payments = paymentSplit(inRange)
  const ticket = averageTicket(inRange)
  const customers = uniqueCustomers(inRange)
  const orderCount = inRange.filter(
    (o) => o.status === "confirmed" || o.status === "delivered"
  ).length

  const buckets = revenueByDay(orders, range, now)
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

  const hasData = inRange.length > 0

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
              <CardDescription>Pedidos confirmados y entregados en el rango.</CardDescription>
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
        </div>
      ) : (
        <Empty className="mt-6 border border-border-subtle bg-card">
          <EmptyContent>
            <EmptyTitle>No hay pedidos en este rango</EmptyTitle>
            <EmptyDescription>
              Cuando llegue un pedido se reflejará aquí automáticamente con sus ingresos y métricas.
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
