import React from "react"
import { Plus, Flame, Sparkles } from "lucide-react"
import { Card } from "@/components/ui/card"
import type { MenuItem } from "@/types/restaurant"
import { useRestaurant } from "@/context/RestaurantContext"
import { LazyImage } from "@/components/ui/LazyImage"
import { formatCurrency, getContrastForeground } from "@/lib/utils"

export interface ProductCardProps {
  product: MenuItem
  onSelectProduct: () => void
  /** Store closed or paused: the product can be browsed but not added. */
  closed?: boolean
}

export default function ProductCard({ product, onSelectProduct, closed = false }: ProductCardProps) {
  const { storeConfig } = useRestaurant()
  const primaryForeground = getContrastForeground(storeConfig.primaryColor)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onSelectProduct()
    }
  }

  const getRadiusClass = (r: typeof storeConfig.cardRadius) => {
    switch (r) {
      case "sm":
        return "rounded-lg"
      case "md":
        return "rounded-xl"
      case "lg":
        return "rounded-2xl"
      case "full":
        return "rounded-3xl"
      default:
        return "rounded-xl"
    }
  }

  const getStyleClass = (style: typeof storeConfig.cardStyle) => {
    switch (style) {
      case "elevated":
        return "shadow-sm hover:shadow-md border-border-subtle"
      case "bordered":
        return "border-2 border-border-strong shadow-none"
      case "glass":
        return "backdrop-blur-md bg-bg-elevated/70 border border-white/10 shadow-sm"
      case "minimal":
        return "border-0 shadow-none bg-bg-elevated/50"
      default:
        return "shadow-xs border-border-subtle"
    }
  }

  const radiusClass = getRadiusClass(storeConfig.cardRadius)
  const styleClass = getStyleClass(storeConfig.cardStyle)

  return (
    <Card
        role="button"
        tabIndex={0}
        onClick={onSelectProduct}
        onKeyDown={handleKeyDown}
        aria-label={
          closed
            ? `${product.name}, ${formatCurrency(product.price)}. Cerrado, no se puede agregar al carrito`
            : `Agregar ${product.name} al carrito, ${formatCurrency(product.price)}`
        }
        style={{
          backgroundColor: "var(--color-bg-elevated)",
          borderColor: "var(--color-border-subtle)",
        }}
        className={`group relative flex h-full w-full flex-row items-stretch cursor-pointer gap-0 overflow-hidden p-3 sm:p-4 transition duration-200 ease-out hover:-translate-y-0.5 focus:outline-none focus-visible:focus-ring active:translate-y-0 ${radiusClass} ${styleClass}`}
      >
        {/* Left Side: Square Thumbnail centered vertically */}
        <div className="relative size-24 min-[400px]:size-28 sm:size-32 aspect-square shrink-0 overflow-hidden rounded-xl bg-bg-elevated-2 self-center">
          <LazyImage
            src={product.src || ""}
            alt={product.name}
            containerClassName="size-full"
            className="size-full object-cover transition duration-300 ease-out group-hover:scale-105"
          />

          {/* Badges on Thumbnail */}
          {storeConfig.showBadges && (
            <div className="absolute top-1.5 left-1.5 flex flex-wrap gap-1 z-10">
              {product.isPopular && (
                <span
                  style={{
                    backgroundColor: storeConfig.primaryColor,
                    color: primaryForeground,
                  }}
                  className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold shadow-xs"
                >
                  <Flame className="size-2.5" />
                  Popular
                </span>
              )}
              {product.isNew && (
                <span className="flex items-center gap-0.5 rounded bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                  <Sparkles className="size-2.5" />
                  Nuevo
                </span>
              )}
            </div>
          )}

          {!product.inStock && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/65 backdrop-blur-2xs">
              <span className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                Agotado
              </span>
            </div>
          )}
        </div>

        {/* Right Side: Title, Full Description, Price & Action */}
        <div className="flex flex-1 flex-col justify-between min-w-0 pl-3 sm:pl-4">
          <div className="space-y-1">
            <h2
              style={{ color: "var(--color-text-primary)" }}
              className="text-base sm:text-lg font-bold leading-snug tracking-tight group-hover:opacity-85 line-clamp-2"
            >
              {product.name}
            </h2>
            {product.description && (
              <p
                title={product.description}
                style={{ color: "var(--color-text-secondary)" }}
                className="text-xs sm:text-sm leading-relaxed font-normal text-pretty"
              >
                {product.description}
              </p>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between pt-1">
            <span
              style={{ color: storeConfig.primaryColor }}
              className="text-base sm:text-lg font-black tracking-tight"
            >
              {formatCurrency(product.price)}
            </span>
            {closed ? (
              <span
                aria-hidden="true"
                className="inline-flex h-8 sm:h-9 shrink-0 items-center justify-center rounded-full bg-red-500/15 px-3 text-xs font-bold text-red-700 dark:text-red-300"
              >
                Cerrado
              </span>
            ) : (
              <span
                aria-hidden="true"
                style={{
                  backgroundColor: storeConfig.primaryColor,
                  color: primaryForeground,
                }}
                className="inline-flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-full shadow-sm transition duration-150 ease-out group-hover:scale-110 group-active:scale-95"
              >
                <Plus className="size-4 sm:size-5 stroke-[3]" />
              </span>
            )}
          </div>
        </div>
      </Card>
  )
}
