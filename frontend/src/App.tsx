import { useMemo } from "react"
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useOutletContext,
} from "react-router"
import RestaurantDirectory from "./pages/RestaurantDirectory"
import Storefront from "./pages/Storefront"
import RestaurantAdminRoute from "./pages/RestaurantAdminRoute"
import AdminLayout from "./pages/admin/AdminLayout"
import AdminGate from "./pages/admin/AdminGate"
import ProductsPage from "./pages/admin/ProductsPage"
import OrdersPage from "./pages/admin/OrdersPage"
import SalesPage from "./pages/admin/SalesPage"
import ConfigPage from "./pages/admin/ConfigPage"
import NotFoundState from "./components/NotFoundState"
import { DefaultThemeScope } from "./components/ThemeScope"
import { Toaster } from "@/components/ui/sonner"
import { CartProvider } from "./store/CartContext"
import { AdminProvider } from "./store/AdminContext"
import type { RestaurantRepository } from "@/lib/repository"

/**
 * Route tree (design D4, spec ST-2): `/` directory, `/r/:slug` scoped
 * storefront (unknown slug → not-found), `/r/:slug/admin` scoped restaurant
 * admin (mode-aware gate), `/admin` legacy layout (super portal in P6),
 * `*` not-found fallback.
 */
function AppShell() {
  const location = useLocation()

  // Cart scope = active restaurant slug (RD-2): switching slugs clears the
  // cart through CartProvider; leaving to any non-storefront route resets it.
  const cartScope = useMemo(() => {
    const match = /^\/r\/([^/]+)/.exec(location.pathname)
    return match ? match[1] : undefined
  }, [location.pathname])

  return (
    <AdminProvider>
      <CartProvider scope={cartScope}>
        <Routes>
          <Route
            path="/"
            element={
              <DefaultThemeScope>
                <RestaurantDirectory />
              </DefaultThemeScope>
            }
          />
          <Route path="/r/:slug" element={<Storefront />} />
          <Route
            path="/r/:slug/admin"
            element={<RestaurantAdminRoute />}
          >
            <Route index element={<Navigate to="products" replace />} />
            <Route path="products" element={<ScopedProducts />} />
            <Route path="orders" element={<ScopedOrders />} />
            <Route path="sales" element={<ScopedSales />} />
            <Route path="config" element={<ScopedConfig />} />
          </Route>
          <Route
            path="/admin"
            element={
              <DefaultThemeScope>
                <AdminGate>
                  <AdminLayout />
                </AdminGate>
              </DefaultThemeScope>
            }
          >
            <Route index element={<Navigate to="/admin/products" replace />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="config" element={<ConfigPage />} />
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
 * Scoped repository handed to section pages via AdminLayout's Outlet context
 * (design D4): every /r/:slug/admin section reads the active restaurant's
 * data through these wrappers, so each admin only sees its own tenant.
 */
function useScopedRepo(): RestaurantRepository {
  return useOutletContext<RestaurantRepository>()
}

function ScopedProducts() {
  return <ProductsPage repo={useScopedRepo()} />
}

function ScopedOrders() {
  return <OrdersPage repo={useScopedRepo()} />
}

function ScopedSales() {
  return <SalesPage repo={useScopedRepo()} />
}

function ScopedConfig() {
  return <ConfigPage repo={useScopedRepo()} />
}

function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  )
}

export default App