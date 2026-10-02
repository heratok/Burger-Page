import React from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import { useAppRouter } from "@/core/router/useAppRouter"
import { ShieldAlert, ArrowLeft } from "lucide-react"

export interface SupportModeBannerProps {
  restaurantName?: string
  onReturn?: () => void
}

export const SupportModeBanner: React.FC<SupportModeBannerProps> = ({
  restaurantName: propRestaurantName,
  onReturn: propOnReturn,
}) => {
  const { session, activeRestaurant, activeRestaurantId, adminTab, switchRestaurant } = useRestaurant()
  const { navigateTo } = useAppRouter()

  const isSuper = session.role === "super"
  const isSuperGlobalScreen =
    adminTab === "restaurants" || adminTab === "users" || adminTab === "metrics" || adminTab === "audit"
  const hasActiveRestaurant =
    Boolean(activeRestaurantId) &&
    activeRestaurantId !== "rest-default" &&
    activeRestaurant.id !== "rest-default"

  // Only show when a super admin has entered a restaurant's admin (not on their own superadmin screens)
  if (!isSuper || isSuperGlobalScreen || !hasActiveRestaurant) {
    return null
  }

  const restaurantName = propRestaurantName || activeRestaurant.config.name || activeRestaurant.name || "Restaurante"

  const handleReturn = () => {
    if (propOnReturn) {
      propOnReturn()
      return
    }
    // Leave tenant context and go back to /admin/restaurants
    switchRestaurant("")
    navigateTo("/admin/restaurants")
  }

  return (
    <div
      role="status"
      aria-label="Modo soporte"
      className="w-full bg-amber-500 text-slate-950 px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-between sm:justify-center gap-2 shadow-xs shrink-0 z-40 border-b border-amber-600/20"
    >
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <ShieldAlert className="size-4 shrink-0 text-slate-950" />
        <span>
          Modo soporte: estás viendo «{restaurantName}»
        </span>
        <span aria-hidden="true" className="font-bold">·</span>
        <button
          type="button"
          onClick={handleReturn}
          className="inline-flex items-center gap-1 font-bold underline hover:text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 rounded px-1 cursor-pointer"
        >
          <ArrowLeft className="size-3 sm:hidden" />
          <span>Volver al panel</span>
        </button>
      </div>
    </div>
  )
}
