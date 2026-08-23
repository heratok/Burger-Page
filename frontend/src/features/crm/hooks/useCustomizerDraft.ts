import { useState, useCallback } from "react"
import type { StorefrontConfig } from "@/types/restaurant"

export function useCustomizerDraft(
  initialConfig: StorefrontConfig,
  onSaveConfig: (config: StorefrontConfig) => void,
  onResetConfig: () => void
) {
  const [draft, setDraft] = useState<StorefrontConfig>(initialConfig)
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop")
  const [activeSection, setActiveSection] = useState<"branding" | "colors" | "uiux" | "business">("branding")

  const handleSave = useCallback(() => {
    onSaveConfig(draft)
  }, [draft, onSaveConfig])

  const handleReset = useCallback(() => {
    if (window.confirm("¿Deseas restablecer el diseño de la tienda a los valores por defecto?")) {
      onResetConfig()
      setDraft(initialConfig)
    }
  }, [initialConfig, onResetConfig])

  const updateDraft = useCallback((updates: Partial<StorefrontConfig>) => {
    setDraft((prev) => ({ ...prev, ...updates }))
  }, [])

  return {
    draft,
    setDraft,
    updateDraft,
    previewDevice,
    setPreviewDevice,
    activeSection,
    setActiveSection,
    handleSave,
    handleReset,
  }
}
