import { ShoppingBasket } from "lucide-react"
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Button } from "@/components/ui/button"
import { useRestaurant } from "@/context/RestaurantContext"

interface EmptyCartProps {
  onBackToMenu: () => void
}

export default function EmptyCart({ onBackToMenu }: EmptyCartProps) {
  const { storeConfig } = useRestaurant()

  return (
    <Empty
      role="status"
      aria-live="polite"
      className="mx-auto max-w-md border-0 px-4 py-16"
    >
      <EmptyMedia
        variant="icon"
        className="mb-6 size-20 rounded-full border border-border-subtle bg-bg-elevated text-text-muted [&_svg:not([class*='size-'])]:size-8"
      >
        <ShoppingBasket className="size-8 text-text-muted" />
      </EmptyMedia>
      <EmptyTitle className="text-xl font-bold tracking-tight text-text-primary">
        Tu carrito está vacío
      </EmptyTitle>
      <EmptyDescription className="text-sm leading-relaxed text-text-secondary mt-1 max-w-xs">
        Agregá productos desde el menú para empezar tu pedido.
      </EmptyDescription>
      <Button
        type="button"
        variant="default"
        size="lg"
        onClick={onBackToMenu}
        style={{ backgroundColor: storeConfig.primaryColor, color: "#FFFFFF" }}
        className="mt-6 h-12 px-6 font-bold text-white shadow-md cursor-pointer hover:opacity-90"
      >
        Explorar menú
      </Button>
    </Empty>
  )
}
