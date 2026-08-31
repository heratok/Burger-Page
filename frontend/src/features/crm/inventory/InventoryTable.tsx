import React from "react"
import type {
  InventoryItem,
  Supplier,
} from "@/types/restaurant"
import {
  Search,
  AlertTriangle,
  Boxes,
  MessageSquare,
  Edit2,
  Trash2,
} from "lucide-react"
import { Pagination } from "@/components/ui/pagination"
import { Select } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"

import { CATEGORY_LABELS } from "./constants"

export interface InventoryTableProps {
  items: InventoryItem[]
  totalItems: number
  suppliers: Supplier[]
  searchTerm: string
  onSearchChange: (term: string) => void
  selectedCategory: string
  onCategoryChange: (category: string) => void
  onlyLowStock: boolean
  onToggleOnlyLowStock: () => void
  currentPage: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  isDark: boolean
  onAdjustStock: (itemId: string, delta: number) => void
  onSendSupplierWhatsApp: (supplier: Supplier) => void
  onEditItem: (item: InventoryItem) => void
  onDeleteItem: (item: InventoryItem) => void
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  items,
  totalItems,
  suppliers,
  searchTerm,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  onlyLowStock,
  onToggleOnlyLowStock,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isDark,
  onAdjustStock,
  onSendSupplierWhatsApp,
  onEditItem,
  onDeleteItem,
}) => {
  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            maxLength={60}
            placeholder="Buscar insumo por nombre o categoría..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`w-full rounded-xl border pl-8.5 pr-4 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isDark
                ? "border-slate-800 bg-[#0E1322] text-white placeholder-slate-500"
                : "border-slate-200 bg-white text-slate-900 placeholder-slate-400"
            }`}
          />
        </div>

        {/* Category Filter */}
        <div className="w-48 sm:w-56">
          <Select
            size="md"
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            aria-label="Filtrar por categoría de inventario"
            options={[
              { value: "all", label: "Todas las Categorías" },
              { value: "ingredients", label: "Ingredientes & Alimentos" },
              { value: "beverages", label: "Bebidas & Refrescos" },
              { value: "packaging", label: "Empaques & Descartables" },
              { value: "cleaning", label: "Limpieza" },
              { value: "other", label: "Otros" },
            ]}
          />
        </div>

        {/* Low Stock Toggle */}
        <button
          type="button"
          onClick={onToggleOnlyLowStock}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
            onlyLowStock
              ? "border-amber-500 bg-amber-500/20 text-amber-400 font-bold"
              : isDark
              ? "border-slate-800 bg-[#0E1322] text-slate-400 hover:text-white"
              : "border-slate-200 bg-white text-slate-600 hover:text-slate-900"
          }`}
        >
          <AlertTriangle className="size-3.5" />
          <span>Solo Bajo Stock</span>
        </button>
      </div>

      {/* Table Container */}
      <div
        className={`rounded-2xl border overflow-hidden ${
          isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200/80 bg-white shadow-xs"
        }`}
      >
        {totalItems === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Boxes className="size-10 mx-auto mb-2 text-slate-500 opacity-50" />
            <p className="text-sm font-semibold">No se encontraron insumos</p>
            <p className="text-xs mt-1 text-slate-500">
              {searchTerm || onlyLowStock
                ? "Probá cambiando los filtros de búsqueda"
                : "Empezá agregando materias primas para controlar tu stock"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead
                className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                  isDark
                    ? "border-slate-800 bg-slate-900/50 text-slate-400"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                <tr>
                  <th className="px-4 py-3">Insumo</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Stock Actual</th>
                  <th className="px-4 py-3">Ajuste Rápido</th>
                  <th className="px-4 py-3">Costo / Valuación</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {items.map((item) => {
                  const isLow = item.currentStock <= item.minStockAlert
                  const supplier = suppliers.find((s) => s.id === item.supplierId)
                  const itemValuation = item.currentStock * item.costPerUnit

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isLow
                          ? "bg-amber-500/5 hover:bg-amber-500/10"
                          : "hover:bg-slate-500/5"
                      }`}
                    >
                      {/* Name */}
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          {isLow && (
                            <span title="Stock por debajo del mínimo">
                              <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                            </span>
                          )}
                          <span>{item.name}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                          {CATEGORY_LABELS[item.category] || item.category}
                        </span>
                      </td>

                      {/* Current Stock */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono font-bold ${
                                isLow
                                  ? "text-amber-500 font-extrabold"
                                  : "text-slate-900 dark:text-slate-200"
                              }`}
                            >
                              {item.currentStock} {item.unit}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              (Mín: {item.minStockAlert})
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="h-1.5 w-24 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isLow ? "bg-amber-500" : "bg-emerald-500"
                              }`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  (item.currentStock / (item.minStockAlert * 2 || 1)) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Quick Adjust Buttons */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onAdjustStock(item.id, -1)}
                            className={`rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors ${
                              isDark
                                ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                                : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                            title="Descontar 1"
                          >
                            -1
                          </button>
                          <button
                            type="button"
                            onClick={() => onAdjustStock(item.id, 1)}
                            className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[11px] font-bold text-indigo-400 hover:bg-indigo-500/20"
                            title="Sumar 1"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() => onAdjustStock(item.id, 5)}
                            className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[11px] font-bold text-indigo-400 hover:bg-indigo-500/20"
                            title="Sumar 5"
                          >
                            +5
                          </button>
                        </div>
                      </td>

                      {/* Cost / Value */}
                      <td className="px-4 py-3 font-mono">
                        <div className="text-slate-900 dark:text-slate-200">
                          {formatCurrency(item.costPerUnit)} /{item.unit.slice(0, 3)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Total: {formatCurrency(itemValuation)}
                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="px-4 py-3">
                        {supplier ? (
                          <button
                            type="button"
                            onClick={() => onSendSupplierWhatsApp(supplier)}
                            className="inline-flex items-center gap-1 text-indigo-400 hover:underline"
                            title="Pedir reposición por WhatsApp"
                          >
                            <span className="truncate max-w-[120px]">{supplier.name}</span>
                            <MessageSquare className="size-3 text-emerald-400" />
                          </button>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">Sin asignar</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEditItem(item)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                            title="Editar insumo"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteItem(item)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
                            title="Eliminar insumo"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination for Inventory Table */}
        {totalItems > 0 && (
          <div className="border-t border-slate-200/80 dark:border-slate-800 px-4 py-2">
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </div>
        )}
      </div>
    </div>
  )
}
