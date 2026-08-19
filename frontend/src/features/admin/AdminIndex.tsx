import { useOutletContext } from "react-router"
import { useAdmin } from "@/store/admin-context"
import type { RestaurantRepository } from "@/shared/storage/repository"
import DashboardResumen from "./DashboardResumen"
import GlobalSummary from "../superadmin/GlobalSummary"
import NotFoundState from "@/shared/ui/NotFoundState"

/**
 * Role-aware `/admin` index landing (design D2, spec SG-1/DR-1/AS-3): a super
 * session with no restaurant selected lands on the global summary aggregating
 * every restaurant (SG-1); a scoped repository — a restaurant session, or a
 * super's switcher selection — lands on that restaurant's Resumen dashboard
 * (DR-1, AS-3 Re-scope), which replaced the retired Ventas section. A scope
 * with no repository (e.g. a stale selection) renders the not-found state
 * instead of crashing.
 */
export default function AdminIndex() {
  const { session } = useAdmin()
  const repo = useOutletContext<RestaurantRepository | undefined>()
  const isSuper = session?.mode === "super"

  if (repo !== undefined) {
    return <DashboardResumen repo={repo} />
  }

  if (isSuper) {
    return <GlobalSummary />
  }

  return <NotFoundState />
}