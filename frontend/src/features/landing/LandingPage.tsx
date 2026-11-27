import { useEffect, useRef, useState } from "react"
import { AnimatePresence, MotionConfig, motion } from "motion/react"
import {
  ArrowRight,
  Check,
  Flame,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react"
import { useAppRouter } from "@/core/router/useAppRouter"
import {
  ensureLandingGsapRegistered,
  gsap,
  ScrollTrigger,
  supportsGsapMatchMedia,
  useGSAP,
} from "./gsapSetup"
import {
  HeroLiveStage,
  KineticMarquee,
  MagneticButton,
} from "./MotionPrimitives"
import { InteractiveShowcase } from "./InteractiveShowcase"
import { FeaturesBento } from "./FeaturesBento"
import { ProfitabilitySection } from "./ProfitabilitySection"
import { WorkflowTimeline } from "./WorkflowTimeline"

const CTA_SPRING = {
  type: "spring" as const,
  stiffness: 450,
  damping: 28,
}

const THEME_ICON_SPRING = {
  type: "spring" as const,
  stiffness: 420,
  damping: 26,
}

const METRIC_COUNTERS = [
  {
    id: "commission",
    target: 0,
    prefix: "",
    suffix: "%",
    finalText: "0%",
    label: "Comisiones por venta",
    valueClass: "text-slate-950 dark:text-white",
  },
  {
    id: "order-time",
    target: 30,
    prefix: "< ",
    suffix: "s",
    finalText: "< 30s",
    label: "Tiempo para pedir",
    valueClass: "text-emerald-700 dark:text-emerald-400",
  },
  {
    id: "ticket-uplift",
    target: 45,
    prefix: "+",
    suffix: "%",
    finalText: "+45%",
    label: "Ticket con adiciones",
    valueClass: "text-orange-700 dark:text-orange-400",
  },
  {
    id: "ownership",
    target: 100,
    prefix: "",
    suffix: "%",
    finalText: "100%",
    label: "Tus datos y clientes",
    valueClass: "text-amber-700 dark:text-amber-400",
  },
] as const

const HERO_TRUST_POINTS = [
  "Sin tarjeta",
  "Setup en 5 min",
  "Cancelás cuando quieras",
] as const

export default function LandingPage() {
  const { navigateTo } = useAppRouter()
  const pageRef = useRef<HTMLDivElement>(null)

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem("foodos_landing_theme")
      if (saved === "light" || saved === "dark") return saved
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        return "dark"
      }
    } catch {
      // Fallback for SSR/test environments
    }
    return "light"
  })

  useEffect(() => {
    try {
      localStorage.setItem("foodos_landing_theme", theme)
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"))
  }

  const handleAdminAccess = () => {
    navigateTo("/admin")
  }

  const isDark = theme === "dark"

  // GSAP scroll & entrance choreography strictly separated from Motion interactive elements
  useGSAP(
    () => {
      if (!supportsGsapMatchMedia()) return
      ensureLandingGsapRegistered()

      const root = pageRef.current
      if (!root) return

      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        let cancelled = false

        // 1. Top 2px scroll reading progress ribbon
        gsap.fromTo(
          "[data-gsap-scroll-progress]",
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: "none",
            scrollTrigger: {
              trigger: root,
              start: "top top",
              end: "bottom bottom",
              scrub: 0.15,
            },
          }
        )

        // 2. Hero kinetic entrance timeline (masked editorial lines + stagger + ember underline + 3D stage)
        const underlinePath = root.querySelector<SVGPathElement>(
          "[data-gsap-hero-underline]"
        )
        const heroTl = gsap.timeline()

        heroTl.from("[data-gsap-hero-line]", {
          yPercent: 108,
          duration: 0.8,
          stagger: 0.12,
          ease: "power4.out",
          clearProps: "transform",
        })

        heroTl.from(
          "[data-gsap-hero]",
          {
            y: 16,
            opacity: 0,
            duration: 0.55,
            stagger: 0.07,
            ease: "power3.out",
            clearProps: "transform,opacity",
          },
          "-=0.45"
        )

        if (underlinePath) {
          const pathLength =
            typeof underlinePath.getTotalLength === "function"
              ? underlinePath.getTotalLength()
              : 420
          gsap.set(underlinePath, {
            strokeDasharray: pathLength,
            strokeDashoffset: pathLength,
          })
          heroTl.to(
            underlinePath,
            {
              strokeDashoffset: 0,
              duration: 0.7,
              ease: "power2.out",
            },
            "-=0.35"
          )
        }

        heroTl.from(
          "[data-gsap-hero-stage]",
          {
            y: 26,
            opacity: 0,
            scale: 0.96,
            duration: 0.85,
            ease: "power3.out",
            clearProps: "transform,opacity",
          },
          0.15
        )

        // 3. Ambient ember depth parallax (opposite axes, zero blur filters)
        gsap.to("[data-gsap-ambient-a]", {
          yPercent: -12,
          ease: "none",
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: "bottom bottom",
            scrub: 1.2,
          },
        })
        gsap.to("[data-gsap-ambient-b]", {
          yPercent: 14,
          ease: "none",
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: "bottom bottom",
            scrub: 1.2,
          },
        })

        // 4. Kinetic metric counters (final values stay in JSX for SSR/reduced-motion/tests)
        const metricsCard = root.querySelector<HTMLElement>("[data-gsap-metrics]")
        if (metricsCard) {
          METRIC_COUNTERS.forEach((metric) => {
            if (metric.target <= 0) return
            const node = metricsCard.querySelector<HTMLElement>(
              `[data-gsap-counter="${metric.id}"]`
            )
            if (!node) return

            const state = { value: 0 }
            gsap.to(state, {
              value: metric.target,
              duration: 1.15,
              ease: "power2.out",
              scrollTrigger: {
                trigger: metricsCard,
                start: "top 92%",
                once: true,
              },
              onUpdate: () => {
                node.textContent = `${metric.prefix}${Math.round(state.value)}${metric.suffix}`
              },
              onComplete: () => {
                node.textContent = metric.finalText
              },
            })
          })
        }

        // 5. 3D perspective scroll-unfold on Obsidian Command Center showcase
        const showcaseUnfold = root.querySelector<HTMLElement>(
          "[data-gsap-showcase-unfold]"
        )
        if (showcaseUnfold) {
          gsap.fromTo(
            showcaseUnfold,
            {
              rotateX: 8,
              scale: 0.95,
              y: 26,
              transformPerspective: 1400,
              transformOrigin: "center top",
            },
            {
              rotateX: 0,
              scale: 1,
              y: 0,
              ease: "none",
              scrollTrigger: {
                trigger: showcaseUnfold,
                start: "top 92%",
                end: "top 38%",
                scrub: 0.7,
              },
            }
          )
        }

        // 6. ScrollTrigger.batch reveals for Bento cards and section headers
        const bentoItems = gsap.utils.toArray<HTMLElement>("[data-gsap-bento]", root)
        if (bentoItems.length > 0) {
          gsap.set(bentoItems, { opacity: 0, y: 24 })
          ScrollTrigger.batch(bentoItems, {
            start: "top 88%",
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                stagger: 0.07,
                ease: "power3.out",
                overwrite: true,
                clearProps: "transform,opacity",
              }),
          })
        }

        const revealItems = gsap.utils.toArray<HTMLElement>("[data-gsap-reveal]", root)
        if (revealItems.length > 0) {
          gsap.set(revealItems, { opacity: 0, y: 24 })
          ScrollTrigger.batch(revealItems, {
            start: "top 88%",
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                stagger: 0.07,
                ease: "power3.out",
                overwrite: true,
                clearProps: "transform,opacity",
              }),
          })
        }

        // 7. Refresh trigger positions once web fonts settle
        if (document.fonts?.ready) {
          document.fonts.ready
            .then(() => {
              if (!cancelled) ScrollTrigger.refresh()
            })
            .catch(() => undefined)
        }

        return () => {
          cancelled = true
          if (metricsCard) {
            METRIC_COUNTERS.forEach((metric) => {
              const node = metricsCard.querySelector<HTMLElement>(
                `[data-gsap-counter="${metric.id}"]`
              )
              if (node) node.textContent = metric.finalText
            })
          }
        }
      })

      return () => mm.revert()
    },
    { scope: pageRef }
  )

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={pageRef}
        className={`min-h-screen font-sans antialiased overflow-x-clip selection:bg-orange-600 selection:text-white transition-colors duration-200 ${
          isDark ? "dark bg-[#0B0F19] text-slate-100" : "bg-[#F7F5F2] text-slate-800"
        }`}
      >
        {/* Top fixed 2px GSAP scroll reading progress ribbon */}
        <div
          aria-hidden="true"
          data-gsap-scroll-progress
          className="fixed top-0 left-0 right-0 z-50 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 pointer-events-none motion-reduce:hidden"
        />

        {/* Background ambient warm lighting: static radial gradients + subtle GSAP transform parallax (zero blur filter) */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
          <div
            className="absolute -top-32 left-1/2 -translate-x-1/2 h-[440px] w-[min(920px,100vw)]"
            style={{
              backgroundImage: isDark
                ? "radial-gradient(ellipse at center, rgba(249,115,22,0.14) 0%, rgba(245,158,11,0.06) 45%, transparent 72%)"
                : "radial-gradient(ellipse at center, rgba(251,146,60,0.15) 0%, rgba(252,211,77,0.09) 45%, transparent 72%)",
            }}
          />
          <div
            data-gsap-ambient-a
            className="hidden md:block absolute top-[35%] right-[-10%] h-[450px] w-[550px] will-change-transform"
            style={{
              backgroundImage: isDark
                ? "radial-gradient(ellipse at center, rgba(245,158,11,0.07) 0%, transparent 70%)"
                : "radial-gradient(ellipse at center, rgba(251,191,36,0.13) 0%, transparent 70%)",
            }}
          />
          <div
            data-gsap-ambient-b
            className="hidden md:block absolute bottom-10 left-[-10%] h-[450px] w-[550px] will-change-transform"
            style={{
              backgroundImage: isDark
                ? "radial-gradient(ellipse at center, rgba(234,88,12,0.07) 0%, transparent 70%)"
                : "radial-gradient(ellipse at center, rgba(249,115,22,0.12) 0%, transparent 70%)",
            }}
          />
          {/* Subtle architectural dot grid pattern */}
          <div
            className={`absolute inset-0 transition-opacity duration-300 ${
              isDark ? "opacity-[0.04]" : "opacity-[0.035]"
            }`}
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, ${
                isDark ? "#94A3B8" : "#0F172A"
              } 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          />
        </div>

        {/* ======================================================== */}
        {/* TOP PLATFORM NAVBAR                                      */}
        {/* ======================================================== */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-24 focus:left-1/2 focus:-translate-x-1/2 focus:z-[100] whitespace-nowrap rounded-md focus:px-4 focus:py-2 bg-orange-700 px-4 py-2 text-sm font-semibold text-white focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-orange-700"
        >
          Saltar al contenido
        </a>

        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#0B0F19]/85 transition-colors">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            {/* Logo Brand */}
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-700 to-amber-700 text-white shadow-md shadow-orange-700/25">
                <Flame className="size-5" aria-hidden="true" />
              </div>
              <div>
                <span className="text-base font-black tracking-tight text-slate-950 dark:text-white flex items-center gap-1.5">
                  FoodOS
                  <span className="rounded-full bg-orange-500/10 dark:bg-orange-500/20 px-2 py-0.5 text-xs font-bold text-orange-700 dark:text-orange-400 border border-brand-orange-subtle">
                    SaaS
                  </span>
                </span>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 hidden sm:block -mt-0.5">
                  Menús Digitales &amp; Pedidos WhatsApp
                </span>
              </div>
            </div>

            {/* Nav Links */}
            <nav
              aria-label="Navegación principal"
              className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              <a
                href="#showcase"
                className="px-2 py-1 hover:text-orange-700 dark:hover:text-orange-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B0F19] rounded-lg"
              >
                Simulador
              </a>
              <a
                href="#features"
                className="px-2 py-1 hover:text-orange-700 dark:hover:text-orange-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B0F19] rounded-lg"
              >
                Beneficios
              </a>
              <a
                href="#how-it-works"
                className="px-2 py-1 hover:text-orange-700 dark:hover:text-orange-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B0F19] rounded-lg"
              >
                Cómo Funciona
              </a>
            </nav>

            {/* Action CTAs & Animated Theme Toggle */}
            <div className="flex items-center gap-2 shrink-0">
              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={CTA_SPRING}
                onClick={toggleTheme}
                aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
                className="relative inline-flex size-11 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-orange-500 hover:text-orange-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-orange-400 dark:hover:text-orange-400 shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B0F19]"
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  {isDark ? (
                    <motion.span
                      key="sun"
                      initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
                      animate={{ opacity: 1, rotate: 0, scale: 1 }}
                      exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
                      transition={THEME_ICON_SPRING}
                      className="inline-flex items-center justify-center"
                    >
                      <Sun className="size-5" aria-hidden="true" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="moon"
                      initial={{ opacity: 0, rotate: 90, scale: 0.6 }}
                      animate={{ opacity: 1, rotate: 0, scale: 1 }}
                      exit={{ opacity: 0, rotate: -90, scale: 0.6 }}
                      transition={THEME_ICON_SPRING}
                      className="inline-flex items-center justify-center"
                    >
                      <Moon className="size-5" aria-hidden="true" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={CTA_SPRING}
                onClick={handleAdminAccess}
                className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 sm:px-3.5 text-xs font-bold text-slate-700 hover:border-orange-500 hover:bg-orange-50/50 hover:text-orange-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-orange-400 dark:hover:bg-slate-800 dark:hover:text-orange-400 shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B0F19]"
              >
                <ShieldCheck
                  className="size-4 text-orange-700 dark:text-orange-400 shrink-0"
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">Acceso Administrador</span>
                <span className="sm:hidden">Admin</span>
              </motion.button>
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1}>
          {/* ======================================================== */}
          {/* ASYMMETRIC 12-COLUMN EDITORIAL SPLIT HERO                */}
          {/* ======================================================== */}
          <section className="relative pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
                {/* Left 7 Cols: Editorial Display Typography & Magnetic CTAs */}
                <div className="lg:col-span-7 text-left">
                  {/* Announcement Badge (exact allowlisted backdrop-blur-md class string) */}
                  <div
                    data-gsap-hero
                    className="inline-flex items-center gap-2 rounded-full border border-brand-orange-subtle bg-orange-500/10 dark:bg-orange-500/15 px-4 py-1.5 text-xs font-bold text-orange-800 dark:text-orange-300 backdrop-blur-md mb-6 shadow-xs"
                  >
                    <Sparkles
                      className="size-3.5 shrink-0 text-orange-700 dark:text-orange-400"
                      aria-hidden="true"
                    />
                    <span>La plataforma para pedidos directos sin comisiones abusivas</span>
                  </div>

                  {/* Giant Editorial Display Headline with GSAP Masked Clip-Up & Ember SVG Underline */}
                  <h1 className="text-4xl sm:text-5xl lg:text-[3.85rem] xl:text-[4.25rem] font-black tracking-[-0.04em] leading-[1.02] text-slate-950 dark:text-white">
                    <span className="block overflow-hidden pb-1">
                      <span data-gsap-hero-line className="block">
                        Tu Menú Digital Interactivo.
                      </span>
                    </span>
                    <span className="block overflow-hidden pb-2">
                      <span
                        data-gsap-hero-line
                        className="relative inline-block text-orange-700 dark:text-orange-400"
                      >
                        Ventas Directas por WhatsApp.
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 420 16"
                          fill="none"
                          preserveAspectRatio="none"
                          className="pointer-events-none absolute -bottom-1 left-0 h-3 w-full text-orange-700/80 dark:text-orange-400/90"
                        >
                          <path
                            data-gsap-hero-underline
                            d="M4 11.5C112 3.5 294 2.5 416 10.5"
                            stroke="currentColor"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                    </span>
                  </h1>

                  <p
                    data-gsap-hero
                    className="mt-6 max-w-xl text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal"
                  >
                    Eliminá las comisiones abusivas de las apps de delivery. Permití que tus
                    comensales armen su pedido con adiciones personalizadas y te lo envíen listo,
                    estructurado y cobrado directo a tu WhatsApp en un clic.
                  </p>

                  {/* Magnetic CTA Cluster (outer div owns GSAP entrance; inner MagneticButton owns Motion pull/tap) */}
                  <div
                    data-gsap-hero
                    className="mt-8 flex flex-wrap items-center gap-3.5"
                  >
                    <MagneticButton
                      onClick={handleAdminAccess}
                      className="group gap-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 dark:bg-orange-700 dark:hover:bg-orange-600 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-slate-950/20 dark:shadow-orange-950/40 transition-colors cursor-pointer dark:focus-visible:ring-offset-[#0B0F19]"
                    >
                      <span className="flex size-6 items-center justify-center rounded-lg bg-orange-700 text-white dark:bg-slate-950 dark:text-orange-300 shadow-xs">
                        <ShieldCheck className="size-3.5" aria-hidden="true" />
                      </span>
                      <span>Entrar al Panel Admin</span>
                      <ArrowRight
                        className="size-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </MagneticButton>

                    <MagneticButton
                      href="#how-it-works"
                      className="gap-2 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-3.5 text-sm font-bold text-slate-800 dark:text-slate-100 hover:border-orange-500 hover:text-orange-700 dark:hover:border-orange-400 dark:hover:text-orange-400 shadow-xs transition-colors dark:focus-visible:ring-offset-[#0B0F19]"
                    >
                      <span>Ver cómo funciona</span>
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </MagneticButton>
                  </div>

                  {/* Compact micro trust line */}
                  <div
                    data-gsap-hero
                    className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-600 dark:text-slate-400"
                  >
                    {HERO_TRUST_POINTS.map((point, index) => (
                      <span key={point} className="inline-flex items-center gap-1.5">
                        {index > 0 && (
                          <span
                            aria-hidden="true"
                            className="mr-2 hidden sm:inline-block size-1 rounded-full bg-slate-400 dark:bg-slate-600"
                          />
                        )}
                        <Check
                          className="size-3.5 shrink-0 text-emerald-700 dark:text-emerald-400"
                          aria-hidden="true"
                        />
                        <span>{point}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right 5 Cols: Live 3D Interactive Obsidian Stage */}
                <div className="lg:col-span-5">
                  <div data-gsap-hero-stage>
                    <HeroLiveStage />
                  </div>
                </div>
              </div>

              {/* 4-Column Social Proof / Metrics Bar (exact allowlisted backdrop-blur-md class string) */}
              <div
                data-gsap-hero
                data-gsap-metrics
                className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto border border-slate-200/80 dark:border-slate-800/80 rounded-3xl bg-white/90 dark:bg-slate-900/80 p-6 shadow-sm backdrop-blur-md"
              >
                {METRIC_COUNTERS.map((metric, index) => (
                  <div
                    key={metric.id}
                    className={`text-center ${
                      index > 0
                        ? "md:border-l md:border-slate-200/80 dark:md:border-slate-800/80 md:pl-4"
                        : ""
                    }`}
                  >
                    <div
                      data-gsap-counter={metric.id}
                      className={`text-3xl sm:text-4xl font-black tracking-tight tabular-nums ${metric.valueClass}`}
                    >
                      {metric.finalText}
                    </div>
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">
                      {metric.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ======================================================== */}
          {/* FULL-BLEED VELOCITY-REACTIVE ARCHITECTURAL MARQUEE       */}
          {/* ======================================================== */}
          <KineticMarquee />

          {/* ======================================================== */}
          {/* OBSIDIAN COMMAND CENTER LIVE SHOWCASE                    */}
          {/* ======================================================== */}
          <section
            id="showcase"
            className="scroll-mt-20 relative py-20 sm:py-24 bg-[#F7F5F2] dark:bg-[#0B0F19] transition-colors"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div data-gsap-reveal className="text-center max-w-3xl mx-auto">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-300/80 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-orange-300 mb-4">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  <span>Simulador Interactivo en Vivo</span>
                </span>
                <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-white">
                  Probá el sistema en vivo — tocá los pedidos y el Kanban
                </h2>
                <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                  Agregá extras, cambiá de mesa con QR y mové comandas por tu cocina para ver cómo
                  fluye cada venta directa sin intermediarios.
                </p>
              </div>

              <div className="[perspective:1400px]">
                <InteractiveShowcase />
              </div>
            </div>
          </section>

          {/* ======================================================== */}
          {/* BENTO FEATURES GRID                                      */}
          {/* ======================================================== */}
          <FeaturesBento />

          {/* ======================================================== */}
          {/* PROFITABILITY COMPARISON & LIVE SAVINGS CALCULATOR       */}
          {/* ======================================================== */}
          <ProfitabilitySection />

          {/* ======================================================== */}
          {/* HOW IT WORKS — STICKY EDITORIAL WORKFLOW TIMELINE        */}
          {/* ======================================================== */}
          <WorkflowTimeline />

          {/* ======================================================== */}
          {/* CINEMATIC DARK OBSIDIAN FINAL CTA                        */}
          {/* ======================================================== */}
          <section className="py-20 sm:py-24 border-t border-slate-200/80 dark:border-slate-800/80 bg-[#F7F5F2] dark:bg-[#0B0F19] transition-colors">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
              <div
                data-gsap-reveal
                className="relative overflow-hidden rounded-[2.25rem] border border-slate-800 bg-slate-950 px-6 py-12 sm:px-12 sm:py-16 text-center text-white shadow-[0_32px_90px_-24px_rgba(15,23,42,0.65)]"
              >
                {/* Glowing ember top architectural hairline */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/90 to-transparent"
                />

                {/* Warm obsidian crown wash (zero blur filter) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-56"
                  style={{
                    background:
                      "radial-gradient(ellipse 65% 100% at 50% 0%, rgba(234,88,12,0.22) 0%, rgba(245,158,11,0.06) 52%, transparent 100%)",
                  }}
                />

                {/* Subtle dot-matrix pattern */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-35"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.24) 1px, transparent 0)",
                    backgroundSize: "24px 24px",
                  }}
                />

                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/35 bg-orange-950/70 px-3.5 py-1 text-xs font-bold text-orange-200 mb-5">
                    <Flame className="size-3.5 text-orange-300" aria-hidden="true" />
                    <span>Empezá a vender hoy mismo</span>
                  </div>

                  <h2 className="mx-auto max-w-3xl text-3xl sm:text-4xl lg:text-5xl font-black tracking-[-0.03em] leading-[1.08] text-white">
                    ¿Listo para potenciar las ventas de tu negocio?
                  </h2>
                  <p className="mt-4 text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed font-normal">
                    Gestioná tu catálogo, recibí pedidos en WhatsApp y tomá el control absoluto de
                    tus clientes sin intermediarios.
                  </p>

                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <MagneticButton
                      onClick={handleAdminAccess}
                      className="group gap-2.5 rounded-2xl bg-gradient-to-r from-orange-700 to-amber-700 hover:from-orange-600 hover:to-amber-600 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-orange-950/50 transition-colors cursor-pointer focus-visible:ring-offset-slate-950"
                    >
                      <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
                      <span>Ingresar al Panel de Gestión</span>
                      <ArrowRight
                        className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </MagneticButton>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs font-semibold text-slate-300">
                    <span>0% comisión por venta</span>
                    <span aria-hidden="true" className="hidden sm:inline text-slate-600">
                      ·
                    </span>
                    <span>Activación inmediata</span>
                    <span aria-hidden="true" className="hidden sm:inline text-slate-600">
                      ·
                    </span>
                    <span>Control total de tu marca</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* Crisp Minimal Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 bg-[#F7F5F2] dark:bg-[#0D121F] py-8 text-slate-600 dark:text-slate-400 text-xs transition-colors">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Flame
                className="size-4 text-orange-700 dark:text-orange-400 shrink-0"
                aria-hidden="true"
              />
              <span className="font-black text-slate-950 dark:text-white">FoodOS</span>
              <span>— Plataforma Multi-Restaurante de Pedidos Directos</span>
            </div>

            <div className="flex items-center gap-4 sm:gap-6 font-semibold">
              <button
                type="button"
                onClick={handleAdminAccess}
                className="pointer-coarse:min-h-11 px-2 py-1 hover:text-orange-700 dark:hover:text-orange-400 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0D121F] rounded-lg"
              >
                Acceso Admin
              </button>
              <a
                href="#features"
                className="px-2 py-1 hover:text-orange-700 dark:hover:text-orange-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0D121F] rounded-lg"
              >
                Beneficios
              </a>
              <a
                href="#how-it-works"
                className="px-2 py-1 hover:text-orange-700 dark:hover:text-orange-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0D121F] rounded-lg"
              >
                Cómo Funciona
              </a>
            </div>
          </div>
        </footer>
      </div>
    </MotionConfig>
  )
}
