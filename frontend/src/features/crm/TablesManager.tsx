import React from "react"
import { useUi, useTenant } from "@/context/RestaurantContext"
import { LayoutGrid } from "lucide-react"
import { CustomizerTablesSection } from "./customizer/CustomizerTablesSection"

export const TablesManager: React.FC = () => {
  const { adminTheme } = useUi()
  const { activeRestaurant } = useTenant()
  const isDark = adminTheme === "dark"

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header Strip */}
      <div
        className={`flex flex-col gap-3 rounded-2xl border p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between ${
          isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500 dark:bg-sky-500/20 dark:text-sky-400">
              <LayoutGrid className="size-4" />
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Gestión de Mesas & Códigos QR
            </h2>
          </div>
          <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Configura las mesas de tu salón, genera códigos QR descargables para pedidos en mesa y controla su disponibilidad.
          </p>
        </div>
      </div>

      {/* Main Tables Management Card */}
      <CustomizerTablesSection restaurantId={activeRestaurant?.id} isDark={isDark} />
    </div>
  )
}
