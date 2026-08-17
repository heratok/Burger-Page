import { useEffect } from "react"
import { HashRouter, Navigate, Route, Routes } from "react-router"
import Home from "./pages/Home"
import AdminLayout from "./pages/admin/AdminLayout"
import AdminGate from "./pages/admin/AdminGate"
import ProductsPage from "./pages/admin/ProductsPage"
import OrdersPage from "./pages/admin/OrdersPage"
import SalesPage from "./pages/admin/SalesPage"
import ConfigPage from "./pages/admin/ConfigPage"
import { Toaster } from "@/components/ui/sonner"
import { CartProvider } from "./store/CartContext"
import { AdminProvider } from "./store/AdminContext"
import { applyAccent } from "./lib/theme"
import { storage } from "./lib/storage"

function App() {
  useEffect(() => {
    applyAccent(storage.getConfig().accent)
  }, [])

  return (
    <HashRouter>
      <AdminProvider>
        <CartProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/admin"
              element={
                <AdminGate>
                  <AdminLayout />
                </AdminGate>
              }
            >
              <Route index element={<Navigate to="/admin/products" replace />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="sales" element={<SalesPage />} />
              <Route path="config" element={<ConfigPage />} />
            </Route>
            <Route path="*" element={<Home />} />
          </Routes>
          <Toaster position="top-right" richColors closeButton />
        </CartProvider>
      </AdminProvider>
    </HashRouter>
  )
}

export default App