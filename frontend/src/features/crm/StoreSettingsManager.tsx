import React, { useState, useEffect } from "react"
import { useUi, useCatalog } from "@/context/RestaurantContext"
import { Settings, Save, RotateCcw, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CustomizerBusinessSection } from "./customizer/CustomizerBusinessSection"
import type { StorefrontConfig } from "@/types/restaurant"
import { toast } from "sonner"

export const StoreSettingsManager: React.FC = () => {
  const { adminTheme } = useUi()
  const { storeConfig, updateStoreConfig } = useCatalog()
  const isDark = adminTheme === "dark"

  const [draft, setDraft] = useState<StorefrontConfig>(storeConfig)
  const [isSaving, setIsSaving] = useState(false)

  // Keep draft in sync if storeConfig changes externally
  useEffect(() => {
    setDraft(storeConfig)
  }, [storeConfig])

  const handleSave = async () => {
    try {
      setIsSaving(true)
      updateStoreConfig(draft)
      toast.success("Ajustes del negocio guardados correctamente")
    } catch {
      toast.error("Ocurrió un error al guardar los ajustes")
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setDraft(storeConfig)
    toast.info("Cambios descartados")
  }

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(storeConfig)

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header Strip */}
      <div
        className={`flex flex-col gap-4 rounded-2xl border p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between ${
          isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-400">
              <Settings className="size-4" />
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Ajustes de Negocio & Operación
            </h2>
            {hasChanges && (
              <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                Cambios pendientes
              </span>
            )}
          </div>
          <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Configura los canales de venta por WhatsApp, reglas de compra, horarios de atención y disponibilidad en vivo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="text-xs font-semibold cursor-pointer"
            >
              <RotateCcw className="size-3.5 mr-1.5" />
              Descartar
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={isSaving}
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            {isSaving ? (
              <CheckCircle2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="size-3.5 mr-1.5" />
            )}
            Guardar Ajustes
          </Button>
        </div>
      </div>

      {/* Main Settings Panel */}
      <CustomizerBusinessSection draft={draft} setDraft={setDraft} isDark={isDark} />
    </div>
  )
}
