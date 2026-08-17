import { useParams } from "react-router"
import { storage } from "@/lib/storage"
import { DefaultThemeScope, ThemeScope } from "../components/ThemeScope"
import NotFoundState from "../components/NotFoundState"
import AdminGate from "./admin/AdminGate"
import AdminLayout from "./admin/AdminLayout"

/**
 * Per-restaurant admin console (design D4, spec AD-1): resolves the slug to a
 * restaurant, applies its palette, gates on that restaurant's adminPassword
 * through a mode-aware session and scopes every section to its repository.
 * Unknown slugs fall back to the not-found state.
 */
export default function RestaurantAdminRoute() {
  const { slug } = useParams()
  const restaurant = storage.getBySlug(slug ?? "")

  if (!restaurant) {
    return (
      <DefaultThemeScope>
        <NotFoundState />
      </DefaultThemeScope>
    )
  }

  const repo = storage.getRepositoryFor(restaurant.id)

  return (
    <ThemeScope palette={restaurant.palette}>
      <AdminGate restaurantId={restaurant.id} repo={repo}>
        <AdminLayout repo={repo} />
      </AdminGate>
    </ThemeScope>
  )
}