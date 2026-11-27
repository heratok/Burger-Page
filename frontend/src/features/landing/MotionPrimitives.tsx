import {
  type MouseEventHandler,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react"
import {
  BadgeCheck,
  Flame,
  MessageSquare,
  Plus,
  QrCode,
  ShoppingBag,
  Zap,
} from "lucide-react"
import { prefersReducedMotion } from "@/lib/motion"
import {
  ensureLandingGsapRegistered,
  gsap,
  isFinePointerDevice,
  ScrollTrigger,
  supportsGsapMatchMedia,
  useGSAP,
} from "./gsapSetup"

interface MagneticButtonProps {
  children: ReactNode
  className?: string
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>
  type?: "button" | "submit" | "reset"
  ariaLabel?: string
  href?: string
}

interface TiltCardProps {
  children: ReactNode
  className?: string
  maxTilt?: number
}

interface HeroOrderItem {
  id: number
  code: string
  title: string
  channel: "WhatsApp" | "QR Salón" | "Delivery"
  amount: number
  eta: string
}

const MAGNETIC_MAX_PULL_PX = 7

const MARQUEE_ITEMS = [
  "0% COMISIONES",
  "WHATSAPP DIRECTO",
  "MESAS CON QR",
  "KANBAN EN VIVO",
  "+45% TICKET PROMEDIO",
  "100% TUS CLIENTES",
  "SETUP EN 5 MINUTOS",
] as const

const INITIAL_HERO_REVENUE = 186500

const INITIAL_HERO_ORDERS: HeroOrderItem[] = [
  {
    id: 108,
    code: "#108",
    title: "Smash Doble Trufada",
    channel: "WhatsApp",
    amount: 34500,
    eta: "Hace 12s",
  },
  {
    id: 107,
    code: "#107",
    title: "Mesa 6 · QR Salón",
    channel: "QR Salón",
    amount: 58500,
    eta: "Hace 2 min",
  },
  {
    id: 106,
    code: "#106",
    title: "Combo Crispy",
    channel: "Delivery",
    amount: 29000,
    eta: "Hace 4 min",
  },
]

const SIMULATED_ORDER_POOL: ReadonlyArray<Omit<HeroOrderItem, "id" | "code" | "eta">> = [
  {
    title: "Doble Bacon Ahumada",
    channel: "WhatsApp",
    amount: 36500,
  },
  {
    title: "Mesa 7 · QR Salón",
    channel: "QR Salón",
    amount: 54000,
  },
  {
    title: "Trío Smash Clásica",
    channel: "Delivery",
    amount: 48500,
  },
  {
    title: "Crispy Honey Mustard",
    channel: "WhatsApp",
    amount: 31000,
  },
  {
    title: "Mesa 2 · Ronda Craft",
    channel: "QR Salón",
    amount: 42000,
  },
]

function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString("es-CO")}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function channelBadgeStyle(channel: HeroOrderItem["channel"]): string {
  if (channel === "WhatsApp") {
    return "bg-emerald-950 border border-emerald-500/40 text-emerald-200"
  }
  if (channel === "QR Salón") {
    return "bg-amber-950 border border-amber-500/40 text-amber-200"
  }
  return "bg-orange-950 border border-orange-500/40 text-orange-200"
}

function renderChannelIcon(channel: HeroOrderItem["channel"]) {
  if (channel === "WhatsApp") {
    return <MessageSquare className="size-3.5 shrink-0" aria-hidden="true" />
  }
  if (channel === "QR Salón") {
    return <QrCode className="size-3.5 shrink-0" aria-hidden="true" />
  }
  return <ShoppingBag className="size-3.5 shrink-0" aria-hidden="true" />
}

export function MagneticButton({
  children,
  className = "",
  onClick,
  type = "button",
  ariaLabel,
  href,
}: MagneticButtonProps) {
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const x = useSpring(rawX, { stiffness: 320, damping: 22 })
  const y = useSpring(rawY, { stiffness: 320, damping: 22 })

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!isFinePointerDevice() || prefersReducedMotion()) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const relX = (event.clientX - rect.left) / rect.width - 0.5
    const relY = (event.clientY - rect.top) / rect.height - 0.5
    rawX.set(clamp(relX * MAGNETIC_MAX_PULL_PX * 2, -MAGNETIC_MAX_PULL_PX, MAGNETIC_MAX_PULL_PX))
    rawY.set(clamp(relY * MAGNETIC_MAX_PULL_PX * 2, -MAGNETIC_MAX_PULL_PX, MAGNETIC_MAX_PULL_PX))
  }

  const handlePointerReset = () => {
    rawX.set(0)
    rawY.set(0)
  }

  const sharedClasses = `inline-flex min-h-11 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 ${className}`.trim()

  if (href) {
    return (
      <motion.a
        href={href}
        aria-label={ariaLabel}
        onClick={onClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerReset}
        onPointerCancel={handlePointerReset}
        style={{ x, y }}
        whileTap={{ scale: 0.97 }}
        className={sharedClasses}
      >
        {children}
      </motion.a>
    )
  }

  return (
    <motion.button
      type={type}
      aria-label={ariaLabel}
      onClick={onClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerReset}
      onPointerCancel={handlePointerReset}
      style={{ x, y }}
      whileTap={{ scale: 0.97 }}
      className={sharedClasses}
    >
      {children}
    </motion.button>
  )
}

export function TiltCard({
  children,
  className = "",
  maxTilt = 6,
}: TiltCardProps) {
  const normX = useMotionValue(0)
  const normY = useMotionValue(0)
  const smoothX = useSpring(normX, { stiffness: 260, damping: 24 })
  const smoothY = useSpring(normY, { stiffness: 260, damping: 24 })

  const rotateY = useTransform(smoothX, [-0.5, 0.5], [-maxTilt, maxTilt])
  const rotateX = useTransform(smoothY, [-0.5, 0.5], [maxTilt, -maxTilt])

  const sheenX = useMotionValue(50)
  const sheenY = useMotionValue(25)
  const rawSheenOpacity = useMotionValue(0)
  const sheenOpacity = useSpring(rawSheenOpacity, { stiffness: 220, damping: 26 })
  const sheenBackground = useMotionTemplate`radial-gradient(280px circle at ${sheenX}% ${sheenY}%, rgba(249, 115, 22, 0.16), rgba(245, 158, 11, 0.06) 44%, transparent 74%)`

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isFinePointerDevice() || prefersReducedMotion()) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const px = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    const py = clamp((event.clientY - rect.top) / rect.height, 0, 1)
    normX.set(px - 0.5)
    normY.set(py - 0.5)
    sheenX.set(px * 100)
    sheenY.set(py * 100)
    rawSheenOpacity.set(1)
  }

  const handlePointerReset = () => {
    normX.set(0)
    normY.set(0)
    rawSheenOpacity.set(0)
  }

  return (
    <motion.div
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerReset}
      onPointerCancel={handlePointerReset}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 1000,
      }}
      className={`relative will-change-transform ${className}`.trim()}
    >
      {children}
      <motion.div
        aria-hidden="true"
        style={{
          background: sheenBackground,
          opacity: sheenOpacity,
        }}
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit]"
      />
    </motion.div>
  )
}

export function KineticMarquee() {
  const containerRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (!supportsGsapMatchMedia() || !trackRef.current) return
      ensureLandingGsapRegistered()

      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const track = trackRef.current
        if (!track) return

        const marqueeTween = gsap.to(track, {
          xPercent: -50,
          duration: 28,
          ease: "none",
          repeat: -1,
        })

        let returnTween: gsap.core.Tween | null = null

        const velocityTrigger = ScrollTrigger.create({
          start: 0,
          end: "max",
          onUpdate(self) {
            const rawBoost = Math.abs(self.getVelocity()) / 420
            const clampedBoost = clamp(rawBoost, 0, 4.5)
            const boostedScale = 1 + clampedBoost

            if (returnTween) {
              returnTween.kill()
            }

            gsap.to(marqueeTween, {
              timeScale: boostedScale,
              duration: 0.18,
              ease: "power2.out",
              overwrite: "auto",
            })

            returnTween = gsap.to(marqueeTween, {
              timeScale: 1,
              duration: 0.85,
              delay: 0.14,
              ease: "power3.out",
              overwrite: "auto",
            })
          },
        })

        return () => {
          returnTween?.kill()
          velocityTrigger.kill()
          marqueeTween.kill()
        }
      })

      return () => {
        mm.revert()
      }
    },
    { scope: containerRef },
  )

  return (
    <section
      ref={containerRef}
      aria-label="Beneficios clave de FoodOS"
      className="relative bg-[#0B0F19] text-white border-y border-slate-800/90 overflow-hidden py-4 select-none"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 sm:w-24 bg-gradient-to-r from-[#0B0F19] to-transparent motion-reduce:hidden"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 sm:w-24 bg-gradient-to-l from-[#0B0F19] to-transparent motion-reduce:hidden"
      />

      <div
        ref={trackRef}
        className="flex w-max items-center motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-y-2 motion-reduce:px-4"
      >
        <div className="flex shrink-0 items-center motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-y-2">
          {MARQUEE_ITEMS.map((item) => (
            <div key={item} className="inline-flex items-center">
              <span className="px-4 sm:px-6 text-xs sm:text-sm font-extrabold uppercase tracking-[0.22em] text-slate-100 whitespace-nowrap">
                {item}
              </span>
              <span
                aria-hidden="true"
                className="inline-block size-2 rotate-45 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.85)]"
              />
            </div>
          ))}
        </div>

        <div
          aria-hidden="true"
          className="flex shrink-0 items-center motion-reduce:hidden"
        >
          {MARQUEE_ITEMS.map((item) => (
            <div key={`dup-${item}`} className="inline-flex items-center">
              <span className="px-4 sm:px-6 text-xs sm:text-sm font-extrabold uppercase tracking-[0.22em] text-slate-100 whitespace-nowrap">
                {item}
              </span>
              <span className="inline-block size-2 rotate-45 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.85)]" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function HeroLiveStage() {
  const stageRef = useRef<HTMLDivElement>(null)
  const [orders, setOrders] = useState<HeroOrderItem[]>(INITIAL_HERO_ORDERS)
  const [revenue, setRevenue] = useState<number>(INITIAL_HERO_REVENUE)
  const [displayedRevenue, setDisplayedRevenue] = useState<number>(INITIAL_HERO_REVENUE)
  const [nextOrderNumber, setNextOrderNumber] = useState<number>(109)
  const [poolIndex, setPoolIndex] = useState<number>(0)
  const previousRevenueRef = useRef<number>(INITIAL_HERO_REVENUE)

  useEffect(() => {
    const startValue = previousRevenueRef.current
    previousRevenueRef.current = revenue

    if (startValue === revenue) return

    if (prefersReducedMotion()) {
      setDisplayedRevenue(revenue)
      return
    }

    const controls = animate(startValue, revenue, {
      duration: 0.45,
      ease: "easeOut",
      onUpdate(latest) {
        setDisplayedRevenue(Math.round(latest))
      },
    })

    return () => {
      controls.stop()
    }
  }, [revenue])

  useGSAP(
    () => {
      if (!supportsGsapMatchMedia()) return
      ensureLandingGsapRegistered()

      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const chipA = stageRef.current?.querySelector<HTMLElement>('[data-hero-chip="whatsapp"]')
        const chipB = stageRef.current?.querySelector<HTMLElement>('[data-hero-chip="commission"]')
        const tweens: gsap.core.Tween[] = []

        if (chipA) {
          tweens.push(
            gsap.to(chipA, {
              y: -6,
              duration: 2.6,
              ease: "sine.inOut",
              repeat: -1,
              yoyo: true,
            }),
          )
        }

        if (chipB) {
          tweens.push(
            gsap.to(chipB, {
              y: 6,
              duration: 3.1,
              delay: 0.35,
              ease: "sine.inOut",
              repeat: -1,
              yoyo: true,
            }),
          )
        }

        return () => {
          tweens.forEach((tween) => tween.kill())
        }
      })

      return () => {
        mm.revert()
      }
    },
    { scope: stageRef },
  )

  const handleSimulateOrder = () => {
    const template = SIMULATED_ORDER_POOL[poolIndex % SIMULATED_ORDER_POOL.length]
    const freshOrder: HeroOrderItem = {
      id: nextOrderNumber,
      code: `#${nextOrderNumber}`,
      title: template.title,
      channel: template.channel,
      amount: template.amount,
      eta: "Recién entrado",
    }

    setOrders((current) => [freshOrder, ...current].slice(0, 3))
    setRevenue((current) => current + template.amount)
    setNextOrderNumber((current) => current + 1)
    setPoolIndex((current) => current + 1)
  }

  return (
    <div ref={stageRef} className="relative py-5 sm:py-6">
      {/* Satellite telemetry chip A — top-left rim, strictly within horizontal bounds */}
      <div
        data-hero-chip="whatsapp"
        className="pointer-events-none absolute top-0.5 left-3 sm:left-5 z-20 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-emerald-200 shadow-lg shadow-slate-950/70"
      >
        <Zap className="size-3.5 shrink-0 text-emerald-200" aria-hidden="true" />
        <span>WhatsApp · 0.4s</span>
      </div>

      <TiltCard
        maxTilt={5}
        className="overflow-hidden rounded-3xl border border-slate-800 bg-[#0B0F19] text-white shadow-2xl shadow-slate-950/60"
      >
        {/* Top ember architectural accent hairline */}
        <div
          aria-hidden="true"
          className="h-px w-full bg-gradient-to-r from-transparent via-orange-500/70 to-transparent"
        />

        {/* Subtle radial warm kitchen ambient glow (no CSS blur filter) */}
        <div
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(360px circle at 85% 0%, rgba(234, 88, 12, 0.16), transparent 68%)",
          }}
          className="pointer-events-none absolute inset-0"
        />

        <div className="relative z-10 p-5 pt-7 pb-7 sm:p-6 sm:pt-7 sm:pb-7">
          {/* Top bar: Live status + animated session revenue */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-2.5 shrink-0" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-sm font-bold tracking-tight text-white">
                FoodOS Live · 0% comisión
              </span>
            </div>

            <div className="text-right">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-200">
                Ventas directas
              </span>
              <span
                aria-live="polite"
                className="font-mono text-lg sm:text-xl font-extrabold tabular-nums text-emerald-200"
              >
                {formatCurrency(displayedRevenue)}
              </span>
            </div>
          </div>

          {/* Live interactive order feed */}
          <div className="mt-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-200">
                <Flame className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Comandas en tiempo real</span>
              </span>
              <span className="rounded-md bg-slate-900 border border-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-200">
                {orders.length} activas
              </span>
            </div>

            <div className="space-y-2.5">
              <AnimatePresence mode="popLayout" initial={false}>
                {orders.map((order, index) => {
                  const isNewest = index === 0
                  return (
                    <motion.div
                      key={order.id}
                      layout
                      initial={{ opacity: 0, y: -16, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className={`rounded-2xl border p-3.5 transition-colors ${
                        isNewest
                          ? "border-orange-500/50 bg-slate-900 shadow-md shadow-orange-950/30"
                          : "border-slate-800 bg-slate-900/90"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-extrabold text-orange-200">
                              {order.code}
                            </span>
                            <span className="break-words text-sm font-bold text-white">
                              {order.title}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${channelBadgeStyle(order.channel)}`}
                            >
                              {renderChannelIcon(order.channel)}
                              <span>{order.channel}</span>
                            </span>
                            <span className="text-xs font-medium text-slate-200">
                              {order.eta}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="block font-mono text-sm font-extrabold tabular-nums text-white">
                            {formatCurrency(order.amount)}
                          </span>
                          <span className="mt-0.5 inline-block text-xs font-semibold text-emerald-200">
                            Neto 100%
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Interactive simulate incoming order CTA */}
          <div className="mt-4">
            <motion.button
              type="button"
              onClick={handleSimulateOrder}
              whileTap={{ scale: 0.97 }}
              className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-700 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-950/50 transition-colors hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <Plus className="size-4 shrink-0" aria-hidden="true" />
              <span>Simular Pedido Entrante</span>
            </motion.button>
          </div>
        </div>
      </TiltCard>

      {/* Satellite telemetry chip B — bottom-right rim, strictly within horizontal bounds */}
      <div
        data-hero-chip="commission"
        className="pointer-events-none absolute right-3 bottom-0.5 sm:right-5 z-20 inline-flex items-center gap-2 rounded-full border border-orange-500/40 bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-orange-200 shadow-lg shadow-slate-950/70"
      >
        <BadgeCheck className="size-3.5 shrink-0 text-amber-200" aria-hidden="true" />
        <span>Comisión: $0</span>
      </div>
    </div>
  )
}
