import React, { useState, useEffect } from "react"
import { Plus, Flame, Sparkles, Search, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import type { MenuItem } from "@/types/restaurant"
import { useRestaurant } from "@/context/RestaurantContext"
import { LazyImage } from "@/components/ui/LazyImage"
import { formatCurrency, getContrastForeground } from "@/lib/utils"
import { resolveImageUrl } from "@/core/storage/supabaseStorage"

export interface ProductCardProps {
  product: MenuItem
  onSelectProduct: () => void
  /** Store closed or paused: the product can be browsed but not added. */
  closed?: boolean
}

export default function ProductCard({ product, onSelectProduct, closed = false }: ProductCardProps) {
  const { storeConfig } = useRestaurant()
  const primaryForeground = getContrastForeground(storeConfig.primaryColor)
  const [isImageExpanded, setIsImageExpanded] = useState(false)

  useEffect(() => {
    if (!isImageExpanded) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        setIsImageExpanded(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [isImageExpanded])

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
    <>
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

          {/* Magnifying Glass to expand photo (shown when image exists) */}
          {product.src && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIsImageExpanded(true)
              }}
              aria-label={`Ampliar foto de ${product.name}`}
              className="absolute inset-0 m-auto z-10 flex size-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-xs opacity-85 sm:opacity-0 group-hover:opacity-100 transition-all hover:scale-110 hover:bg-black/75 cursor-pointer shadow-sm"
            >
              <Search className="size-4" strokeWidth={2.5} />
            </button>
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

      {/* Fullscreen Lightbox Modal */}
      {isImageExpanded && product.src && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ampliada de ${product.name}`}
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in-0 duration-150"
          onClick={(e) => {
            e.stopPropagation()
            setIsImageExpanded(false)
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsImageExpanded(false)
            }}
            aria-label="Cerrar vista previa"
            className="absolute top-4 right-4 z-70 inline-flex size-11 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-all active:scale-95 cursor-pointer"
          >
            <X className="size-6" />
          </button>
          <div
            className="relative max-h-[85vh] max-w-[90vw] overflow-hidden rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={resolveImageUrl(product.src)}
              alt={product.name}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-2xl select-none"
            />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 sm:p-5 text-white">
              <p className="text-base sm:text-lg font-bold">{product.name}</p>
              {product.description && (
                <p className="mt-1 text-xs sm:text-sm text-white/85 leading-relaxed">
                  {product.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
