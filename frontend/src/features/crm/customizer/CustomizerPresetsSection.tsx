import React from "react"
import type { StorefrontConfig } from "@/types/restaurant"
import { Sparkles } from "lucide-react"
import { FULL_THEME_TEMPLATES, FullThemeTemplate } from "../utils/customizerStyles"

export interface CustomizerPresetsSectionProps {
  draft: StorefrontConfig
  setDraft: React.Dispatch<React.SetStateAction<StorefrontConfig>>
  onSelectTemplate?: (template: FullThemeTemplate) => void
  isDark?: boolean
}

export const CustomizerPresetsSection: React.FC<CustomizerPresetsSectionProps> = ({
  draft,
  setDraft,
  onSelectTemplate,
  isDark = false,
}) => {
  const handleSelect = (tpl: FullThemeTemplate) => {
    if (onSelectTemplate) {
      onSelectTemplate(tpl)
    } else {
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
  }

  return (
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
              onClick={() => handleSelect(tpl)}
              className={`relative flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                isMatching
                  ? "border-indigo-600 ring-2 ring-indigo-500/25 bg-indigo-50/10 font-bold"
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
  )
}
