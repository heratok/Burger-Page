import React from "react"
import { Boxes, AlertTriangle, DollarSign, Truck } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export interface InventoryStatsProps {
  totalItems: number
  lowStockCount: number
  totalInventoryValue: number
  suppliersCount: number
  isDark: boolean
  onSelectLowStock: () => void
  onSelectSuppliers: () => void
}

export const InventoryStats: React.FC<InventoryStatsProps> = ({
  totalItems,
  lowStockCount,
  totalInventoryValue,
  suppliersCount,
  isDark,
  onSelectLowStock,
  onSelectSuppliers,
}) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* Metric 1: Total Items */}
      <div
        className={`rounded-2xl border p-4 transition-all ${
          isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200/80 bg-white"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Insumos Registrados
          </span>
          <div className="flex size-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
            <Boxes className="size-4" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
          {totalItems}
        </div>
        <span className="text-[11px] text-slate-400">Total en catálogo de materias primas</span>
      </div>

      {/* Metric 2: Low Stock Alert */}
      <div
        onClick={onSelectLowStock}
        className={`rounded-2xl border p-4 transition-all cursor-pointer hover:border-amber-500/50 ${
          lowStockCount > 0
            ? isDark
              ? "border-amber-500/30 bg-amber-500/10"
              : "border-amber-200 bg-amber-50/70"
            : isDark
            ? "border-slate-800 bg-[#0E1322]"
            : "border-slate-200/80 bg-white"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            Alertas de Bajo Stock
          </span>
          <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-500 animate-pulse">
            <AlertTriangle className="size-4" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-black text-amber-500">
          {lowStockCount}
        </div>
        <span className="text-[11px] text-amber-600/80 dark:text-amber-400/80">
          {lowStockCount > 0 ? "Requieren reposición urgente" : "Stock en niveles óptimos"}
        </span>
      </div>

      {/* Metric 3: Total Inventory Value */}
      <div
        className={`rounded-2xl border p-4 transition-all ${
          isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200/80 bg-white"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Valor del Inventario
          </span>
          <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <DollarSign className="size-4" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-black text-emerald-500">
          {formatCurrency(totalInventoryValue)}
        </div>
        <span className="text-[11px] text-slate-400">Valorización total a costo actual</span>
      </div>

      {/* Metric 4: Suppliers */}
      <div
        onClick={onSelectSuppliers}
        className={`rounded-2xl border p-4 transition-all cursor-pointer hover:border-indigo-500/50 ${
          isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200/80 bg-white"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Proveedores Activos
          </span>
          <div className="flex size-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
            <Truck className="size-4" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
          {suppliersCount}
        </div>
        <span className="text-[11px] text-slate-400">Contactos directos de compra</span>
      </div>
    </div>
  )
}
