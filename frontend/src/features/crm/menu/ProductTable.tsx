import React from "react"
import type { MenuItem } from "@/types/restaurant"
import { Edit2, Trash2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { LazyImage } from "@/components/ui/LazyImage"
import { formatCurrency } from "@/lib/utils"

export interface ProductTableProps {
  products: MenuItem[]
  isDark?: boolean
  onToggleStock: (productId: string) => void
  onEditProduct: (product: MenuItem) => void
  onDeleteProduct: (product: MenuItem) => void
}

export const ProductTable: React.FC<ProductTableProps> = ({
  products,
  isDark = false,
  onToggleStock,
  onEditProduct,
  onDeleteProduct,
}) => {
  return (
    <div
      className={`overflow-hidden rounded-2xl border shadow-xs ${
        isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
      }`}
    >
      <table className="w-full text-left text-xs">
        <thead>
          <tr className={`border-b ${isDark ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-500"}`}>
            <th className="py-3 px-4 font-semibold">Producto</th>
            <th className="py-3 px-4 font-semibold">Categoría</th>
            <th className="py-3 px-4 font-semibold">Precio</th>
            <th className="py-3 px-4 font-semibold">Tags</th>
            <th className="py-3 px-4 font-semibold">Disponibilidad</th>
            <th className="py-3 px-4 font-semibold text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {products.map((prod) => (
            <tr
              key={prod.id}
              className={`transition-colors ${
                isDark ? "hover:bg-slate-800/60" : "hover:bg-slate-50"
              }`}
            >
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <LazyImage
                    src={prod.src}
                    alt={prod.name}
                    containerClassName="size-10 rounded-lg shrink-0 border dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
                    className="size-full object-cover"
                  />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{prod.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 max-w-xs">
                      {prod.description}
                    </div>
                  </div>
                </div>
              </td>
              <td className="py-3 px-4">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300 border dark:border-slate-700">
                  {prod.category}
                </span>
              </td>
              <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                {formatCurrency(prod.price)}
              </td>
              <td className="py-3 px-4">
                <div className="flex gap-1">
                  {prod.isPopular && (
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border dark:border-amber-500/30">
                      Popular
                    </span>
                  )}
                  {prod.isNew && (
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border dark:border-emerald-500/30">
                      Nuevo
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3 px-4">
                <Switch
                  checked={prod.inStock}
                  onCheckedChange={() => onToggleStock(prod.id)}
                  label={prod.inStock ? "Disponible" : "Agotado"}
                />
              </td>
              <td className="py-3 px-4 text-right">
                <button
                  type="button"
                  onClick={() => onEditProduct(prod)}
                  className="mr-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-300 cursor-pointer"
                  title="Editar plato"
                >
                  <Edit2 className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteProduct(prod)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 cursor-pointer"
                  title="Eliminar plato"
                >
                  <Trash2 className="size-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
