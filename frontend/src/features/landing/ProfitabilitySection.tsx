import { useId, useState } from "react"
import { motion } from "motion/react"
import { Calculator, CheckCircle2, Sparkles, TrendingUp, XCircle } from "lucide-react"

const AVERAGE_TICKET = 45_000
const APP_COMMISSION_RATE = 0.28
const MIN_ORDERS = 50
const MAX_ORDERS = 1500
const ORDER_STEP = 50
const DEFAULT_ORDERS = 400
const ORDER_PRESETS = [150, 400, 800] as const

const MAX_MONTHLY_COMMISSION = Math.round(
  MAX_ORDERS * AVERAGE_TICKET * APP_COMMISSION_RATE
)

const BAR_SPRING = {
  type: "spring" as const,
  stiffness: 260,
  damping: 28,
}

const PILL_SPRING = {
  type: "spring" as const,
  stiffness: 420,
  damping: 32,
}

function formatCurrency(amount: number): string {
  const rounded = Math.round(amount)
  return `$${rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`
}

export function ProfitabilitySection() {
  const [monthlyOrders, setMonthlyOrders] = useState<number>(DEFAULT_ORDERS)
  const baseId = useId()
  const headingId = `${baseId}-heading`
  const sliderId = `${baseId}-orders-slider`
  const presetLayoutId = `${baseId}-preset-pill`

  const monthlySales = monthlyOrders * AVERAGE_TICKET
  const monthlyCommissionLost = Math.round(monthlySales * APP_COMMISSION_RATE)
  const annualSavings = monthlyCommissionLost * 12
  const commissionScale = Math.max(
    0.08,
    Math.min(1, monthlyCommissionLost / MAX_MONTHLY_COMMISSION)
  )

  return (
    <section
      aria-labelledby={headingId}
      className="pt-4 pb-20 bg-white dark:bg-[#0B0F19] transition-colors"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-slate-50/80 dark:bg-slate-900/55 p-6 sm:p-8 lg:p-10">
          {/* Header */}
          <div data-gsap-reveal className="text-center max-w-2xl mx-auto mb-8">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-300/80 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 px-3.5 py-1 text-xs font-bold text-orange-800 dark:text-orange-300 mb-3">
              <Calculator className="size-3.5" aria-hidden="true" />
              Comparativa de Rentabilidad
            </span>
            <h3
              id={headingId}
              className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white"
            >
              Dejá de regalar tu margen en cada pedido
            </h3>
            <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300">
              Calculá en vivo cuánto dinero se llevan las comisiones de apps frente a tu canal
              directo con FoodOS.
            </p>
          </div>

          {/* Interactive Live Savings Calculator */}
          <div
            data-gsap-reveal
            className="mb-8 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-950/75 p-5 sm:p-6 shadow-xs"
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    Calculadora de Ahorro en Vivo
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
                  Estimado sobre ticket promedio de{" "}
                  <strong className="font-bold text-slate-900 dark:text-white">
                    {formatCurrency(AVERAGE_TICKET)}
                  </strong>{" "}
                  y comisión promedio de{" "}
                  <strong className="font-bold text-slate-900 dark:text-white">28%</strong> en
                  apps.
                </p>
              </div>

              {/* Quick Volume Presets with scoped Motion layoutId */}
              <div
                role="group"
                aria-label="Volúmenes mensuales sugeridos"
                className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900 p-1.5 self-start lg:self-auto"
              >
                {ORDER_PRESETS.map((preset) => {
                  const isActive = monthlyOrders === preset
                  return (
                    <button
                      key={preset}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setMonthlyOrders(preset)}
                      className={`relative min-h-11 pointer-coarse:min-h-11 cursor-pointer rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                        isActive
                          ? "text-white"
                          : "text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white"
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId={presetLayoutId}
                          transition={PILL_SPRING}
                          aria-hidden="true"
                          className="absolute inset-0 rounded-xl bg-orange-700 shadow-xs"
                        />
                      )}
                      <span className="relative z-10">{preset} pedidos</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Range Slider */}
            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <label
                  htmlFor={sliderId}
                  className="text-sm font-bold text-slate-800 dark:text-slate-100"
                >
                  Pedidos mensuales estimados
                </label>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800/70 px-3 py-1 text-xs font-extrabold text-orange-800 dark:text-orange-300 tabular-nums">
                    {monthlyOrders.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} pedidos/mes
                  </span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 tabular-nums">
                    ({formatCurrency(monthlySales)} facturación)
                  </span>
                </div>
              </div>

              <input
                id={sliderId}
                type="range"
                min={MIN_ORDERS}
                max={MAX_ORDERS}
                step={ORDER_STEP}
                value={monthlyOrders}
                onChange={(e) => setMonthlyOrders(Number(e.target.value))}
                aria-label="Pedidos mensuales estimados"
                className="w-full h-2.5 cursor-pointer accent-orange-700 dark:accent-orange-400 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
              />

              <div className="mt-1.5 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 tabular-nums">
                <span>50 pedidos</span>
                <span>750 pedidos</span>
                <span>1.500 pedidos</span>
              </div>
            </div>

            {/* GPU-only scaleX Comparison Bars + Annual Savings Highlight */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              <div className="lg:col-span-7 space-y-4">
                {/* Bar 1: Delivery Apps Commission Lost */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                      Comisión en apps tradicionales (28%)
                    </span>
                    <span
                      data-testid="profitability-apps-cost"
                      className="text-sm font-extrabold text-rose-700 dark:text-rose-400 tabular-nums"
                    >
                      -{formatCurrency(monthlyCommissionLost)}/mes
                    </span>
                  </div>
                  <div
                    className="h-3.5 w-full overflow-hidden rounded-full bg-rose-100 dark:bg-rose-950/60"
                    aria-hidden="true"
                  >
                    <motion.div
                      style={{ transformOrigin: "left center" }}
                      initial={false}
                      animate={{ scaleX: commissionScale }}
                      transition={BAR_SPRING}
                      className="h-full w-full rounded-full bg-rose-700 dark:bg-rose-500"
                    />
                  </div>
                </div>

                {/* Bar 2: FoodOS Direct 0% Commission */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                      Comisión con FoodOS (0%) · Margen que conservás
                    </span>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span
                        data-testid="profitability-foodos-cost"
                        className="rounded-md bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 text-xs font-extrabold text-emerald-800 dark:text-emerald-300"
                      >
                        $0/mes
                      </span>
                      <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                        +{formatCurrency(monthlyCommissionLost)}/mes
                      </span>
                    </div>
                  </div>
                  <div
                    className="h-3.5 w-full overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950/60"
                    aria-hidden="true"
                  >
                    <motion.div
                      style={{ transformOrigin: "left center" }}
                      initial={false}
                      animate={{ scaleX: commissionScale }}
                      transition={BAR_SPRING}
                      className="h-full w-full rounded-full bg-emerald-700 dark:bg-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Annual Savings Recovered Pill */}
              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-emerald-700/20 bg-emerald-700 px-5 py-4 text-white shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-100">
                    <TrendingUp className="size-4 shrink-0" aria-hidden="true" />
                    <span>Ahorro anual recuperado</span>
                  </div>
                  <div
                    data-testid="profitability-annual-savings"
                    aria-live="polite"
                    className="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-white"
                  >
                    {formatCurrency(annualSavings)}
                  </div>
                  <span className="mt-1 block text-xs font-medium text-emerald-100">
                    Quedan en tu caja cada año en lugar de irse a comisiones
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2-Column Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Traditional Delivery Apps */}
            <div data-gsap-reveal className="h-full">
              <div className="h-full rounded-2xl border border-rose-200/90 dark:border-rose-900/50 bg-white dark:bg-slate-900/80 p-6">
                <h4 className="text-base font-bold text-slate-900 dark:text-white mb-4">
                  Apps de Delivery Tradicionales
                </h4>
                <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <XCircle
                      className="size-4 text-rose-700 dark:text-rose-400 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>25% a 35% de comisión por orden</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <XCircle
                      className="size-4 text-rose-700 dark:text-rose-400 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>Clientes cautivos de la app</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <XCircle
                      className="size-4 text-rose-700 dark:text-rose-400 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>Cobros retenidos por semanas</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* FoodOS Direct */}
            <div data-gsap-reveal className="h-full">
              <div className="h-full rounded-2xl border border-emerald-300/90 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/25 p-6 shadow-xs">
                <h4 className="text-base font-bold text-slate-900 dark:text-white mb-4">
                  Tu Canal Directo con FoodOS
                </h4>
                <ul className="space-y-3 text-sm text-slate-800 dark:text-slate-200 font-medium">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2
                      className="size-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>0% comisiones por venta</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2
                      className="size-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>100% base de datos y CRM propio</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2
                      className="size-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>Pago directo a tu cuenta o efectivo al instante</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
