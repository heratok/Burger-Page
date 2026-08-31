import React from "react"
import type { MenuItem } from "@/types/restaurant"
import { Flame, Sparkles, Edit2, Trash2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { LazyImage } from "@/components/ui/LazyImage"
import { formatCurrency } from "@/lib/utils"

export interface ProductGridProps {
  products: MenuItem[]
  deletingProductIds?: Set<string>
  isDark?: boolean
  onToggleStock: (productId: string) => void
  onEditProduct: (product: MenuItem) => void
  onDeleteProduct: (product: MenuItem) => void
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  deletingProductIds = new Set(),
  isDark = false,
  onToggleStock,
  onEditProduct,
  onDeleteProduct,
}) => {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <div
          key={product.id}
          className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
            deletingProductIds.has(product.id)
              ? "opacity-0 scale-95 pointer-events-none"
              : "opacity-100 scale-100 hover:shadow-md"
          } ${
            isDark
              ? "border-slate-800 bg-slate-900 hover:border-slate-700"
              : "border-slate-200 bg-white hover:border-slate-300"
          } ${!product.inStock ? "opacity-60" : ""}`}
        >
          {/* Image with overlay tags */}
          <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
            <LazyImage
              src={product.src}
              alt={product.name}
              containerClassName="size-full"
              className="size-full object-cover transition duration-300 group-hover:scale-105"
            />
            <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 z-10">
              <span className="rounded-md bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                {product.category}
              </span>
              {product.isPopular && (
                <span className="flex items-center gap-1 rounded-md bg-amber-500/95 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                  <Flame className="size-3" />
                  Popular
                </span>
              )}
              {product.isNew && (
                <span className="flex items-center gap-1 rounded-md bg-emerald-500/95 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                  <Sparkles className="size-3" />
                  Nuevo
                </span>
              )}
            </div>

            {!product.inStock && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/65 backdrop-blur-2xs">
                <span className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-black text-white uppercase tracking-wider">
                  Agotado Temporalmente
                </span>
              </div>
            )}
          </div>

          {/* Body Content */}
          <div className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold tracking-tight line-clamp-1 text-slate-900 dark:text-white">
                {product.name}
              </h3>
              <span className="text-base font-black text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                {formatCurrency(product.price)}
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 min-h-[32px]">
              {product.description}
            </p>

            {/* Stock switch & Actions */}
            <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <Switch
                checked={product.inStock}
                onCheckedChange={() => onToggleStock(product.id)}
                label={product.inStock ? "Disponible" : "Agotado"}
              />

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onEditProduct(product)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-300 cursor-pointer"
                  title="Editar plato"
                >
                  <Edit2 className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteProduct(product)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 cursor-pointer"
                  title="Eliminar plato"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
