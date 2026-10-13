import React from "react"
import type { AdditionItem } from "@/types/restaurant"
import { Edit2, Trash2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export interface AdditionsManagerProps {
  additions: AdditionItem[]
  isDark?: boolean
  onEditAddition: (addition: AdditionItem) => void
  onDeleteAddition: (addition: AdditionItem) => void
}

export const AdditionsManager: React.FC<AdditionsManagerProps> = ({
  additions,
  isDark = false,
  onEditAddition,
  onDeleteAddition,
}) => {
  return (
    <div
      className={`rounded-2xl border p-6 shadow-xs ${
        isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Adiciones y Extras para la Tienda
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Opciones que los clientes pueden sumar al personalizar sus pedidos
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {additions.map((add) => (
          <div
            key={add.id}
            className={`flex items-center justify-between rounded-xl border p-3.5 transition-all ${
              isDark ? "border-slate-800 bg-slate-800/60" : "border-slate-200 bg-slate-50/50"
            }`}
          >
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{add.name}</h4>
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                +{formatCurrency(add.price)}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                aria-label={`Editar adicional ${add.name}`}
                type="button"
                onClick={() => onEditAddition(add)}
                className="pointer-coarse:min-h-11 pointer-coarse:min-w-11 rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700 cursor-pointer"
                title="Editar adicional"
              >
                <Edit2 className="size-3.5" />
              </button>
              <button
                aria-label={`Eliminar adicional ${add.name}`}
                type="button"
                onClick={() => onDeleteAddition(add)}
                className="pointer-coarse:min-h-11 pointer-coarse:min-w-11 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-rose-400 cursor-pointer"
                title="Eliminar adicional"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
