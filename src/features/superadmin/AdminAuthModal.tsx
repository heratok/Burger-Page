import React, { useState } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import { ShieldCheck, Lock, ArrowRight, Store, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AdminAuthModalProps {
  isOpen: boolean
  onClose?: () => void
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ isOpen, onClose }) => {
  const { login, activeRestaurant, adminTheme } = useRestaurant()
  const [password, setPassword] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  const isDark = adminTheme === "dark"

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")
    const result = login(password, activeRestaurant.id)
    if (!result.success) {
      setErrorMsg(result.error || "Contraseña incorrecta")
    } else {
      setPassword("")
      if (onClose) onClose()
    }
  }

  const fillQuickPassword = (pwd: string) => {
    setPassword(pwd)
    setErrorMsg("")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div
        className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
          isDark ? "border-slate-800 bg-[#0E1322] text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-600/30">
            <ShieldCheck className="size-6" />
          </div>
          <h2 className="text-lg font-bold tracking-tight">Acceso a Panel Administrativo</h2>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Store className="size-3.5 text-indigo-500" />
            <span>Local actual: <strong>{activeRestaurant.config.name}</strong></span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Contraseña de Administración
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setErrorMsg("")
                }}
                placeholder="Ingresa tu clave de acceso..."
                className={`w-full rounded-xl border pl-9 pr-4 py-2.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDark
                    ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                    : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400"
                }`}
              />
            </div>
            {errorMsg && (
              <p className="mt-1.5 text-xs text-rose-500 font-medium">{errorMsg}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full gap-2 rounded-xl bg-indigo-600 py-2.5 font-bold text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-700"
          >
            <span>Ingresar al CRM</span>
            <ArrowRight className="size-4" />
          </Button>
        </form>

        {/* Demo Credentials Helper */}
        <div className="mt-5 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3.5 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400 mb-2">
            <Sparkles className="size-3.5" />
            <span>Accesos Rápidos de Demostración:</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fillQuickPassword("admin")}
              className="flex items-center justify-between rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20"
            >
              <span>👑 Super Admin</span>
              <code className="rounded bg-indigo-500/20 px-1 font-mono text-[10px]">admin</code>
            </button>
            <button
              type="button"
              onClick={() => fillQuickPassword(activeRestaurant.adminPassword || "craft")}
              className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <span>🍔 Local Actual</span>
              <code className="rounded bg-slate-200 dark:bg-slate-700 px-1 font-mono text-[10px]">
                {activeRestaurant.adminPassword || "craft"}
              </code>
            </button>
          </div>
        </div>

        {/* Close Button if applicable */}
        {onClose && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Volver a la Tienda de Ventas
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
