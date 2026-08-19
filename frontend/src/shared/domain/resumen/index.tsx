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
import type { DayBucket, ResumenRange } from "@/shared/domain/analytics"
import type { MetodoPago, Order, OrderStatus } from "@/shared/domain/domain"

/**
 * Shared resumen module (design D2, spec RS-1): the single source for the
 * plural status/payment labels, the chart config, the chart-card presenters
 * and computeResumen. ResumenDashboard (range+scope) and GlobalSummary
 * (aggregate+comparison) both derive from here; OrdersPage keeps its singular
 * labels untouched (RS-1 "OrdersPage untouched").
 */

/** Plural status labels — the single definition (RS-1 "Single label source"). */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Nuevos",
  confirmed: "Confirmados",
  delivered: "Entregados",
  cancelled: "Cancelados",
}

/** Plural payment labels — the single definition (RS-1). */
export const PAYMENT_LABELS: Record<MetodoPago, string> = {
  Efectivo: "Efectivo",
  Transferencia: "Transferencia",
}

// Chart tokens (design D4, AS-4): reference the runtime --chart-1..5 ramp,
// never hardcoded hex. Labels derive from the single label sources above, so
// the plural labels are defined exactly once (RS-1).
export const chartConfig = {
  revenue: { label: "Ingresos", color: "var(--chart-1)" },
  new: { label: STATUS_LABELS.new, color: "var(--chart-1)" },
  confirmed: { label: STATUS_LABELS.confirmed, color: "var(--chart-2)" },
  delivered: { label: STATUS_LABELS.delivered, color: "var(--chart-3)" },
  cancelled: { label: STATUS_LABELS.cancelled, color: "var(--chart-4)" },
  Efectivo: { label: PAYMENT_LABELS.Efectivo, color: "var(--chart-2)" },
  Transferencia: { label: PAYMENT_LABELS.Transferencia, color: "var(--chart-3)" },
} as const

export interface ResumenMetrics {
  revenue: number
  orderCount: number
  ticket: number
  customers: number
  status: Record<OrderStatus, number>
  payments: Record<MetodoPago, number>
  buckets: DayBucket[]
  hasData: boolean
}

/**
 * Computes every resumen metric for the active range in one pass (design D2,
 * spec RS-1): the AC-1 rules from the analytics layer apply (cancelled orders
 * excluded from revenue, count, ticket and customers, but kept visible in the
 * status breakdown), and revenue buckets by order day.
 */
export function computeResumen(
  orders: Order[],
  range: ResumenRange,
  now: Date
): ResumenMetrics {
  const inRange = ordersInRange(orders, range, now)
  return {
    revenue: inRange
      .filter((o) => o.status === "confirmed" || o.status === "delivered")
      .reduce((sum, o) => sum + o.total, 0),
    orderCount: inRange.filter(
      (o) => o.status === "confirmed" || o.status === "delivered"
    ).length,
    ticket: averageTicket(inRange),
    customers: uniqueCustomers(inRange),
    status: statusBreakdown(inRange),
    payments: paymentSplit(inRange),
    buckets: revenueByDay(orders, range, now),
    hasData: inRange.length > 0,
  }
}

export function KpiCard({ label, value }: { label: string; value: string }) {
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

export function RevenueByDayCard({
  buckets,
  description,
}: {
  buckets: DayBucket[]
  description: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresos por día</CardTitle>
        <CardDescription>{description}</CardDescription>
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
  )
}

export function StatusBreakdownCard({ status }: { status: Record<OrderStatus, number> }) {
  const statusData = (Object.keys(status) as OrderStatus[]).map((s) => ({
    status: s,
    label: STATUS_LABELS[s],
    value: status[s],
    fill: `var(--color-${s})`,
  }))

  return (
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
  )
}

export function PaymentSplitCard({ payments }: { payments: Record<MetodoPago, number> }) {
  const paymentData = (Object.keys(payments) as MetodoPago[]).map((m) => ({
    metodo: m,
    label: PAYMENT_LABELS[m],
    value: payments[m],
    fill: `var(--color-${m})`,
  }))

  return (
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
  )
}

export function ResumenEmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <Empty className="mt-6 border border-border-subtle bg-card">
      <EmptyContent>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyContent>
    </Empty>
  )
}
