import { lazy, Suspense } from "react"
import { RestaurantProvider, useRestaurant } from "@/context/RestaurantContext"
import { useAppRouter } from "@/core/router/useAppRouter"
import LoadingPage from "@/features/storefront/LoadingPage"
import { Toaster } from "@/components/ui/sonner"

// Code-split backoffice features from public storefront for minimal initial bundle size
const Home = lazy(() => import("@/features/storefront/Home"))
const AdminLayout = lazy(() =>
  import("@/features/crm/AdminLayout").then((m) => ({ default: m.AdminLayout }))
)
const DashboardOverview = lazy(() =>
  import("@/features/crm/DashboardOverview").then((m) => ({
    default: m.DashboardOverview,
  }))
)
const OrdersKanban = lazy(() =>
  import("@/features/crm/OrdersKanban").then((m) => ({
    default: m.OrdersKanban,
  }))
)
const MenuManager = lazy(() =>
  import("@/features/crm/MenuManager").then((m) => ({
    default: m.MenuManager,
  }))
)
const CustomerCRM = lazy(() =>
  import("@/features/crm/CustomerCRM").then((m) => ({
    default: m.CustomerCRM,
  }))
)
const StorefrontCustomizer = lazy(() =>
  import("@/features/crm/StorefrontCustomizer").then((m) => ({
    default: m.StorefrontCustomizer,
  }))
)
const RestaurantNotFound = lazy(() =>
  import("@/features/crm/RestaurantNotFound").then((m) => ({
    default: m.RestaurantNotFound,
  }))
)
const RestaurantsDirectory = lazy(() =>
  import("@/features/superadmin/RestaurantsDirectory").then((m) => ({
    default: m.RestaurantsDirectory,
  }))
)
const AdminAuthModal = lazy(() =>
  import("@/features/superadmin/AdminAuthModal").then((m) => ({
    default: m.AdminAuthModal,
  }))
)

function MainRouter() {
  const { adminTab, session, setActiveView } = useRestaurant()
  const { activeView, isNotFound, attemptedSlug } = useAppRouter()

  // 1. Not Found Route
  if (isNotFound && attemptedSlug) {
    return (
      <Suspense fallback={<LoadingPage />}>
        <RestaurantNotFound attemptedSlug={attemptedSlug} />
      </Suspense>
    )
  }

  // 2. Admin Backoffice Route
  if (activeView === "admin") {
    if (session.role === "guest") {
      return (
        <Suspense fallback={<LoadingPage />}>
          <div className="min-h-screen bg-[#0B0F19]">
            <AdminAuthModal
              isOpen={true}
              onClose={() => setActiveView("store")}
            />
          </div>
        </Suspense>
      )
    }

    return (
      <Suspense fallback={<LoadingPage />}>
        <AdminLayout>
          {adminTab === "restaurants" && <RestaurantsDirectory />}
          {adminTab === "dashboard" && <DashboardOverview />}
          {adminTab === "orders" && <OrdersKanban />}
          {adminTab === "menu" && <MenuManager />}
          {adminTab === "customers" && <CustomerCRM />}
          {adminTab === "customizer" && <StorefrontCustomizer />}
        </AdminLayout>
      </Suspense>
    )
  }

  // 3. Public Storefront Route
  return (
    <Suspense fallback={<LoadingPage />}>
      <Home />
    </Suspense>
  )
}

export default function App() {
  return (
    <RestaurantProvider>
      <MainRouter />
      <Toaster position="top-right" richColors closeButton />
    </RestaurantProvider>
  )
}