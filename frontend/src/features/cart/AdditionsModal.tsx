import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Plus, Minus, X, Maximize2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import type { MenuItem } from "@/types/restaurant"
import { createCartItem, type CartAddition, type CartItem } from "./cartEngine"
import CharacterCounter from "@/components/CharacterCounter"
import { LIMITS } from "@/lib/validation"
import { useCatalog } from "@/context/RestaurantContext"
import { formatCurrency, getContrastForeground } from "@/lib/utils"
import { resolveImageUrl } from "@/core/storage/supabaseStorage"
import { getFontFamilyClass, getStoreThemeStyles } from "@/features/crm/utils/customizerStyles"

export interface AdditionsModalProps {
  onClose: () => void
  product: MenuItem
  onAddToCart: (cartItem: CartItem) => void
  editing?: boolean
  initial?: CartItem
  /** Store closed or paused: nothing can be added or increased, only reduced. */
  closed?: boolean
}

export default function AdditionsModal({
  onClose,
  product,
  onAddToCart,
  editing = false,
  initial,
  closed = false,
}: AdditionsModalProps) {
  const { additions: storeAdditions, storeConfig } = useCatalog()
  const themeStyles = getStoreThemeStyles(storeConfig.bgTheme, storeConfig.primaryColor)
  const fontClass = getFontFamilyClass(storeConfig.fontFamily)
  const primaryForeground = getContrastForeground(storeConfig.primaryColor)
  const [cantidad, setCantidad] = useState(initial?.cantidad ?? 1)
  const [observaciones, setObservaciones] = useState(initial?.observacion ?? "")
  const [isImageExpanded, setIsImageExpanded] = useState(false)
  const lightboxCloseBtnRef = useRef<HTMLButtonElement | null>(null)
  const expandTriggerRef = useRef<HTMLElement | null>(null)

  const handleOpenLightbox = (e: React.MouseEvent<HTMLElement>) => {
    expandTriggerRef.current = e.currentTarget
    setIsImageExpanded(true)
  }

  useEffect(() => {
    if (!isImageExpanded) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        setIsImageExpanded(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [isImageExpanded])

  useEffect(() => {
    if (isImageExpanded) {
      lightboxCloseBtnRef.current?.focus()
    } else if (expandTriggerRef.current) {
      expandTriggerRef.current.focus()
    }
  }, [isImageExpanded])

  const availableAdditions = storeAdditions && storeAdditions.length > 0
    ? storeAdditions.filter((a) => a.available)
    : (product as any)?.additions && Array.isArray((product as any).additions) && (product as any).additions.length > 0
    ? ((product as any).additions as any[]).map((item: any, idx: number) =>
        typeof item === "string"
          ? { id: `legacy-${idx}`, name: item, price: 0, available: true }
          : { id: item.id || `legacy-${idx}`, name: item.name, price: Number(item.price || 0), available: true }
      )
    : []

  const [adiciones, setAdiciones] = useState<CartAddition[]>(() =>
    availableAdditions.map((ad) => {
      const prev = initial?.adiciones.find((a) => a.name === ad.name)
      return {
        id: ad.id,
        name: ad.name,
        price: ad.price,
        cantidad: prev ? prev.cantidad : 0,
      }
    })
  )

  if (!product?.name) return null

  const calcularTotal = () => {
    const totalAdiciones = adiciones.reduce(
      (total, ad) => total + ad.cantidad * ad.price,
      0
    )
    return product.price * cantidad + totalAdiciones
  }

  const handleAdd = () => {
    const cartItem = createCartItem({
      product,
      cantidad,
      adiciones: adiciones.filter((adi) => adi.cantidad > 0),
      observacion: observaciones,
      customId: initial?.id,
    })
    onAddToCart(cartItem)
    onClose()
  }

  const aumentarCantidad = () => {
    if (closed) return
    setCantidad((c) => c + 1)
  }
  const disminuirCantidad = () => {
    if (cantidad > 1) setCantidad((c) => c - 1)
  }

  const modificarCantidadAdicion = (index: number, operacion: "incrementar" | "decrementar") => {
    if (closed && operacion === "incrementar") return
    setAdiciones((prev) => {
      const next = [...prev]
      if (operacion === "incrementar") {
        next[index] = { ...next[index], cantidad: next[index].cantidad + 1 }
      } else if (operacion === "decrementar" && next[index].cantidad > 0) {
        next[index] = { ...next[index], cantidad: next[index].cantidad - 1 }
      }
      return next
    })
  }

  return (
    <Dialog
      open
      modal={!isImageExpanded}
      disablePointerDismissal={isImageExpanded}
      onOpenChange={(open) => {
        if (!open) {
          if (isImageExpanded) return
          onClose()
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        style={{
          ...themeStyles,
          backgroundColor: (themeStyles as any)["--color-bg-base"] || "#FAF6EF",
        }}
        className={`top-auto bottom-0 left-0 flex max-h-[92dvh] w-full max-w-none flex-col overflow-hidden translate-x-0 translate-y-0 gap-0 rounded-t-2xl rounded-b-none border border-border-subtle text-text-primary p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[90dvh] sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl data-[side=bottom]:data-ending-style:translate-y-0 data-[side=bottom]:data-starting-style:translate-y-0 shadow-2xl ${fontClass}`}
      >
        {/* Floating Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            backgroundColor: "var(--color-bg-elevated)",
            borderColor: "var(--color-border-subtle)",
          }}
          className="absolute top-3 right-3 z-30 inline-flex size-9 sm:size-10 items-center justify-center rounded-full border border-border-subtle bg-bg-elevated hover:bg-bg-elevated-2 text-text-muted hover:text-text-primary shadow-md transition-all active:scale-95 cursor-pointer backdrop-blur-md"
        >
          <X className="size-4 sm:size-5" />
        </button>

        <div
          style={{ backgroundColor: (themeStyles as any)["--color-bg-base"] || "var(--color-bg-base, #FAF6EF)" }}
          className="scroll-add min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {/* Hero Image */}
          {product.src && (
            <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] max-h-56 sm:max-h-64 overflow-hidden bg-bg-elevated-2 select-none group/hero shrink-0">
              <img
                src={resolveImageUrl(product.src)}
                alt={product.name}
                onClick={handleOpenLightbox}
                className="size-full object-cover transition-transform duration-300 group-hover/hero:scale-105 cursor-pointer"
              />
              <button
                type="button"
                onClick={handleOpenLightbox}
                aria-label="Ampliar imagen"
                className="absolute bottom-2.5 right-2.5 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/60 hover:bg-black/80 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md transition-all cursor-pointer active:scale-95 shadow-xs"
              >
                <Maximize2 className="size-3.5" />
                <span>Ver foto</span>
              </button>
            </div>
          )}

          {/* Product Header: Title, Price, and Full Description (no line-clamp) */}
          <header
            style={{ backgroundColor: (themeStyles as any)["--color-bg-surface"] || "var(--color-bg-surface, #F4ECE1)" }}
            className="border-b border-border-subtle p-4 sm:p-5"
          >
            <div className="flex items-start justify-between gap-3 pr-8">
              <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-text-primary">
                {editing ? `Editar ${product.name}` : product.name}
              </DialogTitle>
              <p
                style={{ color: storeConfig.primaryColor }}
                className="text-base sm:text-lg font-black tracking-tight shrink-0"
              >
                {formatCurrency(product.price)}
              </p>
            </div>
            {product.description && (
              <DialogDescription className="mt-2 text-xs sm:text-sm leading-relaxed text-text-secondary whitespace-pre-line">
                {product.description}
              </DialogDescription>
            )}
          </header>

          <div className="space-y-4 sm:space-y-6 px-3.5 sm:px-5 py-3 sm:py-4">
          {adiciones.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold tracking-wide text-text-primary uppercase">
                  Adiciones
                </h3>
                <Badge variant="outline" className="border-border-strong bg-bg-elevated text-text-secondary">
                  Opcional
                </Badge>
              </div>
              <ul className="flex flex-col gap-2">
                {adiciones.map((adicion, i) => (
                  <li
                    key={adicion.name}
                    className="flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-elevated p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {adicion.name}
                      </p>
                      <p className="text-xs text-text-muted">
                        +{formatCurrency(adicion.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon-sm"
                        onClick={() => modificarCantidadAdicion(i, "decrementar")}
                        aria-label={`Quitar ${adicion.name}`}
                        disabled={adicion.cantidad === 0}
                        className="size-11 rounded-full border border-border-subtle bg-bg-elevated-2 text-text-primary hover:opacity-80 disabled:opacity-30"
                      >
                        <Minus />
                      </Button>
                      <span
                        aria-live="polite"
                        className="w-6 text-center text-sm font-semibold text-text-primary"
                      >
                        {adicion.cantidad}
                      </span>
                      <Button
                        type="button"
                        size="icon-sm"
                        onClick={() => modificarCantidadAdicion(i, "incrementar")}
                        aria-label={`Agregar ${adicion.name}`}
                        disabled={closed}
                        style={{
                          backgroundColor: storeConfig.primaryColor,
                          color: primaryForeground,
                        }}
                        className="size-11 rounded-full shadow-xs hover:opacity-90 transition-opacity disabled:opacity-30"
                      >
                        <Plus />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Field>
            <div className="mb-2 flex items-center justify-between">
              <FieldLabel
                htmlFor="observaciones"
                className="text-sm font-semibold tracking-wide text-text-primary uppercase"
              >
                Observaciones
              </FieldLabel>
              <Badge variant="outline" className="border-border-strong bg-bg-elevated text-text-secondary">
                Opcional
              </Badge>
            </div>
            <Textarea
              id="observaciones"
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej. sin cebolla, término medio, sin picante..."
              maxLength={LIMITS.observaciones.max}
              className="border-border-subtle bg-bg-input text-text-primary placeholder:text-text-muted focus-visible:ring-accent break-words [overflow-wrap:anywhere]"
            />
            <CharacterCounter value={observaciones} max={LIMITS.observaciones.max} />
            <FieldDescription className="text-xs text-text-muted">
              Cuéntanos cualquier detalle para preparar tu pedido.
            </FieldDescription>
          </Field>
        </div>
      </div>

      <footer
          style={{ backgroundColor: (themeStyles as any)["--color-bg-surface"] || "var(--color-bg-surface, #F4ECE1)" }}
          className="border-t border-border-subtle p-3.5 sm:p-5"
        >
          <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
            <div>
              <p className="text-xs text-text-muted">Cantidad</p>
              <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-bg-elevated px-2 py-1 border border-border-subtle">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  onClick={disminuirCantidad}
                  aria-label="Disminuir cantidad"
                  disabled={cantidad === 1}
                  className="size-10 sm:size-11 rounded-full border border-border-subtle bg-bg-elevated-2 text-text-primary hover:opacity-80 disabled:opacity-30"
                >
                  <Minus />
                </Button>
                <span
                  aria-live="polite"
                  className="w-6 text-center text-sm font-semibold text-text-primary"
                >
                  {cantidad}
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  onClick={aumentarCantidad}
                  aria-label="Aumentar cantidad"
                  disabled={closed}
                  style={{
                    backgroundColor: storeConfig.primaryColor,
                    color: primaryForeground,
                  }}
                  className="size-10 sm:size-11 rounded-full shadow-xs hover:opacity-90 transition-opacity disabled:opacity-30"
                >
                  <Plus />
                </Button>
              </div>
            </div>
            <Button
              type="button"
              variant="default"
              size="lg"
              onClick={handleAdd}
              disabled={!product || (closed && !editing)}
              style={{
                backgroundColor: storeConfig.primaryColor,
                color: primaryForeground,
              }}
              className="h-11 sm:h-12 w-full rounded-xl text-sm sm:text-base font-bold shadow-md cursor-pointer hover:opacity-90 min-[420px]:w-auto min-[420px]:flex-1 sm:min-w-[200px] sm:flex-none"
            >
              {closed && !editing ? (
                "Cerrado"
              ) : (
                <>
                  <Plus data-icon="inline-start" strokeWidth={2.5} />
                  {editing ? "Guardar cambios" : "Agregar"} · {formatCurrency(calcularTotal())}
                </>
              )}
            </Button>
          </div>
        </footer>
      </DialogContent>

      {/* Fullscreen Lightbox / Expanded Image */}
      {isImageExpanded && product.src && typeof document !== "undefined" && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ampliada de ${product.name}`}
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in-0 duration-150"
          onClick={(e) => {
            e.stopPropagation()
            setIsImageExpanded(false)
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            ref={lightboxCloseBtnRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsImageExpanded(false)
            }}
            aria-label="Cerrar vista previa"
            className="absolute top-4 right-4 z-70 inline-flex size-11 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-all active:scale-95 cursor-pointer"
          >
            <X className="size-6" />
          </button>
          <div
            className="relative max-h-[85vh] max-w-[90vw] overflow-hidden rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <img
              src={resolveImageUrl(product.src)}
              alt={product.name}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-2xl select-none"
            />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 sm:p-5 text-white">
              <p className="text-base sm:text-lg font-bold">{product.name}</p>
              {product.description && (
                <p className="mt-1 text-xs sm:text-sm text-white/85 leading-relaxed">
                  {product.description}
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </Dialog>
  )
}

