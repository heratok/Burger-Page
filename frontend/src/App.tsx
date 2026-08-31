import { lazy, Suspense } from "react"
import { RestaurantProvider, useRestaurant } from "@/context/RestaurantContext"
import { useAppRouter } from "@/core/router/useAppRouter"
import {
  AdminLoadingFallback,
  LandingLoadingFallback,
  StorefrontLoadingFallback,
} from "@/components/ui/LoadingFallbacks"
import { Toaster } from "@/components/ui/sonner"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"

// Code-split backoffice features from public storefront for minimal initial bundle size
const Home = lazy(() => import("@/features/storefront/Home"))
const LandingPage = lazy(() => import("@/features/landing/LandingPage"))
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
const InventoryManager = lazy(() =>
  import("@/features/crm/InventoryManager").then((m) => ({
    default: m.InventoryManager,
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
const ReportsManager = lazy(() =>
  import("@/features/crm/ReportsManager").then((m) => ({
    default: m.ReportsManager,
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
const UsersDirectory = lazy(() =>
  import("@/features/superadmin/UsersDirectory").then((m) => ({
    default: m.UsersDirectory,
  }))
)
const GlobalAnalytics = lazy(() =>
  import("@/features/superadmin/GlobalAnalytics").then((m) => ({
    default: m.GlobalAnalytics,
  }))
)
const AdminAuthModal = lazy(() =>
  import("@/features/superadmin/AdminAuthModal").then((m) => ({
    default: m.AdminAuthModal,
  }))
)

function MainRouter() {
  const { adminTab, session } = useRestaurant()
  const { activeView, isNotFound, attemptedSlug, navigateTo } = useAppRouter()

  // 1. Not Found Route
  if (isNotFound && attemptedSlug) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<AdminLoadingFallback />}>
          <RestaurantNotFound attemptedSlug={attemptedSlug} />
        </Suspense>
      </ErrorBoundary>
    )
  }

  // 2. Admin Backoffice Route
  if (activeView === "admin") {
    if (session.role === "guest") {
      return (
        <ErrorBoundary>
          <Suspense fallback={<AdminLoadingFallback />}>
            <AdminAuthModal
              isOpen={true}
              onClose={() => navigateTo("/")}
            />
          </Suspense>
        </ErrorBoundary>
      )
    }

    return (
      <ErrorBoundary>
        <Suspense fallback={<AdminLoadingFallback />}>
          <AdminLayout>
            {adminTab === "restaurants" && <RestaurantsDirectory />}
            {adminTab === "users" && <UsersDirectory />}
            {adminTab === "metrics" && <GlobalAnalytics />}
            {adminTab === "dashboard" && <DashboardOverview />}
            {adminTab === "orders" && <OrdersKanban />}
            {adminTab === "menu" && <MenuManager />}
            {adminTab === "inventory" && <InventoryManager />}
            {adminTab === "customers" && <CustomerCRM />}
            {adminTab === "reports" && <ReportsManager />}
            {adminTab === "customizer" && <StorefrontCustomizer />}
          </AdminLayout>
        </Suspense>
      </ErrorBoundary>
    )
  }

  // 3. Platform Landing Page
  if (activeView === "landing") {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LandingLoadingFallback />}>
          <LandingPage />
        </Suspense>
      </ErrorBoundary>
    )
  }

  // 4. Public Tenant Storefront Route
  return (
    <ErrorBoundary>
      <Suspense fallback={<StorefrontLoadingFallback />}>
        <Home />
      </Suspense>
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <RestaurantProvider>
        <MainRouter />
        <Toaster position="top-right" richColors closeButton />
      </RestaurantProvider>
    </ErrorBoundary>
  )
}