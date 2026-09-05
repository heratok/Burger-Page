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
        <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-xl shadow-indigo-600/30">
          <ShieldCheck className="size-7 animate-pulse" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white tracking-wide">Cargando Panel Administrativo</h3>
          <p className="text-xs text-slate-400">Verificando credenciales y sesión...</p>
        </div>
        <Loader2 className="size-5 text-indigo-500 animate-spin mt-2" />
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
        <Loader2 className="size-5 text-orange-500 animate-spin mt-2" />
      </div>
    </div>
  )
}

/**
 * Storefront food product cards skeleton loader (only for /:slug).
 */
export const StorefrontLoadingFallback: React.FC = () => {
  return (
    <div className="mx-auto max-w-(--container) px-4 py-6 md:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-7 w-40 bg-bg-elevated-2" />
        <Skeleton className="h-4 w-72 bg-bg-elevated-2" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-0 overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated"
          >
            <Skeleton className="aspect-video w-full rounded-none bg-bg-elevated-2" />
            <div className="flex flex-col gap-3 p-4">
              <Skeleton className="h-4 w-2/3 bg-bg-elevated-2" />
              <Skeleton className="h-3 w-full bg-bg-elevated-2" />
              <Skeleton className="h-3 w-5/6 bg-bg-elevated-2" />
              <div className="mt-3 flex items-center justify-between">
                <Skeleton className="h-5 w-20 bg-bg-elevated-2" />
                <Skeleton className="size-9 rounded-full bg-bg-elevated-2" />
              </div>
            </div>
          </div>
        ))}
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
