import React, { useRef } from "react"
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
  Pipette,
  Upload,
  Sparkles,
  Type,
  DollarSign,
  ImageIcon,
  Trash2,
  Sliders,
  Store,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { optimizeImageToWebP } from "@/lib/imageOptimizer"
import { uploadImageToStorage } from "@/core/storage/supabaseStorage"
import { LazyImage } from "@/components/ui/LazyImage"
import { useCustomizerDraft } from "./hooks/useCustomizerDraft"
import {
  getRadiusClass,
  getCardStyleClasses,
  getBgStyle,
  getFontFamilyClass,
  FULL_THEME_TEMPLATES,
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
  const logoInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "logoUrl" | "bannerUrl"
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      toast.error("La imagen original debe ser menor a 10MB")
      return
    }

    try {
      const isLogo = field === "logoUrl"
      const optimizedWebP = await optimizeImageToWebP(file, {
        maxWidth: isLogo ? 400 : 1200,
        maxHeight: isLogo ? 400 : 600,
        quality: isLogo ? 0.85 : 0.82,
      })

      const finalUrl = await uploadImageToStorage(optimizedWebP, {
        restaurantId: activeRestaurant?.id || "default",
        folder: "branding",
        filename: isLogo ? "logo" : "banner",
        bucketName: "image",
      })

      setDraft((prev) => ({ ...prev, [field]: finalUrl }))
      toast.success(isLogo ? "Logo optimizado y cargado en WebP" : "Foto de portada optimizada en WebP")
    } catch (err: any) {
      console.error("Image optimization failed:", err)
      toast.error("No se pudo procesar la imagen seleccionada")
    } finally {
      // Clear input value so same file can be re-selected if needed
      e.target.value = ""
    }
  }

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
          {/* Section Navigation Tabs (Grid 5 cols for flawless responsive fit) */}
          <div className="grid grid-cols-5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 border dark:border-slate-700 text-xs font-semibold gap-1">
            <button
              type="button"
              onClick={() => setActiveSection("templates")}
              className={`rounded-lg py-2 px-1 transition-all text-center flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                activeSection === "templates"
                  ? "bg-white text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-white font-bold"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Sparkles className="size-3.5 text-amber-500 shrink-0" />
              <span className="truncate">Estilos</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("branding")}
              className={`rounded-lg py-2 px-1 transition-all text-center flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                activeSection === "branding"
                  ? "bg-white text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-white font-bold"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <ImageIcon className="size-3.5 text-indigo-500 shrink-0" />
              <span className="truncate">Marca</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("colors")}
              className={`rounded-lg py-2 px-1 transition-all text-center flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                activeSection === "colors"
                  ? "bg-white text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-white font-bold"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Palette className="size-3.5 text-rose-500 shrink-0" />
              <span className="truncate">Colores</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("uiux")}
              className={`rounded-lg py-2 px-1 transition-all text-center flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                activeSection === "uiux"
                  ? "bg-white text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-white font-bold"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Sliders className="size-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">Diseño</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("business")}
              className={`rounded-lg py-2 px-1 transition-all text-center flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                activeSection === "business"
                  ? "bg-white text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-white font-bold"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <DollarSign className="size-3.5 text-amber-500 shrink-0" />
              <span className="truncate">Pedidos</span>
            </button>
          </div>

          {/* Section 0: 1-Click Complete Theme Presets */}
          {activeSection === "templates" && (
            <div
              className={`rounded-2xl border p-5 shadow-xs space-y-4 text-xs ${
                isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-amber-500" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Estilos Listos en 1 Clic
                  </h3>
                </div>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  Aplica una combinación profesional de colores, fondo, tarjetas y tipografía con un solo toque.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {FULL_THEME_TEMPLATES.map((tpl) => {
                  const isMatching =
                    draft.bgTheme === tpl.bgTheme &&
                    draft.primaryColor === tpl.primaryColor &&
                    draft.cardStyle === tpl.cardStyle &&
                    draft.fontFamily === tpl.fontFamily

                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          primaryColor: tpl.primaryColor,
                          primaryHoverColor: tpl.primaryHoverColor,
                          bgTheme: tpl.bgTheme,
                          cardStyle: tpl.cardStyle,
                          cardRadius: tpl.cardRadius,
                          fontFamily: tpl.fontFamily,
                        }))
                      }
                      className={`relative flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                        isMatching
                          ? "border-indigo-600 ring-2 ring-indigo-500/25 bg-indigo-500/10 font-bold"
                          : isDark
                          ? "border-slate-700/80 bg-slate-800/60 hover:bg-slate-800 hover:border-slate-600"
                          : "border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="flex size-10 shrink-0 items-center justify-center rounded-xl shadow-xs border border-white/15 text-white font-black text-sm"
                          style={{ backgroundColor: tpl.primaryColor }}
                        >
                          <span
                            className="size-3.5 rounded-full border border-white/40"
                            style={{ backgroundColor: tpl.previewBg }}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white text-xs">
                              {tpl.name}
                            </span>
                            {isMatching && (
                              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                                Activo
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                            {tpl.tagline}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 shrink-0">
                        <span className="uppercase tracking-wider font-mono">{tpl.fontFamily}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Section 1: Branding, Logo & Cover Photos */}
          {activeSection === "branding" && (
            <div
              className={`rounded-2xl border p-5 shadow-xs space-y-4 text-xs ${
                isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
              }`}
            >
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Identidad Visual & Fotos</h3>

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
                  placeholder="Ej. Cocina artesanal con sabor inolvidable"
                  className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Logo Upload */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <label className="font-semibold block text-slate-800 dark:text-slate-200">
                  Logo del Restaurante
                </label>

                <div className="flex items-center gap-3">
                  {draft.logoUrl ? (
                    <div className="relative size-16 shrink-0">
                      <LazyImage
                        src={draft.logoUrl}
                        alt="Logo preview"
                        containerClassName="size-full rounded-2xl ring-2 ring-indigo-500/40 shadow-xs"
                        className="size-full object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      style={{ backgroundColor: draft.primaryColor }}
                      className="flex size-16 items-center justify-center rounded-2xl text-white font-bold text-xl shrink-0 shadow-xs border border-white/20"
                    >
                      {draft.name.charAt(0) || <Store className="size-6" />}
                    </div>
                  )}

                  <div className="flex-1 space-y-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(e) => handleImageUpload(e, "logoUrl")}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => logoInputRef.current?.click()}
                        className="flex-1 justify-center gap-1.5 text-xs font-semibold cursor-pointer"
                      >
                        <Upload className="size-3.5 text-indigo-500" />
                        <span>Subir Logo</span>
                      </Button>
                      {draft.logoUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setDraft((prev) => ({ ...prev, logoUrl: "" }))}
                          className="px-2.5 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 border-rose-500/30 cursor-pointer"
                          title="Eliminar logo"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Subí tu logo en formato PNG, JPG o WebP desde tu teléfono o PC.
                    </p>
                  </div>
                </div>
              </div>

              {/* Banner Upload */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <label className="font-semibold block text-slate-800 dark:text-slate-200">
                  Foto de Portada / Banner Superior
                </label>

                {draft.bannerUrl && (
                  <div className="relative h-24 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                    <LazyImage
                      src={draft.bannerUrl}
                      alt="Banner Preview"
                      containerClassName="size-full"
                      className="size-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, bannerUrl: "" }))}
                      className="absolute top-2 right-2 z-10 rounded-lg bg-black/70 p-1.5 text-white hover:bg-rose-600 transition-colors cursor-pointer"
                      title="Eliminar foto de portada"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}

                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => handleImageUpload(e, "bannerUrl")}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => bannerInputRef.current?.click()}
                  className="w-full justify-center gap-1.5 text-xs font-semibold cursor-pointer"
                >
                  <Upload className="size-3.5 text-indigo-500" />
                  <span>Subir Foto de Portada</span>
                </Button>
                <p className="text-[10px] text-slate-400">
                  Imagen panorámica que aparece en la parte superior de la carta digital.
                </p>

                <div className="pt-2 space-y-3">
                  <Switch
                    checked={draft.showBanner}
                    onCheckedChange={(checked) => setDraft({ ...draft, showBanner: checked })}
                    label="Mostrar Banner en la Tienda"
                    description="Muestra la foto de portada en la parte superior"
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
            </div>
          )}

          {/* Section 2: Colors & Atmosphere Engine */}
          {activeSection === "colors" && (
            <div
              className={`rounded-2xl border p-5 shadow-xs space-y-5 text-xs ${
                isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
              }`}
            >
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Color de Acento de la Tienda</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  Define el color de los botones de compra, precios y destacados
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
                        className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
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

                {/* Visual Custom Color Picker */}
                <label
                  htmlFor="custom-color-picker"
                  className={`mt-3 flex items-center justify-between gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                    isDark
                      ? "border-slate-700 bg-slate-800/60 hover:bg-slate-800 hover:border-slate-600"
                      : "border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="relative size-9 shrink-0 rounded-full shadow-xs border border-white/20 flex items-center justify-center overflow-hidden"
                      style={{ backgroundColor: draft.primaryColor }}
                    >
                      <input
                        id="custom-color-picker"
                        type="color"
                        value={draft.primaryColor}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            primaryColor: e.target.value,
                            primaryHoverColor: e.target.value,
                          })
                        }
                        className="absolute inset-0 size-full opacity-0 cursor-pointer"
                        title="Elegir color visualmente"
                      />
                      <Pipette className="size-4 text-white drop-shadow-md pointer-events-none" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold block text-slate-900 dark:text-white text-xs">
                        Elegir Color Personalizado
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        Hacé clic para abrir la paleta visual y elegir cualquier tono
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 shrink-0 pointer-events-none">
                    <Pipette className="size-3.5 text-indigo-500" />
                    <span>Selector visual</span>
                  </div>
                </label>
              </div>

              {/* Background Theme Mode for Store */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Fondo & Atmósfera</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  Elige la iluminación y el contraste visual de tu carta digital
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {BG_THEME_OPTIONS.map((opt) => {
                    const isSelected = draft.bgTheme === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDraft({ ...draft, bgTheme: opt.id as StoreBgTheme })}
                        className={`flex flex-col rounded-xl border p-3 text-left transition-all cursor-pointer ${
                          isSelected
                            ? "border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/10 font-bold"
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

          {/* Section 3: UI/UX, Typography & Card Styling */}
          {activeSection === "uiux" && (
            <div
              className={`rounded-2xl border p-5 shadow-xs space-y-5 text-xs ${
                isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
              }`}
            >
              {/* Typography Selector */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Type className="size-4 text-indigo-500" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Tipografía de la Carta
                  </h3>
                </div>
                <p className="text-slate-500 dark:text-slate-400 mb-3">
                  Define el estilo de letra de los títulos, descripciones y precios
                </p>

                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: "sans" as const, name: "Moderna (Sans-Serif)", desc: "Limpia, neutra y ultra legible", fontClass: "font-sans" },
                    { id: "serif" as const, name: "Elegante (Serif)", desc: "Gourmet, bistró y pizzería", fontClass: "font-serif" },
                    { id: "display" as const, name: "Urbana (Display)", desc: "Fuerte y contundente", fontClass: "font-sans font-extrabold" },
                    { id: "mono" as const, name: "Rústica (Monospace)", desc: "Estilo menú de pizarra", fontClass: "font-mono" },
                  ].map((font) => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, fontFamily: font.id })}
                      className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
                        draft.fontFamily === font.id
                          ? "border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/10 font-bold"
                          : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <span className={`block text-xs font-bold ${font.fontClass}`}>
                        {font.name}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                        {font.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Style Selectors */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-sm mb-1 text-slate-900 dark:text-white">
                  Estilo de Tarjetas de Productos
                </h3>
                <div className="grid grid-cols-2 gap-2.5 mt-2.5">
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
                      className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
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
                      className={`rounded-xl border py-2 text-xs transition-all cursor-pointer ${
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

          {/* Section 4: Business Settings & Min Order */}
          {activeSection === "business" && (
            <div
              className={`rounded-2xl border p-5 shadow-xs space-y-4 text-xs ${
                isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
              }`}
            >
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Información Comercial, Pedidos & Domicilios
              </h3>

              <div>
                <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                  Número de WhatsApp para Pedidos (con indicativo país)
                </label>
                <input
                  type="tel"
                  value={draft.whatsappNumber}
                  onChange={(e) => setDraft({ ...draft, whatsappNumber: e.target.value })}
                  placeholder="573022575805"
                  className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-medium"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Los pedidos finalizados por los clientes se enviarán formateados a este número.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                    Costo Domicilio Base ($)
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
                    Pedido Mínimo de Compra ($)
                  </label>
                  <input
                    type="number"
                    value={draft.minOrderAmount || 0}
                    onChange={(e) => setDraft({ ...draft, minOrderAmount: Number(e.target.value) })}
                    placeholder="20000"
                    className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <div>
                  <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                    Símbolo de Moneda
                  </label>
                  <input
                    type="text"
                    value={draft.currencySymbol || "$"}
                    onChange={(e) => setDraft({ ...draft, currencySymbol: e.target.value })}
                    placeholder="$"
                    className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
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
              className={`relative overflow-hidden rounded-2xl border border-slate-700/20 transition-all duration-200 min-h-[560px] flex flex-col ${getFontFamilyClass(
                draft.fontFamily
              )}`}
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
                    <LazyImage
                      src={draft.logoUrl}
                      alt="Logo"
                      containerClassName="size-8 rounded-full border shrink-0"
                      className="size-full object-cover"
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
                  <LazyImage
                    src={draft.bannerUrl}
                    alt="Banner"
                    containerClassName="size-full"
                    className="size-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-3 z-10">
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
                    {products.length} productos
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
                          <LazyImage
                            src={p.src}
                            alt={p.name}
                            containerClassName="size-full"
                            className="size-full object-cover"
                          />
                          {draft.showBadges && p.isPopular && (
                            <span
                              style={{ backgroundColor: draft.primaryColor }}
                              className="absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs z-10"
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
