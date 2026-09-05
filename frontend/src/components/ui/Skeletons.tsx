import React from "react"
import { Skeleton } from "@/components/ui/skeleton"

interface SkeletonProps {
  className?: string
  isDark?: boolean
}

/**
 * Animated shimmer skeleton for data tables (Restaurants, Users, Customers, Inventory).
 */
export const TableSkeleton: React.FC<SkeletonProps & { rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 5,
  isDark = false,
  className = "",
}) => {
  return (
    <div
      data-testid="table-skeleton"
      className={`rounded-2xl border shadow-xs overflow-hidden ${
        isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"
      } ${className}`}
    >
      {/* Table Header Controls Skeleton */}
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800">
        <Skeleton className={`h-8 w-64 rounded-xl ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
        <div className="flex items-center gap-3">
          <Skeleton className={`h-8 w-28 rounded-xl ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
          <Skeleton className={`h-4 w-20 rounded ${isDark ? "bg-slate-800/60" : "bg-slate-200/60"}`} />
        </div>
      </div>

      {/* Table Rows Skeleton */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-4 py-3.5">
                  <Skeleton className={`h-3.5 w-20 rounded ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {Array.from({ length: rows }).map((_, rIdx) => (
              <tr key={rIdx} className="animate-pulse">
                {Array.from({ length: columns }).map((_, cIdx) => (
                  <td key={cIdx} className="px-4 py-4">
                    {cIdx === 0 ? (
                      <div className="flex items-center gap-3">
                        <Skeleton className={`size-10 rounded-xl shrink-0 ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
                        <div className="space-y-1.5 flex-1">
                          <Skeleton className={`h-4 w-32 rounded ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
                          <Skeleton className={`h-3 w-20 rounded ${isDark ? "bg-slate-800/60" : "bg-slate-200/60"}`} />
                        </div>
                      </div>
                    ) : (
                      <Skeleton
                        className={`h-4 ${
                          cIdx === columns - 1 ? "w-16 ml-auto" : "w-24"
                        } rounded ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Animated shimmer skeleton for Kanban Board columns & order tickets.
 */
export const KanbanBoardSkeleton: React.FC<SkeletonProps & { columns?: number }> = ({
  columns = 3,
  isDark = false,
  className = "",
}) => {
  return (
    <div
      data-testid="kanban-skeleton"
      className={`grid grid-cols-1 md:grid-cols-3 gap-5 ${className}`}
    >
      {Array.from({ length: columns }).map((_, colIdx) => (
        <div
          key={colIdx}
          className={`flex flex-col rounded-2xl border p-4 space-y-4 ${
            isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-slate-50/50"
          }`}
        >
          {/* Column Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Skeleton className={`size-3 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-300"}`} />
              <Skeleton className={`h-4 w-28 rounded ${isDark ? "bg-slate-800" : "bg-slate-300"}`} />
            </div>
            <Skeleton className={`h-5 w-8 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-300"}`} />
          </div>

          {/* Ticket Skeletons */}
          {Array.from({ length: colIdx === 0 ? 3 : 2 }).map((_, cardIdx) => (
            <div
              key={cardIdx}
              className={`rounded-xl border p-3.5 space-y-3 shadow-xs ${
                isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <Skeleton className={`h-4 w-20 rounded ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
                <Skeleton className={`h-4 w-14 rounded ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
              </div>
              <div className="space-y-1.5">
                <Skeleton className={`h-3.5 w-3/4 rounded ${isDark ? "bg-slate-800/80" : "bg-slate-200"}`} />
                <Skeleton className={`h-3 w-1/2 rounded ${isDark ? "bg-slate-800/50" : "bg-slate-200/60"}`} />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60">
                <Skeleton className={`h-3.5 w-16 rounded ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
                <Skeleton className={`h-7 w-20 rounded-lg ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * Animated shimmer skeleton for Product & Addition Grid Cards in CRM or Storefront.
 */
export const MenuGridSkeleton: React.FC<SkeletonProps & { count?: number }> = ({
  count = 6,
  isDark = false,
  className = "",
}) => {
  return (
    <div
      data-testid="menu-grid-skeleton"
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3 xl:grid-cols-4 ${className}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`flex flex-col overflow-hidden rounded-2xl border shadow-xs ${
            isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"
          }`}
        >
          <Skeleton className={`aspect-video w-full rounded-none ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
          <div className="flex flex-col gap-3 p-4 flex-1">
            <div className="flex items-start justify-between gap-2">
              <Skeleton className={`h-4 w-36 rounded ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
              <Skeleton className={`h-4 w-16 rounded ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
            </div>
            <Skeleton className={`h-3 w-full rounded ${isDark ? "bg-slate-800/70" : "bg-slate-200/70"}`} />
            <Skeleton className={`h-3 w-4/5 rounded ${isDark ? "bg-slate-800/50" : "bg-slate-200/50"}`} />
            <div className="mt-auto flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <Skeleton className={`h-6 w-20 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
              <div className="flex items-center gap-1.5">
                <Skeleton className={`size-7 rounded-lg ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
                <Skeleton className={`size-7 rounded-lg ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Animated shimmer skeleton for Platform and CRM metric KPI cards.
 */
export const MetricCardsSkeleton: React.FC<SkeletonProps & { count?: number }> = ({
  count = 4,
  isDark = false,
  className = "",
}) => {
  return (
    <div
      data-testid="metrics-skeleton"
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`flex flex-col justify-between rounded-2xl border p-4.5 shadow-xs ${
            isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <Skeleton className={`h-3.5 w-24 rounded ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
            <Skeleton className={`size-8 rounded-xl ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
          </div>
          <div className="mt-3 space-y-2">
            <Skeleton className={`h-7 w-28 rounded ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
            <Skeleton className={`h-3 w-36 rounded ${isDark ? "bg-slate-800/60" : "bg-slate-200/60"}`} />
          </div>
        </div>
      ))}
    </div>
  )
}
