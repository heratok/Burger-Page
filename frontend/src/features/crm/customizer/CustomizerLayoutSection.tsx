import React from "react"
import type { StorefrontConfig, CardStyle, CardRadius } from "@/types/restaurant"
import { Type } from "lucide-react"
import { Switch } from "@/components/ui/switch"

export interface CustomizerLayoutSectionProps {
  draft: StorefrontConfig
  setDraft: React.Dispatch<React.SetStateAction<StorefrontConfig>>
  isDark?: boolean
}

export const CustomizerLayoutSection: React.FC<CustomizerLayoutSectionProps> = ({
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
              onClick={() => setDraft((prev) => ({ ...prev, fontFamily: font.id }))}
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
              onClick={() => setDraft((prev) => ({ ...prev, cardStyle: st.id as CardStyle }))}
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
              onClick={() => setDraft((prev) => ({ ...prev, cardRadius: r.id as CardRadius }))}
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
          onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, showBadges: checked }))}
          label="Mostrar Etiquetas 'Popular' y 'Nuevo'"
          description="Destaca los platos estrella en las tarjetas de la tienda"
        />

        <Switch
          checked={draft.compactGrid}
          onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, compactGrid: checked }))}
          label="Cuadrícula Compacta"
          description="Muestra tarjetas más densas para ver más productos a la vez"
        />
      </div>
    </div>
  )
}
