import { useState } from "react"
import { Plus, Minus, X } from "lucide-react"
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
import { useRestaurant } from "@/context/RestaurantContext"
import { formatCurrency } from "@/lib/utils"

export interface AdditionsModalProps {
  onClose: () => void
  product: MenuItem
  onAddToCart: (cartItem: CartItem) => void
  editing?: boolean
  initial?: CartItem
}

export default function AdditionsModal({
  onClose,
  product,
  onAddToCart,
  editing = false,
  initial,
}: AdditionsModalProps) {
  const { additions: storeAdditions, storeConfig } = useRestaurant()
  const [cantidad, setCantidad] = useState(initial?.cantidad ?? 1)
  const [observaciones, setObservaciones] = useState(initial?.observacion ?? "")

  const availableAdditions = storeAdditions && storeAdditions.length > 0
    ? storeAdditions.filter((a) => a.available)
    : [
        { id: "add-1", name: "Papas Fritas", price: 5000, available: true },
        { id: "add-2", name: "Cebolla Caramelizada", price: 1500, available: true },
        { id: "add-3", name: "Extra Queso", price: 2700, available: true },
        { id: "add-4", name: "Tocineta", price: 2500, available: true },
      ]

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

  const aumentarCantidad = () => setCantidad((c) => c + 1)
  const disminuirCantidad = () => {
    if (cantidad > 1) setCantidad((c) => c - 1)
  }

  const modificarCantidadAdicion = (index: number, operacion: "incrementar" | "decrementar") => {
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
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-0 flex max-h-[92dvh] w-full max-w-none flex-col overflow-hidden translate-x-0 translate-y-0 gap-0 rounded-t-lg rounded-b-none border-border-subtle bg-bg-surface p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[90dvh] sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg data-[side=bottom]:data-ending-style:translate-y-0 data-[side=bottom]:data-starting-style:translate-y-0"
      >
        <header className="flex items-center gap-3 border-b border-border-subtle p-5 pb-4">
          <img
            src={product.src}
            alt={product.name}
            className="size-16 shrink-0 rounded-full bg-bg-elevated-2 object-cover"
          />
          <div className="min-w-0 flex-1 pr-2">
            <DialogTitle className="text-lg font-semibold tracking-tight text-text-primary">
              {editing ? `Editar ${product.name}` : product.name}
            </DialogTitle>
            <DialogDescription className="mt-1 line-clamp-2 text-sm text-text-secondary">
              {product.description}
            </DialogDescription>
            <p className="mt-1.5 text-sm font-bold text-accent">
              {formatCurrency(product.price)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Cerrar"
            className="size-11 shrink-0 rounded-full text-text-muted hover:bg-bg-elevated-2 hover:text-text-primary"
          >
            <X />
          </Button>
        </header>

        <div className="scroll-add min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-4">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-wide text-text-primary uppercase">
                Adiciones
              </h3>
              <Badge variant="outline" className="bg-accent-soft text-accent">
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
                      className="size-11 rounded-full bg-bg-elevated-2 hover:bg-accent disabled:opacity-40"
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
                      variant="default"
                      size="icon-sm"
                      onClick={() => modificarCantidadAdicion(i, "incrementar")}
                      aria-label={`Agregar ${adicion.name}`}
                      className="size-11 rounded-full bg-accent hover:bg-accent-hover"
                    >
                      <Plus />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <Field>
            <div className="mb-2 flex items-center justify-between">
              <FieldLabel
                htmlFor="observaciones"
                className="text-sm font-semibold tracking-wide text-text-primary uppercase"
              >
                Observaciones
              </FieldLabel>
              <Badge variant="outline" className="bg-accent-soft text-accent">
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
            />
            <CharacterCounter value={observaciones} max={LIMITS.observaciones.max} />
            <FieldDescription className="text-xs text-text-muted">
              Cuéntanos cualquier detalle para preparar tu pedido.
            </FieldDescription>
          </Field>
        </div>

        <footer className="border-t border-border-subtle bg-bg-surface p-4 sm:p-5">
          <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
            <div>
              <p className="text-xs text-text-muted">Cantidad</p>
              <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-bg-elevated px-2 py-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  onClick={disminuirCantidad}
                  aria-label="Disminuir cantidad"
                  disabled={cantidad === 1}
                  className="size-11 rounded-full bg-bg-elevated-2 hover:bg-accent disabled:opacity-40"
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
                  variant="default"
                  size="icon-sm"
                  onClick={aumentarCantidad}
                  aria-label="Aumentar cantidad"
                  className="size-11 rounded-full bg-accent hover:bg-accent-hover"
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
              disabled={!product}
              style={{ backgroundColor: storeConfig.primaryColor, color: "#FFFFFF" }}
              className="h-12 w-full rounded-xl text-base text-white font-bold shadow-md cursor-pointer hover:opacity-90 min-[420px]:w-auto min-[420px]:flex-1 sm:min-w-[200px] sm:flex-none"
            >
              <Plus data-icon="inline-start" strokeWidth={2.5} />
              {editing ? "Guardar cambios" : "Agregar"} · {formatCurrency(calcularTotal())}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
