import { ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRestaurant } from "@/context/RestaurantContext"
import { formatCurrency } from "@/lib/utils"

export interface MobileOrderBarProps {
  onOpenCart: () => void
  itemCount: number
  total?: number
}

export default function MobileOrderBar({
  onOpenCart,
  itemCount,
  total = 0,
}: MobileOrderBarProps) {
  const { storeConfig } = useRestaurant()
  const label = `Ver orden, ${itemCount} ${itemCount === 1 ? "producto" : "productos"}, total ${formatCurrency(total)}`

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-bg-surface px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-xl sm:hidden">
      <Button
        type="button"
        onClick={onOpenCart}
        aria-label={label}
        variant="default"
        size="lg"
        style={{ backgroundColor: storeConfig.primaryColor, color: "#FFFFFF" }}
        className="h-12 w-full justify-between rounded-2xl text-base text-white font-bold shadow-md cursor-pointer hover:opacity-90"
      >
        <span className="inline-flex items-center gap-2">
          <ShoppingCart className="size-5 text-white" data-icon="inline-start" />
          <span className="font-bold text-white">Ver orden</span>
          {itemCount > 0 && (
            <span
              aria-hidden="true"
              className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/30 px-1.5 text-xs leading-none font-extrabold text-white"
            >
              {itemCount}
            </span>
          )}
        </span>
        <span className="font-extrabold text-white">{formatCurrency(total)}</span>
      </Button>
    </div>
  )
}
