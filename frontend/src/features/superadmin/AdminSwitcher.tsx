import React from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import { Store, Crown } from "lucide-react"
import { useAppRouter } from "@/core/router/useAppRouter"
import { Select } from "@/components/ui/select"

export interface AdminSwitcherProps {
  collapsed?: boolean
  onSelect?: () => void
}

export const AdminSwitcher: React.FC<AdminSwitcherProps> = ({ collapsed = false, onSelect }) => {
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
    return null
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
        <div className="relative group size-10">
          <select
            aria-label="Selector de restaurante"
            value={adminTab === "restaurants" ? "DIRECTORY" : activeRestaurant.id}
            onChange={(e) => {
              const val = e.target.value
              if (val === "DIRECTORY") {
                navigateTo("/admin/restaurants")
              } else {
                switchRestaurant(val)
                navigateTo("/admin/dashboard")
              }
              onSelect?.()
            }}
            className="absolute inset-0 size-full opacity-0 cursor-pointer z-10"
          >
            <optgroup label="🏢 Plataforma SaaS">
              <option value="DIRECTORY">🌐 Directorio Global SaaS</option>
            </optgroup>
            <optgroup label="🍔 Restaurantes Registrados">
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.config.name} (/{r.slug})
                </option>
              ))}
            </optgroup>
          </select>
          <div className="flex size-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/50 transition-all shadow-xs">
            <Store className="size-5" />
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
          onSelect?.()
        }}
        options={switcherOptions}
        className="text-xs font-semibold"
      />
    </div>
  )
}
