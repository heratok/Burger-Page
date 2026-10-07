import React, { useState, useEffect, useMemo } from "react"
import type { Order } from "@/types/restaurant"
import { Printer, X, Receipt, ChefHat } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { calculateLineItemTotal } from "@/features/cart/cartEngine"
import { getOrderTableLabel } from "@/features/crm/tables/orderTable"
import { useRestaurant } from "@/context/RestaurantContext"

export type TicketPrintMode = "full" | "kitchen"

export interface OrderTicketModalProps {
  order: Order | null
  isOpen: boolean
  isDark?: boolean
  initialMode?: TicketPrintMode
  storeName?: string
  onClose: () => void
}

const formatOrderDate = (isoString?: string) => {
  if (!isoString) return { date: "--/--/----", time: "--:--" }
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return { date: "--/--/----", time: "--:--" }
    return {
      date: d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" }),
      time: d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false }),
    }
  } catch {
    return { date: "--/--/----", time: "--:--" }
  }
}

export const OrderTicketModal: React.FC<OrderTicketModalProps> = ({
  order,
  isOpen,
  isDark = false,
  initialMode = "full",
  storeName: customStoreName,
  onClose,
}) => {
  const [mode, setMode] = useState<TicketPrintMode>(initialMode)

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode)
    }
  }, [isOpen, initialMode])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  let contextStoreName = "BURGER PAGE"
  try {
    // Safe lookup if rendered within RestaurantProvider
    const rest = useRestaurant()
    if (rest?.storeConfig?.name) {
      contextStoreName = rest.storeConfig.name
    }
  } catch {
    // Fallback when outside provider (e.g. isolated test)
  }

  const restaurantName = customStoreName || contextStoreName

  const orderDate = useMemo(() => formatOrderDate(order?.createdAt), [order?.createdAt])

  const service = useMemo(() => {
    if (!order) return { label: "MOSTRADOR", isTable: false }
    const table = getOrderTableLabel(order)
    if (table) {
      return { label: `SALÓN · ${table.toUpperCase()}`, isTable: true }
    }
    const dir = (order.customer?.direccion ?? "").toLowerCase()
    if (dir.includes("mostrador") || dir.includes("llevar")) {
      return { label: "MOSTRADOR / PARA LLEVAR", isTable: false }
    }
    return { label: "DOMICILIO", isTable: false }
  }, [order])

  const totalItemsCount = useMemo(() => {
    if (!order?.items) return 0
    return order.items.reduce((sum, item: any) => sum + Number(item.cantidad || item.quantity || 1), 0)
  }, [order?.items])

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print()
    }
  }

  if (!isOpen || !order) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-modal-title"
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-xs overflow-y-auto"
    >
      {/* Thermal Print CSS rules */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: 80mm auto;
                margin: 4mm;
              }
              *, *::before, *::after {
                box-sizing: border-box !important;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                font-family: monospace, Courier, monospace !important;
                font-size: 11px !important;
              }
              body * {
                visibility: hidden !important;
              }
              #printable-ticket,
              #printable-ticket * {
                visibility: visible !important;
              }
              #printable-ticket {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 72mm !important;
                max-width: 72mm !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
                background: #ffffff !important;
                color: #000000 !important;
                overflow: visible !important;
              }
              .no-print,
              [data-no-print="true"] {
                display: none !important;
              }
              [role="dialog"] {
                position: static !important;
                inset: auto !important;
                overflow: visible !important;
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 !important;
              }
            }
          `,
        }}
      />

      <div
        className={`w-full max-w-lg md:max-w-3xl lg:max-w-4xl rounded-2xl border p-4 sm:p-5 shadow-2xl transition-all my-auto max-h-[95vh] flex flex-col ${
          isDark ? "border-slate-800 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b pb-3 border-slate-100 dark:border-slate-800 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Printer className="size-4" />
              </span>
              <h3 id="ticket-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                Imprimir Comanda / Ticket
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Orden #{order.orderNumber} · Vista previa formato térmico 80mm
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista previa"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Main Body: Responsive dual-panel on tablet/desktop, stacked on mobile */}
        <div className="mt-3.5 flex flex-col md:flex-row gap-4 flex-1 min-h-0 overflow-hidden">
          {/* ================= LEFT PANEL: CONTROLS & OVERVIEW ================= */}
          <aside className="w-full md:w-[280px] lg:w-[320px] shrink-0 flex flex-col justify-between gap-3">
            {/* Mode Switcher Tabs */}
            <div
              className="grid grid-cols-2 md:flex md:flex-col gap-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 md:p-1.5 shrink-0"
              role="tablist"
              aria-label="Modo de impresión"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "full"}
                onClick={() => setMode("full")}
                className={`flex items-center gap-2.5 rounded-lg p-2 md:p-2.5 text-left transition-all cursor-pointer min-h-[44px] ${
                  mode === "full"
                    ? "bg-white text-indigo-600 shadow-xs dark:bg-slate-900 dark:text-indigo-400 ring-1 ring-black/5 dark:ring-white/10"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800"
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg shrink-0 ${
                    mode === "full"
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
                      : "bg-slate-200/60 dark:bg-slate-700/60 text-slate-500"
                  }`}
                >
                  <Receipt className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold leading-tight">Ticket Completo</div>
                  <div className="hidden md:block text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                    Despacho & Facturación
                  </div>
                </div>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={mode === "kitchen"}
                onClick={() => setMode("kitchen")}
                className={`flex items-center gap-2.5 rounded-lg p-2 md:p-2.5 text-left transition-all cursor-pointer min-h-[44px] ${
                  mode === "kitchen"
                    ? "bg-white text-orange-600 shadow-xs dark:bg-slate-900 dark:text-orange-400 ring-1 ring-black/5 dark:ring-white/10"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800"
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg shrink-0 ${
                    mode === "kitchen"
                      ? "bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400"
                      : "bg-slate-200/60 dark:bg-slate-700/60 text-slate-500"
                  }`}
                >
                  <ChefHat className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold leading-tight">Comanda Cocina</div>
                  <div className="hidden md:block text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                    KOT para preparación
                  </div>
                </div>
              </button>
            </div>

            {/* Order quick overview card (Tablet & Desktop md+) */}
            <div className="hidden md:flex flex-col gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 text-xs">
              <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-slate-200/70 dark:border-slate-700/70">
                <span className="font-black text-sm text-slate-900 dark:text-white">
                  Orden #{order.orderNumber}
                </span>
                <span className="rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wide bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50 truncate max-w-[150px]">
                  {service.isTable ? `Mesa: ${getOrderTableLabel(order) || "Salón"}` : service.label}
                </span>
              </div>

              <div className="space-y-1.5 text-slate-600 dark:text-slate-300 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Registro:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {orderDate.date} {orderDate.time}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Cant. Ítems:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {totalItemsCount} {totalItemsCount === 1 ? "ítem" : "ítems"}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/70 dark:border-slate-700/70 text-xs">
                  <span className="text-slate-700 dark:text-slate-300 font-bold">Total:</span>
                  <span className="font-black text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(order.finalTotal || order.total || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-500 dark:text-slate-400">Medio:</span>
                  <span className="font-bold px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/70 text-slate-800 dark:text-slate-200">
                    {order.metodo === "Efectivo" ? "Cobro directo" : order.metodo}
                  </span>
                </div>
              </div>
            </div>

            {/* Desktop Action Controls (Tablet & Desktop md+) */}
            <div className="hidden md:flex flex-col gap-2.5 mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                <span>80mm térmica lista</span>
              </div>

              <button
                type="button"
                onClick={handlePrint}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 active:scale-98 cursor-pointer transition-all min-h-[44px]"
              >
                <Printer className="size-4" />
                <span>Imprimir {mode === "kitchen" ? "Comanda" : "Ticket"}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors min-h-[38px]"
              >
                Cerrar
              </button>
            </div>
          </aside>

          {/* ================= RIGHT PANEL: THERMAL PREVIEW ================= */}
          <div className="flex-1 min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/70 p-3 sm:p-4 overflow-y-auto max-h-[58vh] md:max-h-[74vh] flex justify-center">
            {/* Stylized Physical Thermal Ticket (80mm width) */}
            <div
              id="printable-ticket"
              className="w-full max-w-[310px] bg-white text-slate-950 font-mono text-[11px] leading-relaxed p-4 shadow-md border border-dashed border-slate-300 rounded-xs select-text mx-auto"
            >
            {mode === "full" ? (
              /* ================= MODE: FULL TICKET / DESPACHO ================= */
              <div className="space-y-1.5">
                {/* Header */}
                <div className="text-center space-y-0.5">
                  <div className="text-sm font-black uppercase tracking-wider">{restaurantName}</div>
                  <div className="text-[10px] font-bold tracking-tight text-slate-600">
                    TICKET DE VENTA / DESPACHO
                  </div>
                  <div className="text-xs font-black pt-0.5">ORDEN #{order.orderNumber}</div>
                </div>

                <div className="border-b border-dashed border-slate-400 my-1.5" />

                {/* Metadata */}
                <div className="text-[10px] space-y-0.5 text-slate-800">
                  <div className="flex justify-between">
                    <span>FECHA: {orderDate.date}</span>
                    <span>HORA: {orderDate.time}</span>
                  </div>
                  <div className="font-bold text-[11px] text-slate-950 pt-0.5">
                    MODO: {service.label}
                  </div>
                </div>

                <div className="border-b border-dashed border-slate-400 my-1.5" />

                {/* Customer Information */}
                <div className="text-[10px] space-y-0.5 text-slate-900">
                  <div>
                    <span className="font-bold">CLIENTE: </span>
                    {order.customer.nombre}
                  </div>
                  <div>
                    <span className="font-bold">TEL: </span>
                    {order.customer.telefono || "N/A"}
                  </div>
                  <div>
                    <span className="font-bold">DIR: </span>
                    {order.customer.direccion}
                  </div>
                  {order.customer.barrio && (
                    <div>
                      <span className="font-bold">BARRIO: </span>
                      {order.customer.barrio}
                    </div>
                  )}
                  {order.comentario && (
                    <div className="mt-1 p-1 bg-slate-50 border border-slate-200 text-[10px] italic">
                      Nota cliente: &quot;{order.comentario}&quot;
                    </div>
                  )}
                </div>

                <div className="border-b border-dashed border-slate-400 my-1.5" />

                {/* Items Breakdown */}
                <div className="text-[10px] font-bold flex justify-between uppercase pb-1 border-b border-slate-300">
                  <span>CANT &middot; DESCRIPCIÓN</span>
                  <span>TOTAL</span>
                </div>

                <div className="space-y-2 pt-1">
                  {order.items.map((item: any, idx: number) => {
                    const qty = Number(item.cantidad || item.quantity || 1)
                    const name = String(item.name || item.productName || "Producto")
                    const price = Number(item.price || item.unitPrice || 0)
                    const total =
                      typeof item.total === "number" && !isNaN(item.total)
                        ? item.total
                        : calculateLineItemTotal({
                            price,
                            cantidad: qty,
                            adiciones: item.adiciones ?? [],
                          })

                    return (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex justify-between items-start font-bold text-xs text-slate-950">
                          <span className="leading-tight">
                            <span className="font-black">[{qty}]</span> {name}
                          </span>
                          <span className="shrink-0 ml-2 font-black">
                            {formatCurrency(total)}
                          </span>
                        </div>
                        {item.adiciones && item.adiciones.length > 0 && (
                          <div className="pl-3 text-[10px] text-slate-600 space-y-0.5">
                            {item.adiciones.map((a: any, aIdx: number) => (
                              <div key={aIdx}>
                                + {a.cantidad || 1}x {a.name} ({formatCurrency(a.price * (a.cantidad || 1))})
                              </div>
                            ))}
                          </div>
                        )}
                        {item.observacion && (
                          <div className="pl-3 text-[10px] text-slate-800 italic">
                            * Obs: {item.observacion}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="border-b border-dashed border-slate-400 my-2" />

                {/* Totals */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-700">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(order.total ?? 0)}</span>
                  </div>
                  {order.deliveryFee > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>Costo de envío:</span>
                      <span>{formatCurrency(order.deliveryFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-slate-950 pt-1 border-t-2 border-slate-900">
                    <span>TOTAL A PAGAR:</span>
                    <span>{formatCurrency(order.finalTotal || 0)}</span>
                  </div>
                </div>

                <div className="border-b border-dashed border-slate-400 my-2" />

                {/* Payment Info */}
                <div className="text-[10px] space-y-0.5 text-slate-800">
                  <div>
                    <span className="font-bold">MÉTODO DE PAGO: </span>
                    {order.metodo}
                  </div>
                  {order.pagoCon && (
                    <div>
                      <span className="font-bold">PAGA CON: </span>
                      {formatCurrency(Number(order.pagoCon))}
                      {order.cambio !== undefined && (
                        <span> &middot; CAMBIO: {formatCurrency(order.cambio)}</span>
                      )}
                    </div>
                  )}
                  {order.metodo === "Transferencia" && (
                    <div>
                      <span className="font-bold">COMPROBANTE: </span>
                      {order.receiptUrl ? "Soporte Adjunto ✓" : "Pendiente de Confirmar"}
                    </div>
                  )}
                </div>

                <div className="border-b border-dashed border-slate-400 my-2" />

                {/* Footer */}
                <div className="text-center space-y-0.5 pt-1 text-slate-500 text-[10px]">
                  <div className="font-bold text-slate-800">¡GRACIAS POR SU COMPRA!</div>
                  <div>Burger-Page CRM &middot; Facturación</div>
                  <div className="text-[9px] pt-1 text-slate-400 tracking-wider">
                    - - - - - - CORTE DE TICKET - - - - - -
                  </div>
                </div>
              </div>
            ) : (
              /* ================= MODE: KITCHEN COMMAND (KOT) ================= */
              <div className="space-y-2">
                {/* Kitchen Header */}
                <div className="text-center space-y-1">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-800">
                    *** COMANDA COCINA (KOT) ***
                  </div>
                  <div className="text-2xl font-black text-black tracking-tight">
                    ORDEN #{order.orderNumber}
                  </div>
                  <div className="bg-black text-white font-black text-xs py-1 px-2 rounded-xs uppercase tracking-wide">
                    {service.label}
                  </div>
                </div>

                <div className="flex justify-between text-[11px] font-bold border-y border-black py-1">
                  <span>HORA: {orderDate.time}</span>
                  <span>FECHA: {orderDate.date}</span>
                </div>

                {/* Customer name / quick reference */}
                <div className="text-[11px] font-bold text-slate-900">
                  <span>REF: </span>
                  {order.customer.nombre}
                </div>

                <div className="border-b-2 border-black my-1.5" />

                {/* Kitchen Items breakdown */}
                <div className="text-[11px] font-black uppercase pb-1 border-b border-dashed border-slate-400 flex justify-between">
                  <span>CANT &middot; DETALLE</span>
                  <span>COCINA</span>
                </div>

                <div className="space-y-3 pt-1">
                  {order.items.map((item: any, idx: number) => {
                    const qty = Number(item.cantidad || item.quantity || 1)
                    const name = String(item.name || item.productName || "Producto")

                    return (
                      <div key={idx} className="space-y-1 pb-1.5 border-b border-dashed border-slate-300 last:border-b-0">
                        <div className="flex items-start gap-1.5 text-xs font-black text-black leading-snug">
                          <span className="text-sm font-black bg-black text-white px-1.5 py-0.5 rounded-xs shrink-0">
                            {qty}X
                          </span>
                          <span className="uppercase text-sm pt-0.5">{name}</span>
                        </div>
                        {item.adiciones && item.adiciones.length > 0 && (
                          <div className="pl-6 space-y-0.5 text-xs font-bold text-black uppercase">
                            {item.adiciones.map((a: any, aIdx: number) => (
                              <div key={aIdx} className="leading-tight">
                                &gt;&gt; + {a.cantidad || 1}X {a.name}
                              </div>
                            ))}
                          </div>
                        )}
                        {item.observacion && (
                          <div className="ml-2 mt-1 p-1 bg-amber-100 border-l-3 border-amber-600 text-amber-950 text-[11px] font-black uppercase">
                            ** OBS: {item.observacion} **
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* General Note */}
                {order.comentario && (
                  <div className="mt-2 p-2 border-2 border-black bg-slate-100 text-xs font-black uppercase space-y-0.5">
                    <div className="text-[10px] text-slate-600 font-bold">NOTA GENERAL DE LA ORDEN:</div>
                    <div className="text-black">&quot;{order.comentario}&quot;</div>
                  </div>
                )}

                <div className="border-b-2 border-black my-2" />

                {/* Kitchen Footer */}
                <div className="space-y-1 pt-0.5">
                  <div className="flex justify-between text-xs font-black text-black">
                    <span>TOTAL ÍTEMS A PREPARAR:</span>
                    <span className="text-sm">{totalItemsCount}</span>
                  </div>
                  <div className="text-center font-black text-xs uppercase tracking-widest pt-2">
                    --- ENVIADO A COCINA ---
                  </div>
                  <div className="text-center text-[9px] pt-1 text-slate-400 tracking-wider">
                    - - - - - - CORTE DE TICKET - - - - - -
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>

        {/* Mobile Sticky Bottom Bar (<md) */}
        <div className="md:hidden mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2 shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span>80mm térmica lista</span>
            </div>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {formatCurrency(order.finalTotal || order.total || 0)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors min-h-[44px]"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handlePrint}
              aria-label="Imprimir recibo térmico"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 active:scale-98 cursor-pointer transition-all min-h-[44px]"
            >
              <Printer className="size-4" />
              <span>Imprimir {mode === "kitchen" ? "Comanda" : "Ticket"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
