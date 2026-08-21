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
import ImageWithFallback from "@/components/ImageWithFallback"
import { ADICIONES_INICIALES, type Adicion, type Burger, type BurgerCompra } from "@/data/data"
import CharacterCounter from "../components/CharacterCounter"
import { LIMITS } from "@/lib/validation"

interface AdditionsInitial {
  cantidad: number
  adicion: Adicion[]
  observacion: string
}

interface AdditionsProps {
  cerrar: () => void
  hamburger: Burger
  agregarList: (burgerCompra: BurgerCompra) => void
  editing?: boolean
  initial?: AdditionsInitial
}

export default function Additions({ cerrar, hamburger, agregarList, editing = false, initial }: AdditionsProps) {
  const [cantidad, setCantidad] = useState(initial?.cantidad ?? 1)
  const [observaciones, setObservaciones] = useState(initial?.observacion ?? "")
  const [adiciones, setAdiciones] = useState<Adicion[]>(() =>
    ADICIONES_INICIALES.map((ad) => {
      const prev = initial?.adicion.find((a) => a.name === ad.name)
      return prev ? { ...ad, cantidad: prev.cantidad } : ad
    })
  )

  if (!hamburger?.name) return null

  const calcularTotal = () => {
    const totalAdiciones = adiciones.reduce(
      (total, ad) => total + ad.cantidad * ad.price,
      0
    )
    return hamburger.price * cantidad + totalAdiciones
  }

  const agregar = () => {
    agregarList({
      adicion: adiciones.filter((adi) => adi.cantidad > 0),
      name: hamburger.name,
      src: hamburger.src,
      totalapagar: calcularTotal(),
      cantidad: cantidad,
      observacion: observaciones,
    })
    cerrar()
  }

  const aumentarBurger = () => setCantidad((c) => c + 1)
  const disminuirBurger = () => {
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
        if (!open) cerrar()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-0 flex max-h-[92dvh] w-full max-w-none flex-col overflow-hidden translate-x-0 translate-y-0 gap-0 rounded-t-lg rounded-b-none border-border-subtle bg-bg-surface p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[90dvh] sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg data-[side=bottom]:data-ending-style:translate-y-0 data-[side=bottom]:data-starting-style:translate-y-0"
      >
        <header className="flex items-center gap-3 border-b border-border-subtle p-5 pb-4">
          <ImageWithFallback
            src={hamburger.src}
            alt={hamburger.name}
            className="size-16 shrink-0 rounded-full bg-bg-elevated-2 object-cover"
          />
          <div className="min-w-0 flex-1 pr-2">
            <DialogTitle className="text-lg font-semibold tracking-tight text-text-primary">
              {editing ? `Editar ${hamburger.name}` : hamburger.name}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-text-secondary">
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
              {adiciones.map((adicion, i) => (
                <li
                  key={adicion.name}
                  className="flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-elevated p-3"
                >
                  <span className="inline-flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-elevated-2">
                    <ImageWithFallback
                      src={adicion.src}
                      alt={adicion.name}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {adicion.name}
                    </p>
                    <p className="text-xs text-text-muted">
                      +${adicion.price.toLocaleString()}
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
                  onClick={disminuirBurger}
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
                  onClick={aumentarBurger}
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