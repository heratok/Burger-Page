import { motion } from "motion/react"
import { CheckCircle2, QrCode, UtensilsCrossed, MessageSquare } from "lucide-react"

interface WorkflowStep {
  number: string
  badge: string
  footnote: string
  title: string
  description: string
  accent: "orange" | "amber" | "emerald"
  icon: "menu" | "qr" | "orders"
}

const CARD_SPRING = {
  type: "spring" as const,
  stiffness: 380,
  damping: 28,
}

const WORKFLOW_STEPS: readonly WorkflowStep[] = [
  {
    number: "01",
    badge: "Setup en 5 min",
    footnote: "Sin código",
    title: "Creá tu Menú",
    description:
      "Cargá tus categorías, fotos de productos, precios, ingredientes y adiciones opcionales desde tu panel administrativo sin código.",
    accent: "orange",
    icon: "menu",
  },
  {
    number: "02",
    badge: "Link único + QR",
    footnote: "Salón y delivery",
    title: "Compartí tu Link o QR",
    description:
      "Colocá tu enlace personalizado en tu biografía de Instagram, estados de WhatsApp o imprimí códigos QR en tus mesas y empaques.",
    accent: "amber",
    icon: "qr",
  },
  {
    number: "03",
    badge: "WhatsApp + Kanban",
    footnote: "Listo para cocina",
    title: "Recibí Pedidos Listos",
    description:
      "El comensal pide en segundos y a vos te entra el mensaje estructurado con todo el detalle para preparar y despachar.",
    accent: "emerald",
    icon: "orders",
  },
]

const ACCENT_STYLES: Record<
  WorkflowStep["accent"],
  {
    node: string
    badge: string
    iconBox: string
    hoverBorder: string
  }
> = {
  orange: {
    node: "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-500/40 dark:bg-orange-950/80 dark:text-orange-300",
    badge:
      "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800/70 dark:bg-orange-950/60 dark:text-orange-300",
    iconBox:
      "border-orange-200 bg-orange-100/80 text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/15 dark:text-orange-400",
    hoverBorder: "hover:border-orange-300 dark:hover:border-orange-500/50",
  },
  amber: {
    node: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/80 dark:text-amber-300",
    badge:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300",
    iconBox:
      "border-amber-200 bg-amber-100/80 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-400",
    hoverBorder: "hover:border-amber-300 dark:hover:border-amber-500/50",
  },
  emerald: {
    node: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/80 dark:text-emerald-300",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-300",
    iconBox:
      "border-emerald-200 bg-emerald-100/80 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-400",
    hoverBorder: "hover:border-emerald-300 dark:hover:border-emerald-500/50",
  },
}

function renderStepIcon(icon: WorkflowStep["icon"]) {
  if (icon === "menu") return <UtensilsCrossed className="size-5" aria-hidden="true" />
  if (icon === "qr") return <QrCode className="size-5" aria-hidden="true" />
  return <MessageSquare className="size-5" aria-hidden="true" />
}

export function WorkflowTimeline() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 py-20 border-t border-slate-200/80 dark:border-slate-800/80 bg-[#FAFAFA] dark:bg-[#0D121F] transition-colors"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div data-gsap-reveal className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-300/80 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-orange-300 mb-4">
            Flujo de Cocina en 3 Pasos
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Empezá a vender en 3 simples pasos
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            Sin instalaciones complejas ni hardware propietario. Pasá de configurar tu carta a
            recibir pedidos listos en minutos.
          </p>
        </div>

        <div className="relative">
          {/* Desktop architectural progress rail connecting step 01 -> 02 -> 03 */}
          <div
            aria-hidden="true"
            className="hidden md:block pointer-events-none absolute top-7 left-[16.667%] right-[16.667%] z-0 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          >
            <div
              data-gsap-timeline-fill
              className="h-full w-full origin-left scale-x-100 rounded-full bg-gradient-to-r from-orange-600 via-amber-500 to-emerald-600 dark:from-orange-500 dark:via-amber-400 dark:to-emerald-400 will-change-transform"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {WORKFLOW_STEPS.map((step) => {
              const styles = ACCENT_STYLES[step.accent]
              return (
                <div key={step.number} data-gsap-step className="relative z-10 flex flex-col h-full">
                  {/* Rail-anchored step medallion */}
                  <div className="flex flex-col items-center mb-5">
                    <div
                      className={`flex size-14 items-center justify-center rounded-2xl border-2 font-black text-lg tracking-tight shadow-sm ${styles.node}`}
                    >
                      {step.number}
                    </div>
                    <div
                      aria-hidden="true"
                      className="hidden md:block h-4 w-px bg-slate-200 dark:bg-slate-800"
                    />
                  </div>

                  {/* Motion-owned interactive card (strictly separate DOM element from GSAP outer wrapper) */}
                  <motion.article
                    whileHover={{ y: -4 }}
                    transition={CARD_SPRING}
                    className={`flex flex-1 flex-col justify-between rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900/75 p-7 shadow-xs hover:shadow-lg transition-colors ${styles.hoverBorder}`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-5">
                        <div
                          className={`flex size-11 shrink-0 items-center justify-center rounded-2xl border ${styles.iconBox}`}
                        >
                          {renderStepIcon(step.icon)}
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${styles.badge}`}
                        >
                          {step.badge}
                        </span>
                      </div>

                      <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                        {step.title}
                      </h3>
                      <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                        {step.description}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/90 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2
                          className="size-4 text-emerald-700 dark:text-emerald-400 shrink-0"
                          aria-hidden="true"
                        />
                        Paso {step.number} de 03
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {step.footnote}
                      </span>
                    </div>
                  </motion.article>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export default WorkflowTimeline
