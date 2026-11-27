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

const CARD_SPRING = {
  type: "spring" as const,
  stiffness: 380,
  damping: 28,
}

const BRAND_SWATCHES = [
  { name: "Brasa", swatchClass: "bg-orange-700 dark:bg-orange-500" },
  { name: "Ámbar", swatchClass: "bg-amber-600 dark:bg-amber-400" },
  { name: "Carbón", swatchClass: "bg-slate-900 dark:bg-slate-200" },
  { name: "Fresco", swatchClass: "bg-emerald-700 dark:bg-emerald-400" },
]

export function FeaturesBento() {
  const [stockActive, setStockActive] = useState(true)

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
          {/* Card 1 — Featured WhatsApp Flow */}
          <div data-gsap-bento className="md:col-span-3 lg:col-span-7 h-full">
            <motion.article
              whileHover={{ y: -4 }}
              transition={CARD_SPRING}
              className="group relative flex h-full flex-col justify-between rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-900/50 p-6 sm:p-7 hover:border-orange-300 dark:hover:border-orange-500/40 hover:bg-white dark:hover:bg-slate-900/85 hover:shadow-lg transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-4 mb-5">
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

                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                  Pedidos por WhatsApp sin Fricción
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Tus clientes arman su carrito en segundos desde cualquier celular. Recibí la orden
                  lista y estructurada en tu WhatsApp con dirección, método de pago, notas y
                  desglose exacto.
                </p>
              </div>

              {/* Mini visual live-flow badge */}
              <div className="mt-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950/70 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-slate-700 dark:text-slate-200">
                      Cliente
                    </span>
                    <ArrowRight
                      className="size-3.5 text-orange-700 dark:text-orange-400 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800/60 px-2.5 py-1 text-orange-800 dark:text-orange-300">
                      Menú
                    </span>
                    <ArrowRight
                      className="size-3.5 text-orange-700 dark:text-orange-400 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-2.5 py-1 text-white">
                      WhatsApp
                    </span>
                  </div>
                  <span className="text-slate-600 dark:text-slate-400 font-semibold">
                    ~25 seg promedio
                  </span>
                </div>
              </div>
            </motion.article>
          </div>

          {/* Card 2 — Featured 0% Commission */}
          <div data-gsap-bento className="md:col-span-3 lg:col-span-5 h-full">
            <motion.article
              whileHover={{ y: -4 }}
              transition={CARD_SPRING}
              className="group relative flex h-full flex-col justify-between rounded-3xl border border-orange-200/90 dark:border-orange-900/50 bg-orange-50/40 dark:bg-slate-900/60 p-6 sm:p-7 hover:border-orange-400 dark:hover:border-orange-500/60 hover:bg-white dark:hover:bg-slate-900/90 hover:shadow-lg transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/25">
                    <TrendingUp className="size-6" aria-hidden="true" />
                  </div>
                  <span className="inline-flex items-center rounded-full bg-orange-700 px-3 py-1 text-xs font-bold text-white">
                    +45% ticket promedio
                  </span>
                </div>

                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                  0% Comisiones, 100% Margen
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Eliminá el peaje del 30% por venta y multiplicá tu margen con adiciones, salsas y
                  combos sugeridos antes de cerrar la compra.
                </p>
              </div>

              {/* Mini margin indicator */}
              <div className="mt-6 rounded-2xl border border-emerald-200/90 dark:border-emerald-900/60 bg-white dark:bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    100% para tu caja
                  </span>
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                    $0 comisión
                  </span>
                </div>
                <div
                  className="h-2.5 w-full overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950"
                  aria-hidden="true"
                >
                  <div className="h-full w-full rounded-full bg-emerald-700 dark:bg-emerald-500" />
                </div>
              </div>
            </motion.article>
          </div>

          {/* Card 3 — Smart QR Tables */}
          <div data-gsap-bento className="md:col-span-3 lg:col-span-4 h-full">
            <motion.article
              whileHover={{ y: -4 }}
              transition={CARD_SPRING}
              className="flex h-full flex-col justify-between rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-900/50 p-6 hover:border-orange-300 dark:hover:border-orange-500/40 hover:bg-white dark:hover:bg-slate-900/85 hover:shadow-md transition-colors"
            >
              <div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-100/80 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25 mb-4">
                  <QrCode className="size-6" aria-hidden="true" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Mesas & Códigos QR Inteligentes
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Imprimí el QR para cada mesa o empaque. Tus comensales escanean, piden y la orden
                  entra etiquetada por zona.
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950/70 px-3.5 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-800">
                    <QrCode className="size-4" aria-hidden="true" />
                  </span>
                  <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                    Mesa 04 · Terraza
                  </span>
                </div>
                <span className="shrink-0 rounded-md bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  QR Activo
                </span>
              </div>
            </motion.article>
          </div>

          {/* Card 4 — Real-Time Kanban */}
          <div data-gsap-bento className="md:col-span-3 lg:col-span-4 h-full">
            <motion.article
              whileHover={{ y: -4 }}
              transition={CARD_SPRING}
              className="flex h-full flex-col justify-between rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-900/50 p-6 hover:border-orange-300 dark:hover:border-orange-500/40 hover:bg-white dark:hover:bg-slate-900/85 hover:shadow-md transition-colors"
            >
              <div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/25 mb-4">
                  <Zap className="size-6" aria-hidden="true" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Tablero Kanban en Tiempo Real
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Gestioná tu cocina con alertas sonoras y mové cada ticket sin errores desde que
                  ingresa hasta la entrega.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950/70 px-3 py-2.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/70 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                  Pendiente
                </span>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400" aria-hidden="true">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800/70 px-2.5 py-0.5 text-xs font-bold text-orange-800 dark:text-orange-300">
                  Cocina
                </span>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400" aria-hidden="true">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  Listo
                </span>
              </div>
            </motion.article>
          </div>

          {/* Card 5 — Brand & Domain */}
          <div data-gsap-bento className="md:col-span-3 lg:col-span-4 h-full">
            <motion.article
              whileHover={{ y: -4 }}
              transition={CARD_SPRING}
              className="flex h-full flex-col justify-between rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-900/50 p-6 hover:border-orange-300 dark:hover:border-orange-500/40 hover:bg-white dark:hover:bg-slate-900/85 hover:shadow-md transition-colors"
            >
              <div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-100/90 dark:bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-500/25 mb-4">
                  <Palette className="size-6" aria-hidden="true" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Tu Marca, Tu Dominio
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Tu tienda refleja tus colores, logotipo y banners con un slug propio y una base de
                  clientes CRM 100% tuya.
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950/70 px-3.5 py-2.5">
                <div className="flex items-center gap-2" aria-label="Paleta cálida personalizable">
                  {BRAND_SWATCHES.map((swatch) => (
                    <span
                      key={swatch.name}
                      className={`size-4 rounded-full ring-2 ring-white dark:ring-slate-900 ${swatch.swatchClass}`}
                    />
                  ))}
                </div>
                <span className="truncate text-xs font-bold text-slate-700 dark:text-slate-300">
                  tumarca.foodos.app
                </span>
              </div>
            </motion.article>
          </div>

          {/* Card 6 — Stock, Reports & Multi-Branch Strip */}
          <div data-gsap-bento className="md:col-span-3 lg:col-span-12 h-full">
            <motion.article
              whileHover={{ y: -4 }}
              transition={CARD_SPRING}
              className="flex h-full flex-col lg:flex-row lg:items-center lg:justify-between gap-6 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-900/50 p-6 sm:p-7 hover:border-orange-300 dark:hover:border-orange-500/40 hover:bg-white dark:hover:bg-slate-900/85 hover:shadow-md transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4 lg:max-w-2xl">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-slate-800 border border-slate-700">
                  <Layers className="size-6" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
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
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950/70 px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2
                      className={`size-4 shrink-0 ${
                        stockActive
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                      aria-hidden="true"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Smash Doble
                      </span>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
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
                      transition={CARD_SPRING}
                      className={`block size-5 rounded-full bg-white shadow-xs ${
                        stockActive ? "ml-auto" : "mr-auto"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950/70 px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">
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
            </motion.article>
          </div>
        </div>
      </div>
    </section>
  )
}
