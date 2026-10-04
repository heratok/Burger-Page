import { lazy, Suspense } from "react"
import { ShieldAlert } from "lucide-react"
import { RestaurantProvider, useUi, useAuth, useTenant, useCatalog } from "@/context/RestaurantContext"
import { useAppRouter } from "@/core/router/useAppRouter"
import {
  AdminLoadingFallback,
  LandingLoadingFallback,
  StorefrontLoadingFallback,
} from "@/components/ui/LoadingFallbacks"
import { Toaster } from "@/components/ui/sonner"
import { getToasterClipPath, getToasterOffset } from "@/components/ui/toaster-offset"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"
import { Button } from "@/components/ui/button"
import { getStoreThemeStyles } from "@/features/crm/utils/customizerStyles"
import { useDocumentFavicon } from "@/hooks/useDocumentFavicon"
import { selectTitleRestaurantName, useDocumentTitle } from "@/hooks/useDocumentTitle"

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
const TablesManager = lazy(() =>
  import("@/features/crm/TablesManager").then((m) => ({
    default: m.TablesManager,
  }))
)
const StoreSettingsManager = lazy(() =>
  import("@/features/crm/StoreSettingsManager").then((m) => ({
    default: m.StoreSettingsManager,
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
const AuditLogScreen = lazy(() =>
  import("@/features/superadmin/AuditLogScreen").then((m) => ({
    default: m.AuditLogScreen,
  }))
)
const AdminAuthModal = lazy(() =>
  import("@/features/superadmin/AdminAuthModal").then((m) => ({
    default: m.AdminAuthModal,
  }))
)
const ChangePasswordScreen = lazy(() =>
  import("@/features/superadmin/ChangePasswordScreen").then((m) => ({
    default: m.ChangePasswordScreen,
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
  const { adminTab } = useUi()
  const { session } = useAuth()
  const { activeRestaurant } = useTenant()
  const { storeConfig } = useCatalog()
  const { activeView, isNotFound, isResolving, attemptedSlug, loadError, retry, navigateTo } = useAppRouter()

  const titleRestaurantName = selectTitleRestaurantName({
    activeView,
    isNotFound,
    isResolving,
    sessionRole: session.role,
    adminTab,
    restaurantId: activeRestaurant.id,
    restaurantName: storeConfig.name,
  })
  useDocumentTitle(titleRestaurantName)
  useDocumentFavicon(titleRestaurantName ? storeConfig.logoUrl : undefined)

  // 1. Not Found Route
  if (isNotFound && attemptedSlug) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<AdminLoadingFallback />}>
          <RestaurantNotFound attemptedSlug={attemptedSlug} loadError={loadError} onRetry={retry} />
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

    // Forced password change screen blocks the entire admin until changed
    if (session.mustChangePassword) {
      return (
        <ErrorBoundary>
          <Suspense fallback={<AdminLoadingFallback />}>
            <ChangePasswordScreen
              isForced={true}
              onSuccess={() => {
                if (session.role === "super") {
                  navigateTo("/admin/restaurants")
                } else {
                  navigateTo("/admin/dashboard")
                }
              }}
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
      adminTab === "restaurants" || adminTab === "users" || adminTab === "metrics" || adminTab === "audit"

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
                {adminTab === "audit" && <AuditLogScreen />}
                {adminTab === "dashboard" && <DashboardOverview />}
                {adminTab === "orders" && <OrdersKanban />}
                {adminTab === "tables" && <TablesManager />}
                {adminTab === "menu" && <MenuManager />}
                {adminTab === "inventory" && <InventoryManager />}
                {adminTab === "customers" && <CustomerCRM />}
                {adminTab === "reports" && <ReportsManager />}
                {adminTab === "customizer" && <StorefrontCustomizer />}
                {adminTab === "settings" && <StoreSettingsManager />}
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

  // 4. Public Tenant Storefront Route (only once the slug is a known tenant)
  if (isResolving) {
    return <StorefrontLoadingFallback />
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<StorefrontLoadingFallback />}>
        <Home />
      </Suspense>
    </ErrorBoundary>
  )
}

export function AppToaster() {
  const { activeView, adminTheme } = useUi()
  const { storeConfig } = useCatalog()

  let sonnerTheme: "light" | "dark" = "dark"
  let themeStyles: React.CSSProperties | undefined

  if (activeView === "admin") {
    sonnerTheme = adminTheme === "dark" ? "dark" : "light"
    themeStyles =
      adminTheme === "dark"
        ? ({
            "--color-bg-elevated": "#0E1322",
            "--color-text-primary": "#F8FAFC",
            "--color-border-subtle": "#1E293B",
          } as React.CSSProperties)
        : ({
            "--color-bg-elevated": "#FFFFFF",
            "--color-text-primary": "#0F172A",
            "--color-border-subtle": "#E2E8F0",
          } as React.CSSProperties)
  } else {
    const isDarkTheme =
      storeConfig.bgTheme === "dark-charcoal" || storeConfig.bgTheme === "deep-midnight"
    sonnerTheme = isDarkTheme ? "dark" : "light"
    themeStyles = getStoreThemeStyles(storeConfig.bgTheme, storeConfig.primaryColor)
  }

  const offset = getToasterOffset(activeView)
  const clipPath = getToasterClipPath(activeView)

  return (
    <Toaster
      theme={sonnerTheme}
      themeStyles={themeStyles}
      position="top-right"
      {...(offset.top !== undefined && { offset: { top: offset.top } })}
      {...(offset.mobileTop !== undefined && { mobileOffset: { top: offset.mobileTop } })}
      {...(clipPath !== undefined && { style: { clipPath } })}
      richColors
      closeButton
    />
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <RestaurantProvider>
        <MainRouter />
        <AppToaster />
      </RestaurantProvider>
    </ErrorBoundary>
  )
}