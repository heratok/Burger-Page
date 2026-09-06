import { Pencil, Trash2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import EmptyCart from "./EmptyCart"
import type { CartItem } from "./cartEngine"
import { useRestaurant } from "@/context/RestaurantContext"
import { formatCurrency, getContrastForeground } from "@/lib/utils"
import { resolveImageUrl } from "@/core/storage/supabaseStorage"

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

  const total = items.reduce((acc, item) => acc + item.total, 0)

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
        <h1
          style={{ color: "var(--color-text-primary)" }}
          className="text-2xl font-bold tracking-tight"
        >
          Tu pedido
        </h1>
        <p
          style={{ color: "var(--color-text-secondary)" }}
          className="mt-1 text-sm"
        >
          Revisa los productos antes de enviar tu orden.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {items.map((cartItem, i) => (
          <li
            key={cartItem.id || i}
            style={{
              backgroundColor: "var(--color-bg-elevated)",
              borderColor: "var(--color-border-subtle)",
            }}
            className="relative flex gap-3 rounded-2xl border p-3 sm:gap-4 sm:p-4 shadow-xs"
          >
            <img
              src={resolveImageUrl(cartItem.src)}
              alt={cartItem.name}
              loading="lazy"
              style={{ backgroundColor: "var(--color-bg-elevated-2)" }}
              className="size-16 shrink-0 rounded-xl object-cover sm:size-20"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2
                    style={{ color: "var(--color-text-primary)" }}
                    className="truncate text-base font-bold"
                  >
                    {cartItem.name}
                  </h2>
                  <p
                    style={{ color: "var(--color-text-muted)" }}
                    className="mt-0.5 text-xs"
                  >
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
                    style={{ color: "var(--color-text-muted)" }}
                    className="size-11 rounded-full hover:opacity-80"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => deleteItem(i)}
                    aria-label={`Eliminar ${cartItem.name}`}
                    style={{ color: "var(--color-text-muted)" }}
                    className="size-11 rounded-full hover:text-rose-500"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>

              {cartItem.adiciones && cartItem.adiciones.length > 0 && (
                <p
                  style={{ color: "var(--color-text-secondary)" }}
                  className="mt-2 text-xs leading-relaxed"
                >
                  <span style={{ color: "var(--color-text-muted)" }}>Adiciones: </span>
                  {cartItem.adiciones
                    .map((ad) => `${ad.cantidad}× ${ad.name}`)
                    .join(", ")}
                </p>
              )}
              {cartItem.observacion && (
                <p
                  style={{ color: "var(--color-text-secondary)" }}
                  className="mt-1 text-xs leading-relaxed"
                >
                  <span style={{ color: "var(--color-text-muted)" }}>Nota: </span>
                  {cartItem.observacion}
                </p>
              )}
              <p
                style={{ color: storeConfig.primaryColor }}
                className="mt-2 text-base font-black tracking-tight"
              >
                {formatCurrency(cartItem.total)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div
        style={{
          backgroundColor: "var(--color-bg-surface)",
          borderColor: "var(--color-border-subtle)",
        }}
        className="fixed right-0 bottom-0 left-0 z-30 border-t backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-(--container) flex-col items-stretch gap-3 px-4 py-3 sm:flex-row sm:items-center md:px-6 lg:px-8">
          <div className="flex flex-1 items-center justify-between sm:flex-col sm:items-start sm:justify-center">
            <span
              style={{ color: "var(--color-text-muted)" }}
              className="text-xs tracking-wide uppercase font-semibold"
            >
              Total
            </span>
            <span
              style={{ color: storeConfig.primaryColor }}
              className="text-xl font-black"
            >
              {formatCurrency(total)}
            </span>
          </div>
          <div className="flex gap-2 sm:flex-row-reverse">
            <Button
              type="button"
              variant="default"
              size="lg"
              onClick={handleCheckout}
              style={{
                backgroundColor: storeConfig.primaryColor,
                color: getContrastForeground(storeConfig.primaryColor),
              }}
              className="h-12 flex-1 sm:flex-none font-bold shadow-md cursor-pointer hover:opacity-90"
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