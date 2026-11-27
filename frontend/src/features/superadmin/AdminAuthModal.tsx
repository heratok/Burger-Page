import React, { useState } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import { useAppRouter } from "@/core/router/useAppRouter"
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Eye,
  EyeOff,
  Flame,
  Boxes,
  ShoppingBag,
  Users,
  KeyRound,
  User,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface AdminAuthModalProps {
  isOpen: boolean
  onClose?: () => void
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ isOpen, onClose }) => {
  // M6: the session is written ONLY through AuthContext.login (wrapped by
  // useRestaurant().login), which performs the backend call and sets the
  // session from the REAL validated server response. The wrapper also rebuilds
  // tenant and navigation state for the new role, so this modal must not call
  // useAuth().login directly.
  const { login, refreshRestaurants } = useRestaurant()
  const { navigateTo } = useAppRouter()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  if (!isOpen) return null

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
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 lg:p-12 overflow-x-clip bg-[#0B0F19] text-slate-100 font-sans selection:bg-orange-600 selection:text-white">
      {/* Subtle static warm ambient auras (zero blur filters, zero layout cost) */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="hidden md:block absolute -top-44 -left-40 h-[560px] w-[560px]"
          style={{
            backgroundImage:
              "radial-gradient(circle at center, rgba(249,115,22,0.16) 0%, rgba(245,158,11,0.06) 45%, transparent 70%)",
          }}
        />
        <div
          className="hidden md:block absolute -bottom-44 -right-36 h-[560px] w-[560px]"
          style={{
            backgroundImage:
              "radial-gradient(circle at center, rgba(217,119,6,0.14) 0%, rgba(249,115,22,0.05) 45%, transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, #CBD5E1 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      {/* Main Split Layout */}
      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: Cohesive FoodOS Suite Overview */}
        <div className="lg:col-span-6 space-y-6 text-left hidden lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-3.5 py-1.5 text-xs font-semibold text-orange-300">
            <Sparkles className="size-3.5 text-amber-400" aria-hidden="true" />
            <span>FoodOS · Suite Operativa</span>
          </div>

          <h1 className="text-4xl xl:text-[2.85rem] font-black tracking-[-0.03em] text-white leading-[1.08]">
            Gestión Centralizada para{" "}
            <span className="text-orange-400">Restaurantes</span>
          </h1>

          <p className="text-base text-slate-300 leading-relaxed max-w-md">
            Portal administrativo privado. Controlá tus pedidos en vivo, carta digital, stock e
            insumos y base de clientes desde un solo lugar.
          </p>

          {/* Compact 2x2 Operational Highlights */}
          <div className="grid grid-cols-2 gap-3 pt-1 max-w-md">
            <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-4 transition-colors hover:border-slate-700">
              <div className="flex items-center gap-2 text-orange-400 mb-1.5">
                <ShoppingBag className="size-4 shrink-0" aria-hidden="true" />
                <span className="text-sm font-bold text-white">Pedidos en Vivo</span>
              </div>
              <p className="text-sm text-slate-400 leading-snug">
                Tablero Kanban de cocina y recepción WhatsApp.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-4 transition-colors hover:border-slate-700">
              <div className="flex items-center gap-2 text-amber-400 mb-1.5">
                <Boxes className="size-4 shrink-0" aria-hidden="true" />
                <span className="text-sm font-bold text-white">Stock & Insumos</span>
              </div>
              <p className="text-sm text-slate-400 leading-snug">
                Control de materias primas y disponibilidad al instante.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-4 transition-colors hover:border-slate-700">
              <div className="flex items-center gap-2 text-emerald-400 mb-1.5">
                <Users className="size-4 shrink-0" aria-hidden="true" />
                <span className="text-sm font-bold text-white">Clientes CRM</span>
              </div>
              <p className="text-sm text-slate-400 leading-snug">
                Historial de compras y fidelización directa.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-4 transition-colors hover:border-slate-700">
              <div className="flex items-center gap-2 text-orange-300 mb-1.5">
                <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
                <span className="text-sm font-bold text-white">Acceso Aislado</span>
              </div>
              <p className="text-sm text-slate-400 leading-snug">
                Sesiones cifradas con roles granulares por sucursal.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs font-medium text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-400" aria-hidden="true" />
              0% comisiones por venta
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-400" aria-hidden="true" />
              Multi-sucursal y roles
            </span>
          </div>
        </div>

        {/* Right Column: Sculpted Obsidian Login Card */}
        <div className="lg:col-span-6 flex justify-center">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-800/90 bg-[#0F1524] p-6 sm:p-8 shadow-[0_32px_90px_-24px_rgba(0,0,0,0.85)] animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
            {/* Subtle top ember accent hairline */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/80 to-transparent"
            />

            {/* Header */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-lg shadow-orange-950/60">
                <Flame className="size-6" aria-hidden="true" />
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-0.5 text-xs font-semibold text-orange-300 mb-2.5">
                <ShieldCheck className="size-3.5 text-orange-400" aria-hidden="true" />
                <span>Portal Administrativo</span>
              </div>

              <h2 className="text-2xl font-extrabold tracking-tight text-white">
                Iniciar Sesión
              </h2>
              <p className="text-sm text-slate-400 mt-1 max-w-xs">
                Ingresá tus credenciales para acceder al panel de gestión
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <div>
                <label
                  htmlFor="admin-auth-modal-usuario"
                  className="block text-sm font-semibold mb-1.5 text-slate-200"
                >
                  Usuario
                </label>
                <div className="relative">
                  <User
                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
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
                    className="w-full rounded-xl border border-slate-700/90 bg-slate-950/80 py-3 pl-10 pr-4 text-base sm:text-sm text-white placeholder-slate-500 transition-colors hover:border-slate-600 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/25 font-medium"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-auth-modal-contrasena-de-acceso"
                  className="block text-sm font-semibold mb-1.5 text-slate-200"
                >
                  Contraseña de Acceso
                </label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
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
                    className="w-full rounded-xl border border-slate-700/90 bg-slate-950/80 py-3 pl-10 pr-12 text-base sm:text-sm text-white placeholder-slate-500 transition-colors hover:border-slate-600 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/25 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex size-10 pointer-coarse:size-11 items-center justify-center rounded-lg text-slate-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 cursor-pointer"
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
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-300"
                  >
                    <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>Bloq Mayús está activado</span>
                  </div>
                )}

                {errorMsg && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm font-medium text-rose-300 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none"
                  >
                    <AlertCircle className="size-4 shrink-0 text-rose-400" aria-hidden="true" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>

              {/* Submit CTA Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-12 h-auto gap-2 rounded-xl bg-orange-600 hover:bg-orange-500 active:scale-[0.99] py-3 text-sm font-bold text-white shadow-lg shadow-orange-950/60 transition-all cursor-pointer disabled:opacity-70"
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

            {/* Privacy & Security Guarantee */}
            <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-slate-800/90 bg-slate-950/70 py-2.5 px-3.5 text-xs font-medium text-slate-300 text-center">
              <KeyRound className="size-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
              <span>Acceso protegido con cifrado y resolución automática de rol</span>
            </div>

            {/* Footer Navigation Link */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleReturnHome}
                className="min-h-11 px-3 rounded-lg text-sm font-medium text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                <span>Volver a la Página Principal</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
