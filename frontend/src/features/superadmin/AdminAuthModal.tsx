import React, { useState } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import { useAppRouter } from "@/core/router/useAppRouter"
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  Sparkles,
  Eye,
  EyeOff,
  Flame,
  Boxes,
  ShoppingBag,
  Users,
  KeyRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface AdminAuthModalProps {
  isOpen: boolean
  onClose?: () => void
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ isOpen, onClose }) => {
  const { login } = useRestaurant()
  const { navigateTo } = useAppRouter()

  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  if (!isOpen) return null

  const handleReturnHome = () => {
    if (onClose) onClose()
    navigateTo("/")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")
    setIsLoading(true)

    const result = login(password)

    if (!result.success) {
      setErrorMsg(result.error || "Contraseña incorrecta. Verifica tu clave de acceso.")
      setIsLoading(false)
    } else {
      setPassword("")
      setIsLoading(false)
      if (window.location.pathname.startsWith("/admin")) {
        navigateTo(window.location.pathname)
      } else {
        navigateTo("/admin")
      }
    }
  }

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 lg:p-12 overflow-x-hidden bg-gradient-to-br from-[#0A0E1A] via-[#0F172A] to-[#131127] text-slate-100 font-sans">
      {/* ======================================================== */}
      {/* VIBRANT LUMINOUS AURORA LIGHTS                           */}
      {/* ======================================================== */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Top left vibrant cyan/indigo aura */}
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-indigo-500/25 via-cyan-500/20 to-transparent blur-[140px]" />
        {/* Center warm amber/orange aura */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[700px] rounded-full bg-gradient-to-r from-orange-500/15 via-rose-500/15 to-indigo-600/15 blur-[160px]" />
        {/* Bottom right purple aura */}
        <div className="absolute -bottom-40 -right-40 h-[650px] w-[650px] rounded-full bg-gradient-to-tl from-purple-600/25 via-violet-500/20 to-transparent blur-[140px]" />

        {/* Ambient Subtle Tech Grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #CBD5E1 1px, transparent 0)`,
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      {/* ======================================================== */}
      {/* SPLIT HERO CONTAINER                                     */}
      {/* ======================================================== */}
      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* ======================================================== */}
        {/* LEFT COLUMN: PLATFORM VALUE PROPOSITION                  */}
        {/* ======================================================== */}
        <div className="lg:col-span-6 space-y-6 text-left hidden sm:block">
          {/* Brand pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-semibold text-indigo-300 backdrop-blur-md shadow-sm">
            <Sparkles className="size-3.5 text-amber-400 animate-pulse" />
            <span>FoodOS • Suite Operativa</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
            Gestión Centralizada para{" "}
            <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">
              Restaurantes
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-md">
            Portal administrativo seguro y privado. Accedé al control de pedidos en vivo, catálogo de productos, control de stock e insumos y clientes.
          </p>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2 max-w-md">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3.5 backdrop-blur-md">
              <div className="flex items-center gap-2 text-orange-400 mb-1">
                <ShoppingBag className="size-4" />
                <span className="text-xs font-bold text-white">Pedidos en Vivo</span>
              </div>
              <p className="text-[11px] text-slate-400">Flujo Kanban de cocina y recepción WhatsApp.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3.5 backdrop-blur-md">
              <div className="flex items-center gap-2 text-indigo-400 mb-1">
                <Boxes className="size-4" />
                <span className="text-xs font-bold text-white">Stock & Insumos</span>
              </div>
              <p className="text-[11px] text-slate-400">Control de materias primas y proveedores.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3.5 backdrop-blur-md">
              <div className="flex items-center gap-2 text-emerald-400 mb-1">
                <Users className="size-4" />
                <span className="text-xs font-bold text-white">Clientes CRM</span>
              </div>
              <p className="text-[11px] text-slate-400">Base de clientes y fidelización directa.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3.5 backdrop-blur-md">
              <div className="flex items-center gap-2 text-amber-400 mb-1">
                <ShieldCheck className="size-4" />
                <span className="text-xs font-bold text-white">Cifrado Seguro</span>
              </div>
              <p className="text-[11px] text-slate-400">Acceso autenticado y aislado por tenant.</p>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: CLEAN ZERO-KNOWLEDGE LOGIN CARD             */}
        {/* ======================================================== */}
        <div className="lg:col-span-6 flex justify-center">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900/85 p-6 sm:p-8 shadow-2xl shadow-indigo-950/80 backdrop-blur-2xl transition-all">
            {/* Header */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-500 via-indigo-600 to-violet-600 p-0.5 shadow-lg shadow-indigo-600/30">
                <div className="flex size-full items-center justify-center rounded-[14px] bg-slate-900 text-white">
                  <Flame className="size-7 text-orange-400" />
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-0.5 text-[10px] font-bold text-indigo-300 mb-2">
                <ShieldCheck className="size-3 text-indigo-400" />
                <span>Portal Administrativo</span>
              </div>

              <h2 className="text-xl font-extrabold tracking-tight text-white">
                Iniciar Sesión
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Ingresá tu contraseña para acceder a tu panel de administración
              </p>
            </div>

            {/* Zero-Knowledge Universal Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-slate-300">
                  Contraseña de Acceso
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoFocus
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setErrorMsg("")
                    }}
                    placeholder="Ingresá tu clave de administración..."
                    className="w-full rounded-2xl border border-slate-700/80 bg-slate-800/90 py-3 pl-10 pr-11 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>

                {errorMsg && (
                  <div className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-400 flex items-center gap-2 animate-in fade-in">
                    <span>⚠️ {errorMsg}</span>
                  </div>
                )}
              </div>

              {/* Submit CTA Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 py-3 text-xs font-bold text-white shadow-xl shadow-indigo-600/25 hover:from-indigo-700 hover:to-violet-700 transition-all cursor-pointer"
              >
                <span>{isLoading ? "Verificando..." : "Acceder al Panel"}</span>
                <ArrowRight className="size-4" />
              </Button>
            </form>

            {/* Privacy & Security Guarantee */}
            <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-slate-950/40 py-2.5 px-3 text-[11px] text-slate-400 text-center">
              <KeyRound className="size-3.5 text-indigo-400 shrink-0" />
              <span>Acceso protegido con cifrado y resolución automática de rol</span>
            </div>

            {/* Footer Navigation Link */}
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={handleReturnHome}
                className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>← Volver a la Página Principal</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
