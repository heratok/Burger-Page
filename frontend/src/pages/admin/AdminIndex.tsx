import { useOutletContext } from "react-router"
import { useAdmin } from "@/store/admin-context"
import type { RestaurantRepository } from "@/lib/repository"

/**
 * Role-aware `/admin` index landing (design D2, spec SG-1/DR-1): a super
 * session lands on the global summary; a restaurant session lands on its
 * Resumen dashboard. The full dashboards arrive in later slices
 * (GlobalSummary = Slice 4, DashboardResumen = Slice 2), so until then this
 * renders the section title the nav/landing tests assert, keeping the route
 * wiring and shell intact.
 */
export default function AdminIndex() {
  const { session } = useAdmin()
  const repo = useOutletContext<RestaurantRepository | undefined>()
  const isSuper = session?.mode === "super"

  return (
    <section aria-label="Resumen">
      <h1 className="text-xl font-bold tracking-tight text-text-primary">
        {isSuper ? "Resumen global" : "Resumen"}
      </h1>
      <p className="mt-1 text-sm text-text-secondary">
        {isSuper
          ? "Resumen agregado de todos los restaurantes."
          : repo !== undefined
            ? "Resumen de ventas y métricas del restaurante."
            : "Selecciona un restaurante para ver su resumen."}
      </p>
    </section>
  )
}
