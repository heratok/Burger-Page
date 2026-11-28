import React, { useEffect, useState } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import { useAppRouter } from "@/core/router/useAppRouter"
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Flame,
  KeyRound,
  User,
  AlertCircle,
  Loader2,
  Check,
  Sun,
  Moon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface AdminAuthModalProps {
  isOpen: boolean
  onClose?: () => void
}

const THEME_STORAGE_KEY = "foodos_landing_theme"

const SUITE_PILLARS = [
  {
    title: "Pedidos WhatsApp y Kanban en vivo",
    description: "Recibí órdenes estructuradas y avanzá comandas sin errores.",
  },
  {
    title: "Carta digital, mesas QR y stock",
    description: "Actualizá precios, adiciones y disponibilidad en segundos.",
  },
  {
    title: "Acceso cifrado y aislado por local",
    description: "Roles granulares para caja, cocina y administración.",
  },
] as const

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ isOpen, onClose }) => {
  // M6: the session is written ONLY through AuthContext.login (wrapped by
  // useRestaurant().login), which performs the backend call and sets the
  // session from the REAL validated server response. The wrapper also rebuilds
  // tenant and navigation state for the new role, so this modal must not call
  // useAuth().login directly.
  const { login, refreshRestaurants } = useRestaurant()
  const { navigateTo } = useAppRouter()

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY)
      if (saved === "light" || saved === "dark") return saved
    } catch {
      // Fallback for restricted storage environments
    }
    return "light"
  })

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Ignore storage errors
    }
  }, [theme])

  if (!isOpen) return null

  const isDark = theme === "dark"

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"))
  }

  const handleReturnHome = () => {
    if (onClose) onClose()
    navigateTo("/")
  }

  const handlePasswordKeyEvent = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === "function") {
      setCapsLockOn(e.getModifierState("CapsLock"))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")
    setIsLoading(true)

    try {
      const result = await login(username.trim(), password.trim())

      if (result.success && result.role) {
        setUsername("")
        setPassword("")
        // Navigate BEFORE any network wait: until the URL matches the new
        // session, the router would keep resolving the previous one's path.
        navigateTo(result.landingPath ?? "/admin")
        await refreshRestaurants()
        setIsLoading(false)
        return
      }

      const errorDetail = result.error || "Credenciales incorrectas"
      setErrorMsg(errorDetail)
      toast.error(errorDetail)
    } catch {
      const connError = "Error de conexión al servidor de autenticación"
      setErrorMsg(connError)
      toast.error(connError)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className={`min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 lg:p-10 overflow-x-clip font-sans antialiased transition-colors duration-200 selection:bg-slate-900 selection:text-white dark:selection:bg-orange-700 ${
        isDark
          ? "dark bg-[#0B0F19] text-slate-100"
          : "bg-[#F5F4F0] text-slate-900"
      }`}
    >
      {/* Calm architectural dot backdrop (zero blur filters) */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className={`absolute inset-0 ${isDark ? "opacity-[0.045]" : "opacity-[0.035]"}`}
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, ${isDark ? "#CBD5E1" : "#0F172A"} 1px, transparent 0)`,
            backgroundSize: "26px 26px",
          }}
        />
      </div>

      {/* Unified Architectural Split Card */}
      <div className="relative z-10 w-full max-w-[920px] grid grid-cols-1 lg:grid-cols-12 overflow-hidden rounded-[2rem] border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111625] shadow-[0_24px_70px_-24px_rgba(15,23,42,0.16)] dark:shadow-[0_32px_90px_-24px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
        {/* Left Brand Column: Calm Warm Charcoal Panel */}
        <aside className="hidden lg:flex lg:col-span-5 relative flex-col justify-between overflow-hidden bg-slate-900 p-8 xl:p-10 text-white">
          {/* Subtle top ember hairline */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/70 to-transparent"
          />
          {/* Soft non-saturated warm corner wash */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -left-24 h-72 w-72"
            style={{
              backgroundImage:
                "radial-gradient(circle at center, rgba(234,88,12,0.14) 0%, transparent 70%)",
            }}
          />

          <div className="relative space-y-7">
            {/* Brand identity */}
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-orange-700 text-white shadow-sm">
                <Flame className="size-5" aria-hidden="true" />
              </div>
              <div>
                <span className="block text-base font-extrabold tracking-tight text-white">
                  FoodOS
                </span>
                <span className="block text-xs font-medium text-slate-200">
                  Suite Operativa
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-[1.85rem] font-black tracking-[-0.03em] leading-[1.12] text-white">
                Tu operación, en calma y{" "}
                <span className="text-orange-200">bajo control.</span>
              </h1>
              <p className="text-sm leading-relaxed text-slate-200">
                Un panel administrativo limpio para gestionar pedidos, catálogo, stock y clientes
                sin intermediarios.
              </p>
            </div>

            {/* Calm minimal pillars list */}
            <ul className="space-y-4 pt-2">
              {SUITE_PILLARS.map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-emerald-200">
                    <Check className="size-3" aria-hidden="true" />
                  </span>
                  <div>
                    <span className="block text-sm font-semibold text-white">
                      {item.title}
                    </span>
                    <span className="block text-xs leading-relaxed text-slate-200 mt-0.5">
                      {item.description}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative pt-8 mt-8 border-t border-slate-800 flex items-center justify-between text-xs font-medium text-slate-200">
            <span>0% comisiones por venta</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-200">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Multi-sucursal
            </span>
          </div>
        </aside>

        {/* Right Form Column: Clean, Low-Saturation Workspace */}
        <div className="lg:col-span-7 flex flex-col justify-between p-6 sm:p-8 lg:p-10">
          {/* Top Utility Bar */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleReturnHome}
              className="min-h-11 -ml-2 px-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-950 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80 transition-colors inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span>Volver a la Página Principal</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
            >
              {isDark ? (
                <Sun className="size-4" aria-hidden="true" />
              ) : (
                <Moon className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Form Body */}
          <div className="my-auto py-6 sm:py-8 max-w-md w-full mx-auto">
            {/* Compact Mobile Brand Identity */}
            <div className="flex items-center gap-2.5 mb-6 lg:hidden">
              <div className="flex size-9 items-center justify-center rounded-xl bg-orange-700 text-white">
                <Flame className="size-5" aria-hidden="true" />
              </div>
              <span className="text-base font-extrabold tracking-tight text-slate-950 dark:text-white">
                FoodOS
              </span>
              <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                Portal Admin
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
                <ShieldCheck className="size-3.5 text-orange-700 dark:text-orange-400" aria-hidden="true" />
                <span>Portal Administrativo</span>
              </div>
              <h2 className="text-2xl sm:text-[1.75rem] font-extrabold tracking-tight text-slate-950 dark:text-white">
                Iniciar Sesión
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Ingresá tus credenciales para acceder al panel de gestión.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div>
                <label
                  htmlFor="admin-auth-modal-usuario"
                  className="block text-sm font-semibold mb-1.5 text-slate-800 dark:text-slate-200"
                >
                  Usuario
                </label>
                <div className="relative">
                  <User
                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="admin-auth-modal-usuario"
                    type="text"
                    required
                    autoFocus
                    autoComplete="username"
                    maxLength={50}
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      setErrorMsg("")
                    }}
                    placeholder="Tu nombre de usuario"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/80 py-3 pl-10 pr-4 text-base sm:text-sm text-slate-950 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-500 transition-colors hover:border-slate-400 dark:hover:border-slate-600 focus:border-slate-900 dark:focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-orange-400/20 font-medium"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-auth-modal-contrasena-de-acceso"
                  className="block text-sm font-semibold mb-1.5 text-slate-800 dark:text-slate-200"
                >
                  Contraseña de Acceso
                </label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="admin-auth-modal-contrasena-de-acceso"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    maxLength={100}
                    value={password}
                    onKeyUp={handlePasswordKeyEvent}
                    onKeyDown={handlePasswordKeyEvent}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setErrorMsg("")
                    }}
                    placeholder="Ingresá tu contraseña"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/80 py-3 pl-10 pr-12 text-base sm:text-sm text-slate-950 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-500 transition-colors hover:border-slate-400 dark:hover:border-slate-600 focus:border-slate-900 dark:focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-orange-400/20 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex size-10 pointer-coarse:size-11 items-center justify-center rounded-lg text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 cursor-pointer"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>

                {capsLockOn && (
                  <div
                    role="status"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300"
                  >
                    <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>Bloq Mayús está activado</span>
                  </div>
                )}

                {errorMsg && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="mt-3 rounded-xl border border-rose-300 dark:border-rose-500/35 bg-rose-50 dark:bg-rose-950/60 px-3.5 py-2.5 text-sm font-medium text-rose-800 dark:text-rose-200 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none"
                  >
                    <AlertCircle className="size-4 shrink-0 text-rose-700 dark:text-rose-300" aria-hidden="true" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>

              {/* Calm, High-Contrast Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-12 h-auto gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-orange-700 dark:hover:bg-orange-600 active:scale-[0.99] py-3 text-sm font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-70"
              >
                {isLoading ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <span>Acceder al Panel</span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Calm Footer Security Assurance */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 text-center">
            <KeyRound
              className="size-3.5 text-emerald-700 dark:text-emerald-400 shrink-0"
              aria-hidden="true"
            />
            <span>Acceso protegido con cifrado y resolución automática de rol</span>
          </div>
        </div>
      </div>
    </div>
  )
}
