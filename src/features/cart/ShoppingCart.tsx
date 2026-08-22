import { Pencil, Trash2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import EmptyCart from "./EmptyCart"
import type { CartItem } from "./cartEngine"
import { useRestaurant } from "@/context/RestaurantContext"

export interface ShoppingCartProps {
  onClose: () => void
  onCloseCart: () => void
  onOpenCheckout: () => void
  items: CartItem[]
  onDeleteCart: (items: CartItem[]) => void
  onEditItem: (index: number) => void
}

function ShoppingCart({
  onClose,
  onCloseCart,
  onOpenCheckout,
  items,
  onDeleteCart,
  onEditItem,
}: ShoppingCartProps) {
  const { storeConfig } = useRestaurant()

  const handleBackToMenu = () => {
    onClose()
    onCloseCart()
  }

  const total = items.reduce((acc, burger) => acc + burger.total, 0)

  const deleteItem = (i: number) => {
    onDeleteCart(items.filter((_, index) => index !== i))
  }

  const handleCheckout = () => {
    onCloseCart()
    onOpenCheckout()
  }

  if (items.length === 0) {
    return <EmptyCart onBackToMenu={handleBackToMenu} />
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
        {items.map((cartItem, i) => (
          <li
            key={cartItem.id || i}
            className="relative flex gap-3 rounded-lg border border-border-subtle bg-bg-elevated p-3 sm:gap-4 sm:p-4"
          >
            <img
              src={cartItem.src}
              alt={cartItem.name}
              loading="lazy"
              className="size-16 shrink-0 rounded-md bg-bg-elevated-2 object-cover sm:size-20"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-text-primary">
                    {cartItem.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {cartItem.cantidad}× {cartItem.name}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onEditItem(i)}
                    aria-label={`Editar ${cartItem.name}`}
                    className="size-11 rounded-full text-text-muted hover:bg-bg-elevated-2 hover:text-text-primary"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => deleteItem(i)}
                    aria-label={`Eliminar ${cartItem.name}`}
                    className="size-11 shrink-0 rounded-full text-text-muted hover:bg-bg-elevated-2 hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>

              {cartItem.adiciones && cartItem.adiciones.length > 0 && (
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                  <span className="text-text-muted">Adiciones: </span>
                  {cartItem.adiciones
                    .map((ad) => `${ad.cantidad}× ${ad.name}`)
                    .join(", ")}
                </p>
              )}
              {cartItem.observacion && (
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                  <span className="text-text-muted">Nota: </span>
                  {cartItem.observacion}
                </p>
              )}
              <p className="mt-2 text-base font-bold text-accent">
                ${cartItem.total.toLocaleString()}
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
              type="button"
              variant="default"
              size="lg"
              onClick={handleCheckout}
              style={{ backgroundColor: storeConfig.primaryColor, color: "#FFFFFF" }}
              className="h-12 flex-1 sm:flex-none text-white font-bold shadow-md cursor-pointer hover:opacity-90"
            >
              Confirmar orden
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleBackToMenu}
              className="h-12 flex-1 sm:flex-none font-bold cursor-pointer"
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