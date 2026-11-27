import { useState } from "react"
import { motion } from "motion/react"
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Layers,
  MessageSquare,
  Palette,
  QrCode,
  Store,
  TrendingUp,
  Zap,
} from "lucide-react"
import { TiltCard } from "./MotionPrimitives"

const SWITCH_SPRING = {
  type: "spring" as const,
  stiffness: 420,
  damping: 30,
}

const BRAND_SWATCHES = [
  {
    id: "brasa",
    name: "Brasa",
    swatchClass: "bg-orange-700 dark:bg-orange-500",
    pillClass:
      "border-orange-200 dark:border-orange-800/70 bg-orange-50 dark:bg-orange-950/60 text-orange-800 dark:text-orange-200",
    dotClass: "bg-orange-700 dark:bg-orange-400",
  },
  {
    id: "ambar",
    name: "Ámbar",
    swatchClass: "bg-amber-600 dark:bg-amber-400",
    pillClass:
      "border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200",
    dotClass: "bg-amber-700 dark:bg-amber-400",
  },
  {
    id: "carbon",
    name: "Carbón",
    swatchClass: "bg-slate-900 dark:bg-slate-200",
    pillClass:
      "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100",
    dotClass: "bg-slate-900 dark:bg-slate-200",
  },
  {
    id: "fresco",
    name: "Fresco",
    swatchClass: "bg-emerald-700 dark:bg-emerald-400",
    pillClass:
      "border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200",
    dotClass: "bg-emerald-700 dark:bg-emerald-400",
  },
] as const

export function FeaturesBento() {
  const [stockActive, setStockActive] = useState(true)
  const [activeSwatchId, setActiveSwatchId] =
    useState<(typeof BRAND_SWATCHES)[number]["id"]>("brasa")

  const activeSwatch =
    BRAND_SWATCHES.find((swatch) => swatch.id === activeSwatchId) ?? BRAND_SWATCHES[0]

  return (
    <section
      id="features"
      className="scroll-mt-20 py-20 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0B0F19] transition-colors"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div data-gsap-reveal className="text-center max-w-3xl mx-auto mb-14">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-300/80 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-orange-300 mb-4">
            Plataforma Todo-en-Uno
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Todo lo que tu restaurante necesita para vender más
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            Diseñado desde cero para agilizar cada pedido, elevar el ticket promedio y cuidar tus
            ganancias netas sin intermediarios.
          </p>
        </div>

        {/* Balanced asymmetric Bento:
            md (6 cols): 3+3 | 3+3 | 3+3
            lg (12 cols): 7+5 | 4+4+4 | 12 */}
        <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-5">
          {/* Card 1 — Featured WhatsApp Flow (Porcelain Editorial + Obsidian Flow Strip) */}
          <div data-gsap-bento className="md:col-span-3 lg:col-span-7 h-full">
            <TiltCard maxTilt={4} className="h-full rounded-3xl">
              <article className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-lg shadow-slate-900/[0.04] dark:shadow-slate-950/50 transition-colors hover:border-orange-300 dark:hover:border-orange-500/45">
                <div
                  aria-hidden="true"
                  style={{
                    background:
                      "radial-gradient(300px circle at 92% 4%, rgba(16, 185, 129, 0.08), transparent 65%)",
                  }}
                  className="pointer-events-none absolute inset-0"
                />

                <div className="relative z-10">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100/80 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25">
                      <MessageSquare className="size-6" aria-hidden="true" />
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      <span
                        className="size-2 rounded-full bg-emerald-700 dark:bg-emerald-400"
                        aria-hidden="true"
                      />
                      Sin descargas ni registros
                    </span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Pedidos por WhatsApp sin Fricción
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Tus clientes arman su carrito en segundos desde cualquier celular. Recibí la
                    orden lista y estructurada en tu WhatsApp con dirección, método de pago, notas y
                    desglose exacto.
                  </p>
                </div>

                {/* Embedded Dark Obsidian Live WhatsApp Flow Strip */}
                <div className="relative z-10 mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white shadow-inner">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800/90">
                    <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200">
                      <span className="relative flex size-2 shrink-0" aria-hidden="true">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
                        <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                      </span>
                      Flujo directo en vivo
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-200 tabular-nums">
                      ~25 seg promedio
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-100">
                      Cliente
                    </span>
                    <span
                      aria-hidden="true"
                      className="inline-flex items-center text-orange-200"
                    >
                      <ArrowRight className="size-3.5 shrink-0" />
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-orange-500/50 bg-orange-950 px-3 py-1.5 text-orange-200">
                      Menú
                    </span>
                    <span
                      aria-hidden="true"
                      className="inline-flex items-center text-emerald-200"
                    >
                      <ArrowRight className="size-3.5 shrink-0" />
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-white shadow-sm shadow-emerald-950/60">
                      <Zap className="size-3.5 shrink-0" aria-hidden="true" />
                      <span>WhatsApp Listo · 0.4s</span>
                    </span>
                  </div>
                </div>
              </article>
            </TiltCard>
          </div>

          {/* Card 2 — Jet-Black Obsidian Anchor Card (0% Comisiones, 100% Margen) */}
          <div data-gsap-bento className="md:col-span-3 lg:col-span-5 h-full">
            <TiltCard maxTilt={4} className="h-full rounded-3xl">
              <article className="relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-6 sm:p-7 text-white shadow-2xl shadow-slate-950/40">
                {/* Top ember architectural hairline */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/85 to-transparent"
                />
                {/* Subtle radial ember ambient wash (no blur filter) */}
                <div
                  aria-hidden="true"
                  style={{
                    background:
                      "radial-gradient(280px circle at 88% 0%, rgba(234, 88, 12, 0.24), transparent 68%)",
                  }}
                  className="pointer-events-none absolute inset-0"
                />

                <div className="relative z-10">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-orange-500/40 bg-orange-950 text-orange-200">
                      <TrendingUp className="size-6" aria-hidden="true" />
                    </div>
                    <span className="inline-flex items-center rounded-full bg-orange-700 px-3 py-1 text-xs font-bold text-white shadow-sm shadow-orange-950/50">
                      +45% ticket promedio
                    </span>
                  </div>

                  {/* Giant tabular 0% display anchor */}
                  <div className="mb-3 flex items-baseline gap-3">
                    <span className="font-mono text-6xl sm:text-7xl font-black leading-none tracking-tighter tabular-nums text-white">
                      0%
                    </span>
                    <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-orange-200">
                      Comisión por venta
                    </span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
                    0% Comisiones, 100% Margen
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-200">
                    Eliminá el peaje del 30% por venta y multiplicá tu margen con adiciones, salsas
                    y combos sugeridos antes de cerrar la compra.
                  </p>
                </div>

                {/* Glowing emerald 100% para tu caja bar */}
                <div className="relative z-10 mt-6 rounded-2xl border border-emerald-500/35 bg-emerald-950/75 p-4">
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                      100% para tu caja
                    </span>
                    <span className="font-mono text-xs font-extrabold text-white tabular-nums">
                      $0 comisión
                    </span>
                  </div>
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full bg-slate-900"
                    aria-hidden="true"
                  >
                    <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-amber-300 shadow-[0_0_16px_rgba(16,185,129,0.65)]" />
                  </div>
                </div>
              </article>
            </TiltCard>
          </div>

          {/* Card 3 — Smart QR Tables */}
          <div data-gsap-bento className="md:col-span-3 lg:col-span-4 h-full">
            <TiltCard maxTilt={4} className="h-full rounded-3xl">
              <article className="flex h-full flex-col justify-between rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-all hover:border-orange-300 dark:hover:border-orange-500/45 hover:shadow-lg">
                <div>
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-100/80 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25 mb-4">
                    <QrCode className="size-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Mesas & Códigos QR Inteligentes
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Imprimí el QR para cada mesa o empaque. Tus comensales escanean, piden y la
                    orden entra etiquetada por zona.
                  </p>
                </div>

                {/* QR Table Medallion Embed */}
                <div className="mt-5 flex items-center justify-between gap-2 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 px-3.5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-white shadow-xs">
                      <QrCode className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <span className="block text-xs font-extrabold text-slate-900 dark:text-white">
                        Mesa 04 · Terraza
                      </span>
                      <span className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Zona Salón
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/70 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <span
                      className="size-1.5 rounded-full bg-emerald-700 dark:bg-emerald-400"
                      aria-hidden="true"
                    />
                    QR Activo
                  </span>
                </div>
              </article>
            </TiltCard>
          </div>

          {/* Card 4 — Real-Time Kanban */}
          <div data-gsap-bento className="md:col-span-3 lg:col-span-4 h-full">
            <TiltCard maxTilt={4} className="h-full rounded-3xl">
              <article className="flex h-full flex-col justify-between rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-all hover:border-orange-300 dark:hover:border-orange-500/45 hover:shadow-lg">
                <div>
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/25 mb-4">
                    <Zap className="size-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Tablero Kanban en Tiempo Real
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Gestioná tu cocina con alertas sonoras y mové cada ticket sin errores desde que
                    ingresa hasta la entrega.
                  </p>
                </div>

                {/* Kanban Status Pills Embed */}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 px-3 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/70 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
                    <span
                      className="size-1.5 rounded-full bg-amber-700 dark:bg-amber-400"
                      aria-hidden="true"
                    />
                    Pendiente
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800/70 px-2.5 py-1 text-xs font-bold text-orange-800 dark:text-orange-300">
                    <span
                      className="size-1.5 rounded-full bg-orange-700 dark:bg-orange-400"
                      aria-hidden="true"
                    />
                    Cocina
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <span
                      className="size-1.5 rounded-full bg-emerald-700 dark:bg-emerald-400"
                      aria-hidden="true"
                    />
                    Listo
                  </span>
                </div>
              </article>
            </TiltCard>
          </div>

          {/* Card 5 — Brand & Domain */}
          <div data-gsap-bento className="md:col-span-3 lg:col-span-4 h-full">
            <TiltCard maxTilt={4} className="h-full rounded-3xl">
              <article className="flex h-full flex-col justify-between rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-all hover:border-orange-300 dark:hover:border-orange-500/45 hover:shadow-lg">
                <div>
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-100/90 dark:bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-500/25 mb-4">
                    <Palette className="size-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Tu Marca, Tu Dominio
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Tu tienda refleja tus colores, logotipo y banners con un slug propio y una base
                    de clientes CRM 100% tuya.
                  </p>
                </div>

                {/* Interactive Warm Brand Palette Switcher Embed */}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 px-3.5 py-2.5">
                  <div
                    role="group"
                    aria-label="Paleta cálida personalizable"
                    className="flex items-center gap-1.5"
                  >
                    {BRAND_SWATCHES.map((swatch) => {
                      const isSelected = swatch.id === activeSwatch.id
                      return (
                        <button
                          key={swatch.id}
                          type="button"
                          aria-pressed={isSelected}
                          aria-label={`Previsualizar tono ${swatch.name}`}
                          onClick={() => setActiveSwatchId(swatch.id)}
                          className={`inline-flex size-6 pointer-coarse:size-11 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                            isSelected
                              ? "ring-2 ring-slate-900 dark:ring-white ring-offset-1 ring-offset-slate-50 dark:ring-offset-slate-950"
                              : ""
                          }`}
                        >
                          <span
                            className={`size-4 rounded-full ${swatch.swatchClass}`}
                            aria-hidden="true"
                          />
                        </button>
                      )
                    })}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${activeSwatch.pillClass}`}
                  >
                    <span
                      className={`size-2 rounded-full ${activeSwatch.dotClass}`}
                      aria-hidden="true"
                    />
                    <span>tumarca.foodos.app</span>
                  </span>
                </div>
              </article>
            </TiltCard>
          </div>

          {/* Card 6 — Stock, Reports & Multi-Branch Strip */}
          <div data-gsap-bento className="md:col-span-3 lg:col-span-12 h-full">
            <article className="flex h-full flex-col lg:flex-row lg:items-center lg:justify-between gap-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-sm transition-colors hover:border-orange-300 dark:hover:border-orange-500/45 hover:shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4 lg:max-w-2xl">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-slate-800 border border-slate-700">
                  <Layers className="size-6" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Control de Stock, Reportes & Multi-Sede
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Pausá productos agotados en un clic, consultá métricas diarias de ventas y
                    administrá múltiples sucursales desde un mismo panel centralizado.
                  </p>
                </div>
              </div>

              {/* Instant availability toggle + multi-branch summary */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2
                      className={`size-4 shrink-0 transition-colors ${
                        stockActive
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                      aria-hidden="true"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                        Smash Doble
                      </span>
                      <span
                        aria-live="polite"
                        className={`text-xs font-semibold ${
                          stockActive
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {stockActive ? "Disponible en menú" : "Pausada al instante"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={stockActive}
                    aria-label="Alternar disponibilidad instantánea de Smash Doble"
                    onClick={() => setStockActive((prev) => !prev)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                      stockActive
                        ? "bg-emerald-700 dark:bg-emerald-500"
                        : "bg-slate-300 dark:bg-slate-700"
                    }`}
                  >
                    <motion.span
                      layout
                      transition={SWITCH_SPRING}
                      className={`block size-5 rounded-full bg-white shadow-xs ${
                        stockActive ? "ml-auto" : "mr-auto"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <BarChart3
                    className="size-4 text-orange-700 dark:text-orange-400 shrink-0"
                    aria-hidden="true"
                  />
                  <span>Reportes live</span>
                  <span className="text-slate-600 dark:text-slate-400" aria-hidden="true">
                    ·
                  </span>
                  <Store
                    className="size-4 text-amber-800 dark:text-amber-400 shrink-0"
                    aria-hidden="true"
                  />
                  <span>Multi-sede</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  )
}
