import { useEffect } from "react"
import { HashRouter, Route, Routes } from "react-router"
import Home from "./pages/Home"
import { Toaster } from "@/components/ui/sonner"
import { CartProvider } from "./store/CartContext"
import { applyAccent } from "./lib/theme"
import { storage } from "./lib/storage"

function AdminPlaceholder() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          Panel de administración
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Disponible próximamente.
        </p>
      </div>
    </main>
  )
}

function App() {
  useEffect(() => {
    applyAccent(storage.getConfig().accent)
  }, [])

  return (
    <HashRouter>
      <CartProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<AdminPlaceholder />} />
          <Route path="*" element={<Home />} />
        </Routes>
        <Toaster position="top-right" richColors closeButton />
      </CartProvider>
    </HashRouter>
  )
}

export default App