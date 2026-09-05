import React from "react"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Select } from "@/components/ui/select"

export interface PaginationProps {
  currentPage: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
  className?: string
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  className = "",
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  const handlePrev = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1)
    }
  }

  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-2 py-3 text-xs text-slate-500 dark:text-slate-400 ${className}`}
      aria-label="Paginación de tabla"
    >
      {/* Items count summary */}
      <div className="flex items-center gap-2">
        <span>
          Mostrando <strong className="text-slate-900 dark:text-slate-200">{startItem}</strong> a{" "}
          <strong className="text-slate-900 dark:text-slate-200">{endItem}</strong> de{" "}
          <strong className="text-slate-900 dark:text-slate-200">{totalItems}</strong> registros
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2 border-l pl-3 border-slate-200 dark:border-slate-700">
            <span className="text-[11px] whitespace-nowrap">Por pág:</span>
            <div className="w-20">
              <Select
                size="sm"
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                aria-label="Registros por página"
                options={pageSizeOptions.map((opt) => ({
                  value: opt,
                  label: String(opt),
                }))}
                className="font-bold text-center pl-2 pr-6"
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center gap-1 self-end sm:self-auto">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          aria-label="Primera página"
          title="Primera página"
          className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer transition-colors"
        >
          <ChevronsLeft className="size-4" />
        </button>

        <button
          type="button"
          onClick={handlePrev}
          disabled={currentPage <= 1}
          aria-label="Página anterior"
          title="Página anterior"
          className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div className="px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-300">
          Pág. {currentPage} de {totalPages}
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={currentPage >= totalPages}
          aria-label="Página siguiente"
          title="Página siguiente"
          className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer transition-colors"
        >
          <ChevronRight className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          aria-label="Última página"
          title="Última página"
          className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer transition-colors"
        >
          <ChevronsRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
