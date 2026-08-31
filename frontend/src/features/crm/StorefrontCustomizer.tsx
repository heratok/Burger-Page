import React from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import { Palette, RotateCcw, Save, Sparkles, ImageIcon, Sliders, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCustomizerDraft } from "./hooks/useCustomizerDraft"
import {
  CustomizerPresetsSection,
  CustomizerBrandingSection,
  CustomizerColorsSection,
  CustomizerLayoutSection,
  CustomizerBusinessSection,
  CustomizerLivePreview,
} from "./customizer"

const CUSTOMIZER_TABS = [
  { id: "templates", label: "Estilos", icon: Sparkles, iconClass: "text-amber-500" },
  { id: "branding", label: "Marca", icon: ImageIcon, iconClass: "text-indigo-500" },
  { id: "colors", label: "Colores", icon: Palette, iconClass: "text-rose-500" },
  { id: "uiux", label: "Diseño", icon: Sliders, iconClass: "text-emerald-500" },
  { id: "business", label: "Pedidos", icon: DollarSign, iconClass: "text-amber-500" },
] as const

export const StorefrontCustomizer: React.FC = () => {
  const {
    storeConfig,
    updateStoreConfig,
    resetStoreConfig,
    products,
    setActiveView,
    adminTheme,
    activeRestaurant,
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

  const handleViewRealStore = () => {
    handleSave()
    setActiveView("store")
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
              Personalizador Visual de Tienda
            </h2>
          </div>
          <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Modifica la apariencia, colores y experiencia de compra de tus clientes con vista previa en tiempo real.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleReset} className="text-xs font-semibold cursor-pointer">
            <RotateCcw className="size-3.5 mr-1.5" />
            Restablecer
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <Save className="size-3.5 mr-1.5" />
            Guardar & Publicar
          </Button>
        </div>
      </div>

      {/* Editor Grid: Left Controls (5 cols), Right Live Simulator (7 cols) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: Controls & Settings */}
        <div className="space-y-5 lg:col-span-5">
          {/* Section Navigation Tabs */}
          <div className="grid grid-cols-5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 border dark:border-slate-700 text-xs font-semibold gap-1">
            {CUSTOMIZER_TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeSection === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSection(tab.id)}
                  className={`rounded-lg py-2 px-1 transition-all text-center flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                    isActive
                      ? "bg-white text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-white font-bold"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  <Icon className={`size-3.5 ${tab.iconClass} shrink-0`} />
                  <span className="truncate">{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Active Section Content */}
          {activeSection === "templates" && <CustomizerPresetsSection draft={draft} setDraft={setDraft} isDark={isDark} />}
          {activeSection === "branding" && (
            <CustomizerBrandingSection draft={draft} setDraft={setDraft} restaurantId={activeRestaurant?.id} isDark={isDark} />
          )}
          {activeSection === "colors" && <CustomizerColorsSection draft={draft} setDraft={setDraft} isDark={isDark} />}
          {activeSection === "uiux" && <CustomizerLayoutSection draft={draft} setDraft={setDraft} isDark={isDark} />}
          {activeSection === "business" && <CustomizerBusinessSection draft={draft} setDraft={setDraft} isDark={isDark} />}
        </div>

        {/* RIGHT COLUMN: Interactive Live Simulator Preview */}
        <div className="space-y-3 lg:col-span-7">
          <CustomizerLivePreview
            draft={draft}
            previewDevice={previewDevice}
            setPreviewDevice={setPreviewDevice}
            products={products}
            isDark={isDark}
            onViewRealStore={handleViewRealStore}
          />
        </div>
      </div>
    </div>
  )
}
