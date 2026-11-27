import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useId, useRef, useState } from "react"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import {
  Check,
  CheckCircle2,
  Flame,
  MessageSquare,
  Plus,
  QrCode,
  RotateCcw,
  Send,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  Volume2,
  Zap,
} from "lucide-react"
import {
  ensureLandingGsapRegistered,
  gsap,
  ScrollTrigger,
  supportsGsapMatchMedia,
  useGSAP,
} from "./gsapSetup"

type ShowcaseTab = "delivery" | "qr" | "kanban"
type KanbanStatus = "pending" | "cooking" | "ready"

interface DeliveryExtra {
  id: string
  name: string
  price: number
  defaultSelected: boolean
}

interface QrTableItem {
  id: string
  name: string
  description: string
  price: number
  icon: "burger" | "drink"
}

interface QrTablePreset {
  id: string
  name: string
  items: QrTableItem[]
}

interface KanbanTicket {
  id: string
  title: string
  summary: string
  price: string
  channel: string
  status: KanbanStatus
}

const DELIVERY_BASE_BURGER_PRICE = 28000
const DELIVERY_SIDES_PRICE = 12500

const DELIVERY_EXTRAS: readonly DeliveryExtra[] = [
  { id: "bacon", name: "Tocineta Extra", price: 3500, defaultSelected: true },
  { id: "cheddar", name: "Queso Cheddar", price: 4000, defaultSelected: false },
  { id: "truffle", name: "Papas Trufadas", price: 6500, defaultSelected: false },
]

const QR_EXTRA_DRINK_PRICE = 9000

const QR_TABLES: readonly QrTablePreset[] = [
  {
    id: "mesa-4",
    name: "Mesa 4 · Terraza",
    items: [
      {
        id: "m4-burgers",
        name: "2x Smash Burger Doble",
        description: "Pan brioche, doble queso cheddar, salsa especial",
        price: 48000,
        icon: "burger",
      },
      {
        id: "m4-drinks",
        name: "2x Limonada Natural",
        description: "Limón recién exprimido con hierbabuena",
        price: 14000,
        icon: "drink",
      },
    ],
  },
  {
    id: "mesa-7",
    name: "Mesa 7 · Patio",
    items: [
      {
        id: "m7-burger",
        name: "1x Craft Monster Burger",
        description: "Doble carne 150g, cheddar fundido, tocineta ahumada",
        price: 28000,
        icon: "burger",
      },
      {
        id: "m7-wings",
        name: "1x Alitas BBQ Ahumadas",
        description: "8 piezas glaseadas con miel y chipotle de la casa",
        price: 20500,
        icon: "drink",
      },
    ],
  },
  {
    id: "barra-2",
    name: "Barra 2 · VIP",
    items: [
      {
        id: "b2-burger",
        name: "1x Smash Trufada",
        description: "Carne madurada, alioli trufado y cebolla crispy",
        price: 26000,
        icon: "burger",
      },
      {
        id: "b2-beer",
        name: "1x Cerveza Artesanal IPA",
        description: "Pinta helada 473ml tirada directo de barril",
        price: 10000,
        icon: "drink",
      },
    ],
  },
]

const INITIAL_KANBAN_TICKETS: readonly KanbanTicket[] = [
  {
    id: "104",
    title: "#104 · Mesa 4",
    summary: "2x Smash Burger Doble, 2x Limonada Natural",
    price: "$62.000",
    channel: "Salón QR",
    status: "pending",
  },
  {
    id: "103",
    title: "#103 · Delivery WhatsApp",
    summary: "1x Craft Monster + Tocineta, 1x Papas Rústicas",
    price: "$44.000",
    channel: "WhatsApp",
    status: "cooking",
  },
  {
    id: "102",
    title: "#102 · Retiro en Local",
    summary: "1x Combo Burger Clásica + Bebida",
    price: "$31.000 · Pagado",
    channel: "Retiro",
    status: "ready",
  },
]

const KANBAN_COLUMNS: readonly {
  status: KanbanStatus
  label: string
  topAccentClass: string
  headerClass: string
  badgeClass: string
  cardBorderClass: string
  actionLabel: string
  actionClass: string
}[] = [
  {
    status: "pending",
    label: "Pendiente",
    topAccentClass: "from-amber-500/80 via-amber-400/50 to-transparent",
    headerClass: "text-amber-200",
    badgeClass: "bg-amber-950 border border-amber-700/70 text-amber-200",
    cardBorderClass: "border-amber-800/60",
    actionLabel: "A Cocina →",
    actionClass: "bg-orange-700 hover:bg-orange-800 text-white",
  },
  {
    status: "cooking",
    label: "En Cocina",
    topAccentClass: "from-orange-500/80 via-orange-400/50 to-transparent",
    headerClass: "text-orange-200",
    badgeClass: "bg-orange-950 border border-orange-700/70 text-orange-200",
    cardBorderClass: "border-orange-800/60",
    actionLabel: "Marcar Listo →",
    actionClass: "bg-emerald-700 hover:bg-emerald-800 text-white",
  },
  {
    status: "ready",
    label: "Listo",
    topAccentClass: "from-emerald-500/80 via-emerald-400/50 to-transparent",
    headerClass: "text-emerald-200",
    badgeClass: "bg-emerald-950 border border-emerald-700/70 text-emerald-200",
    cardBorderClass: "border-emerald-800/60",
    actionLabel: "Entregado ✓",
    actionClass: "bg-slate-100 hover:bg-white text-slate-950",
  },
]

const TABS: readonly {
  id: ShowcaseTab
  label: string
  panelId: string
  tabId: string
}[] = [
  {
    id: "delivery",
    label: "Pedido Delivery",
    panelId: "panel-delivery",
    tabId: "tab-delivery",
  },
  {
    id: "qr",
    label: "Mesa & Código QR",
    panelId: "panel-qr",
    tabId: "tab-qr",
  },
  {
    id: "kanban",
    label: "Cocina & Kanban",
    panelId: "panel-kanban",
    tabId: "tab-kanban",
  },
]

const TAB_SPRING = { type: "spring", stiffness: 420, damping: 32 } as const
const CARD_SPRING = { type: "spring", stiffness: 380, damping: 30 } as const

function formatCop(amount: number): string {
  const formatted = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `$${formatted}`
}

export function InteractiveShowcase() {
  const scopeId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const spotlightRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const isInitialTabMountRef = useRef(true)

  const [activeTab, setActiveTab] = useState<ShowcaseTab>("delivery")

  // Delivery interactive state
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>(() =>
    DELIVERY_EXTRAS.filter((extra) => extra.defaultSelected).map((extra) => extra.id)
  )
  const [whatsAppSent, setWhatsAppSent] = useState(false)
  const sentTimerRef = useRef<number | null>(null)

  // QR table interactive state
  const [selectedTableId, setSelectedTableId] = useState<string>(QR_TABLES[0].id)
  const [extraDrinksByTable, setExtraDrinksByTable] = useState<Record<string, number>>({})

  // Kanban interactive state
  const [tickets, setTickets] = useState<KanbanTicket[]>(() => [...INITIAL_KANBAN_TICKETS])
  const [deliveredCount, setDeliveredCount] = useState(0)

  // Clear pending toast timer on unmount
  useEffect(() => {
    return () => {
      if (sentTimerRef.current !== null) {
        window.clearTimeout(sentTimerRef.current)
      }
    }
  }, [])

  // Refresh downstream ScrollTrigger positions when active showcase tab changes height
  useEffect(() => {
    if (isInitialTabMountRef.current) {
      isInitialTabMountRef.current = false
      return
    }
    if (!supportsGsapMatchMedia()) return

    let timeoutId: number | null = null
    const rafId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        ensureLandingGsapRegistered()
        ScrollTrigger.refresh()
      }, 220)
    })

    return () => {
      window.cancelAnimationFrame(rafId)
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [activeTab])

  const handleTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) => {
    let nextIndex: number | null = null
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % TABS.length
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length
    } else if (event.key === "Home") {
      nextIndex = 0
    } else if (event.key === "End") {
      nextIndex = TABS.length - 1
    }

    if (nextIndex === null) return

    event.preventDefault()
    setActiveTab(TABS[nextIndex].id)
    tabRefs.current[nextIndex]?.focus()
  }

  // GSAP desktop cursor-tracking ember highlight (strictly separate DOM node from Motion)
  useGSAP(
    () => {
      ensureLandingGsapRegistered()
      if (!supportsGsapMatchMedia()) return

      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference) and (pointer: fine)", () => {
        const container = containerRef.current
        const spotlight = spotlightRef.current
        if (!container || !spotlight) return

        const moveX = gsap.quickTo(spotlight, "x", { duration: 0.45, ease: "power3.out" })
        const moveY = gsap.quickTo(spotlight, "y", { duration: 0.45, ease: "power3.out" })
        const fadeTo = gsap.quickTo(spotlight, "opacity", { duration: 0.3, ease: "power2.out" })

        const handlePointerMove = (event: PointerEvent) => {
          const rect = container.getBoundingClientRect()
          moveX(event.clientX - rect.left)
          moveY(event.clientY - rect.top)
          fadeTo(1)
        }

        const handlePointerLeave = () => {
          fadeTo(0)
        }

        container.addEventListener("pointermove", handlePointerMove, { passive: true })
        container.addEventListener("pointerleave", handlePointerLeave, { passive: true })

        return () => {
          container.removeEventListener("pointermove", handlePointerMove)
          container.removeEventListener("pointerleave", handlePointerLeave)
          gsap.set(spotlight, { opacity: 0 })
        }
      })

      return () => mm.revert()
    },
    { scope: containerRef }
  )

  // Derived Delivery values
  const activeExtras = DELIVERY_EXTRAS.filter((extra) => selectedExtraIds.includes(extra.id))
  const extrasTotal = activeExtras.reduce((sum, extra) => sum + extra.price, 0)
  const deliveryTotal = DELIVERY_BASE_BURGER_PRICE + DELIVERY_SIDES_PRICE + extrasTotal

  const toggleExtra = (extraId: string) => {
    setSelectedExtraIds((prev) =>
      prev.includes(extraId) ? prev.filter((id) => id !== extraId) : [...prev, extraId]
    )
    setWhatsAppSent(false)
  }

  const handleSimulateWhatsApp = () => {
    setWhatsAppSent(true)
    if (sentTimerRef.current !== null) {
      window.clearTimeout(sentTimerRef.current)
    }
    sentTimerRef.current = window.setTimeout(() => {
      setWhatsAppSent(false)
      sentTimerRef.current = null
    }, 4500)
  }

  // Derived QR values
  const activeTable = QR_TABLES.find((table) => table.id === selectedTableId) ?? QR_TABLES[0]
  const extraDrinkCount = extraDrinksByTable[activeTable.id] ?? 0
  const tableBaseTotal = activeTable.items.reduce((sum, item) => sum + item.price, 0)
  const qrTotal = tableBaseTotal + extraDrinkCount * QR_EXTRA_DRINK_PRICE

  const handleAddDrink = () => {
    setExtraDrinksByTable((prev) => ({
      ...prev,
      [activeTable.id]: (prev[activeTable.id] ?? 0) + 1,
    }))
  }

  // Derived Kanban actions
  const hasKanbanChanges =
    deliveredCount > 0 ||
    tickets.length !== INITIAL_KANBAN_TICKETS.length ||
    tickets.some((ticket) => {
      const initial = INITIAL_KANBAN_TICKETS.find((t) => t.id === ticket.id)
      return !initial || initial.status !== ticket.status
    })

  const advanceTicket = (ticketId: string) => {
    const target = tickets.find((t) => t.id === ticketId)
    if (!target) return

    if (target.status === "pending") {
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: "cooking" } : t))
      )
      return
    }

    if (target.status === "cooking") {
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: "ready" } : t))
      )
      return
    }

    setTickets((prev) => prev.filter((t) => t.id !== ticketId))
    setDeliveredCount((count) => count + 1)
  }

  const resetKanban = () => {
    setTickets([...INITIAL_KANBAN_TICKETS])
    setDeliveredCount(0)
  }

  const renderTabIcon = (tabId: ShowcaseTab) => {
    if (tabId === "delivery") return <MessageSquare className="size-3.5 shrink-0" aria-hidden="true" />
    if (tabId === "qr") return <QrCode className="size-3.5 shrink-0" aria-hidden="true" />
    return <Zap className="size-3.5 shrink-0" aria-hidden="true" />
  }

  return (
    <div data-gsap-showcase-unfold className="mt-16 max-w-5xl mx-auto">
      <div
        ref={containerRef}
        className="relative rounded-3xl border border-slate-800/90 bg-slate-950 p-4 sm:p-6 shadow-[0_32px_90px_-24px_rgba(15,23,42,0.55)] text-left text-slate-100 overflow-hidden"
      >
        {/* Luminous ember top hairline accent */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/80 to-transparent"
        />

        {/* Subtle ambient obsidian crown wash (zero blur filter) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-44"
          style={{
            background:
              "radial-gradient(ellipse 68% 100% at 50% 0%, rgba(234, 88, 12, 0.14) 0%, rgba(245, 158, 11, 0.04) 48%, transparent 100%)",
          }}
        />

        {/* GSAP cursor-tracking ember radial highlight (desktop fine-pointer only, zero blur filter) */}
        <div
          ref={spotlightRef}
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -left-40 size-80 rounded-full opacity-0 will-change-transform"
          style={{
            background:
              "radial-gradient(circle, rgba(249, 115, 22, 0.18) 0%, rgba(245, 158, 11, 0.07) 44%, transparent 72%)",
          }}
        />

        <div className="relative z-10">
          {/* Top Obsidian Command Browser Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 pb-3.5 mb-5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
                <span className="size-3 rounded-full bg-rose-400/90" />
                <span className="size-3 rounded-full bg-amber-400/90" />
                <span className="size-3 rounded-full bg-emerald-400/90" />
              </div>
              <span className="ml-2 inline-flex items-center rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-mono font-medium text-slate-200 min-w-0 break-all">
                https://foodos.app/craft-burger
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold bg-emerald-950/90 text-emerald-200 px-3 py-1.5 rounded-full border border-emerald-800/70">
              <span
                className="size-2 rounded-full bg-emerald-400 animate-pulse motion-reduce:animate-none"
                aria-hidden="true"
              />
              <span>Tienda Operando en Vivo</span>
            </div>
          </div>

          <LayoutGroup id={scopeId}>
            {/* Scenario Tabs Dock with shared-element Motion spring indicator */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label="Escenarios del producto FoodOS"
                className="inline-flex flex-wrap gap-1.5 rounded-2xl border border-slate-800 bg-slate-900/90 p-1.5"
              >
                {TABS.map((tab, tabIndex) => {
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      ref={(el) => {
                        tabRefs.current[tabIndex] = el
                      }}
                      type="button"
                      role="tab"
                      id={tab.tabId}
                      tabIndex={isActive ? 0 : -1}
                      aria-selected={isActive}
                      aria-controls={tab.panelId}
                      onClick={() => setActiveTab(tab.id)}
                      onKeyDown={(event) => handleTabKeyDown(event, tabIndex)}
                      className={`relative pointer-coarse:min-h-11 inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                        isActive
                          ? "text-white"
                          : "bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId={`${scopeId}-tab-pill`}
                          transition={TAB_SPRING}
                          aria-hidden="true"
                          className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-700 to-amber-700 border border-orange-500/40 shadow-[0_0_24px_-4px_rgba(234,88,12,0.55)]"
                        />
                      )}
                      <span className="relative z-10 inline-flex items-center gap-2">
                        {renderTabIcon(tab.id)}
                        <span>{tab.label}</span>
                      </span>
                    </button>
                  )
                })}
              </div>

              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-semibold text-orange-200">
                <Sparkles className="size-3.5 text-orange-200 shrink-0" aria-hidden="true" />
                <span>Simulador interactivo en vivo</span>
              </span>
            </div>

            {/* Animated Tab Stage */}
            <div className="relative">
              <AnimatePresence mode="popLayout" initial={false}>
                {/* Tab 1: Pedido Delivery */}
                {activeTab === "delivery" && (
                  <motion.div
                    key="delivery"
                    role="tabpanel"
                    id="panel-delivery"
                    aria-labelledby="tab-delivery"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start"
                  >
                    {/* Mockup Obsidian Storefront Builder */}
                    <div className="md:col-span-7 space-y-3.5">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="size-11 shrink-0 rounded-2xl bg-gradient-to-br from-orange-700 to-amber-700 border border-orange-500/40 flex items-center justify-center text-white shadow-sm">
                              <UtensilsCrossed className="size-5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-sm text-white">
                                Craft Monster Burger
                              </h3>
                              <p className="text-sm text-slate-200">
                                Doble carne 150g, cheddar fundido, tocineta
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-sm font-extrabold text-orange-200">
                              {formatCop(DELIVERY_BASE_BURGER_PRICE)}
                            </span>
                            {extrasTotal > 0 && (
                              <div className="text-xs font-semibold text-emerald-200">
                                +{formatCop(extrasTotal)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Interactive Add-on Toggle Chips */}
                        <div className="border-t border-slate-800 pt-3">
                          <span className="block text-xs font-semibold text-slate-200 mb-2.5">
                            Probá sumar o quitar adiciones en vivo:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {DELIVERY_EXTRAS.map((extra) => {
                              const isSelected = selectedExtraIds.includes(extra.id)
                              return (
                                <motion.button
                                  key={extra.id}
                                  type="button"
                                  aria-pressed={isSelected}
                                  whileTap={{ scale: 0.96 }}
                                  onClick={() => toggleExtra(extra.id)}
                                  className={`pointer-coarse:min-h-11 inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                                    isSelected
                                      ? "border-emerald-500/70 bg-emerald-950 text-emerald-200 shadow-[0_0_16px_-4px_rgba(16,185,129,0.45)]"
                                      : "border-slate-700 bg-slate-950 text-slate-200 hover:border-orange-500/70 hover:text-orange-200"
                                  }`}
                                >
                                  {isSelected ? (
                                    <Check className="size-3.5 shrink-0" aria-hidden="true" />
                                  ) : (
                                    <Plus className="size-3.5 shrink-0" aria-hidden="true" />
                                  )}
                                  <span>
                                    {extra.name} (+{formatCop(extra.price)})
                                  </span>
                                </motion.button>
                              )
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-11 shrink-0 rounded-2xl bg-amber-700 border border-amber-500/40 flex items-center justify-center text-white shadow-sm">
                            <Flame className="size-5" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-white">
                              Papas Rústicas Cheddar
                            </h3>
                            <p className="text-sm text-slate-200">
                              Papas crocantes con salsa artesanal
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-extrabold text-orange-200 shrink-0">
                          {formatCop(DELIVERY_SIDES_PRICE)}
                        </span>
                      </div>

                      <div className="rounded-2xl bg-orange-950/75 border border-orange-800/70 p-3.5 flex items-center justify-between gap-3 text-xs text-orange-100 font-semibold">
                        <div className="flex items-center gap-2 min-w-0">
                          <ShoppingBag
                            className="size-4 text-orange-200 shrink-0"
                            aria-hidden="true"
                          />
                          <span>
                            Carrito de Compra: 2 productos
                            {activeExtras.length > 0
                              ? ` + ${activeExtras.length} ${activeExtras.length === 1 ? "adición" : "adiciones"}`
                              : ""}
                          </span>
                        </div>
                        <span className="text-sm font-extrabold text-white shrink-0">
                          {formatCop(deliveryTotal)}
                        </span>
                      </div>
                    </div>

                    {/* Glowing Emerald WhatsApp Terminal */}
                    <div className="md:col-span-5 rounded-2xl border border-emerald-800/70 bg-emerald-950/45 p-4 relative shadow-[0_0_40px_-16px_rgba(16,185,129,0.4)] space-y-3.5">
                      <div className="flex items-center justify-between gap-2 text-emerald-200 text-xs font-bold">
                        <span className="inline-flex items-center gap-2">
                          <MessageSquare
                            className="size-4 text-emerald-200 shrink-0"
                            aria-hidden="true"
                          />
                          <span>Mensaje formateado en WhatsApp:</span>
                        </span>
                        <span className="rounded-full border border-emerald-700/70 bg-emerald-950 px-2 py-0.5 text-xs font-bold text-emerald-200">
                          Directo
                        </span>
                      </div>

                      <div className="rounded-xl bg-slate-950 border border-emerald-800/60 p-3.5 text-xs text-slate-100 font-mono space-y-1.5 leading-relaxed">
                        <div className="font-bold text-emerald-200">
                          👋 ¡Hola Craft Burger! Nuevo Pedido:
                        </div>
                        <div>• 1x Craft Monster Burger ({formatCop(DELIVERY_BASE_BURGER_PRICE)})</div>
                        {activeExtras.map((extra) => (
                          <div key={extra.id} className="text-emerald-200 pl-2">
                            + {extra.name} ({formatCop(extra.price)})
                          </div>
                        ))}
                        <div>• 1x Papas Rústicas ({formatCop(DELIVERY_SIDES_PRICE)})</div>
                        <div className="border-t border-slate-800 pt-2 text-white font-bold">
                          Total a Pagar: {formatCop(deliveryTotal)}
                        </div>
                        <div className="text-emerald-200">
                          📍 Cra 15 # 85-30 • Pago: Efectivo
                        </div>
                      </div>

                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.015 }}
                        whileTap={{ scale: 0.97 }}
                        transition={TAB_SPRING}
                        onClick={handleSimulateWhatsApp}
                        className="w-full min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-500/40 px-4 py-2.5 text-xs font-bold shadow-[0_0_24px_-6px_rgba(16,185,129,0.55)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                      >
                        <Send className="size-3.5 shrink-0" aria-hidden="true" />
                        <span>Simular Envío por WhatsApp</span>
                      </motion.button>

                      <AnimatePresence>
                        {whatsAppSent && (
                          <motion.div
                            key="whatsapp-toast"
                            role="status"
                            aria-live="polite"
                            initial={{ opacity: 0, y: 8, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.96 }}
                            transition={CARD_SPRING}
                            className="rounded-xl border border-emerald-600/70 bg-emerald-950 px-3 py-2.5 flex items-center gap-2 text-xs font-bold text-emerald-200"
                          >
                            <CheckCircle2
                              className="size-4 text-emerald-200 shrink-0"
                              aria-hidden="true"
                            />
                            <span>Ticket enviado al instante · 0% comisión</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}

                {/* Tab 2: Mesa & Código QR */}
                {activeTab === "qr" && (
                  <motion.div
                    key="qr"
                    role="tabpanel"
                    id="panel-qr"
                    aria-labelledby="tab-qr"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start"
                  >
                    <div className="md:col-span-7 space-y-3.5">
                      {/* Table Selector Bar with Motion layoutId pill */}
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-900/90 p-2.5">
                        <div
                          role="group"
                          aria-label="Seleccionar mesa del salón"
                          className="flex flex-wrap items-center gap-1.5"
                        >
                          {QR_TABLES.map((table) => {
                            const isSelected = table.id === activeTable.id
                            return (
                              <button
                                key={table.id}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => setSelectedTableId(table.id)}
                                className={`relative pointer-coarse:min-h-11 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                                  isSelected
                                    ? "text-white"
                                    : "bg-slate-900 text-amber-200 hover:bg-slate-800 hover:text-white"
                                }`}
                              >
                                {isSelected && (
                                  <motion.span
                                    layoutId={`${scopeId}-qr-table-pill`}
                                    transition={TAB_SPRING}
                                    aria-hidden="true"
                                    className="absolute inset-0 rounded-xl bg-amber-700 border border-amber-500/40 shadow-xs"
                                  />
                                )}
                                <span className="relative z-10 inline-flex items-center gap-1.5">
                                  <QrCode className="size-3.5 shrink-0" aria-hidden="true" />
                                  <span>{table.name}</span>
                                </span>
                              </button>
                            )
                          })}
                        </div>

                        <span className="rounded-full bg-emerald-950 px-2.5 py-1 text-xs font-bold text-emerald-200 border border-emerald-700/70">
                          QR Escaneado
                        </span>
                      </div>

                      {/* Table Items */}
                      <div className="space-y-3">
                        {activeTable.items.map((item) => (
                          <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={CARD_SPRING}
                            className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`size-11 shrink-0 rounded-2xl flex items-center justify-center text-white shadow-sm ${
                                  item.icon === "burger"
                                    ? "bg-orange-700 border border-orange-500/40"
                                    : "bg-amber-700 border border-amber-500/40"
                                }`}
                              >
                                {item.icon === "burger" ? (
                                  <UtensilsCrossed className="size-5" aria-hidden="true" />
                                ) : (
                                  <Sparkles className="size-5" aria-hidden="true" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-sm text-white">{item.name}</h3>
                                <p className="text-sm text-slate-200">{item.description}</p>
                              </div>
                            </div>
                            <span className="text-sm font-extrabold text-orange-200 shrink-0">
                              {formatCop(item.price)}
                            </span>
                          </motion.div>
                        ))}

                        <AnimatePresence>
                          {extraDrinkCount > 0 && (
                            <motion.div
                              key="extra-drink-row"
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={CARD_SPRING}
                              className="rounded-2xl border border-emerald-700/70 bg-emerald-950/60 p-4 flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="size-11 shrink-0 rounded-2xl bg-emerald-700 border border-emerald-500/40 flex items-center justify-center text-white shadow-sm">
                                  <Sparkles className="size-5" aria-hidden="true" />
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-bold text-sm text-white">
                                    {extraDrinkCount}x Bebida Extra de la Casa
                                  </h3>
                                  <p className="text-sm text-emerald-200">
                                    Agregada en nueva ronda desde la mesa
                                  </p>
                                </div>
                              </div>
                              <span className="text-sm font-extrabold text-emerald-200 shrink-0">
                                {formatCop(extraDrinkCount * QR_EXTRA_DRINK_PRICE)}
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-orange-950/75 border border-orange-800/70 p-3.5 text-xs text-orange-100 font-semibold">
                        <div className="flex items-center gap-2">
                          <ShoppingBag
                            className="size-4 text-orange-200 shrink-0"
                            aria-hidden="true"
                          />
                          <span>Cuenta abierta en mesa</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.96 }}
                            onClick={handleAddDrink}
                            className="pointer-coarse:min-h-11 inline-flex items-center gap-1 rounded-xl border border-orange-500/60 bg-slate-950 px-3 py-1.5 text-xs font-bold text-orange-200 hover:bg-orange-950 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                          >
                            <span>+ Agregar Bebida (+$9.000)</span>
                          </motion.button>
                          <span className="text-sm font-extrabold text-white">
                            {formatCop(qrTotal)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Instant Kitchen / Table Ticket */}
                    <div className="md:col-span-5 rounded-2xl border border-amber-800/60 bg-slate-900/90 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-amber-200 text-xs font-bold">
                        <QrCode
                          className="size-4 text-amber-200 shrink-0"
                          aria-hidden="true"
                        />
                        <span>Comanda instantánea de salón:</span>
                      </div>
                      <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 text-xs text-slate-100 font-mono space-y-2 leading-relaxed">
                        <div className="font-bold text-orange-200">
                          🪑 Pedido en Salón — {activeTable.name}
                        </div>
                        {activeTable.items.map((item) => (
                          <div key={item.id}>
                            • {item.name} ({formatCop(item.price)})
                          </div>
                        ))}
                        {extraDrinkCount > 0 && (
                          <div className="text-emerald-200">
                            • {extraDrinkCount}x Bebida Extra (
                            {formatCop(extraDrinkCount * QR_EXTRA_DRINK_PRICE)})
                          </div>
                        )}
                        <div className="border-t border-slate-800 pt-2 text-white font-bold">
                          Total Mesa: {formatCop(qrTotal)}
                        </div>
                        <div className="text-emerald-200 font-semibold">
                          Sin espera en caja • Directo a cocina
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Tab 3: Cocina & Kanban (Interactive Obsidian KDS Showstopper) */}
                {activeTab === "kanban" && (
                  <motion.div
                    key="kanban"
                    role="tabpanel"
                    id="panel-kanban"
                    aria-labelledby="tab-kanban"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-200">
                        Hacé clic en el botón de cada comanda para avanzar el pedido por la cocina:
                      </span>
                      <div className="flex items-center gap-2">
                        {deliveredCount > 0 && (
                          <span className="rounded-full bg-emerald-950 border border-emerald-700/70 px-2.5 py-1 text-xs font-bold text-emerald-200">
                            {deliveredCount} {deliveredCount === 1 ? "entregado" : "entregados"}
                          </span>
                        )}
                        {hasKanbanChanges && (
                          <motion.button
                            type="button"
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={resetKanban}
                            className="pointer-coarse:min-h-11 inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                          >
                            <RotateCcw className="size-3.5 shrink-0" aria-hidden="true" />
                            <span>Reiniciar tablero</span>
                          </motion.button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {KANBAN_COLUMNS.map((column) => {
                        const columnTickets = tickets.filter((t) => t.status === column.status)
                        return (
                          <div
                            key={column.status}
                            className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/85 p-3.5 space-y-2.5 min-h-[200px] flex flex-col"
                          >
                            <div
                              aria-hidden="true"
                              className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${column.topAccentClass}`}
                            />

                            <div
                              className={`flex items-center justify-between text-xs font-bold ${column.headerClass}`}
                            >
                              <span>{column.label}</span>
                              <span className={`rounded-full px-2 py-0.5 ${column.badgeClass}`}>
                                {columnTickets.length}
                              </span>
                            </div>

                            <div className="relative space-y-2.5 flex-1">
                              <AnimatePresence mode="popLayout">
                                {columnTickets.map((ticket) => (
                                  <motion.div
                                    key={ticket.id}
                                    layout
                                    layoutId={`${scopeId}-kanban-card-${ticket.id}`}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={CARD_SPRING}
                                    className={`rounded-xl border ${column.cardBorderClass} bg-slate-950 p-3 space-y-2`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="font-bold text-xs text-white">
                                        {ticket.title}
                                      </div>
                                      <span className="shrink-0 rounded-md border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-xs font-semibold text-slate-200">
                                        {ticket.channel}
                                      </span>
                                    </div>

                                    <div className="text-xs text-slate-200">
                                      {ticket.summary}
                                    </div>

                                    <div className="flex items-center justify-between gap-2 pt-1">
                                      <span className="text-xs font-extrabold text-orange-200">
                                        {ticket.price}
                                      </span>
                                      <motion.button
                                        type="button"
                                        aria-label={`${column.actionLabel} (#${ticket.id})`}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => advanceTicket(ticket.id)}
                                        className={`pointer-coarse:min-h-11 inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${column.actionClass}`}
                                      >
                                        {column.actionLabel}
                                      </motion.button>
                                    </div>
                                  </motion.div>
                                ))}
                              </AnimatePresence>

                              {columnTickets.length === 0 && (
                                <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-4 text-center text-xs font-medium text-slate-200">
                                  Sin pedidos en esta etapa
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="rounded-2xl border border-emerald-800/70 bg-emerald-950/55 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-200">
                      <div className="flex items-center gap-2 font-semibold">
                        <Volume2
                          className="size-4 text-emerald-200 shrink-0"
                          aria-hidden="true"
                        />
                        <span>Alertas sonoras activas · Sincronización en tiempo real vía SSE</span>
                      </div>
                      <span className="font-bold text-white">Latencia &lt; 1s</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </LayoutGroup>
        </div>
      </div>
    </div>
  )
}

export default InteractiveShowcase
