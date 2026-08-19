import { useMemo } from "react"
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useOutletContext,
  useParams,
} from "react-router"
import Storefront from "./pages/Storefront"
import AdminGate from "./pages/admin/AdminGate"
import AdminShell from "./pages/admin/AdminShell"
import AdminIndex from "./pages/admin/AdminIndex"
import ProductsPage from "./pages/admin/ProductsPage"
import OrdersPage from "./pages/admin/OrdersPage"
import SalesPage from "./pages/admin/SalesPage"
import ConfigPage from "./pages/admin/ConfigPage"
import NotFoundState from "./components/NotFoundState"
import { DefaultThemeScope } from "./components/ThemeScope"
import { Toaster } from "@/components/ui/sonner"
import { CartProvider } from "./store/CartContext"
import { AdminProvider } from "./store/AdminContext"
import RestaurantsPage from "./pages/superadmin/RestaurantsPage"
import CreateRestaurantPage from "./pages/superadmin/CreateRestaurantPage"
import EditRestaurantPage from "./pages/superadmin/EditRestaurantPage"
import SuperPasswordPage from "./pages/superadmin/SuperPasswordPage"
import { RESERVED_SLUGS } from "@/lib/slug"
import type { RestaurantRepository } from "@/lib/repository"

/**
 * Route tree (design D4, spec ST-2/AD-1/SA-1): B2B-first. `/` redirects to
 * the admin panel (no public directory; clients reach a restaurant only
 * through the shared direct `/:slug` link), `/:slug` scoped storefront
 * (unknown slug → not-found; reserved system slugs never reach a storefront),
 * `/r/:slug` legacy redirect, `/r/:slug/admin` legacy redirect, `/admin`
 * unified role-driven admin (gate accepts both the super password and any
 * restaurant's admin password; the layout shows sections by session mode),
 * `*` not-found fallback.
 */
function AppShell() {
  const location = useLocation()

  // Cart scope = active restaurant slug (RD-2): switching slugs clears the
  // cart through CartProvider; leaving to any non-storefront route resets it.
  // With the direct /:slug storefront the scope is the first path segment,
  // except on reserved system routes.
  const cartScope = useMemo(() => {
    const segment = location.pathname.split("/")[1] ?? ""
    if (segment === "" || RESERVED_SLUGS.includes(segment)) return undefined
    return segment
  }, [location.pathname])

  return (
    <AdminProvider>
      <CartProvider scope={cartScope}>
        <Routes>
          <Route
            path="/"
            element={
              <DefaultThemeScope>
                <Navigate to="/admin" replace />
              </DefaultThemeScope>
            }
          />
          <Route path="/:slug" element={<Storefront />} />
          <Route path="/r/:slug" element={<LegacyStorefrontRedirect />} />
          <Route
            path="/r/:slug/admin"
            element={<Navigate to="/admin" replace />}
          />
          <Route
            path="/admin"
            element={
              <AdminGate>
                <AdminShell />
              </AdminGate>
            }
          >
            <Route index element={<AdminIndex />} />
            <Route path="products" element={<ScopedProducts />} />
            <Route path="orders" element={<ScopedOrders />} />
            <Route path="sales" element={<ScopedSales />} />
            <Route path="config" element={<ScopedConfig />} />
            <Route path="restaurants" element={<RestaurantsPage />} />
            <Route path="restaurants/new" element={<CreateRestaurantPage />} />
            <Route path="restaurants/:id/edit" element={<EditRestaurantPage />} />
            <Route path="password" element={<SuperPasswordPage />} />
          </Route>
          <Route
            path="*"
            element={
              <DefaultThemeScope>
                <NotFoundState />
              </DefaultThemeScope>
            }
          />
        </Routes>
        <Toaster position="top-right" richColors closeButton />
      </CartProvider>
    </AdminProvider>
  )
}

/**
 * Legacy storefront redirect: keeps already-shared `/r/:slug` links working
 * by forwarding to the direct `/:slug` storefront route.
 */
function LegacyStorefrontRedirect() {
  const { slug } = useParams()
  return <Navigate to={`/${slug}`} replace />
}

/**
 * Scoped repository handed to section pages via AdminShell's Outlet context
 * (design D4): every /admin section reads the active restaurant's data through
 * these wrappers, so a restaurant admin only sees its own tenant. Undefined
 * means the section has no scoped restaurant (e.g. super at the global
 * summary, or a deleted selection) and renders the not-found state instead of
 * crashing.
 */
function useScopedRepo(): RestaurantRepository | undefined {
  return useOutletContext<RestaurantRepository | undefined>()
}

function ScopedProducts() {
  const repo = useScopedRepo()
  if (!repo) return <NotFoundState />
  return <ProductsPage repo={repo} />
}

function ScopedOrders() {
  const repo = useScopedRepo()
  if (!repo) return <NotFoundState />
  return <OrdersPage repo={repo} />
}

function ScopedSales() {
  const repo = useScopedRepo()
  if (!repo) return <NotFoundState />
  return <SalesPage repo={repo} />
}

function ScopedConfig() {
  const repo = useScopedRepo()
  if (!repo) return <NotFoundState />
  return <ConfigPage repo={repo} />
}

function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  )
}

export default App