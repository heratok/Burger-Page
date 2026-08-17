import { useEffect } from "react"
import { HashRouter, Navigate, Route, Routes } from "react-router"
import Home from "./pages/Home"
import AdminLayout from "./pages/admin/AdminLayout"
import ProductsPage from "./pages/admin/ProductsPage"
import { Toaster } from "@/components/ui/sonner"
import { CartProvider } from "./store/CartContext"
import { applyAccent } from "./lib/theme"
import { storage } from "./lib/storage"

function App() {
  useEffect(() => {
    applyAccent(storage.getConfig().accent)
  }, [])

  return (
    <HashRouter>
      <CartProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/products" replace />} />
            <Route path="products" element={<ProductsPage />} />
          </Route>
          <Route path="*" element={<Home />} />
        </Routes>
        <Toaster position="top-right" richColors closeButton />
      </CartProvider>
    </HashRouter>
  )
}

export default App