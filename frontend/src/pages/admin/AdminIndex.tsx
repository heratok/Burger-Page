import { useOutletContext } from "react-router"
import { useAdmin } from "@/store/admin-context"
import type { RestaurantRepository } from "@/lib/repository"
import DashboardResumen from "./DashboardResumen"
import NotFoundState from "@/components/NotFoundState"

/**
 * Role-aware `/admin` index landing (design D2, spec SG-1/DR-1): a super
 * session lands on the global summary placeholder (GlobalSummary = Slice 4);
 * a restaurant session lands on its Resumen dashboard, which replaces the
 * retired Ventas section (DR-1). A restaurant scope with no scoped repository
 * (e.g. a stale selection) renders the not-found state instead of crashing.
 */
export default function AdminIndex() {
  const { session } = useAdmin()
  const repo = useOutletContext<RestaurantRepository | undefined>()
  const isSuper = session?.mode === "super"

  if (isSuper) {
    return (
      <section aria-label="Resumen">
        <h1 className="text-xl font-bold tracking-tight text-text-primary">
          Resumen global
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Resumen agregado de todos los restaurantes.
        </p>
      </section>
    )
  }

  if (repo !== undefined) {
    return <DashboardResumen repo={repo} />
  }

  return <NotFoundState />
}
