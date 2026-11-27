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

const VALUE_POP_SPRING = {
  type: "spring" as const,
  stiffness: 460,
  damping: 26,
}

function formatNumber(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

function formatCurrency(amount: number): string {
  return `$${formatNumber(amount)}`
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
        {/* Section Editorial Header */}
        <div data-gsap-reveal className="text-center max-w-2xl mx-auto mb-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-300/80 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-orange-300 mb-3">
            <Calculator className="size-3.5" aria-hidden="true" />
            Comparativa de Rentabilidad
          </span>
          <h3
            id={headingId}
            className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white"
          >
            Dejá de regalar tu margen en cada pedido
          </h3>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            Calculá en vivo cuánto dinero se llevan las comisiones de apps frente a tu canal directo
            con FoodOS.
          </p>
        </div>

        {/* Jet-Black Obsidian Revenue Terminal */}
        <div
          data-gsap-reveal
          className="relative mb-8 overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 p-6 sm:p-10 text-white shadow-[0_32px_90px_-24px_rgba(15,23,42,0.5)]"
        >
          {/* Top Ember Hairline Gradient */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/85 to-transparent"
          />
          {/* Subtle Warm Ambient Top Glow (pure radial-gradient, zero blur filter) */}
          <div
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(480px circle at 85% 0%, rgba(234, 88, 12, 0.18), transparent 68%)",
            }}
            className="pointer-events-none absolute inset-0"
          />

          <div className="relative z-10">
            {/* Terminal Top Bar + Preset Segmented Control */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 pb-6 border-b border-slate-800/90">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-950 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-200">
                    <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
                    Calculadora de Ahorro en Vivo
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1 font-mono text-xs font-semibold text-slate-200">
                    <span
                      className="size-1.5 rounded-full bg-emerald-400"
                      aria-hidden="true"
                    />
                    LIVE TERMINAL
                  </span>
                </div>
                <p className="mt-2.5 text-sm font-medium text-slate-200">
                  Estimado sobre ticket promedio de{" "}
                  <strong className="font-mono font-bold text-white">
                    {formatCurrency(AVERAGE_TICKET)}
                  </strong>{" "}
                  y comisión promedio de{" "}
                  <strong className="font-mono font-bold text-orange-200">28%</strong> en apps.
                </p>
              </div>

              {/* Scoped Motion layoutId Ember Preset Segmented Control */}
              <div
                role="group"
                aria-label="Volúmenes mensuales sugeridos"
                className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-900 p-1.5 self-start lg:self-auto"
              >
                {ORDER_PRESETS.map((preset) => {
                  const isActive = monthlyOrders === preset
                  return (
                    <button
                      key={preset}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setMonthlyOrders(preset)}
                      className={`relative min-h-11 pointer-coarse:min-h-11 cursor-pointer rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                        isActive ? "text-white" : "text-slate-200 hover:text-white"
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId={presetLayoutId}
                          transition={PILL_SPRING}
                          aria-hidden="true"
                          className="absolute inset-0 rounded-xl bg-orange-700 shadow-md shadow-orange-950/60"
                        />
                      )}
                      <span className="relative z-10">{preset} pedidos</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Volume Slider + Live Volume Readout */}
            <div className="mt-6 rounded-2xl border border-slate-800/90 bg-slate-900/75 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
                <label
                  htmlFor={sliderId}
                  className="text-sm font-bold text-white"
                >
                  Pedidos mensuales estimados
                </label>
                <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-orange-500/40 bg-slate-950 px-3.5 py-1.5 font-mono text-xs font-bold tabular-nums">
                  <span className="text-orange-200">
                    {formatNumber(monthlyOrders)} pedidos/mes
                  </span>
                  <span className="text-slate-200" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-white">
                    {formatCurrency(monthlySales)} facturación
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
                aria-valuetext={`${formatNumber(monthlyOrders)} pedidos al mes`}
                className="w-full min-h-11 py-4 cursor-pointer accent-orange-500 rounded-lg bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              />

              <div className="mt-0.5 flex items-center justify-between font-mono text-xs font-semibold text-slate-200 tabular-nums">
                <span>50 pedidos</span>
                <span>750 pedidos</span>
                <span>1.500 pedidos</span>
              </div>
            </div>

            {/* Dramatic Split Readout: Commission Burn vs Obsidian Emerald Annual Savings */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left: Luminous Rose vs Glowing Emerald scaleX Comparison Bars */}
              <div className="lg:col-span-7 flex flex-col justify-center gap-5 rounded-2xl border border-slate-800/90 bg-slate-900/75 p-5 sm:p-6">
                {/* Bar 1: Delivery Apps Commission Burn */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-xs sm:text-sm font-bold text-slate-100">
                      Comisión quemada en apps tradicionales (28%)
                    </span>
                    <span
                      data-testid="profitability-apps-cost"
                      className="font-mono text-sm sm:text-base font-extrabold text-rose-200 tabular-nums"
                    >
                      -{formatCurrency(monthlyCommissionLost)}/mes
                    </span>
                  </div>
                  <div
                    className="h-3.5 w-full overflow-hidden rounded-full border border-rose-800/40 bg-rose-950/75"
                    aria-hidden="true"
                  >
                    <motion.div
                      style={{ transformOrigin: "left center" }}
                      initial={false}
                      animate={{ scaleX: commissionScale }}
                      transition={BAR_SPRING}
                      className="h-full w-full rounded-full bg-gradient-to-r from-rose-600 via-rose-500 to-orange-500 shadow-[0_0_16px_rgba(244,63,94,0.5)]"
                    />
                  </div>
                </div>

                {/* Bar 2: FoodOS Direct 0% Commission Retained */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-xs sm:text-sm font-bold text-slate-100">
                      Comisión con FoodOS (0%) · Margen que conservás
                    </span>
                    <div className="flex items-center gap-2 font-mono tabular-nums">
                      <span
                        data-testid="profitability-foodos-cost"
                        className="rounded-lg border border-emerald-500/45 bg-emerald-950 px-2.5 py-0.5 text-xs font-extrabold text-emerald-200"
                      >
                        $0/mes
                      </span>
                      <span className="text-sm sm:text-base font-extrabold text-emerald-200">
                        +{formatCurrency(monthlyCommissionLost)}/mes
                      </span>
                    </div>
                  </div>
                  <div
                    className="h-3.5 w-full overflow-hidden rounded-full border border-emerald-800/40 bg-emerald-950/75"
                    aria-hidden="true"
                  >
                    <motion.div
                      style={{ transformOrigin: "left center" }}
                      initial={false}
                      animate={{ scaleX: commissionScale }}
                      transition={BAR_SPRING}
                      className="h-full w-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-amber-300 shadow-[0_0_16px_rgba(16,185,129,0.55)]"
                    />
                  </div>
                </div>
              </div>

              {/* Right: Glowing Emerald Obsidian Annual Savings Display */}
              <div className="lg:col-span-5">
                <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-emerald-700/60 bg-emerald-950/90 p-6 shadow-[0_20px_50px_-16px_rgba(16,185,129,0.35)]">
                  <div
                    aria-hidden="true"
                    style={{
                      background:
                        "radial-gradient(260px circle at 90% 10%, rgba(16, 185, 129, 0.25), transparent 70%)",
                    }}
                    className="pointer-events-none absolute inset-0"
                  />

                  <div className="relative z-10">
                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-emerald-200">
                      <TrendingUp className="size-4 shrink-0" aria-hidden="true" />
                      <span>Ahorro anual recuperado</span>
                    </div>

                    <div aria-live="polite" aria-atomic="true">
                      <motion.div
                        key={annualSavings}
                        data-testid="profitability-annual-savings"
                        initial={{ opacity: 0.72, scale: 0.96, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={VALUE_POP_SPRING}
                        className="mt-3 font-mono text-3xl sm:text-4xl xl:text-[2.6rem] font-black leading-none tracking-tight tabular-nums text-white"
                      >
                        {formatCurrency(annualSavings)}
                      </motion.div>
                    </div>
                  </div>

                  <div className="relative z-10 mt-4 border-t border-emerald-800/70 pt-3.5">
                    <span className="block text-xs font-semibold text-emerald-100 leading-relaxed">
                      Quedan en tu caja cada año en lugar de irse a comisiones de terceros.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2-Column Side-by-Side Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Traditional Delivery Apps */}
          <div data-gsap-reveal className="h-full">
            <div className="h-full rounded-3xl border border-rose-200/90 dark:border-rose-900/50 bg-white dark:bg-slate-900/80 p-6 sm:p-7 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
                <h4 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Apps de Delivery Tradicionales
                </h4>
                <span className="inline-flex items-center rounded-full border border-rose-200 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 text-xs font-bold text-rose-800 dark:text-rose-300">
                  Peaje por venta
                </span>
              </div>
              <ul className="space-y-3.5 text-sm text-slate-700 dark:text-slate-300">
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
            <div className="h-full rounded-3xl border-2 border-emerald-300 dark:border-emerald-700/70 bg-emerald-50/65 dark:bg-emerald-950/25 p-6 sm:p-7 shadow-lg shadow-emerald-950/[0.06]">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
                <h4 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Tu Canal Directo con FoodOS
                </h4>
                <span className="inline-flex items-center rounded-full bg-emerald-700 px-3 py-0.5 text-xs font-bold text-white">
                  Canal propio
                </span>
              </div>
              <ul className="space-y-3.5 text-sm text-slate-800 dark:text-slate-200 font-medium">
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
    </section>
  )
}
