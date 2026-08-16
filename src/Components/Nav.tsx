import { ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"

interface NavProps {
  mostrar: () => void
  cantidad: number
  total?: number
}

export default function Nav({ mostrar, cantidad, total = 0 }: NavProps) {
  const label = `Ver orden, ${cantidad} ${cantidad === 1 ? "producto" : "productos"}, total $${total.toLocaleString()}`

  return (
    <Button
      type="button"
      onClick={mostrar}
      aria-label={label}
      variant="secondary"
      className="fixed bottom-4 left-1/2 z-40 h-12 -translate-x-1/2 rounded-full border border-border-strong bg-bg-elevated px-3 text-text-primary shadow-lg transition duration-150 ease-out hover:border-accent hover:bg-bg-elevated-2 focus:outline-none focus-visible:focus-ring sm:right-6 sm:left-auto sm:translate-x-0 sm:px-5 [&_svg:not([class*='size-'])]:size-5"
    >
      <span className="relative inline-flex items-center justify-center">
        <ShoppingCart className="text-accent" data-icon="inline-start" />
        {cantidad > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1 text-xs leading-none font-bold text-text-primary"
          >
            {cantidad}
          </span>
        )}
      </span>
      <span className="hidden flex-col items-start leading-tight sm:inline-flex">
        <span className="text-sm font-medium">Ver orden</span>
        <span className="text-xs text-text-muted">
          ${total.toLocaleString()}
        </span>
      </span>
    </Button>
  )
}