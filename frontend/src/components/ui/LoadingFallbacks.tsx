import React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2, ShieldCheck, Sparkles } from "lucide-react"

/**
 * Clean, dark/neutral full-screen loader for the Admin Backoffice & Auth Modal.
 * Prevents any flash of public storefront food skeletons.
 */
export const AdminLoadingFallback: React.FC = () => {
  return (
    <div className="min-h-screen w-full bg-[#0B0F19] text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-xs animate-in fade-in duration-200">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-xl shadow-orange-600/30">
          <ShieldCheck className="size-7 animate-pulse" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white tracking-wide">Cargando Panel Administrativo</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Verificando credenciales y sesión...</p>
        </div>
        <Loader2 className="size-5 text-indigo-600 dark:text-indigo-400 animate-spin mt-2" />
      </div>
    </div>
  )
}

/**
 * Clean, seamless loader for the SaaS Landing Page (root /).
 */
export const LandingLoadingFallback: React.FC = () => {
  return (
    <div className="min-h-screen w-full bg-[#FAFAFA] text-slate-800 flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3 text-center animate-in fade-in duration-150">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-xl shadow-orange-500/20">
          <Sparkles className="size-6 animate-pulse" />
        </div>
        <Loader2 className="size-5 text-orange-800 dark:text-orange-400 animate-spin mt-2" />
      </div>
    </div>
  )
}

/**
 * Stand-in for the store navbar (logo + brand block + action circles) so a cold
 * load never paints a bare spinner over an empty page. It carries no store
 * identity (no name, no logo), so an unknown slug still never flashes a fake
 * store, and it keeps the real 64px bar height so nothing jumps when the tenant
 * resolves.
 */
const StoreNavSkeleton: React.FC = () => (
  <div
    data-slot="storefront-skeleton-nav"
    aria-hidden="true"
    className="border-b border-border-subtle bg-bg-base"
  >
    <div className="mx-auto flex h-16 max-w-(--container) items-center justify-between px-4 md:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-full bg-bg-elevated-2" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-24 bg-bg-elevated-2 sm:w-32" />
          <Skeleton className="h-3 w-16 bg-bg-elevated-2 sm:w-40" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="size-10 rounded-full bg-bg-elevated-2" />
        <Skeleton className="size-10 rounded-full bg-bg-elevated-2" />
      </div>
    </div>
  </div>
)

/**
 * Boot loader for /:slug while the tenant is unknown (lookup in flight, route
 * chunk downloading). It draws the store shell plus the catalog skeleton, so the
 * tenant lookup and the catalog load read as one continuous loading state
 * instead of a chrome-less void followed by a second full-page loader.
 */
export const StoreBootLoader: React.FC = () => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Cargando"
      className="min-h-screen w-full bg-bg-base"
    >
      <StoreNavSkeleton />
      <main className="mx-auto max-w-(--container) px-4 pt-6 pb-12 md:px-6 lg:px-8">
        <StorefrontLoadingFallback />
      </main>
    </div>
  )
}

/**
 * Horizontal product card placeholder mirroring ProductCard: thumbnail to the
 * left, title + description lines to the right, price and action circle at the
 * bottom. It lives in the same responsive grid as the real catalog.
 */
const StoreProductCardSkeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div
    data-slot="storefront-skeleton-card"
    aria-hidden="true"
    className={`flex-row items-stretch gap-0 overflow-hidden rounded-xl border border-border-subtle bg-bg-elevated p-3 sm:p-4 ${className}`}
  >
    <Skeleton
      data-slot="storefront-skeleton-thumb"
      className="size-24 min-[400px]:size-28 sm:size-32 aspect-square shrink-0 self-center rounded-xl bg-bg-elevated-2"
    />
    <div
      data-slot="storefront-skeleton-card-body"
      className="flex min-w-0 flex-1 flex-col justify-between pl-3 sm:pl-4"
    >
      <div className="space-y-1">
        <Skeleton className="h-5 w-3/4 bg-bg-elevated-2" />
        <Skeleton className="h-3.5 w-full bg-bg-elevated-2" />
        <Skeleton className="h-3.5 w-5/6 bg-bg-elevated-2" />
      </div>
      <div className="mt-3 flex items-center justify-between pt-1">
        <Skeleton
          data-slot="storefront-skeleton-price"
          className="h-5 w-20 bg-bg-elevated-2"
        />
        <Skeleton
          data-slot="storefront-skeleton-action"
          className="size-9 shrink-0 rounded-full bg-bg-elevated-2"
        />
      </div>
    </div>
  </div>
)

/**
 * Catalog skeleton for /:slug. It mirrors the settled storefront anatomy -
 * identity/meta block (title, status pill, delivery line, search pill, category
 * pills) and horizontal product cards in the real `grid-cols-1 md:grid-cols-2`
 * grid - so the height delta when the real catalog lands is small: two cards on
 * mobile, four from md up. It carries no page padding; the host supplies it.
 */
export const StorefrontLoadingFallback: React.FC = () => {
  return (
    <div data-slot="storefront-skeleton" className="space-y-6">
      {/* Identity + meta: title, open/closed pill, delivery line */}
      <div className="flex flex-col items-center gap-2.5">
        <Skeleton
          data-slot="storefront-skeleton-title"
          className="h-8 w-48 bg-bg-elevated-2"
        />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Skeleton
            data-slot="storefront-skeleton-status"
            className="h-7 w-24 rounded-full bg-bg-elevated-2"
          />
          <Skeleton
            data-slot="storefront-skeleton-delivery"
            className="h-5 w-40 bg-bg-elevated-2"
          />
        </div>
      </div>

      {/* Search pill */}
      <div className="flex justify-center">
        <Skeleton
          data-slot="storefront-skeleton-search"
          className="h-11 w-full max-w-md rounded-full bg-bg-elevated"
        />
      </div>

      {/* Category pill row (stand-in for the pinned bar) */}
      <div
        data-slot="storefront-skeleton-categories"
        className="flex items-center gap-1.5 overflow-hidden border-b border-border-subtle py-2"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 shrink-0 rounded-full bg-bg-elevated-2" />
        ))}
      </div>

      {/* Catalog: section header + horizontal cards in the real grid */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
          <Skeleton className="h-6 w-32 bg-bg-elevated-2" />
          <Skeleton className="h-5 w-8 rounded-full bg-bg-elevated-2" />
        </div>
        <div
          data-slot="storefront-skeleton-grid"
          className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 lg:gap-5"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <StoreProductCardSkeleton
              key={i}
              // `hidden md:flex`: 2 cards on mobile, 4 from md up.
              className={i < 2 ? "flex" : "hidden md:flex"}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Scoped content loader for individual tabs inside AdminLayout.
 * Keeps the sidebar and header mounted and intact, avoiding layout shifts and full-screen flashes.
 */
export const AdminContentFallback: React.FC<{ isDark?: boolean }> = ({ isDark }) => {
  return (
    <div className="space-y-6 animate-pulse w-full">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className={`h-7 w-48 rounded-lg ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
          <div className={`h-4 w-72 rounded-md ${isDark ? "bg-slate-800/60" : "bg-slate-200/60"}`} />
        </div>
        <div className={`h-9 w-28 rounded-xl ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`h-28 rounded-2xl border p-4 ${
              isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white"
            }`}
          >
            <div className={`h-4 w-24 rounded ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
            <div className={`mt-4 h-7 w-16 rounded ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
          </div>
        ))}
      </div>
      <div
        className={`h-64 rounded-2xl border p-6 ${
          isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white"
        }`}
      />
    </div>
  )
}
