import { Pencil, Trash2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import NoBuy from "../components/NoBuy"
import type { BurgerCompra } from "@/data/data"

interface ShoppingCartProps {
  cerrar: () => void
  cerrarCarrito: () => void
  abrirForm: () => void
  list: BurgerCompra[]
  deleteCart: (list: BurgerCompra[]) => void
  editarItem: (index: number) => void
}

function ShoppingCart({ cerrar, cerrarCarrito, abrirForm, list, deleteCart, editarItem }: ShoppingCartProps) {
  const volver = () => {
    cerrar()
    cerrarCarrito()
  }

  const total = list.reduce((acc, burger) => acc + burger.totalapagar, 0)

  const deleteCar = (i: number) => {
    deleteCart(list.filter((_, indice) => indice !== i))
  }

  const open = () => {
    cerrarCarrito()
    abrirForm()
  }

  if (list.length === 0) {
    return <NoBuy volver={volver} />
  }

  return (
    <div className="mx-auto max-w-(--container) px-4 pb-32 md:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          Tu pedido
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Revisa los productos antes de enviar tu orden.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {list.map((burgerCompra, i) => (
          <li
            key={i}
            className="relative flex gap-3 rounded-lg border border-border-subtle bg-bg-elevated p-3 sm:gap-4 sm:p-4"
          >
            <img
              src={burgerCompra.src}
              alt={burgerCompra.name}
              loading="lazy"
              className="size-16 shrink-0 rounded-md bg-bg-elevated-2 object-cover sm:size-20"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-text-primary">
                    {burgerCompra.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {burgerCompra.cantidad}× {burgerCompra.name}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => editarItem(i)}
                    aria-label={`Editar ${burgerCompra.name}`}
                    className="size-11 rounded-full text-text-muted hover:bg-bg-elevated-2 hover:text-text-primary"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => deleteCar(i)}
                    aria-label={`Eliminar ${burgerCompra.name}`}
                    className="size-11 shrink-0 rounded-full text-text-muted hover:bg-bg-elevated-2 hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>

              {burgerCompra.adicion && burgerCompra.adicion.length > 0 && (
                <p className="mt-2 text-xs leading-relaxed break-words text-text-secondary">
                  <span className="text-text-muted">Adiciones: </span>
                  {burgerCompra.adicion
                    .map((ad) => `${ad.cantidad}× ${ad.name}`)
                    .join(", ")}
                </p>
              )}
              {burgerCompra.observacion && (
                <p className="mt-1 text-xs leading-relaxed break-words text-text-secondary">
                  <span className="text-text-muted">Nota: </span>
                  {burgerCompra.observacion}
                </p>
              )}
              <p className="mt-2 text-base font-bold text-accent">
                ${burgerCompra.totalapagar.toLocaleString()}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="fixed right-0 bottom-0 left-0 z-30 border-t border-border-subtle bg-bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-(--container) flex-col items-stretch gap-3 px-4 py-3 sm:flex-row sm:items-center md:px-6 lg:px-8">
          <div className="flex flex-1 items-center justify-between sm:flex-col sm:items-start sm:justify-center">
            <span className="text-xs tracking-wide text-text-muted uppercase">
              Total
            </span>
            <span className="text-xl font-bold text-accent">
              ${total.toLocaleString()}
            </span>
          </div>
          <div className="flex gap-2 sm:flex-row-reverse">
            <Button
              variant="default"
              size="lg"
              onClick={open}
              className="h-12 flex-1 sm:flex-none"
            >
              Confirmar orden
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={volver}
              className="h-12 flex-1 sm:flex-none"
            >
              <ArrowLeft data-icon="inline-start" />
              Seguir comprando
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ShoppingCart