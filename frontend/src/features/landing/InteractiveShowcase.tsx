import { useEffect, useId, useRef, useState } from "react"
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
  headerClass: string
  badgeClass: string
  cardBorderClass: string
  actionLabel: string
  actionClass: string
}[] = [
  {
    status: "pending",
    label: "Pendiente",
    headerClass: "text-amber-800 dark:text-amber-300",
    badgeClass: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300",
    cardBorderClass: "border-amber-200 dark:border-amber-900/50",
    actionLabel: "A Cocina →",
    actionClass:
      "bg-orange-700 hover:bg-orange-800 text-white dark:bg-orange-700 dark:hover:bg-orange-600",
  },
  {
    status: "cooking",
    label: "En Cocina",
    headerClass: "text-orange-800 dark:text-orange-300",
    badgeClass: "bg-orange-100 text-orange-900 dark:bg-orange-950/60 dark:text-orange-300",
    cardBorderClass: "border-orange-200 dark:border-orange-900/50",
    actionLabel: "Marcar Listo →",
    actionClass:
      "bg-emerald-700 hover:bg-emerald-800 text-white dark:bg-emerald-700 dark:hover:bg-emerald-600",
  },
  {
    status: "ready",
    label: "Listo",
    headerClass: "text-emerald-800 dark:text-emerald-300",
    badgeClass: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300",
    cardBorderClass: "border-emerald-200 dark:border-emerald-900/50",
    actionLabel: "Entregado ✓",
    actionClass:
      "bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900",
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
    <div
      ref={containerRef}
      className="mt-16 relative max-w-4xl mx-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-2xl text-left overflow-hidden"
    >
      {/* GSAP cursor-tracking ember radial highlight (desktop fine-pointer only, zero blur filter) */}
      <div
        ref={spotlightRef}
        aria-hidden="true"
        className="pointer-events-none absolute -top-36 -left-36 size-72 rounded-full opacity-0 will-change-transform"
        style={{
          background:
            "radial-gradient(circle, rgba(234, 88, 12, 0.14) 0%, rgba(245, 158, 11, 0.06) 44%, transparent 72%)",
        }}
      />

      <div className="relative z-10">
        {/* Top Browser Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-3 rounded-full bg-rose-400 shrink-0" aria-hidden="true" />
            <div className="size-3 rounded-full bg-amber-400 shrink-0" aria-hidden="true" />
            <div className="size-3 rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
            <span className="ml-2 text-xs font-mono font-medium text-slate-600 dark:text-slate-400 min-w-0 break-all">
              https://foodos.app/craft-burger
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60">
            <span
              className="size-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse motion-reduce:animate-none"
              aria-hidden="true"
            />
            <span>Tienda Operando en Vivo</span>
          </div>
        </div>

        <LayoutGroup id={scopeId}>
          {/* Scenario Tabs with shared-element Motion spring indicator */}
          <div
            role="tablist"
            aria-label="Escenarios del producto FoodOS"
            className="flex flex-wrap gap-2 mb-5"
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={tab.tabId}
                  aria-selected={isActive}
                  aria-controls={tab.panelId}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative pointer-coarse:min-h-11 inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 dark:focus-visible:ring-orange-400 dark:focus-visible:ring-offset-slate-900 ${
                    isActive
                      ? "text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-orange-50 hover:text-orange-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId={`${scopeId}-tab-pill`}
                      transition={TAB_SPRING}
                      aria-hidden="true"
                      className="absolute inset-0 rounded-xl bg-orange-700 shadow-sm"
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
                  className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start"
                >
                  {/* Mockup Storefront Builder */}
                  <div className="md:col-span-7 space-y-3">
                    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/50 p-3.5 shadow-xs space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-11 shrink-0 rounded-2xl bg-orange-700 flex items-center justify-center text-white shadow-sm">
                            <UtensilsCrossed className="size-5" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                              Craft Monster Burger
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Doble carne 150g, cheddar fundido, tocineta
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-extrabold text-orange-700 dark:text-orange-400">
                            {formatCop(DELIVERY_BASE_BURGER_PRICE)}
                          </span>
                          {extrasTotal > 0 && (
                            <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              +{formatCop(extrasTotal)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Interactive Add-on Toggle Chips */}
                      <div className="border-t border-slate-200/80 dark:border-slate-700/70 pt-2.5">
                        <span className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
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
                                className={`pointer-coarse:min-h-11 inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 dark:focus-visible:ring-orange-400 dark:focus-visible:ring-offset-slate-900 ${
                                  isSelected
                                    ? "border-emerald-700 bg-emerald-50 text-emerald-800 dark:border-emerald-500/60 dark:bg-emerald-950/60 dark:text-emerald-300"
                                    : "border-slate-300 bg-white text-slate-700 hover:border-orange-400 hover:text-orange-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-orange-500/60"
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

                    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/50 p-3.5 flex items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-11 shrink-0 rounded-2xl bg-amber-700 flex items-center justify-center text-white shadow-sm">
                          <Flame className="size-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                            Papas Rústicas Cheddar
                          </h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Papas crocantes con salsa artesanal
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-extrabold text-orange-700 dark:text-orange-400 shrink-0">
                        {formatCop(DELIVERY_SIDES_PRICE)}
                      </span>
                    </div>

                    <div className="rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/50 p-3 flex items-center justify-between gap-3 text-xs text-orange-950 dark:text-orange-200 font-semibold">
                      <div className="flex items-center gap-2 min-w-0">
                        <ShoppingBag
                          className="size-4 text-orange-700 dark:text-orange-400 shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          Carrito de Compra: 2 productos
                          {activeExtras.length > 0
                            ? ` + ${activeExtras.length} ${activeExtras.length === 1 ? "adición" : "adiciones"}`
                            : ""}
                        </span>
                      </div>
                      <span className="text-sm font-extrabold text-orange-800 dark:text-orange-300 shrink-0">
                        {formatCop(deliveryTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Mockup WhatsApp Message Preview */}
                  <div className="md:col-span-5 rounded-2xl border border-emerald-200 dark:border-[#222E35] bg-[#E8F8F0] dark:bg-[#111B21] p-4 relative shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-emerald-900 dark:text-[#25D366] text-xs font-bold">
                      <MessageSquare
                        className="size-4 text-emerald-700 dark:text-[#25D366] shrink-0"
                        aria-hidden="true"
                      />
                      <span>Mensaje formateado en WhatsApp:</span>
                    </div>

                    <div className="rounded-xl bg-white dark:bg-[#202C33] border border-emerald-200/80 dark:border-[#2A3942] p-3 text-xs text-slate-800 dark:text-[#E9EDEF] font-mono space-y-1.5 leading-relaxed shadow-xs">
                      <div className="font-bold text-emerald-800 dark:text-[#25D366]">
                        👋 ¡Hola Craft Burger! Nuevo Pedido:
                      </div>
                      <div>• 1x Craft Monster Burger ({formatCop(DELIVERY_BASE_BURGER_PRICE)})</div>
                      {activeExtras.map((extra) => (
                        <div
                          key={extra.id}
                          className="text-emerald-800 dark:text-[#25D366] pl-2"
                        >
                          + {extra.name} ({formatCop(extra.price)})
                        </div>
                      ))}
                      <div>• 1x Papas Rústicas ({formatCop(DELIVERY_SIDES_PRICE)})</div>
                      <div className="border-t border-slate-200 dark:border-slate-700/60 pt-1.5 text-slate-900 dark:text-white font-bold">
                        Total a Pagar: {formatCop(deliveryTotal)}
                      </div>
                      <div className="text-emerald-800 dark:text-[#25D366]">
                        📍 Cra 15 # 85-30 • Pago: Efectivo
                      </div>
                    </div>

                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.97 }}
                      transition={TAB_SPRING}
                      onClick={handleSimulateWhatsApp}
                      className="w-full min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 text-xs font-bold shadow-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800 focus-visible:ring-offset-2 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-[#111B21]"
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
                          className="rounded-xl border border-emerald-300 dark:border-emerald-700/60 bg-white dark:bg-emerald-950/80 px-3 py-2 flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-200 shadow-xs"
                        >
                          <CheckCircle2
                            className="size-4 text-emerald-700 dark:text-emerald-400 shrink-0"
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
                  className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start"
                >
                  <div className="md:col-span-7 space-y-3">
                    {/* Table Selector Bar with Motion layoutId pill */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/30 p-2.5">
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
                              className={`relative pointer-coarse:min-h-11 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 dark:focus-visible:ring-orange-400 dark:focus-visible:ring-offset-slate-900 ${
                                isSelected
                                  ? "text-white"
                                  : "text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40"
                              }`}
                            >
                              {isSelected && (
                                <motion.span
                                  layoutId={`${scopeId}-qr-table-pill`}
                                  transition={TAB_SPRING}
                                  aria-hidden="true"
                                  className="absolute inset-0 rounded-xl bg-amber-700 shadow-xs"
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

                      <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
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
                          className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/50 p-3.5 flex items-center justify-between gap-3 shadow-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`size-11 shrink-0 rounded-2xl flex items-center justify-center text-white shadow-sm ${
                                item.icon === "burger" ? "bg-orange-700" : "bg-amber-700"
                              }`}
                            >
                              {item.icon === "burger" ? (
                                <UtensilsCrossed className="size-5" aria-hidden="true" />
                              ) : (
                                <Sparkles className="size-5" aria-hidden="true" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                                {item.name}
                              </h3>
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                {item.description}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-extrabold text-orange-700 dark:text-orange-400 shrink-0">
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
                            className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 flex items-center justify-between gap-3 shadow-xs"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="size-11 shrink-0 rounded-2xl bg-emerald-700 flex items-center justify-center text-white shadow-sm">
                                <Sparkles className="size-5" aria-hidden="true" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                                  {extraDrinkCount}x Bebida Extra de la Casa
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  Agregada en nueva ronda desde la mesa
                                </p>
                              </div>
                            </div>
                            <span className="text-sm font-extrabold text-emerald-800 dark:text-emerald-300 shrink-0">
                              {formatCop(extraDrinkCount * QR_EXTRA_DRINK_PRICE)}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/50 p-3 text-xs text-orange-950 dark:text-orange-200 font-semibold">
                      <div className="flex items-center gap-2">
                        <ShoppingBag
                          className="size-4 text-orange-700 dark:text-orange-400 shrink-0"
                          aria-hidden="true"
                        />
                        <span>Cuenta abierta en mesa</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          onClick={handleAddDrink}
                          className="pointer-coarse:min-h-11 inline-flex items-center gap-1 rounded-xl border border-orange-300 dark:border-orange-700/70 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-orange-800 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-950/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 dark:focus-visible:ring-orange-400"
                        >
                          <span>+ Agregar Bebida (+$9.000)</span>
                        </motion.button>
                        <span className="text-sm font-extrabold text-orange-800 dark:text-orange-300">
                          {formatCop(qrTotal)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Instant Kitchen / Table Ticket */}
                  <div className="md:col-span-5 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-slate-800/70 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 text-xs font-bold mb-2.5">
                      <QrCode
                        className="size-4 text-amber-700 dark:text-amber-400 shrink-0"
                        aria-hidden="true"
                      />
                      <span>Comanda instantánea de salón:</span>
                    </div>
                    <div className="rounded-xl bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-slate-700 p-3.5 text-xs text-slate-800 dark:text-slate-200 font-mono space-y-2 leading-relaxed shadow-xs">
                      <div className="font-bold text-orange-800 dark:text-orange-400">
                        🪑 Pedido en Salón — {activeTable.name}
                      </div>
                      {activeTable.items.map((item) => (
                        <div key={item.id}>
                          • {item.name} ({formatCop(item.price)})
                        </div>
                      ))}
                      {extraDrinkCount > 0 && (
                        <div className="text-emerald-800 dark:text-emerald-400">
                          • {extraDrinkCount}x Bebida Extra ({formatCop(extraDrinkCount * QR_EXTRA_DRINK_PRICE)})
                        </div>
                      )}
                      <div className="border-t border-slate-200 dark:border-slate-800 pt-1.5 text-slate-900 dark:text-white font-bold">
                        Total Mesa: {formatCop(qrTotal)}
                      </div>
                      <div className="text-emerald-800 dark:text-emerald-400 font-semibold">
                        Sin espera en caja • Directo a cocina
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Tab 3: Cocina & Kanban (Interactive Showstopper) */}
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
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Hacé clic en el botón de cada comanda para avanzar el pedido por la cocina:
                    </span>
                    <div className="flex items-center gap-2">
                      {deliveredCount > 0 && (
                        <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
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
                          className="pointer-coarse:min-h-11 inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 dark:focus-visible:ring-orange-400"
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
                          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/40 p-3.5 space-y-2.5 min-h-[190px] flex flex-col"
                        >
                          <div
                            className={`flex items-center justify-between text-xs font-bold ${column.headerClass}`}
                          >
                            <span>{column.label}</span>
                            <span className={`rounded-full px-2 py-0.5 ${column.badgeClass}`}>
                              {columnTickets.length}
                            </span>
                          </div>

                          <div className="space-y-2.5 flex-1">
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
                                  className={`rounded-xl border ${column.cardBorderClass} bg-white dark:bg-slate-900 p-3 shadow-xs space-y-2`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="font-bold text-xs text-slate-900 dark:text-white">
                                      {ticket.title}
                                    </div>
                                    <span className="shrink-0 rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                      {ticket.channel}
                                    </span>
                                  </div>

                                  <div className="text-xs text-slate-600 dark:text-slate-400">
                                    {ticket.summary}
                                  </div>

                                  <div className="flex items-center justify-between gap-2 pt-1">
                                    <span className="text-xs font-extrabold text-orange-700 dark:text-orange-400">
                                      {ticket.price}
                                    </span>
                                    <motion.button
                                      type="button"
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => advanceTicket(ticket.id)}
                                      className={`pointer-coarse:min-h-11 inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 dark:focus-visible:ring-orange-400 dark:focus-visible:ring-offset-slate-900 ${column.actionClass}`}
                                    >
                                      {column.actionLabel}
                                    </motion.button>
                                  </div>
                                </motion.div>
                              ))}
                            </AnimatePresence>

                            {columnTickets.length === 0 && (
                              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-center text-xs font-medium text-slate-600 dark:text-slate-400">
                                Sin pedidos en esta etapa
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/80 dark:bg-emerald-950/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900 dark:text-emerald-200">
                    <div className="flex items-center gap-2 font-semibold">
                      <Volume2
                        className="size-4 text-emerald-700 dark:text-emerald-400 shrink-0"
                        aria-hidden="true"
                      />
                      <span>Alertas sonoras activas · Sincronización en tiempo real vía SSE</span>
                    </div>
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">
                      Latencia &lt; 1s
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </LayoutGroup>
      </div>
    </div>
  )
}

export default InteractiveShowcase
