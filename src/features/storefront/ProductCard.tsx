import React from "react"
import { Plus, Flame, Sparkles } from "lucide-react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import type { MenuItem } from "@/types/restaurant"
import { useRestaurant } from "@/context/RestaurantContext"

export interface ProductCardProps {
  product: MenuItem
  onSelectProduct: () => void
}

export default function ProductCard({ product, onSelectProduct }: ProductCardProps) {
  const { storeConfig } = useRestaurant()

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
        return "shadow-md hover:shadow-xl border-border-subtle"
      case "bordered":
        return "border-2 border-border-strong shadow-none"
      case "glass":
        return "backdrop-blur-md bg-bg-elevated/70 border border-white/10 shadow-lg"
      case "minimal":
        return "border-0 shadow-none bg-bg-elevated/50"
      default:
        return "shadow-sm border-border-subtle"
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
      aria-label={`Agregar ${product.name} al carrito, $${product.price.toLocaleString()}`}
      style={{
        backgroundColor: "var(--color-bg-elevated)",
        borderColor: "var(--color-border-subtle)",
      }}
      className={`group relative cursor-pointer gap-0 overflow-hidden py-0 transition duration-200 ease-out hover:-translate-y-1 focus:outline-none focus-visible:focus-ring active:translate-y-0 ${radiusClass} ${styleClass}`}
    >
      <div
        style={{ backgroundColor: "var(--color-bg-elevated-2)" }}
        className="relative aspect-video overflow-hidden"
      >
        <img
          src={product.src}
          alt={product.name}
          loading="lazy"
          className="size-full object-cover transition duration-300 ease-out group-hover:scale-105"
        />

        {/* Badges */}
        {storeConfig.showBadges && (
          <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 z-10">
            {product.isPopular && (
              <span
                style={{ backgroundColor: storeConfig.primaryColor }}
                className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold text-white shadow-xs"
              >
                <Flame className="size-3" />
                Popular
              </span>
            )}
            {product.isNew && (
              <span className="flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                <Sparkles className="size-3" />
                Nuevo
              </span>
            )}
          </div>
        )}

        {!product.inStock && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/65 backdrop-blur-2xs">
            <span className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white uppercase tracking-wider">
              Agotado
            </span>
          </div>
        )}
      </div>

      <CardContent className="flex flex-1 flex-col gap-1.5 px-4 pt-4">
        <div className="flex items-start justify-between gap-2">
          <h2
            style={{ color: "var(--color-text-primary)" }}
            className="text-base font-bold leading-tight tracking-tight group-hover:opacity-85"
          >
            {product.name}
          </h2>
        </div>
        <p
          style={{ color: "var(--color-text-secondary)" }}
          className="line-clamp-2 text-xs leading-relaxed font-normal"
        >
          {product.description}
        </p>
      </CardContent>

      <CardFooter className="mt-auto justify-between border-t-0 bg-transparent px-4 pb-4 pt-2">
        <span
          style={{ color: storeConfig.primaryColor }}
          className="text-lg font-black tracking-tight"
        >
          ${product.price.toLocaleString()}
        </span>
        <span
          aria-hidden="true"
          style={{ backgroundColor: storeConfig.primaryColor }}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-white shadow-md transition duration-150 ease-out group-hover:scale-110 group-active:scale-95"
        >
          <Plus className="size-5 stroke-[3]" />
        </span>
      </CardFooter>
    </Card>
  )
}
