import { useState } from "react"
import { Plus, Minus, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/ui/ui/dialog"
import { Button } from "@/shared/ui/ui/button"
import { Badge } from "@/shared/ui/ui/badge"
import { Field, FieldDescription, FieldLabel } from "@/shared/ui/ui/field"
import { Textarea } from "@/shared/ui/ui/textarea"
import type { RestaurantRepository } from "@/shared/storage/repository"
import type { CartItem, ModifierChoice, Product } from "@/shared/domain/domain"
import CharacterCounter from "@/shared/ui/CharacterCounter"
import { LIMITS } from "@/shared/validation/validation"

interface ProductCustomizeProps {
  cerrar: () => void
  hamburger: Product
  agregarList: (item: CartItem) => void
  editing?: boolean
  initial?: CartItem
  repo: RestaurantRepository
}

export default function ProductCustomize({ cerrar, hamburger, agregarList, editing = false, initial, repo }: ProductCustomizeProps) {
  const [cantidad, setCantidad] = useState(initial?.cantidad ?? 1)
  const [observaciones, setObservaciones] = useState(initial?.observacion ?? "")
  const [modifiers, setModifiers] = useState<ModifierChoice[]>(() => {
    const catalog = repo.listModifiers() ?? []
    return catalog
      .filter(
        (m) =>
          m.available ||
          initial?.modifiers.some((choice) => choice.id === m.id)
      )
      .map((m) => {
        const prev = initial?.modifiers.find((choice) => choice.id === m.id)
        return prev ?? { id: m.id, name: m.name, price: m.price, cantidad: 0 }
      })
  })

  if (!hamburger?.name) return null

  const modifierSrc = new Map(
    (repo.listModifiers() ?? []).map((m) => [m.id, m.src])
  )

  const calcularTotal = () => {
    const totalModifiers = modifiers.reduce(
      (total, m) => total + m.cantidad * m.price,
      0
    )
    return hamburger.price * cantidad + totalModifiers
  }

  const agregar = () => {
    agregarList({
      id: initial?.id ?? crypto.randomUUID(),
      productId: hamburger.id,
      name: hamburger.name,
      src: hamburger.src,
      unitPrice: hamburger.price,
      cantidad: cantidad,
      modifiers: modifiers.filter((m) => m.cantidad > 0),
      observacion: observaciones,
      total: calcularTotal(),
    })
    cerrar()
  }

  const aumentarCantidad = () => setCantidad((c) => c + 1)
  const disminuirCantidad = () => {
    if (cantidad > 1) setCantidad((c) => c - 1)
  }

  const modificarCantidadModifier = (index: number, operacion: "incrementar" | "decrementar") => {
    setModifiers((prev) => {
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
        if (!open) cerrar()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-0 flex max-h-[92dvh] w-full max-w-none flex-col overflow-hidden translate-x-0 translate-y-0 gap-0 rounded-t-lg rounded-b-none border-border-subtle bg-bg-surface p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[90dvh] sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg data-[side=bottom]:data-ending-style:translate-y-0 data-[side=bottom]:data-starting-style:translate-y-0"
      >
        <header className="flex items-center gap-3 border-b border-border-subtle p-5 pb-4">
          <img
            src={hamburger.src}
            alt={hamburger.name}
            className="size-16 shrink-0 rounded-full bg-bg-elevated-2 object-cover"
          />
          <div className="min-w-0 flex-1 pr-2">
            <DialogTitle className="text-lg font-semibold tracking-tight text-text-primary">
              {editing ? `Editar ${hamburger.name}` : hamburger.name}
            </DialogTitle>
            <DialogDescription className="mt-1 line-clamp-2 text-sm text-text-secondary">
              {hamburger.description}
            </DialogDescription>
            <p className="mt-1.5 text-sm font-bold text-accent">
              ${hamburger.price.toLocaleString()}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={cerrar}
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
              {modifiers.map((modifier, i) => (
                <li
                  key={modifier.id}
                  className="flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-elevated p-3"
                >
                  <span className="inline-flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-elevated-2">
                    <img
                      src={modifierSrc.get(modifier.id)}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {modifier.name}
                    </p>
                    <p className="text-xs text-text-muted">
                      +${modifier.price.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-sm"
                      onClick={() => modificarCantidadModifier(i, "decrementar")}
                      aria-label={`Quitar ${modifier.name}`}
                      disabled={modifier.cantidad === 0}
                      className="size-11 rounded-full bg-bg-elevated-2 hover:bg-accent disabled:opacity-40"
                    >
                      <Minus />
                    </Button>
                    <span
                      aria-live="polite"
                      className="w-6 text-center text-sm font-semibold text-text-primary"
                    >
                      {modifier.cantidad}
                    </span>
                    <Button
                      type="button"
                      variant="default"
                      size="icon-sm"
                      onClick={() => modificarCantidadModifier(i, "incrementar")}
                      aria-label={`Agregar ${modifier.name}`}
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
              variant="default"
              size="lg"
              onClick={agregar}
              disabled={!hamburger}
              className="h-12 w-full rounded text-base min-[420px]:w-auto min-[420px]:flex-1 sm:min-w-[200px] sm:flex-none"
            >
              <Plus data-icon="inline-start" strokeWidth={2.5} />
              {editing ? "Guardar cambios" : "Agregar"} · ${calcularTotal().toLocaleString()}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  )
}