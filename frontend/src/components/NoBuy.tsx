import { ShoppingBasket } from "lucide-react"
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Button } from "@/components/ui/button"

interface NoBuyProps {
  volver: () => void
}

export default function NoBuy({ volver }: NoBuyProps) {
  return (
    <Empty
      role="status"
      aria-live="polite"
      className="mx-auto max-w-md border-0 px-4 py-16 [&_[data-slot=empty-description]]:text-text-secondary"
    >
      <EmptyMedia
        variant="icon"
        className="mb-6 size-20 rounded-full border border-border-subtle bg-bg-elevated text-text-muted [&_svg:not([class*='size-'])]:size-8"
      >
        <ShoppingBasket />
      </EmptyMedia>
      <EmptyTitle className="text-xl font-semibold tracking-tight text-text-primary">
        Tu carrito está vacío
      </EmptyTitle>
      <EmptyDescription className="text-sm leading-relaxed">
        Agrega hamburguesas desde el menú para empezar tu pedido.
      </EmptyDescription>
      <Button
        variant="default"
        size="lg"
        onClick={volver}
        className="mt-6 h-12"
      >
        Explorar menú
      </Button>
    </Empty>
  )
}