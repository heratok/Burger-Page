import React from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import { Store, ChevronDown, Crown, Shield } from "lucide-react"
import { useAppRouter } from "@/core/router/useAppRouter"

export const AdminSwitcher: React.FC = () => {
  const {
    restaurants,
    activeRestaurant,
    switchRestaurant,
    session,
    adminTab,
    adminTheme,
  } = useRestaurant()

  const { navigateTo } = useAppRouter()

  const isDark = adminTheme === "dark"
  const isSuper = session.role === "super"

  if (!isSuper) {
    return (
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 p-2.5">
        <div className="flex items-center gap-2">
          <img
            src={activeRestaurant.config.logoUrl}
            alt={activeRestaurant.config.name}
            className="size-7 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-700"
          />
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold truncate text-slate-900 dark:text-white">
              {activeRestaurant.config.name}
            </h4>
            <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
              <Shield className="size-2.5 text-indigo-500" />
              <span>Admin Local</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          <Crown className="size-3" />
          <span>Super Administrador</span>
        </div>
        <span className="rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-300">
          {restaurants.length} locales
        </span>
      </div>

      <div className="relative group">
        <select
          value={adminTab === "restaurants" ? "DIRECTORY" : activeRestaurant.id}
          onChange={(e) => {
            const val = e.target.value
            if (val === "DIRECTORY") {
              navigateTo("/admin/restaurants")
            } else {
              switchRestaurant(val)
              navigateTo("/admin/dashboard")
            }
          }}
          className={`w-full appearance-none rounded-xl border py-2 pl-8 pr-7 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
            isDark
              ? "border-indigo-500/30 bg-slate-900 text-slate-100 hover:border-indigo-500/60"
              : "border-indigo-200 bg-indigo-50/50 text-slate-900 hover:border-indigo-300"
          }`}
        >
          <optgroup label="🏢 Plataforma SaaS">
            <option value="DIRECTORY">🌐 Directorio Global de Restaurantes</option>
          </optgroup>
          <optgroup label="🍔 Restaurantes Registrados">
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.config.name} ({r.slug})
              </option>
            ))}
          </optgroup>
        </select>

        <Store className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-indigo-500 pointer-events-none" />
        <ChevronDown className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  )
}
