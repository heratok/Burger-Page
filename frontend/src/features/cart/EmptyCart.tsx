import { ShoppingBasket } from "lucide-react"
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Button } from "@/components/ui/button"
import { useRestaurant } from "@/context/RestaurantContext"
import { getContrastForeground } from "@/lib/utils"

interface EmptyCartProps {
  onBackToMenu: () => void
}

export default function EmptyCart({ onBackToMenu }: EmptyCartProps) {
  const { storeConfig } = useRestaurant()
  const primaryForeground = getContrastForeground(storeConfig.primaryColor)

  return (
    <Empty
      role="status"
      aria-live="polite"
      className="mx-auto max-w-md border-0 px-4 py-16"
    >
      <EmptyMedia
        variant="icon"
        style={{
          backgroundColor: "var(--color-bg-elevated)",
          borderColor: "var(--color-border-subtle)",
          color: "var(--color-text-muted)",
        }}
        className="mb-6 size-20 rounded-full border [&_svg:not([class*='size-'])]:size-8 shadow-xs"
      >
        <ShoppingBasket className="size-8" style={{ color: "var(--color-text-muted)" }} />
      </EmptyMedia>
      <EmptyTitle
        style={{ color: "var(--color-text-primary)" }}
        className="text-xl font-black tracking-tight"
      >
        Tu carrito está vacío
      </EmptyTitle>
      <EmptyDescription
        style={{ color: "var(--color-text-secondary)" }}
        className="text-sm leading-relaxed mt-1 max-w-xs font-normal"
      >
        Agregá productos desde el menú para empezar tu pedido.
      </EmptyDescription>
      <Button
        type="button"
        variant="default"
        size="lg"
        onClick={onBackToMenu}
        style={{ backgroundColor: storeConfig.primaryColor, color: primaryForeground }}
        className="mt-6 h-12 px-6 font-bold shadow-md cursor-pointer hover:opacity-90"
      >
        Explorar menú
      </Button>
    </Empty>
  )
}
