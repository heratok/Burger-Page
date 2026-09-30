import React from "react"
import { AlertCircle } from "lucide-react"

interface RestaurantNotFoundProps {
  attemptedSlug?: string
  /** True when the lookup failed transiently (network/5xx) rather than 404. */
  loadError?: boolean
  onRetry?: () => void
}

export const RestaurantNotFound: React.FC<RestaurantNotFoundProps> = ({ attemptedSlug, loadError, onRetry }) => {

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#0F1112] text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-[#181A1B] p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/30">
            <AlertCircle className="size-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">No pudimos cargar el restaurante</h1>
          <p className="mt-2 text-sm text-slate-400">
            Hubo un problema de conexión al cargar{" "}
            {attemptedSlug && (
              <code className="rounded-md bg-slate-800 px-1.5 py-0.5 font-mono text-amber-400 text-xs">
                /{attemptedSlug}
              </code>
            )}
            . Intentá de nuevo.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 rounded-2xl bg-indigo-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-400"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
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
      </div>
    </div>
  )
}
