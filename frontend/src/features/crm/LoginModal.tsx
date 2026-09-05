import React, { useState, useRef, useEffect } from "react"
import { Lock, Eye, EyeOff, Loader2, User } from "lucide-react"
import { useRestaurant } from "@/context/RestaurantContext"
import { apiClient } from "@/core/api/apiClient"
import { toast } from "sonner"

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  targetRestaurantIdOrSlug?: string
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  targetRestaurantIdOrSlug,
}) => {
  const { login, setSession } = useRestaurant()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const usernameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setUsername("")
      setPassword("")
      setError("")
      setTimeout(() => usernameRef.current?.focus(), 100)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return

    setIsLoading(true)
    setError("")

    try {
      const result = await apiClient.login(username.trim(), password.trim())

      if (result.success && result.user) {
        const isSuper = result.user.role === 'super_admin'
        const role = isSuper ? ('super' as const) : ('restaurant' as const)
        setSession({
          role,
          restaurantId: result.user.restaurantId || (typeof targetRestaurantIdOrSlug === 'string' ? targetRestaurantIdOrSlug : undefined),
          authenticatedAt: new Date().toISOString(),
        })

        if (role === 'super') {
          toast.success(`Bienvenido, ${result.user.username}`)
        } else {
          toast.success(`Bienvenido al panel de administración`)
        }
        onClose()
      } else {
        setError(result.error || "Credenciales incorrectas")
      }
    } catch {
      // Fallback to legacy password-only login for backwards compatibility
      const legacyResult = login(password.trim(), targetRestaurantIdOrSlug)
      if (legacyResult.success) {
        onClose()
      } else {
        setError(legacyResult.error || "Credenciales incorrectas")
      }
    }

    setIsLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-[#0E1322] p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-600/30">
            <Lock className="size-7 text-white" />
          </div>
          <h2 className="text-lg font-bold text-white">Panel de Administración</h2>
          <p className="mt-1 text-xs text-slate-400">
            Ingresa tus credenciales para acceder
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Username */}
          <div className="relative">
            <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <input
              ref={usernameRef}
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setError("")
              }}
              placeholder="Usuario"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError("")
              }}
              placeholder="Contraseña"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-10 pr-10 py-3 text-sm text-white placeholder-slate-500 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-800/50 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !username.trim() || !password.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition-all hover:shadow-indigo-600/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Verificando...</span>
              </>
            ) : (
              <span>Acceder al Panel</span>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl px-4 py-2 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
          >
            Cancelar
          </button>
        </form>
      </div>
    </div>
  )
}
