import { useRestaurant } from "@/context/RestaurantContext"
import { useAppRouter } from "@/core/router/useAppRouter"
import {
  Sparkles,
  ArrowRight,
  MessageSquare,
  Store,
  TrendingUp,
  Palette,
  ShieldCheck,
  Zap,
  Users,
  QrCode,
  ExternalLink,
  ShoppingBag,
  Flame,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  const { restaurants } = useRestaurant()
  const { navigateTo } = useAppRouter()

  const scrollToDemos = () => {
    const el = document.getElementById("demo-stores")
    if (el) {
      el.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-800 selection:bg-orange-500 selection:text-white font-sans antialiased overflow-x-hidden">
      {/* Background ambient warm lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[550px] w-[850px] rounded-full bg-gradient-to-tr from-orange-400/10 via-amber-300/15 to-indigo-400/10 blur-[130px]" />
        <div className="absolute top-[35%] right-[-10%] h-[450px] w-[550px] rounded-full bg-amber-400/10 blur-[140px]" />
        <div className="absolute bottom-10 left-[-10%] h-[450px] w-[550px] rounded-full bg-orange-500/10 blur-[140px]" />
        {/* Subtle dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #0F172A 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* ======================================================== */}
      {/* TOP PLATFORM NAVBAR                                      */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md transition-colors">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25">
              <Flame className="size-5" />
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-slate-900 flex items-center gap-1.5">
                FoodOS
                <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-600 border border-orange-500/20">
                  SaaS
                </span>
              </span>
              <span className="text-[11px] font-medium text-slate-500 block -mt-0.5">
                Menús Digitales & Pedidos WhatsApp
              </span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-600">
            <a href="#features" className="hover:text-orange-600 transition-colors">
              Beneficios
            </a>
            <a href="#how-it-works" className="hover:text-orange-600 transition-colors">
              Cómo Funciona
            </a>
            <button
              type="button"
              onClick={scrollToDemos}
              className="hover:text-orange-600 transition-colors cursor-pointer"
            >
              Restaurantes Demo
            </button>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigateTo("/admin")}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-orange-500 hover:bg-orange-50/50 hover:text-orange-600 shadow-xs"
            >
              <ShieldCheck className="size-4 text-orange-500" />
              <span>Acceso Administrador</span>
            </Button>

            <Button
              type="button"
              onClick={scrollToDemos}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-orange-500/25 hover:from-orange-600 hover:to-amber-600 cursor-pointer"
            >
              <span>Ver Demos</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* HERO SECTION                                             */}
      {/* ======================================================== */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-xs font-bold text-orange-700 backdrop-blur-md mb-6 shadow-xs">
            <Sparkles className="size-3.5 text-orange-500" />
            <span>La plataforma #1 para pedidos directos sin 30% de comisiones</span>
          </div>

          {/* Main Hero Headline */}
          <h1 className="mx-auto max-w-4xl text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-tight">
            Tu Menú Digital Interactivo.{" "}
            <span className="bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 bg-clip-text text-transparent">
              Ventas Directas por WhatsApp.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
            Eliminá las comisiones abusivas de las apps de delivery. Permití que tus comensales armen
            su pedido con adiciones personalizadas y te lo envíen listo, estructurado y cobrado directo a tu
            WhatsApp en un clic.
          </p>

          {/* Hero CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              onClick={scrollToDemos}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-orange-500/30 hover:from-orange-600 hover:to-amber-600 cursor-pointer"
            >
              <Store className="size-4" />
              <span>Probar Restaurantes Demo</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => navigateTo("/admin")}
              className="flex items-center gap-2 rounded-2xl border-slate-300 bg-white px-5 py-3.5 text-sm font-bold text-slate-800 hover:bg-slate-50 hover:border-orange-400 shadow-xs cursor-pointer"
            >
              <ShieldCheck className="size-4 text-orange-500" />
              <span>Entrar al Panel Admin</span>
            </Button>
          </div>

          {/* Social Proof / Metrics Row */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto border border-slate-200/80 rounded-3xl bg-white/90 p-6 shadow-sm backdrop-blur-md">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">0%</div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">Comisiones por venta</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600">&lt; 30s</div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">Tiempo para pedir</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-orange-500">+45%</div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">Ticket con adiciones</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-indigo-600">100%</div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">Tus datos y clientes</div>
            </div>
          </div>

          {/* Interactive Preview Simulation (High-converting Light Mockup) */}
          <div className="mt-16 relative max-w-4xl mx-auto rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-2xl text-left overflow-hidden">
            {/* Top Browser Bar */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-rose-400" />
                <div className="size-3 rounded-full bg-amber-400" />
                <div className="size-3 rounded-full bg-emerald-400" />
                <span className="ml-2 text-xs font-mono font-medium text-slate-500">
                  https://foodos.app/craft-burger
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Tienda Operando en Vivo</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Mockup Storefront side */}
              <div className="md:col-span-7 space-y-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-2xl bg-orange-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                      🍔
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">Craft Monster Burger</h3>
                      <p className="text-xs text-slate-500">Doble carne 150g, cheddar fundido, tocineta</p>
                    </div>
                  </div>
                  <span className="text-sm font-extrabold text-orange-600">$28.000</span>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-2xl bg-amber-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                      🍟
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">Papas Rústicas Cheddar</h3>
                      <p className="text-xs text-slate-500">Papas crocantes con salsa artesanal</p>
                    </div>
                  </div>
                  <span className="text-sm font-extrabold text-orange-600">$12.500</span>
                </div>

                <div className="rounded-2xl bg-orange-50/80 border border-orange-200/80 p-3 flex items-center justify-between text-xs text-orange-950 font-medium">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="size-4 text-orange-600" />
                    <span>Carrito de Compra: 2 productos listos</span>
                  </div>
                  <span className="font-extrabold text-orange-600">$40.500</span>
                </div>
              </div>

              {/* Mockup WhatsApp message preview */}
              <div className="md:col-span-5 rounded-2xl border border-emerald-200 bg-[#E8F8F0] p-4 relative shadow-sm">
                <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold mb-2.5">
                  <MessageSquare className="size-4 text-emerald-600" />
                  <span>Mensaje formateado en WhatsApp:</span>
                </div>
                <div className="rounded-xl bg-white border border-emerald-100 p-3 text-[11px] text-slate-800 font-mono space-y-1.5 leading-relaxed shadow-xs">
                  <p className="font-bold text-emerald-700">👋 ¡Hola Craft Burger! Nuevo Pedido:</p>
                  <p>• 1x Craft Monster Burger ($28.000)</p>
                  <p className="text-emerald-600 text-[10px] pl-2">+ Tocineta Extra ($3.500)</p>
                  <p>• 1x Papas Rústicas ($12.500)</p>
                  <div className="border-t border-slate-100 pt-1 text-slate-900 font-bold">
                    Total a Pagar: $44.000
                  </div>
                  <p className="text-emerald-700 text-[10px]">📍 Cra 15 # 85-30 • Pago: Efectivo</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* FEATURES / VALUE PILLARS                                 */}
      {/* ======================================================== */}
      <section id="features" className="py-20 border-t border-slate-200/80 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-orange-600">
              Ventajas Comerciales
            </span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-900">
              Todo lo que tu restaurante necesita para vender más
            </h2>
            <p className="mt-3 text-sm text-slate-600 font-normal">
              Diseñado desde cero para agilizar la compra y maximizar tus ganancias netas sin intermediarios.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="rounded-3xl border border-slate-200/80 bg-slate-50/50 p-6 hover:border-orange-300 hover:bg-white hover:shadow-md transition-all">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 mb-4">
                <MessageSquare className="size-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Checkout Directo a WhatsApp</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Tus clientes no tienen que registrarse ni descargar apps pesadas. El pedido se arma en segundos
                y te llega estructurado con dirección, método de pago y desglose total.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-3xl border border-slate-200/80 bg-slate-50/50 p-6 hover:border-orange-300 hover:bg-white hover:shadow-md transition-all">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 border border-orange-500/20 mb-4">
                <TrendingUp className="size-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Adiciones y Upselling Inteligente</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Aumentá tu ganancia ofreciendo salsas, tocineta, quesos o combos antes de finalizar la
                compra. El ticket promedio sube un 45% comprobado.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-3xl border border-slate-200/80 bg-slate-50/50 p-6 hover:border-orange-300 hover:bg-white hover:shadow-md transition-all">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 mb-4">
                <Palette className="size-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Personalización Total de Marca</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Tu tienda luce con tus colores, logotipo, banners y tipografías. Cada restaurante
                tiene su propio slug aislado y una identidad visual única.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-3xl border border-slate-200/80 bg-slate-50/50 p-6 hover:border-orange-300 hover:bg-white hover:shadow-md transition-all">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 mb-4">
                <Zap className="size-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Gestor de Pedidos Kanban</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Controlá tus órdenes en tiempo real con alertas sonoras. Movelas fácilmente entre
                Pendiente, Cocinando, En Camino y Entregado.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="rounded-3xl border border-slate-200/80 bg-slate-50/50 p-6 hover:border-orange-300 hover:bg-white hover:shadow-md transition-all">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 border border-violet-500/20 mb-4">
                <Users className="size-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">CRM y Base de Clientes</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Guardá automáticamente el historial de compras de tus comensales, segmentá clientes VIP
                y conocé quiénes son los más fieles a tu marca.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="rounded-3xl border border-slate-200/80 bg-slate-50/50 p-6 hover:border-orange-300 hover:bg-white hover:shadow-md transition-all">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 border border-cyan-500/20 mb-4">
                <QrCode className="size-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Menú QR para Mesas y Delivery</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
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
      <section id="how-it-works" className="py-20 border-t border-slate-200/80 bg-[#FAFAFA]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-orange-600">
              Paso a Paso
            </span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-900">
              Empezá a vender en 3 simples pasos
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="relative rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xs">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 font-black text-xl border border-orange-500/20 mb-4">
                1
              </div>
              <h3 className="text-base font-bold text-slate-900">Creá tu Menú</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed font-normal">
                Cargá tus categorías, fotos de productos, precios, ingredientes y adiciones opcionales
                desde tu panel administrativo sin código.
              </p>
            </div>

            <div className="relative rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xs">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 font-black text-xl border border-amber-500/20 mb-4">
                2
              </div>
              <h3 className="text-base font-bold text-slate-900">Compartí tu Link o QR</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed font-normal">
                Colocá tu enlace personalizado en tu biografía de Instagram, estados de WhatsApp o imprimí
                códigos QR en tus mesas y empaques.
              </p>
            </div>

            <div className="relative rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xs">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 font-black text-xl border border-emerald-500/20 mb-4">
                3
              </div>
              <h3 className="text-base font-bold text-slate-900">Recibí Pedidos Listos</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed font-normal">
                El comensal pide en segundos y a vos te entra el mensaje estructurado con todo el detalle
                para preparar y despachar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* LIVE DEMO RESTAURANTS SHOWCASE                           */}
      {/* ======================================================== */}
      <section id="demo-stores" className="py-20 border-t border-slate-200/80 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">
              Tiendas en Vivo
            </span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-900">
              Explorá nuestros restaurantes de prueba
            </h2>
            <p className="mt-3 text-sm text-slate-600 font-normal">
              Hacé clic en cualquiera de las tiendas para experimentar cómo vive la compra tu cliente final.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {restaurants.map((restaurant) => (
              <div
                key={restaurant.id}
                className="group relative flex flex-col justify-between rounded-3xl border border-slate-200 bg-slate-50/50 p-6 transition-all duration-200 hover:-translate-y-1 hover:border-orange-300 hover:bg-white hover:shadow-xl"
              >
                <div>
                  {/* Restaurant Header */}
                  <div className="flex items-center gap-3 mb-4">
                    {restaurant.config.logoUrl ? (
                      <img
                        src={restaurant.config.logoUrl}
                        alt={restaurant.config.name}
                        className="size-12 rounded-2xl object-cover border border-slate-200 shadow-xs"
                      />
                    ) : (
                      <div
                        style={{ backgroundColor: restaurant.config.primaryColor }}
                        className="flex size-12 items-center justify-center rounded-2xl text-white font-bold text-lg shadow-sm"
                      >
                        {restaurant.config.name.charAt(0)}
                      </div>
                    )}

                    <div className="truncate">
                      <h3 className="font-bold text-base text-slate-900 group-hover:text-orange-600 transition-colors truncate">
                        {restaurant.config.name}
                      </h3>
                      <span className="text-xs text-slate-500 font-mono">
                        /{restaurant.slug}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 mb-4 leading-relaxed font-normal">
                    {restaurant.config.tagline || "Menú digital para delivery y pedidos en línea."}
                  </p>

                  <div className="flex items-center gap-2.5 text-[11px] text-slate-500 mb-6">
                    <span className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 font-semibold text-slate-700 shadow-2xs">
                      🍽️ {restaurant.products.length} platos
                    </span>
                    <span className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 font-semibold text-slate-700 shadow-2xs">
                      🛵 {restaurant.config.estimatedDeliveryTime || "30-45 min"}
                    </span>
                  </div>
                </div>

                {/* Open Storefront Button */}
                <Button
                  type="button"
                  onClick={() => navigateTo(`/${restaurant.slug}`)}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-bold text-white shadow-md transition-all hover:opacity-90 cursor-pointer"
                  style={{ backgroundColor: restaurant.config.primaryColor || "#FF7A21" }}
                >
                  <span>Ver Tienda /{restaurant.slug}</span>
                  <ExternalLink className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* FINAL CTA                                                */}
      {/* ======================================================== */}
      <section className="py-20 border-t border-slate-200/80 bg-[#FAFAFA] text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-8 sm:p-12 relative overflow-hidden shadow-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3.5 py-1 text-xs font-bold text-orange-700 mb-4">
              <Flame className="size-3.5 text-orange-500" />
              <span>Empezá a vender hoy mismo</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-black text-slate-900">
              ¿Listo para potenciar las ventas de tu negocio?
            </h2>
            <p className="mt-3 text-sm text-slate-600 max-w-xl mx-auto font-normal">
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

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-slate-500 text-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-orange-500" />
            <span className="font-black text-slate-900">FoodOS</span>
            <span>— Plataforma Multi-Restaurante de Pedidos Directos</span>
          </div>

          <div className="flex items-center gap-6 font-semibold">
            <button
              type="button"
              onClick={() => navigateTo("/admin")}
              className="hover:text-orange-600 transition-colors cursor-pointer"
            >
              Acceso Admin
            </button>
            <a href="#features" className="hover:text-orange-600 transition-colors">
              Beneficios
            </a>
            <button
              type="button"
              onClick={scrollToDemos}
              className="hover:text-orange-600 transition-colors cursor-pointer"
            >
              Tiendas Demo
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
