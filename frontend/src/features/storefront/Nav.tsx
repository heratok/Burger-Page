import { ShoppingCart } from "lucide-react"
import { Button } from "@/shared/ui/ui/button"

interface NavProps {
  mostrar: () => void
  cantidad: number
  total?: number
}

export default function Nav({ mostrar, cantidad, total = 0 }: NavProps) {
  const label = `Ver orden, ${cantidad} ${cantidad === 1 ? "producto" : "productos"}, total $${total.toLocaleString()}`

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-bg-elevated px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-4px_16px_rgba(0,0,0,0.35)] sm:hidden">
      <Button
        type="button"
        onClick={mostrar}
        aria-label={label}
        variant="default"
        size="lg"
        className="h-12 w-full justify-between rounded-full text-base shadow-md"
      >
        <span className="inline-flex items-center gap-2">
          <ShoppingCart className="size-5" data-icon="inline-start" />
          <span className="font-medium">Ver orden</span>
          {cantidad > 0 && (
            <span
              aria-hidden="true"
              className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/25 px-1.5 text-xs leading-none font-bold"
            >
              {cantidad}
            </span>
          )}
        </span>
        <span className="font-bold">${total.toLocaleString()}</span>
      </Button>
    </div>
  )
}
