import { useState, useEffect } from "react"
import { useAppRouter } from "@/core/router/useAppRouter"
import {
  Sparkles,
  MessageSquare,
  TrendingUp,
  Palette,
  ShieldCheck,
  Zap,
  Users,
  QrCode,
  ShoppingBag,
  Flame,
  Sun,
  Moon,
  UtensilsCrossed,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  const { navigateTo } = useAppRouter()

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem("foodos_landing_theme")
      if (saved === "light" || saved === "dark") return saved
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        return "dark"
      }
    } catch {
      // Fallback for SSR/test environments
    }
    return "light"
  })

  useEffect(() => {
    try {
      localStorage.setItem("foodos_landing_theme", theme)
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"))
  }

  const isDark = theme === "dark"

  return (
    <div
      className={`min-h-screen font-sans antialiased overflow-x-hidden selection:bg-orange-500 selection:text-white transition-colors duration-200 ${
        isDark ? "dark bg-[#0B0F19] text-slate-100" : "bg-[#FAFAFA] text-slate-800"
      }`}
    >
      {/* Background ambient warm lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className={`absolute -top-32 left-1/2 -translate-x-1/2 h-[550px] w-[850px] rounded-full blur-[130px] transition-colors duration-500 ${
            isDark
              ? "bg-gradient-to-tr from-orange-500/10 via-amber-500/5 to-orange-600/10"
              : "bg-gradient-to-tr from-orange-400/10 via-amber-300/15 to-orange-400/10"
          }`}
        />
        <div
          className={`absolute top-[35%] right-[-10%] h-[450px] w-[550px] rounded-full blur-[140px] transition-colors duration-500 ${
            isDark ? "bg-amber-500/5" : "bg-amber-400/10"
          }`}
        />
        <div
          className={`absolute bottom-10 left-[-10%] h-[450px] w-[550px] rounded-full blur-[140px] transition-colors duration-500 ${
            isDark ? "bg-orange-600/5" : "bg-orange-500/10"
          }`}
        />
        {/* Subtle dot grid pattern */}
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            isDark ? "opacity-[0.04]" : "opacity-[0.03]"
          }`}
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, ${
              isDark ? "#94A3B8" : "#0F172A"
            } 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* ======================================================== */}
      {/* TOP PLATFORM NAVBAR                                      */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#0B0F19]/85 transition-colors">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25">
              <Flame className="size-5" />
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                FoodOS
                <span className="rounded-full bg-orange-500/10 dark:bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-600 dark:text-orange-400 border border-brand-orange-subtle">
                  SaaS
                </span>
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:block -mt-0.5">
                Menús Digitales & Pedidos WhatsApp
              </span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <a
              href="#features"
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              Beneficios
            </a>
            <a
              href="#how-it-works"
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              Cómo Funciona
            </a>
          </nav>

          {/* Action CTAs & Theme Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
              className="inline-flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-orange-500 hover:text-orange-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-orange-400 dark:hover:text-orange-400 shadow-xs transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>

            <Button
              type="button"
              variant="outline"
              onClick={() => navigateTo("/admin")}
              className="inline-flex items-center gap-1.5 rounded-xl border-slate-200 bg-white px-3 sm:px-3.5 text-xs font-bold text-slate-700 hover:border-orange-500 hover:bg-orange-50/50 hover:text-orange-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-orange-400 dark:hover:bg-slate-800 dark:hover:text-orange-400 shadow-xs cursor-pointer"
            >
              <ShieldCheck className="size-4 text-orange-500 shrink-0" />
              <span className="hidden sm:inline">Acceso Administrador</span>
              <span className="sm:hidden">Admin</span>
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* ======================================================== */}
        {/* HERO SECTION                                             */}
        {/* ======================================================== */}
        <section className="relative pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-orange-subtle bg-orange-500/10 dark:bg-orange-500/15 px-4 py-1.5 text-xs font-bold text-orange-700 dark:text-orange-300 backdrop-blur-md mb-6 shadow-xs">
              <Sparkles className="size-3.5 text-orange-500" />
              <span>La plataforma para pedidos directos sin comisiones abusivas</span>
            </div>

            {/* Main Hero Headline (Solid high-contrast text, avoiding AI gradient text tell) */}
            <h1 className="mx-auto max-w-4xl text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
              Tu Menú Digital Interactivo.{" "}
              <span className="text-orange-600 dark:text-orange-500">
                Ventas Directas por WhatsApp.
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
              Eliminá las comisiones abusivas de las apps de delivery. Permití que tus comensales armen
              su pedido con adiciones personalizadas y te lo envíen listo, estructurado y cobrado directo a tu
              WhatsApp en un clic.
            </p>

            {/* Hero CTAs */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigateTo("/admin")}
                className="flex items-center gap-2 rounded-2xl border-slate-300 bg-white px-5 py-3.5 text-sm font-bold text-slate-800 hover:bg-slate-50 hover:border-orange-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800/80 dark:hover:border-orange-500 shadow-xs cursor-pointer"
              >
                <ShieldCheck className="size-4 text-orange-500" />
                <span>Entrar al Panel Admin</span>
              </Button>
            </div>

            {/* Social Proof / Metrics Row (Intentional brand colors, no random indigo) */}
            <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto border border-slate-200/80 dark:border-slate-800/80 rounded-3xl bg-white/90 dark:bg-slate-900/80 p-6 shadow-sm backdrop-blur-md">
              <div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">0%</div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  Comisiones por venta
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">&lt; 30s</div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  Tiempo para pedir
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-orange-600 dark:text-orange-400">+45%</div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  Ticket con adiciones
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">100%</div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  Tus datos y clientes
                </div>
              </div>
            </div>

            {/* Interactive Preview Simulation (Ilustrativo) */}
            <div
              aria-hidden="true"
              className="mt-16 relative max-w-4xl mx-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 sm:p-6 shadow-2xl text-left overflow-hidden"
            >
              {/* Top Browser Bar */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-5">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-rose-400" />
                  <div className="size-3 rounded-full bg-amber-400" />
                  <div className="size-3 rounded-full bg-emerald-400" />
                  <span className="ml-2 text-xs font-mono font-medium text-slate-500 dark:text-slate-400 truncate max-w-[130px] sm:max-w-none">
                    https://foodos.app/craft-burger
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none" />
                  <span>Tienda Operando en Vivo</span>
                </div>
              </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Mockup Storefront side */}
              <div className="md:col-span-7 space-y-3">
                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-sm">
                      <UtensilsCrossed className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">Craft Monster Burger</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Doble carne 150g, cheddar fundido, tocineta
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-extrabold text-orange-600 dark:text-orange-400">$28.000</span>
                </div>

                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-sm">
                      <Flame className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">Papas Rústicas Cheddar</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Papas crocantes con salsa artesanal
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-extrabold text-orange-600 dark:text-orange-400">$12.500</span>
                </div>

                <div className="rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200/80 dark:border-orange-900/40 p-3 flex items-center justify-between text-xs text-orange-950 dark:text-orange-200 font-medium">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="size-4 text-orange-600 dark:text-orange-400" />
                    <span>Carrito de Compra: 2 productos listos</span>
                  </div>
                  <span className="font-extrabold text-orange-600 dark:text-orange-400">$40.500</span>
                </div>
              </div>

              {/* Mockup WhatsApp message preview */}
              <div className="md:col-span-5 rounded-2xl border border-emerald-200 dark:border-[#222E35] bg-[#E8F8F0] dark:bg-[#111B21] p-4 relative shadow-sm">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-[#25D366] text-xs font-bold mb-2.5">
                  <MessageSquare className="size-4 text-emerald-600 dark:text-[#25D366]" />
                  <span>Mensaje formateado en WhatsApp:</span>
                </div>
                <div className="rounded-xl bg-white dark:bg-[#202C33] border border-emerald-100 dark:border-[#2A3942] p-3 text-[11px] text-slate-800 dark:text-[#E9EDEF] font-mono space-y-1.5 leading-relaxed shadow-xs">
                  <p className="font-bold text-emerald-700 dark:text-[#25D366]">👋 ¡Hola Craft Burger! Nuevo Pedido:</p>
                  <p>• 1x Craft Monster Burger ($28.000)</p>
                  <p className="text-emerald-700 dark:text-[#25D366] text-[10px] pl-2">+ Tocineta Extra ($3.500)</p>
                  <p>• 1x Papas Rústicas ($12.500)</p>
                  <div className="border-t border-slate-100 dark:border-slate-700/60 pt-1 text-slate-900 dark:text-white font-bold">
                    Total a Pagar: $44.000
                  </div>
                  <p className="text-emerald-700 dark:text-[#25D366] text-[10px]">📍 Cra 15 # 85-30 • Pago: Efectivo</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* FEATURES / VALUE PILLARS                                 */}
      {/* ======================================================== */}
      <section id="features" className="py-20 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0B0F19] transition-colors">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Todo lo que tu restaurante necesita para vender más
            </h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 font-normal">
              Diseñado desde cero para agilizar la compra y maximizar tus ganancias netas sin intermediarios.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 p-6 hover:border-orange-300 dark:hover:border-orange-500/40 hover:bg-white dark:hover:bg-slate-900/80 hover:shadow-md transition-all">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-4">
                <MessageSquare className="size-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Checkout Directo a WhatsApp</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Tus clientes no tienen que registrarse ni descargar apps pesadas. El pedido se arma en segundos
                y te llega estructurado con dirección, método de pago y desglose total.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 p-6 hover:border-orange-300 dark:hover:border-orange-500/40 hover:bg-white dark:hover:bg-slate-900/80 hover:shadow-md transition-all">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-brand-orange-subtle mb-4">
                <TrendingUp className="size-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Adiciones y Upselling Inteligente</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Aumentá tu ganancia ofreciendo salsas, tocineta, quesos o combos antes de finalizar la
                compra. El ticket promedio sube un 45% comprobado.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 p-6 hover:border-orange-300 dark:hover:border-orange-500/40 hover:bg-white dark:hover:bg-slate-900/80 hover:shadow-md transition-all">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-4">
                <Palette className="size-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Personalización Total de Marca</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Tu tienda luce con tus colores, logotipo, banners y tipografías. Cada restaurante
                tiene su propio slug aislado y una identidad visual única.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 p-6 hover:border-orange-300 dark:hover:border-orange-500/40 hover:bg-white dark:hover:bg-slate-900/80 hover:shadow-md transition-all">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-brand-orange-subtle mb-4">
                <Zap className="size-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Gestor de Pedidos Kanban</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Controlá tus órdenes en tiempo real con alertas sonoras. Movelas fácilmente entre
                Pendiente, Cocinando, En Camino y Entregado.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 p-6 hover:border-orange-300 dark:hover:border-orange-500/40 hover:bg-white dark:hover:bg-slate-900/80 hover:shadow-md transition-all">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-4">
                <Users className="size-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">CRM y Base de Clientes</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Guardá automáticamente el historial de compras de tus comensales, segmentá clientes VIP
                y conocé quiénes son los más fieles a tu marca.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 p-6 hover:border-orange-300 dark:hover:border-orange-500/40 hover:bg-white dark:hover:bg-slate-900/80 hover:shadow-md transition-all">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-4">
                <QrCode className="size-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Menú QR para Mesas y Delivery</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Imprimí el código QR para tus mesas o pegalo en tus empaques. Tus clientes escanean y
                acceden al instante a una carta ultra rápida.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* HOW IT WORKS                                             */}
      {/* ======================================================== */}
      <section id="how-it-works" className="py-20 border-t border-slate-200/80 dark:border-slate-800/80 bg-[#FAFAFA] dark:bg-[#0D121F] transition-colors">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Empezá a vender en 3 simples pasos
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="relative rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-7 text-center shadow-xs">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 font-black text-xl border border-brand-orange-subtle mb-4">
                1
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Creá tu Menú</h3>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                Cargá tus categorías, fotos de productos, precios, ingredientes y adiciones opcionales
                desde tu panel administrativo sin código.
              </p>
            </div>

            <div className="relative rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-7 text-center shadow-xs">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-xl border border-amber-500/20 mb-4">
                2
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Compartí tu Link o QR</h3>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                Colocá tu enlace personalizado en tu biografía de Instagram, estados de WhatsApp o imprimí
                códigos QR en tus mesas y empaques.
              </p>
            </div>

            <div className="relative rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-7 text-center shadow-xs">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-xl border border-emerald-500/20 mb-4">
                3
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Recibí Pedidos Listos</h3>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                El comensal pide en segundos y a vos te entra el mensaje estructurado con todo el detalle
                para preparar y despachar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* FINAL CTA                                                */}
      {/* ======================================================== */}
      <section className="py-20 border-t border-slate-200/80 dark:border-slate-800/80 bg-[#FAFAFA] dark:bg-[#0D121F] text-center transition-colors">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-orange-200/80 dark:border-orange-900/40 bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-slate-900 dark:via-[#131926] dark:to-slate-900 p-8 sm:p-12 relative overflow-hidden shadow-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-orange-subtle bg-orange-500/10 px-3.5 py-1 text-xs font-bold text-orange-700 dark:text-orange-300 mb-4">
              <Flame className="size-3.5 text-orange-500" />
              <span>Empezá a vender hoy mismo</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">
              ¿Listo para potenciar las ventas de tu negocio?
            </h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 max-w-xl mx-auto font-normal">
              Gestioná tu catálogo, recibí pedidos en WhatsApp y tomá el control absoluto de tus clientes sin intermediarios.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                onClick={() => navigateTo("/admin")}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-orange-500/30 hover:from-orange-600 hover:to-amber-600 cursor-pointer"
              >
                <ShieldCheck className="size-4" />
                <span>Ingresar al Panel de Gestión</span>
              </Button>
            </div>
          </div>
        </div>
      </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F19] py-8 text-slate-500 dark:text-slate-400 text-xs transition-colors">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-orange-500" />
            <span className="font-black text-slate-900 dark:text-white">FoodOS</span>
            <span>— Plataforma Multi-Restaurante de Pedidos Directos</span>
          </div>

          <div className="flex items-center gap-6 font-semibold">
            <button
              type="button"
              onClick={() => navigateTo("/admin")}
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer"
            >
              Acceso Admin
            </button>
            <a
              href="#features"
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              Beneficios
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
