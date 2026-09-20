import { lazy, Suspense } from "react"
import { ShieldAlert } from "lucide-react"
import { RestaurantProvider, useRestaurant } from "@/context/RestaurantContext"
import { useAppRouter } from "@/core/router/useAppRouter"
import {
  AdminLoadingFallback,
  LandingLoadingFallback,
  StorefrontLoadingFallback,
} from "@/components/ui/LoadingFallbacks"
import { Toaster } from "@/components/ui/sonner"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"
import { Button } from "@/components/ui/button"

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

interface GlobalModuleAccessDeniedProps {
  onBackToDashboard: () => void
}

/**
 * SUS-04 route-level fallback for /admin/restaurants, /admin/users and
 * /admin/metrics when the session is not a Super Admin. AdminLayout already
 * hides those tabs in the nav for restaurant admins; this view covers direct
 * URL navigation so cross-tenant directories and aggregates never render
 * for the wrong role.
 */
function GlobalModuleAccessDenied({ onBackToDashboard }: GlobalModuleAccessDeniedProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-[#0E1322]">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/25">
          <ShieldAlert className="size-7" />
        </div>
        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          No tienes permisos para acceder a este módulo global
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Este módulo es exclusivo del Super Admin de la plataforma. Tu sesión actual no
          tiene el rol requerido para visualizar datos globales.
        </p>
        <Button
          type="button"
          onClick={onBackToDashboard}
          className="mt-6 w-full cursor-pointer rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 font-bold text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600"
        >
          Volver al Dashboard
        </Button>
      </div>
    </div>
  )
}

export function MainRouter() {
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

    // SUS-04: global SaaS modules are exclusive to the platform Super Admin.
    // A restaurant admin (or any non-super, non-guest session) deep-linking to
    // /admin/restaurants, /admin/users or /admin/metrics must never render
    // cross-tenant directories or aggregates, so enforce the gate at route level.
    const isSuper = session.role === "super"
    const isGlobalAdminTab =
      adminTab === "restaurants" || adminTab === "users" || adminTab === "metrics"

    return (
      <ErrorBoundary>
        <Suspense fallback={<AdminLoadingFallback />}>
          <AdminLayout>
            {isGlobalAdminTab && !isSuper ? (
              <GlobalModuleAccessDenied
                onBackToDashboard={() => navigateTo("/admin/dashboard")}
              />
            ) : (
              <>
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
              </>
            )}
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