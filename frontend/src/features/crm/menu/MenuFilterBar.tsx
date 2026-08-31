import React from "react"
import { Search, LayoutGrid, List, Tags } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface MenuFilterBarProps {
  categories: string[]
  selectedCategory: string
  totalProductsCount: number
  searchTerm: string
  viewMode: "grid" | "table"
  isDark?: boolean
  onSelectCategory: (category: string) => void
  onSearchChange: (term: string) => void
  onViewModeChange: (mode: "grid" | "table") => void
  onOpenCategoryModal: () => void
}

export const MenuFilterBar: React.FC<MenuFilterBarProps> = ({
  categories,
  selectedCategory,
  totalProductsCount,
  searchTerm,
  viewMode,
  isDark = false,
  onSelectCategory,
  onSearchChange,
  onViewModeChange,
  onOpenCategoryModal,
}) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSelectCategory("ALL")}
          className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
            selectedCategory === "ALL"
              ? "bg-indigo-600 text-white"
              : isDark
              ? "bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-750"
              : "bg-white border text-slate-700 hover:bg-slate-50"
          }`}
        >
          Todos ({totalProductsCount})
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onSelectCategory(cat)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedCategory === cat
                ? "bg-indigo-600 text-white"
                : isDark
                ? "bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-750"
                : "bg-white border text-slate-700 hover:bg-slate-50"
            }`}
          >
            {cat}
          </button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenCategoryModal}
          className="gap-1.5 rounded-xl border-dashed border-indigo-400/50 bg-indigo-50/50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/30 dark:text-indigo-400 dark:hover:bg-indigo-900/40 text-xs font-semibold cursor-pointer"
        >
          <Tags className="size-3.5" />
          <span>Gestionar Categorías</span>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar plato..."
            className={`w-full rounded-xl border pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isDark
                ? "border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-400"
                : "border-slate-200 bg-white text-slate-800 placeholder-slate-400"
            }`}
          />
        </div>
        <div className="flex rounded-xl border p-0.5 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            className={`rounded-lg p-1.5 text-xs ${
              viewMode === "grid"
                ? "bg-white shadow-xs text-slate-900 dark:bg-slate-700 dark:text-white"
                : "text-slate-400"
            }`}
            title="Cuadrícula"
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("table")}
            className={`rounded-lg p-1.5 text-xs ${
              viewMode === "table"
                ? "bg-white shadow-xs text-slate-900 dark:bg-slate-700 dark:text-white"
                : "text-slate-400"
            }`}
            title="Lista"
          >
            <List className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
