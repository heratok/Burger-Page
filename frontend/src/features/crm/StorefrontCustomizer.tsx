import React from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import {
  THEME_COLOR_PRESETS,
  BG_THEME_OPTIONS,
} from "@/data/initialData"
import type { StoreBgTheme, CardStyle, CardRadius } from "@/types/restaurant"
import {
  Palette,
  Smartphone,
  Monitor,
  RotateCcw,
  Save,
  Eye,
  Check,
  Plus,
  ShoppingCart,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useCustomizerDraft } from "./hooks/useCustomizerDraft"
import {
  getRadiusClass,
  getCardStyleClasses,
  getBgStyle,
} from "./utils/customizerStyles"

export const StorefrontCustomizer: React.FC = () => {
  const {
    storeConfig,
    updateStoreConfig,
    resetStoreConfig,
    products,
    setActiveView,
    adminTheme,
  } = useRestaurant()

  const {
    draft,
    setDraft,
    previewDevice,
    setPreviewDevice,
    activeSection,
    setActiveSection,
    handleSave,
    handleReset,
  } = useCustomizerDraft(storeConfig, updateStoreConfig, resetStoreConfig)

  const isDark = adminTheme === "dark"
  const currentBgStyle = getBgStyle(draft.bgTheme)

  return (
    <div className="space-y-6">
      {/* Top Header Strip */}
      <div
        className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between ${
          isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <Palette className="size-5 text-indigo-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Personalizador Visual de Tienda (No-Code)
            </h2>
          </div>
          <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Modifica la apariencia, colores y experiencia de compra de tus clientes con vista previa en tiempo real.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="text-xs font-semibold"
          >
            <RotateCcw className="size-3.5 mr-1.5" />
            Restablecer
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-600/20"
          >
            <Save className="size-3.5 mr-1.5" />
            Guardar & Publicar
          </Button>
        </div>
      </div>

      {/* Editor Grid: Left Controls (1 col), Right Live Simulator (1 col) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: Controls & Settings (5 cols on lg) */}
        <div className="space-y-5 lg:col-span-5">
          {/* Section Navigation Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800 border dark:border-slate-700 text-xs font-semibold overflow-x-auto scrollbar-hide">
            <button
              type="button"
              onClick={() => setActiveSection("branding")}
              className={`flex-1 rounded-lg py-2 px-2.5 transition-all text-center whitespace-nowrap ${
                activeSection === "branding"
                  ? "bg-white text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Marca & Logo
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("colors")}
              className={`flex-1 rounded-lg py-2 px-2.5 transition-all text-center whitespace-nowrap ${
                activeSection === "colors"
                  ? "bg-white text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Colores & Fondo
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("uiux")}
              className={`flex-1 rounded-lg py-2 px-2.5 transition-all text-center whitespace-nowrap ${
                activeSection === "uiux"
                  ? "bg-white text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Diseño & Cards
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("business")}
              className={`flex-1 rounded-lg py-2 px-2.5 transition-all text-center whitespace-nowrap ${
                activeSection === "business"
                  ? "bg-white text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Contacto & Envío
            </button>
          </div>

          {/* Section 1: Branding & Identidad */}
          {activeSection === "branding" && (
            <div
              className={`rounded-2xl border p-5 shadow-xs space-y-4 text-xs ${
                isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
              }`}
            >
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Identidad Visual</h3>

              <div>
                <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                  Nombre del Restaurante
                </label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Ej. Burger Craft"
                  className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                  Slogan / Tagline
                </label>
                <input
                  type="text"
                  value={draft.tagline}
                  onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
                  placeholder="Ej. Hamburguesas artesanales de autor"
                  className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                  URL del Logo (Circular)
                </label>
                <input
                  type="url"
                  value={draft.logoUrl}
                  onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                  URL de Imagen de Portada / Banner
                </label>
                <input
                  type="url"
                  value={draft.bannerUrl}
                  onChange={(e) => setDraft({ ...draft, bannerUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <Switch
                  checked={draft.showBanner}
                  onCheckedChange={(checked) => setDraft({ ...draft, showBanner: checked })}
                  label="Mostrar Banner Hero en la Tienda"
                  description="Muestra una imagen panorámica de bienvenida en la parte superior"
                />

                <Switch
                  checked={draft.showAnnouncement}
                  onCheckedChange={(checked) => setDraft({ ...draft, showAnnouncement: checked })}
                  label="Barra de Anuncio Superior"
                  description="Franja llamativa para promociones o avisos importantes"
                />

                {draft.showAnnouncement && (
                  <div>
                    <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                      Texto del Anuncio
                    </label>
                    <input
                      type="text"
                      value={draft.announcementText}
                      onChange={(e) => setDraft({ ...draft, announcementText: e.target.value })}
                      placeholder="🔥 ¡Envío GRATIS hoy...!"
                      className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 2: Colors & Theme Engine */}
          {activeSection === "colors" && (
            <div
              className={`rounded-2xl border p-5 shadow-xs space-y-5 text-xs ${
                isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
              }`}
            >
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Color de Acento de la Tienda</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  Define el color de los botones, precios, badges y elementos destacados
                </p>

                {/* Preset Swatches */}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {THEME_COLOR_PRESETS.map((preset) => {
                    const isSelected = draft.primaryColor === preset.primary
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            primaryColor: preset.primary,
                            primaryHoverColor: preset.primaryHover,
                          })
                        }
                        className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition-all ${
                          isSelected
                            ? "border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/10"
                            : isDark
                            ? "border-slate-700 hover:border-slate-600 text-slate-200"
                            : "border-slate-200 hover:border-slate-300 text-slate-800"
                        }`}
                      >
                        <span
                          style={{ backgroundColor: preset.primary }}
                          className="flex size-6 shrink-0 items-center justify-center rounded-full text-white shadow-xs"
                        >
                          {isSelected && <Check className="size-3.5 stroke-[3]" />}
                        </span>
                        <div className="truncate">
                          <span className="font-bold block truncate">{preset.name}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Custom Hex Picker */}
                <div className="mt-3 flex items-center gap-3 rounded-xl border p-2.5 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60">
                  <input
                    type="color"
                    value={draft.primaryColor}
                    onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })}
                    className="size-8 rounded-lg cursor-pointer border-0 bg-transparent"
                  />
                  <div className="flex-1">
                    <span className="font-semibold block text-slate-800 dark:text-slate-200">
                      Color Personalizado Hex
                    </span>
                    <input
                      type="text"
                      value={draft.primaryColor}
                      onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })}
                      className="w-28 text-xs uppercase font-mono font-bold bg-transparent text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Background Theme Mode for Store */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Fondo & Contraste de la Tienda</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  Elige la atmósfera visual del menú para tus clientes
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {BG_THEME_OPTIONS.map((opt) => {
                    const isSelected = draft.bgTheme === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDraft({ ...draft, bgTheme: opt.id as StoreBgTheme })}
                        className={`flex flex-col rounded-xl border p-3 text-left transition-all ${
                          isSelected
                            ? "border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/10"
                            : isDark
                            ? "border-slate-700 hover:border-slate-600 text-slate-200"
                            : "border-slate-200 hover:border-slate-300 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{opt.name}</span>
                          <span
                            style={{ backgroundColor: opt.previewColor }}
                            className="size-4 rounded-full border border-slate-400/30"
                          />
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {opt.description}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Section 3: UI/UX & Card Styling */}
          {activeSection === "uiux" && (
            <div
              className={`rounded-2xl border p-5 shadow-xs space-y-4 text-xs ${
                isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
              }`}
            >
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Estilo de Tarjetas de Productos</h3>

              {/* Card Style Selectors */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: "elevated", name: "Sombra Elevada", desc: "Clásico y tridimensional" },
                  { id: "bordered", name: "Borde Moderno", desc: "Líneas nítidas de alto impacto" },
                  { id: "glass", name: "Cristal Glassmorphism", desc: "Translúcido y premium" },
                  { id: "minimal", name: "Minimal Plano", desc: "Limpio sin bordes pesados" },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, cardStyle: st.id as CardStyle })}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      draft.cardStyle === st.id
                        ? "border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/10 font-bold text-slate-900 dark:text-white"
                        : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span className="block font-semibold">{st.name}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{st.desc}</span>
                  </button>
                ))}
              </div>

              {/* Border Radius */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-sm mb-2 text-slate-900 dark:text-white">Redondez de Bordes</h3>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { id: "sm", name: "8px Suave" },
                    { id: "md", name: "12px Moderno" },
                    { id: "lg", name: "18px Redondo" },
                    { id: "full", name: "24px Píldora" },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, cardRadius: r.id as CardRadius })}
                      className={`rounded-xl border py-2 text-xs transition-all ${
                        draft.cardRadius === r.id
                          ? "border-indigo-600 bg-indigo-50/10 font-bold text-indigo-600 dark:text-indigo-400"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <Switch
                  checked={draft.showBadges}
                  onCheckedChange={(checked) => setDraft({ ...draft, showBadges: checked })}
                  label="Mostrar Etiquetas 'Popular' y 'Nuevo'"
                  description="Destaca los platos estrella en las tarjetas de la tienda"
                />

                <Switch
                  checked={draft.compactGrid}
                  onCheckedChange={(checked) => setDraft({ ...draft, compactGrid: checked })}
                  label="Cuadrícula Compacta"
                  description="Muestra tarjetas más densas para ver más productos a la vez"
                />
              </div>
            </div>
          )}

          {/* Section 4: Business Settings */}
          {activeSection === "business" && (
            <div
              className={`rounded-2xl border p-5 shadow-xs space-y-4 text-xs ${
                isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
              }`}
            >
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Información Comercial & WhatsApp</h3>

              <div>
                <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                  Número de WhatsApp para Pedidos (con indicativo país)
                </label>
                <input
                  type="tel"
                  value={draft.whatsappNumber}
                  onChange={(e) => setDraft({ ...draft, whatsappNumber: e.target.value })}
                  placeholder="573022575805"
                  className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Los pedidos finalizados por los clientes se enviarán formateados a este número.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                    Costo Domicilio Base ($ COP)
                  </label>
                  <input
                    type="number"
                    value={draft.deliveryFee}
                    onChange={(e) => setDraft({ ...draft, deliveryFee: Number(e.target.value) })}
                    className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                    Tiempo Estimado Entrega
                  </label>
                  <input
                    type="text"
                    value={draft.estimatedDeliveryTime}
                    onChange={(e) => setDraft({ ...draft, estimatedDeliveryTime: e.target.value })}
                    placeholder="30 - 45 min"
                    className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                  Horario de Atención
                </label>
                <input
                  type="text"
                  value={draft.openingHours}
                  onChange={(e) => setDraft({ ...draft, openingHours: e.target.value })}
                  placeholder="Mar - Dom: 12:00 PM - 10:30 PM"
                  className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                  Dirección Física del Local
                </label>
                <input
                  type="text"
                  value={draft.address}
                  onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                  placeholder="Calle 45 # 22-18"
                  className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Interactive Live Simulator Preview (7 cols on lg) */}
        <div className="space-y-3 lg:col-span-7">
          {/* Simulator Bar */}
          <div
            className={`flex items-center justify-between rounded-2xl border px-4 py-2.5 shadow-xs ${
              isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">Simulador en Tiempo Real</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800 border dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setPreviewDevice("desktop")}
                  className={`rounded-md p-1.5 text-xs ${
                    previewDevice === "desktop"
                      ? "bg-white shadow-xs text-indigo-700 dark:bg-slate-700 dark:text-white"
                      : "text-slate-400"
                  }`}
                  title="Vista Escritorio"
                >
                  <Monitor className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  className={`rounded-md p-1.5 text-xs ${
                    previewDevice === "mobile"
                      ? "bg-white shadow-xs text-indigo-700 dark:bg-slate-700 dark:text-white"
                      : "text-slate-400"
                  }`}
                  title="Vista Móvil"
                >
                  <Smartphone className="size-3.5" />
                </button>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  handleSave()
                  setActiveView("store")
                }}
                className="text-xs font-semibold"
              >
                <Eye className="size-3 mr-1" />
                Ver Tienda Real
              </Button>
            </div>
          </div>

          {/* Device Mockup Wrapper */}
          <div
            className={`mx-auto flex justify-center overflow-hidden rounded-2xl border p-2 sm:p-4 transition-all duration-300 ${
              isDark ? "border-slate-800 bg-slate-950/80" : "border-slate-200 bg-slate-100/80"
            }`}
          >
            <div
              style={{
                backgroundColor: currentBgStyle.bg,
                color: currentBgStyle.text,
                maxWidth: previewDevice === "mobile" ? "375px" : "100%",
                width: "100%",
                boxShadow: "0 20px 40px -15px rgba(0,0,0,0.3)",
              }}
              className="relative overflow-hidden rounded-2xl border border-slate-700/20 transition-all duration-200 min-h-[560px] flex flex-col"
            >
              {/* Promotional Announcement Strip */}
              {draft.showAnnouncement && (
                <div
                  style={{ backgroundColor: draft.primaryColor }}
                  className="py-1.5 px-3 text-center text-[10px] font-bold text-white tracking-wide truncate"
                >
                  {draft.announcementText}
                </div>
              )}

              {/* Simulated Store Navbar */}
              <div
                style={{ borderColor: "rgba(128,128,128,0.15)" }}
                className="flex items-center justify-between border-b px-4 py-3"
              >
                <div className="flex items-center gap-2.5">
                  {draft.logoUrl ? (
                    <img
                      src={draft.logoUrl}
                      alt="Logo"
                      className="size-8 rounded-full object-cover border"
                      style={{ borderColor: draft.primaryColor }}
                    />
                  ) : (
                    <div
                      style={{ backgroundColor: draft.primaryColor }}
                      className="flex size-8 items-center justify-center rounded-full text-white font-bold text-xs"
                    >
                      {draft.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-bold leading-tight line-clamp-1">{draft.name}</h4>
                    <p style={{ color: currentBgStyle.subText }} className="text-[10px] line-clamp-1">
                      {draft.tagline}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    style={{ borderColor: "rgba(128,128,128,0.2)" }}
                    className="relative flex size-8 items-center justify-center rounded-full border"
                  >
                    <ShoppingCart className="size-3.5" />
                    <span
                      style={{ backgroundColor: draft.primaryColor }}
                      className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    >
                      2
                    </span>
                  </div>
                </div>
              </div>

              {/* Simulated Hero Banner */}
              {draft.showBanner && draft.bannerUrl && (
                <div className="relative h-28 w-full overflow-hidden">
                  <img src={draft.bannerUrl} alt="Banner" className="size-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-3">
                    <span className="text-xs font-bold text-white">
                      {draft.tagline}
                    </span>
                  </div>
                </div>
              )}

              {/* Simulated Products Grid inside Preview */}
              <div className="p-3 sm:p-4 flex-1 space-y-3 overflow-y-auto max-h-[420px]">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold">Menú Destacado</span>
                  <span style={{ color: draft.primaryColor }} className="font-semibold text-[11px]">
                    {products.length} hamburguesas
                  </span>
                </div>

                <div
                  className={`grid gap-3 ${
                    previewDevice === "mobile" || draft.compactGrid
                      ? "grid-cols-2"
                      : "grid-cols-2 sm:grid-cols-3"
                  }`}
                >
                  {products.slice(0, 4).map((p) => {
                    const cardRadiusClass = getRadiusClass(draft.cardRadius)
                    const cardStyleClass = getCardStyleClasses(draft.cardStyle, draft.bgTheme)

                    return (
                      <div
                        key={p.id}
                        className={`overflow-hidden transition-all ${cardRadiusClass} ${cardStyleClass} flex flex-col`}
                      >
                        <div className="relative aspect-video w-full overflow-hidden bg-slate-800/20">
                          <img src={p.src} alt={p.name} className="size-full object-cover" />
                          {draft.showBadges && p.isPopular && (
                            <span
                              style={{ backgroundColor: draft.primaryColor }}
                              className="absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs"
                            >
                              Popular
                            </span>
                          )}
                        </div>

                        <div className="p-2.5 flex flex-col flex-1 justify-between gap-1.5">
                          <div>
                            <h5 className="text-[11px] font-bold leading-tight line-clamp-1">
                              {p.name}
                            </h5>
                            <p
                              style={{ color: currentBgStyle.subText }}
                              className="text-[9px] line-clamp-1"
                            >
                              {p.description}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span
                              style={{ color: draft.primaryColor }}
                              className="text-xs font-black"
                            >
                              ${p.price.toLocaleString()}
                            </span>
                            <span
                              style={{ backgroundColor: draft.primaryColor }}
                              className="flex size-6 items-center justify-center rounded-full text-white shadow-xs"
                            >
                              <Plus className="size-3.5 stroke-[3]" />
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Simulated Mobile Floating Cart */}
              <div
                style={{ borderColor: "rgba(128,128,128,0.15)" }}
                className="mt-auto border-t p-2.5 flex items-center justify-between"
              >
                <div className="text-[10px]">
                  <span style={{ color: currentBgStyle.subText }}>Total orden:</span>
                  <div style={{ color: draft.primaryColor }} className="font-bold text-xs">
                    $54.000
                  </div>
                </div>
                <button
                  type="button"
                  style={{ backgroundColor: draft.primaryColor }}
                  className="rounded-xl px-3 py-1.5 text-[11px] font-bold text-white shadow-xs"
                >
                  Ver Mi Pedido (2)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
