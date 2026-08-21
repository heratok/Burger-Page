import { useEffect, useState } from "react"
import { RestaurantProvider, useRestaurant } from "@/context/RestaurantContext"
import Home from "./pages/Home"
import { AdminLayout } from "./components/crm/AdminLayout"
import { DashboardOverview } from "./components/crm/DashboardOverview"
import { OrdersKanban } from "./components/crm/OrdersKanban"
import { MenuManager } from "./components/crm/MenuManager"
import { CustomerCRM } from "./components/crm/CustomerCRM"
import { StorefrontCustomizer } from "./components/crm/StorefrontCustomizer"
import { RestaurantsDirectory } from "./components/crm/superadmin/RestaurantsDirectory"
import { AdminAuthModal } from "./components/crm/superadmin/AdminAuthModal"
import { RestaurantNotFound } from "./components/crm/RestaurantNotFound"
import { Toaster } from "@/components/ui/sonner"

function MainRouter() {
  const {
    activeView,
    setActiveView,
    adminTab,
    session,
    restaurants,
    switchRestaurant,
  } = useRestaurant()

  const [attemptedSlug, setAttemptedSlug] = useState<string | null>(null)
  const [isSlugNotFound, setIsSlugNotFound] = useState(false)

  // Handle URL path routing on mount and back/forward navigation
  useEffect(() => {
    const handleLocation = () => {
      const pathname = window.location.pathname.replace(/^\/+|\/+$/g, "")

      if (!pathname) {
        // Root "/" path
        setIsSlugNotFound(false)
        return
      }

      if (pathname === "admin") {
        setActiveView("admin")
        setIsSlugNotFound(false)
        return
      }

      // Check if pathname matches a registered restaurant slug
      const found = restaurants.find(
        (r) => r.slug.toLowerCase() === pathname.toLowerCase()
      )

      if (found) {
        switchRestaurant(found.id)
        setActiveView("store")
        setIsSlugNotFound(false)
      } else {
        setAttemptedSlug(pathname)
        setIsSlugNotFound(true)
      }
    }

    handleLocation()
    window.addEventListener("popstate", handleLocation)
    return () => window.removeEventListener("popstate", handleLocation)
  }, [restaurants, switchRestaurant, setActiveView])

  // If slug was not found
  if (isSlugNotFound && attemptedSlug) {
    return <RestaurantNotFound attemptedSlug={attemptedSlug} />
  }

  // Admin View
  if (activeView === "admin") {
    // If not authenticated, show the authentication modal gate
    if (session.role === "guest") {
      return (
        <div className="min-h-screen bg-[#0B0F19]">
          <AdminAuthModal
            isOpen={true}
            onClose={() => setActiveView("store")}
          />
        </div>
      )
    }

    return (
      <AdminLayout>
        {adminTab === "restaurants" && <RestaurantsDirectory />}
        {adminTab === "dashboard" && <DashboardOverview />}
        {adminTab === "orders" && <OrdersKanban />}
        {adminTab === "menu" && <MenuManager />}
        {adminTab === "customers" && <CustomerCRM />}
        {adminTab === "customizer" && <StorefrontCustomizer />}
      </AdminLayout>
    )
  }

  // Store View
  return <Home />
}

export default function App() {
  return (
    <RestaurantProvider>
      <MainRouter />
      <Toaster position="top-right" richColors closeButton />
    </RestaurantProvider>
  )
}