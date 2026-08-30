import React from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import { Store, Crown, Shield } from "lucide-react"
import { useAppRouter } from "@/core/router/useAppRouter"
import { Select } from "@/components/ui/select"

export interface AdminSwitcherProps {
  collapsed?: boolean
}

export const AdminSwitcher: React.FC<AdminSwitcherProps> = ({ collapsed = false }) => {
  const {
    restaurants,
    activeRestaurant,
    switchRestaurant,
    session,
    adminTab,
  } = useRestaurant()

  const { navigateTo } = useAppRouter()
  const isSuper = session.role === "super"

  if (!isSuper) {
    if (collapsed) {
      return (
        <div
          title={`${activeRestaurant.config.name} (Admin Local)`}
          className="flex size-10 items-center justify-center mx-auto rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 shadow-xs"
        >
          <img
            src={activeRestaurant.config.logoUrl}
            alt={activeRestaurant.config.name}
            className="size-7 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-700 shadow-xs"
          />
        </div>
      )
    }

    return (
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 p-2.5 shadow-xs">
        <div className="flex items-center gap-2">
          <img
            src={activeRestaurant.config.logoUrl}
            alt={activeRestaurant.config.name}
            className="size-7 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-700 shadow-xs"
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

  const switcherOptions = [
    {
      label: "🏢 Plataforma SaaS",
      options: [
        { value: "DIRECTORY", label: "🌐 Directorio Global SaaS" },
      ],
    },
    {
      label: "🍔 Restaurantes Registrados",
      options: restaurants.map((r) => ({
        value: r.id,
        label: `${r.config.name} (/${r.slug})`,
      })),
    },
  ]

  if (collapsed) {
    return (
      <div className="flex justify-center" title="Cambiar restaurante / Directorio SaaS">
        <div className="relative group w-10">
          <Select
            aria-label="Selector de restaurante"
            size="sm"
            leftIcon={<Store className="size-3.5 text-indigo-500" />}
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
            options={switcherOptions}
            className="w-10 pl-7 pr-0 text-transparent opacity-0 absolute inset-0 cursor-pointer z-20"
          />
          <div className="flex size-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500/20 transition-all shadow-xs">
            <Store className="size-4" />
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

      <Select
        aria-label="Selector de restaurante"
        size="sm"
        leftIcon={<Store className="size-3.5 text-indigo-500" />}
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
        options={switcherOptions}
        className="text-xs font-semibold"
      />
    </div>
  )
}
