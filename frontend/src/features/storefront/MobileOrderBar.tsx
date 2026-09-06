import { ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRestaurant } from "@/context/RestaurantContext"
import { formatCurrency, getContrastForeground } from "@/lib/utils"

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
  const primaryForeground = getContrastForeground(storeConfig.primaryColor)
  const label = `Ver orden, ${itemCount} ${itemCount === 1 ? "producto" : "productos"}, total ${formatCurrency(total)}`

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-bg-surface px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-xl sm:hidden">
      <Button
        type="button"
        onClick={onOpenCart}
        aria-label={label}
        variant="default"
        size="lg"
        style={{ backgroundColor: storeConfig.primaryColor, color: primaryForeground }}
        className="h-12 w-full justify-between rounded-2xl text-base font-bold shadow-md cursor-pointer hover:opacity-90"
      >
        <span className="inline-flex items-center gap-2">
          <ShoppingCart className="size-5" style={{ color: primaryForeground }} data-icon="inline-start" />
          <span className="font-bold" style={{ color: primaryForeground }}>Ver orden</span>
          {itemCount > 0 && (
            <span
              aria-hidden="true"
              style={{
                backgroundColor: primaryForeground === "#FFFFFF" ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.15)",
                color: primaryForeground,
              }}
              className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs leading-none font-extrabold"
            >
              {itemCount}
            </span>
          )}
        </span>
        <span className="font-extrabold" style={{ color: primaryForeground }}>{formatCurrency(total)}</span>
      </Button>
    </div>
  )
}
