import React from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import { Store, ArrowRight, AlertCircle } from "lucide-react"

interface RestaurantNotFoundProps {
  attemptedSlug?: string
}

export const RestaurantNotFound: React.FC<RestaurantNotFoundProps> = ({ attemptedSlug }) => {
  const { restaurants, switchRestaurant, setActiveView } = useRestaurant()

  const handleSelect = (slug: string) => {
    switchRestaurant(slug)
    window.history.pushState({}, "", `/${slug}`)
    setActiveView("store")
  }

  return (
    <div className="min-h-screen bg-[#0F1112] text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-[#181A1B] p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/30">
          <AlertCircle className="size-8" />
        </div>

        <h1 className="text-2xl font-black tracking-tight">Restaurante no encontrado</h1>
        <p className="mt-2 text-sm text-slate-400">
          El enlace{" "}
          {attemptedSlug && (
            <code className="rounded-md bg-slate-800 px-1.5 py-0.5 font-mono text-amber-400 text-xs">
              /{attemptedSlug}
            </code>
          )}{" "}
          no corresponde a ningún restaurante activo en la plataforma.
        </p>

        <div className="mt-6 border-t border-slate-800 pt-6 text-left">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            <Store className="size-3.5 text-indigo-400" />
            <span>Restaurantes Disponibles en la Plataforma:</span>
          </div>

          <div className="space-y-2.5">
            {restaurants.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelect(r.slug)}
                className="group flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-left transition-all hover:border-indigo-500/50 hover:bg-slate-800/80"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={r.config.logoUrl}
                    alt={r.config.name}
                    className="size-10 rounded-xl object-cover ring-1 ring-slate-700"
                  />
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                      {r.config.name}
                    </h4>
                    <p className="text-xs text-slate-400 line-clamp-1">{r.config.tagline}</p>
                  </div>
                </div>
                <ArrowRight className="size-4 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-indigo-400" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
