import React from "react"
import type { StorefrontConfig, StoreBgTheme } from "@/types/restaurant"
import { Palette, Check, Pipette } from "lucide-react"
import { THEME_COLOR_PRESETS, BG_THEME_OPTIONS } from "@/constants/themePresets"

export interface CustomizerColorsSectionProps {
  draft: StorefrontConfig
  setDraft: React.Dispatch<React.SetStateAction<StorefrontConfig>>
  isDark?: boolean
}

export const CustomizerColorsSection: React.FC<CustomizerColorsSectionProps> = ({
  draft,
  setDraft,
  isDark = false,
}) => {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-xs space-y-5 text-xs ${
        isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
      }`}
    >
      <div>
        <div className="flex items-center gap-2">
          <Palette className="size-4 text-rose-500" />
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Color de Acento de la Tienda</h3>
        </div>
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
                  setDraft((prev) => ({
                    ...prev,
                    primaryColor: preset.primary,
                    primaryHoverColor: preset.primaryHover,
                  }))
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
                  setDraft((prev) => ({
                    ...prev,
                    primaryColor: e.target.value,
                    primaryHoverColor: e.target.value,
                  }))
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
                onClick={() => setDraft((prev) => ({ ...prev, bgTheme: opt.id as StoreBgTheme }))}
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
  )
}
