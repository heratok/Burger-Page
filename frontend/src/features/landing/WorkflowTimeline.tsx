import { useId, useRef, useState } from "react"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Flame,
  Link2,
  MessageSquare,
  Plus,
  QrCode,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react"
import { prefersReducedMotion } from "@/lib/motion"
import {
  ensureLandingGsapRegistered,
  gsap,
  ScrollTrigger,
  supportsGsapMatchMedia,
  useGSAP,
} from "./gsapSetup"

type WorkflowStepIndex = 0 | 1 | 2

interface WorkflowStep {
  index: WorkflowStepIndex
  number: string
  badge: string
  footnote: string
  stageLabel: string
  title: string
  description: string
  accent: "orange" | "amber" | "emerald"
  icon: "menu" | "qr" | "orders"
}

interface MenuModifier {
  id: string
  label: string
  price: number
}

const SPRING_PILL = {
  type: "spring" as const,
  stiffness: 420,
  damping: 32,
}

const STAGE_SPRING = {
  type: "spring" as const,
  stiffness: 340,
  damping: 30,
}

const WORKFLOW_STEPS: readonly WorkflowStep[] = [
  {
    index: 0,
    number: "01",
    badge: "Setup en 5 min",
    footnote: "Sin código",
    stageLabel: "Editor de Carta en Vivo",
    title: "Creá tu Menú",
    description:
      "Cargá tus categorías, fotos de productos, precios, ingredientes y adiciones opcionales desde tu panel administrativo sin código.",
    accent: "orange",
    icon: "menu",
  },
  {
    index: 1,
    number: "02",
    badge: "Link único + QR",
    footnote: "Salón y delivery",
    stageLabel: "Distribución Omnicanal",
    title: "Compartí tu Link o QR",
    description:
      "Colocá tu enlace personalizado en tu biografía de Instagram, estados de WhatsApp o imprimí códigos QR en tus mesas y empaques.",
    accent: "amber",
    icon: "qr",
  },
  {
    index: 2,
    number: "03",
    badge: "WhatsApp + Kanban",
    footnote: "Listo para cocina",
    stageLabel: "Despacho Directo en Cocina",
    title: "Recibí Pedidos Listos",
    description:
      "El comensal pide en segundos y a vos te entra el mensaje estructurado con todo el detalle para preparar y despachar.",
    accent: "emerald",
    icon: "orders",
  },
]

const STAGE_MODIFIERS: readonly MenuModifier[] = [
  { id: "tocineta", label: "Tocineta", price: 3500 },
  { id: "cheddar", label: "Cheddar", price: 3000 },
  { id: "salsa", label: "Salsa Ahumada", price: 2500 },
]

const KITCHEN_PIPELINE = [
  { id: "received", label: "Recibido", detail: "WhatsApp · 20:14", status: "done" },
  { id: "fire", label: "En Fuego", detail: "Parrilla · 04m", status: "active" },
  { id: "ready", label: "Listo · 0% comisión", detail: "Empaque listo", status: "next" },
] as const

const QR_MATRIX: readonly (readonly number[])[] = [
  [1, 1, 1, 0, 1, 0, 1, 1, 1],
  [1, 0, 1, 0, 0, 1, 1, 0, 1],
  [1, 1, 1, 0, 1, 0, 1, 1, 1],
  [0, 0, 0, 1, 0, 1, 0, 0, 0],
  [1, 0, 1, 1, 1, 0, 1, 0, 1],
  [0, 1, 0, 0, 1, 1, 0, 1, 0],
  [1, 1, 1, 0, 1, 0, 1, 0, 1],
  [1, 0, 1, 0, 0, 1, 0, 1, 1],
  [1, 1, 1, 0, 1, 1, 1, 0, 1],
]

const ACCENT_CHAPTER_STYLES: Record<
  WorkflowStep["accent"],
  {
    activeBorder: string
    activeNode: string
    inactiveNode: string
    badge: string
  }
> = {
  orange: {
    activeBorder:
      "border-orange-300 dark:border-orange-600/70 bg-white dark:bg-slate-900 shadow-lg",
    activeNode: "bg-orange-700 text-white border-orange-700",
    inactiveNode:
      "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700",
    badge:
      "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800/70 dark:bg-orange-950/70 dark:text-orange-200",
  },
  amber: {
    activeBorder:
      "border-amber-300 dark:border-amber-600/70 bg-white dark:bg-slate-900 shadow-lg",
    activeNode: "bg-amber-700 text-white border-amber-700",
    inactiveNode:
      "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700",
    badge:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/70 dark:text-amber-200",
  },
  emerald: {
    activeBorder:
      "border-emerald-300 dark:border-emerald-600/70 bg-white dark:bg-slate-900 shadow-lg",
    activeNode: "bg-emerald-700 text-white border-emerald-700",
    inactiveNode:
      "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/70 dark:text-emerald-200",
  },
}

function renderStepIcon(icon: WorkflowStep["icon"]) {
  if (icon === "menu") return <UtensilsCrossed className="size-4 shrink-0" aria-hidden="true" />
  if (icon === "qr") return <QrCode className="size-4 shrink-0" aria-hidden="true" />
  return <MessageSquare className="size-4 shrink-0" aria-hidden="true" />
}

function formatCop(amount: number): string {
  const formatted = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `$${formatted}`
}

export function WorkflowTimeline() {
  const scopeId = useId()
  const sectionRef = useRef<HTMLElement>(null)
  const chaptersRef = useRef<HTMLDivElement>(null)

  const [activeStep, setActiveStep] = useState<WorkflowStepIndex>(0)
  const [activeModifiers, setActiveModifiers] = useState<string[]>(["tocineta", "cheddar"])
  const [activePipelineIndex, setActivePipelineIndex] = useState<number>(1)

  const reducedMotion = prefersReducedMotion()

  // GSAP ScrollTrigger owns vertical spine scrub + chapter scroll-step transitions
  useGSAP(
    () => {
      ensureLandingGsapRegistered()
      if (!supportsGsapMatchMedia()) return

      const chaptersContainer = chaptersRef.current
      if (!chaptersContainer) return

      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const spineFill = chaptersContainer.querySelector<HTMLElement>(
          "[data-gsap-timeline-fill]"
        )
        if (spineFill) {
          gsap.fromTo(
            spineFill,
            { scaleY: 0 },
            {
              scaleY: 1,
              ease: "none",
              scrollTrigger: {
                trigger: chaptersContainer,
                start: "top 72%",
                end: "bottom 55%",
                scrub: 0.45,
              },
            }
          )
        }

        const chapterNodes = gsap.utils.toArray<HTMLElement>(
          "[data-workflow-chapter]",
          chaptersContainer
        )
        chapterNodes.forEach((node, index) => {
          const stepIndex = index as WorkflowStepIndex
          ScrollTrigger.create({
            trigger: node,
            start: "top 58%",
            end: "bottom 42%",
            onEnter: () => setActiveStep(stepIndex),
            onEnterBack: () => setActiveStep(stepIndex),
          })
        })
      })

      return () => mm.revert()
    },
    { scope: sectionRef }
  )

  const toggleModifier = (modifierId: string) => {
    setActiveModifiers((prev) =>
      prev.includes(modifierId) ? prev.filter((id) => id !== modifierId) : [...prev, modifierId]
    )
  }

  const currentStep = WORKFLOW_STEPS[activeStep]
  const modifiersTotal = STAGE_MODIFIERS.filter((m) => activeModifiers.includes(m.id)).reduce(
    (sum, m) => sum + m.price,
    0
  )
  const previewBurgerTotal = 26000 + modifiersTotal

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="scroll-mt-20 py-24 border-t border-slate-200/80 dark:border-slate-800/80 bg-[#FAFAFA] dark:bg-[#0D121F] transition-colors"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div data-gsap-reveal className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-300/80 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-950/60 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-orange-200 mb-4">
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

        <LayoutGroup id={scopeId}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Left Column: Vertical Narrative Chapters + GSAP Scrubbed Glowing Spine */}
            <div ref={chaptersRef} className="lg:col-span-5 relative space-y-5">
              {/* Vertical glowing progress spine */}
              <div
                aria-hidden="true"
                className="hidden sm:block pointer-events-none absolute top-7 bottom-7 left-5 w-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
              >
                <div
                  data-gsap-timeline-fill
                  className="h-full w-full origin-top scale-y-100 rounded-full bg-gradient-to-b from-orange-600 via-amber-500 to-emerald-600 will-change-transform"
                />
              </div>

              {WORKFLOW_STEPS.map((step) => {
                const isActive = activeStep === step.index
                const accent = ACCENT_CHAPTER_STYLES[step.accent]

                return (
                  <div
                    key={step.number}
                    data-workflow-chapter={step.index}
                    className="relative sm:pl-14"
                  >
                    {/* Spine Node Medallion */}
                    <div
                      aria-hidden="true"
                      className={`hidden sm:flex absolute left-0 top-6 size-11 items-center justify-center rounded-2xl border-2 text-sm font-black tracking-tight transition-colors ${
                        isActive ? accent.activeNode : accent.inactiveNode
                      }`}
                    >
                      {step.number}
                    </div>

                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setActiveStep(step.index)}
                      className={`relative w-full min-h-11 text-left rounded-3xl border p-6 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 dark:focus-visible:ring-orange-400 dark:focus-visible:ring-offset-slate-950 ${
                        isActive
                          ? accent.activeBorder
                          : "border-slate-200/90 dark:border-slate-800/90 bg-white/80 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      {/* Motion shared-element ember active indicator pill */}
                      {isActive && (
                        <motion.span
                          layoutId={`${scopeId}-workflow-active-pill`}
                          transition={SPRING_PILL}
                          aria-hidden="true"
                          className="absolute left-0 top-6 bottom-6 w-1.5 rounded-r-full bg-gradient-to-b from-orange-600 via-amber-500 to-emerald-600"
                        />
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="inline-flex items-center gap-2">
                          <span className="sm:hidden inline-flex size-7 items-center justify-center rounded-lg bg-slate-900 text-xs font-black text-white">
                            {step.number}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${accent.badge}`}
                          >
                            {renderStepIcon(step.icon)}
                            <span>{step.badge}</span>
                          </span>
                        </div>

                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          {step.footnote}
                        </span>
                      </div>

                      <span
                        role="heading"
                        aria-level={3}
                        className="block text-lg font-extrabold text-slate-900 dark:text-white"
                      >
                        {step.title}
                      </span>

                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {step.description}
                      </p>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2
                            className="size-4 text-emerald-700 dark:text-emerald-400 shrink-0"
                            aria-hidden="true"
                          />
                          <span>Paso {step.number} de 03</span>
                        </span>
                        <span className="inline-flex items-center gap-1 font-bold text-orange-700 dark:text-orange-400">
                          <span>{isActive ? "Viendo ahora" : "Ver etapa"}</span>
                          <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
                        </span>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Right Column: Sticky Obsidian Live Stage */}
            <div className="lg:col-span-7 lg:sticky lg:top-28">
              <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-6 sm:p-8 shadow-[0_32px_90px_-24px_rgba(15,23,42,0.55)] text-slate-100">
                {/* Luminous ember hairline top edge */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/80 to-transparent"
                />

                {/* Subtle top ambient radial glow (zero blur filter) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-48"
                  style={{
                    background:
                      "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(234, 88, 12, 0.16) 0%, rgba(16, 185, 129, 0.05) 55%, transparent 100%)",
                  }}
                />

                <div className="relative z-10">
                  {/* Stage Telemetry Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-6">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center rounded-lg bg-orange-700 px-2.5 py-1 text-xs font-black tracking-wide text-white">
                        PASO {currentStep.number} / 03
                      </span>
                      <span className="text-sm font-bold text-white">
                        {currentStep.stageLabel}
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800/70 bg-emerald-950/90 px-2.5 py-1 text-xs font-bold text-emerald-200">
                      <span
                        className="size-2 rounded-full bg-emerald-400 animate-pulse motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                      <span>FoodOS Live</span>
                    </div>
                  </div>

                  {/* Morphing Visual Stage */}
                  <div className="min-h-[340px]">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {/* Step 0: Live Menu Editor Mockup */}
                      {activeStep === 0 && (
                        <motion.div
                          key="stage-menu"
                          initial={{ opacity: 0, y: 14, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -12, scale: 0.98 }}
                          transition={STAGE_SPRING}
                          className="space-y-4"
                        >
                          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex items-center gap-3.5">
                                <div className="size-12 shrink-0 rounded-2xl bg-gradient-to-br from-orange-700 to-amber-700 border border-orange-500/40 flex items-center justify-center text-white">
                                  <UtensilsCrossed className="size-5" aria-hidden="true" />
                                </div>
                                <div>
                                  <span className="block text-xs font-semibold uppercase tracking-wider text-orange-200">
                                    Producto destacado
                                  </span>
                                  <span className="block text-lg font-extrabold text-white">
                                    Burger Doble Smash
                                  </span>
                                </div>
                              </div>

                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/70 bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-200">
                                <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
                                <span>Publicado en 5 min · Online</span>
                              </span>
                            </div>

                            <div className="border-t border-slate-800 pt-4">
                              <span className="block text-xs font-semibold text-slate-200 mb-3">
                                Adiciones activas (hacé clic para probar):
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {STAGE_MODIFIERS.map((modifier, idx) => {
                                  const isSelected = activeModifiers.includes(modifier.id)
                                  return (
                                    <motion.button
                                      key={modifier.id}
                                      type="button"
                                      aria-pressed={isSelected}
                                      initial={{ opacity: 0, y: 8 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{
                                        ...STAGE_SPRING,
                                        delay: reducedMotion ? 0 : idx * 0.05,
                                      }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => toggleModifier(modifier.id)}
                                      className={`pointer-coarse:min-h-11 inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                                        isSelected
                                          ? "border-orange-500/70 bg-orange-950 text-orange-200"
                                          : "border-slate-700 bg-slate-950 text-slate-200 hover:border-orange-500/60"
                                      }`}
                                    >
                                      {isSelected ? (
                                        <Check className="size-3.5 shrink-0" aria-hidden="true" />
                                      ) : (
                                        <Plus className="size-3.5 shrink-0" aria-hidden="true" />
                                      )}
                                      <span>
                                        {modifier.label} (+{formatCop(modifier.price)})
                                      </span>
                                    </motion.button>
                                  )
                                })}
                              </div>
                            </div>

                            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                                <Sparkles className="size-4 text-amber-200 shrink-0" aria-hidden="true" />
                                <span>Precio final publicado al cliente</span>
                              </div>
                              <span className="text-base font-black text-white">
                                {formatCop(previewBurgerTotal)}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5">
                              <span className="block text-xs font-semibold text-slate-200">
                                Control de Stock
                              </span>
                              <span className="mt-1 block text-sm font-bold text-emerald-200">
                                1 clic para pausar
                              </span>
                            </div>
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5">
                              <span className="block text-xs font-semibold text-slate-200">
                                Actualización
                              </span>
                              <span className="mt-1 block text-sm font-bold text-orange-200">
                                Instantánea en QR y Web
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Step 1: Table QR Card with Animated Ember Laser Scan Beam */}
                      {activeStep === 1 && (
                        <motion.div
                          key="stage-qr"
                          initial={{ opacity: 0, y: 14, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -12, scale: 0.98 }}
                          transition={STAGE_SPRING}
                          className="space-y-4"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
                            {/* Artisanal QR Frame + Motion Ember Laser Beam */}
                            <div className="sm:col-span-5 flex flex-col items-center">
                              <div className="relative rounded-2xl border border-amber-700/70 bg-slate-950 p-4 shadow-[0_0_32px_-12px_rgba(245,158,11,0.4)]">
                                {/* Corner brackets */}
                                <span
                                  aria-hidden="true"
                                  className="absolute top-2 left-2 size-3 border-t-2 border-l-2 border-orange-500 rounded-tl-sm"
                                />
                                <span
                                  aria-hidden="true"
                                  className="absolute top-2 right-2 size-3 border-t-2 border-r-2 border-orange-500 rounded-tr-sm"
                                />
                                <span
                                  aria-hidden="true"
                                  className="absolute bottom-2 left-2 size-3 border-b-2 border-l-2 border-orange-500 rounded-bl-sm"
                                />
                                <span
                                  aria-hidden="true"
                                  className="absolute bottom-2 right-2 size-3 border-b-2 border-r-2 border-orange-500 rounded-br-sm"
                                />

                                <div className="relative size-28 overflow-hidden rounded-lg bg-slate-900 p-2">
                                  {/* Stylized high-contrast QR matrix */}
                                  <div
                                    aria-hidden="true"
                                    className="grid grid-cols-9 gap-1 size-full"
                                  >
                                    {QR_MATRIX.flatMap((row, rowIdx) =>
                                      row.map((cell, colIdx) => (
                                        <span
                                          key={`${rowIdx}-${colIdx}`}
                                          className={`rounded-[2px] ${
                                            cell === 1 ? "bg-slate-100" : "bg-transparent"
                                          }`}
                                        />
                                      ))
                                    )}
                                  </div>

                                  {/* Animated Ember Laser Scan Beam */}
                                  <motion.div
                                    aria-hidden="true"
                                    initial={reducedMotion ? { y: 52 } : { y: 0 }}
                                    animate={reducedMotion ? { y: 52 } : { y: [0, 104, 0] }}
                                    transition={
                                      reducedMotion
                                        ? { duration: 0 }
                                        : {
                                            duration: 2.6,
                                            repeat: Infinity,
                                            ease: "easeInOut",
                                          }
                                    }
                                    className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-orange-400 to-transparent shadow-[0_0_16px_2px_rgba(249,115,22,0.85)]"
                                  />
                                </div>
                              </div>

                              <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-amber-700/70 bg-amber-950 px-3 py-1 text-xs font-bold text-amber-200">
                                <QrCode className="size-3.5 shrink-0" aria-hidden="true" />
                                <span>Mesa 04 · Terraza</span>
                              </span>
                            </div>

                            {/* Live Share Link & Channels */}
                            <div className="sm:col-span-7 space-y-3.5">
                              <div>
                                <span className="block text-xs font-semibold uppercase tracking-wider text-amber-200">
                                  Tu canal propio sin apps
                                </span>
                                <span className="mt-1 block text-lg font-extrabold text-white">
                                  Un link, todos tus puntos de venta
                                </span>
                              </div>

                              <div className="rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-2 text-xs font-mono font-bold text-orange-200 min-w-0 break-all">
                                  <Link2 className="size-4 shrink-0" aria-hidden="true" />
                                  <span>foodos.app/tu-marca</span>
                                </span>
                                <span className="shrink-0 rounded-md bg-emerald-950 border border-emerald-700/70 px-2 py-0.5 text-xs font-bold text-emerald-200">
                                  HTTPS
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {["Bio de Instagram", "Estados WhatsApp", "QR en Mesas"].map(
                                  (channel) => (
                                    <span
                                      key={channel}
                                      className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-xs font-semibold text-slate-200"
                                    >
                                      {channel}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-amber-800/60 bg-amber-950/40 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-amber-200">
                            <span>El comensal escanea y pide directo desde el navegador</span>
                            <span className="font-bold text-white">Sin descargas · &lt; 30s</span>
                          </div>
                        </motion.div>
                      )}

                      {/* Step 2: Live Kitchen Flow Mockup */}
                      {activeStep === 2 && (
                        <motion.div
                          key="stage-orders"
                          initial={{ opacity: 0, y: 14, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -12, scale: 0.98 }}
                          transition={STAGE_SPRING}
                          className="space-y-4"
                        >
                          {/* Incoming WhatsApp Order Card */}
                          <div className="rounded-2xl border border-emerald-800/70 bg-emerald-950/45 p-4 space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-2 text-xs font-bold text-emerald-200">
                                <MessageSquare className="size-4 shrink-0" aria-hidden="true" />
                                <span>Pedido entrante #108 · WhatsApp</span>
                              </span>
                              <span className="rounded-full bg-emerald-950 border border-emerald-700/70 px-2.5 py-0.5 text-xs font-bold text-emerald-200">
                                0% comisión
                              </span>
                            </div>

                            <div className="rounded-xl border border-emerald-800/60 bg-slate-950 p-3 font-mono text-xs text-slate-100 space-y-1">
                              <div className="font-bold text-white">
                                1x Burger Doble Smash + Tocineta + Cheddar
                              </div>
                              <div className="text-emerald-200">
                                Total: $32.500 · Retiro rápido · Pago confirmado
                              </div>
                            </div>
                          </div>

                          {/* Glowing Kanban Status Pipeline */}
                          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-200">
                                <Flame className="size-4 shrink-0" aria-hidden="true" />
                                <span>Pipeline en Cocina (tocá una etapa)</span>
                              </span>
                              <span className="text-xs font-bold text-emerald-200">
                                Sincronizado SSE
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              {KITCHEN_PIPELINE.map((stage, idx) => {
                                const isCurrent = activePipelineIndex === idx
                                return (
                                  <motion.button
                                    key={stage.id}
                                    type="button"
                                    aria-pressed={isCurrent}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => setActivePipelineIndex(idx)}
                                    className={`relative pointer-coarse:min-h-11 rounded-xl border p-3 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                                      isCurrent
                                        ? "border-emerald-500/70 bg-emerald-950 text-white shadow-[0_0_20px_-6px_rgba(16,185,129,0.5)]"
                                        : "border-slate-800 bg-slate-950 text-slate-200 hover:border-orange-500/60"
                                    }`}
                                  >
                                    {isCurrent && (
                                      <motion.span
                                        layoutId={`${scopeId}-kitchen-stage-glow`}
                                        transition={SPRING_PILL}
                                        aria-hidden="true"
                                        className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-emerald-400"
                                      />
                                    )}
                                    <span className="block text-xs font-extrabold">
                                      {stage.label}
                                    </span>
                                    <span className="mt-1 block text-xs font-medium text-emerald-200">
                                      {stage.detail}
                                    </span>
                                  </motion.button>
                                )
                              })}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </LayoutGroup>
      </div>
    </section>
  )
}

export default WorkflowTimeline
