import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Utensils, Flame } from "lucide-react"
import ProductCard from "./ProductCard"
import type { MenuItem } from "@/types/restaurant"
import Navbar from "./Navbar"
import ProductSearch from "./ProductSearch"
import MobileOrderBar from "./MobileOrderBar"
import LoadingPage from "./LoadingPage"
import {
  ShoppingCart,
  AdditionsModal,
  CheckoutForm,
  type CartItem,
} from "@/features/cart"
import { useRestaurant } from "@/context/RestaurantContext"

export default function Home() {
  const { products, storeConfig } = useRestaurant()
  const [isAdditionsModalOpen, setIsAdditionsModalOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<MenuItem>(products[0])
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [searchText, setSearchText] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL")
  const [loading, setLoading] = useState(true)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  // Keep selectedProduct in sync if products load
  useEffect(() => {
    if (products.length > 0 && !selectedProduct) {
      setSelectedProduct(products[0])
    }
  }, [products, selectedProduct])

  const categories = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => {
      if (p.category) set.add(p.category)
    })
    return Array.from(set)
  }, [products])

  const handleAddToCart = (cartItem: CartItem) => {
    if (editingIndex !== null) {
      setCartItems((prev) =>
        prev.map((item, i) => (i === editingIndex ? cartItem : item))
      )
      setEditingIndex(null)
      toast.success("Cambios guardados")
      return
    }
    setCartItems((prev) => [...prev, cartItem])
    toast.success(`${cartItem.name} agregada al carrito`)
  }

  const handleDeleteCart = (updatedItems: CartItem[]) => {
    setCartItems(updatedItems)
  }

  const handleProductClick = (product: MenuItem) => {
    setSelectedProduct(product)
    setEditingIndex(null)
    setIsAdditionsModalOpen(true)
  }

  const handleEditCartItem = (index: number) => {
    const item = cartItems[index]
    if (!item) return
    const product = products.find((b) => b.id === item.menuItemId || b.name === item.name)
    if (!product) return
    setSelectedProduct(product)
    setEditingIndex(index)
    setIsAdditionsModalOpen(true)
  }

  const handleOpenCheckout = () => setIsCheckoutOpen(true)
  const handleOpenCart = () => setIsCartOpen(true)
  const handleCloseCart = () => setIsCartOpen(false)
  const handleCloseCheckout = () => setIsCheckoutOpen(false)
  const handleCloseModal = () => {
    setIsAdditionsModalOpen(false)
    setEditingIndex(null)
  }

  const totalCart = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.total, 0),
    [cartItems]
  )

  const filteredProducts = useMemo(() => {
    const query = searchText.toLowerCase().trim()
    return products.filter((objeto) => {
      const matchQuery =
        !query ||
        objeto.name.toLowerCase().includes(query) ||
        objeto.description.toLowerCase().includes(query)
      const matchCategory =
        selectedCategory === "ALL" || objeto.category === selectedCategory
      return matchQuery && matchCategory
    })
  }, [products, searchText, selectedCategory])

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 300)
    return () => window.clearTimeout(t)
  }, [])

  const showFullScreen = isCartOpen || isCheckoutOpen
  const showMobileBar = cartItems.length > 0 && !showFullScreen

  const getThemeStyle = (theme: typeof storeConfig.bgTheme): React.CSSProperties => {
    switch (theme) {
      case "clean-white":
        return {
          "--color-bg-base": "#FFFFFF",
          "--color-bg-surface": "#F8FAFC",
          "--color-bg-elevated": "#FFFFFF",
          "--color-bg-elevated-2": "#F1F5F9",
          "--color-bg-input": "#F8FAFC",
          "--color-border-subtle": "#E2E8F0",
          "--color-border-strong": "#CBD5E1",
          "--color-text-primary": "#0F172A",
          "--color-text-secondary": "#475569",
          "--color-text-muted": "#64748B",
          "--color-card": "#FFFFFF",
          "--color-card-foreground": "#0F172A",
          "--color-accent": storeConfig.primaryColor,
          "--color-primary": storeConfig.primaryColor,
          "--color-ring": storeConfig.primaryColor,
          backgroundColor: "#FFFFFF",
          color: "#0F172A",
        } as React.CSSProperties
      case "warm-cream":
        return {
          "--color-bg-base": "#FAF6EF",
          "--color-bg-surface": "#F4ECE1",
          "--color-bg-elevated": "#FFFFFF",
          "--color-bg-elevated-2": "#ECE2D0",
          "--color-bg-input": "#F7F0E6",
          "--color-border-subtle": "#E4DAC8",
          "--color-border-strong": "#D0C3AE",
          "--color-text-primary": "#2A231C",
          "--color-text-secondary": "#5C4F43",
          "--color-text-muted": "#8C7E72",
          "--color-card": "#FFFFFF",
          "--color-card-foreground": "#2A231C",
          "--color-accent": storeConfig.primaryColor,
          "--color-primary": storeConfig.primaryColor,
          "--color-ring": storeConfig.primaryColor,
          backgroundColor: "#FAF6EF",
          color: "#2A231C",
        } as React.CSSProperties
      case "deep-midnight":
        return {
          "--color-bg-base": "#050607",
          "--color-bg-surface": "#101216",
          "--color-bg-elevated": "#181B22",
          "--color-bg-elevated-2": "#222630",
          "--color-bg-input": "#13161C",
          "--color-border-subtle": "#252B38",
          "--color-border-strong": "#374151",
          "--color-text-primary": "#FFFFFF",
          "--color-text-secondary": "#CBD5E1",
          "--color-text-muted": "#94A3B8",
          "--color-card": "#181B22",
          "--color-card-foreground": "#FFFFFF",
          "--color-accent": storeConfig.primaryColor,
          "--color-primary": storeConfig.primaryColor,
          "--color-ring": storeConfig.primaryColor,
          backgroundColor: "#050607",
          color: "#FFFFFF",
        } as React.CSSProperties
      case "dark-charcoal":
      default:
        return {
          "--color-bg-base": "#0F1112",
          "--color-bg-surface": "#181A1B",
          "--color-bg-elevated": "#212529",
          "--color-bg-elevated-2": "#2A2F35",
          "--color-bg-input": "#1A1D20",
          "--color-border-subtle": "#2D3138",
          "--color-border-strong": "#3A4048",
          "--color-text-primary": "#F5F5F7",
          "--color-text-secondary": "#C5C8CC",
          "--color-text-muted": "#8B8F95",
          "--color-card": "#212529",
          "--color-card-foreground": "#F5F5F7",
          "--color-accent": storeConfig.primaryColor,
          "--color-primary": storeConfig.primaryColor,
          "--color-ring": storeConfig.primaryColor,
          backgroundColor: "#0F1112",
          color: "#F5F5F7",
        } as React.CSSProperties
    }
  }

  const themeStyles = getThemeStyle(storeConfig.bgTheme)

  return (
    <div
      style={themeStyles}
      className="min-h-screen transition-colors duration-200"
    >
      <Navbar cantidad={cartItems.length} total={totalCart} onOpenCart={handleOpenCart} />

      <a id="main" className="sr-only" tabIndex={-1}>
        Inicio del contenido principal
      </a>

      {/* Hero Banner if Enabled */}
      {!showFullScreen && storeConfig.showBanner && storeConfig.bannerUrl && (
        <div className="relative h-48 sm:h-64 md:h-72 w-full overflow-hidden">
          <img
            src={storeConfig.bannerUrl}
            alt={storeConfig.name}
            className="size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex items-end">
            <div className="mx-auto max-w-(--container) w-full px-4 pb-6 md:px-6 lg:px-8">
              <span
                style={{ backgroundColor: storeConfig.primaryColor }}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black text-white shadow-md uppercase tracking-wider mb-2"
              >
                <Flame className="size-3.5" />
                Cocina Artesanal
              </span>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white drop-shadow-md">
                {storeConfig.name}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-200 max-w-xl line-clamp-2">
                {storeConfig.tagline} &middot; {storeConfig.estimatedDeliveryTime}
              </p>
            </div>
          </div>
        </div>
      )}

      <main
        className={`mx-auto max-w-(--container) px-4 pt-6 md:px-6 lg:px-8 ${
          showMobileBar ? "pb-44 sm:pb-6" : "pb-12"
        }`}
      >
        {loading ? (
          <LoadingPage />
        ) : showFullScreen ? (
          isCartOpen ? (
            <ShoppingCart
              items={cartItems}
              onDeleteCart={handleDeleteCart}
              onEditItem={handleEditCartItem}
              onClose={handleCloseModal}
              onOpenCheckout={handleOpenCheckout}
              onCloseCart={handleCloseCart}
            />
          ) : (
            <CheckoutForm
              onClose={handleCloseCheckout}
              cartItems={cartItems}
              onBackToCart={handleOpenCart}
            />
          )
        ) : (
          <div className="space-y-6">
            {!storeConfig.showBanner && (
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-text-primary">
                  {storeConfig.name}
                </h1>
                <p className="mt-1 text-sm text-text-secondary max-w-md mx-auto">
                  {storeConfig.tagline}
                </p>
              </div>
            )}

            {/* Category Pills & Search */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 justify-center sm:justify-start">
                <ProductSearch onChangeText={(text) => setSearchText(text)} total={filteredProducts.length} />
              </div>

              {/* Category Pills */}
              {categories.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("ALL")}
                    style={
                      selectedCategory === "ALL"
                        ? { backgroundColor: storeConfig.primaryColor, color: "#FFFFFF", borderColor: storeConfig.primaryColor }
                        : undefined
                    }
                    className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                      selectedCategory === "ALL"
                        ? "shadow-sm text-white"
                        : "border border-border-subtle bg-bg-elevated text-text-primary hover:bg-bg-elevated-2 hover:border-border-strong"
                    }`}
                  >
                    Todos ({products.length})
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      style={
                        selectedCategory === cat
                          ? { backgroundColor: storeConfig.primaryColor, color: "#FFFFFF", borderColor: storeConfig.primaryColor }
                          : undefined
                      }
                      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                        selectedCategory === cat
                          ? "shadow-sm text-white"
                          : "border border-border-subtle bg-bg-elevated text-text-primary hover:bg-bg-elevated-2 hover:border-border-strong"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {filteredProducts.length === 0 ? (
              <EmptyResults />
            ) : (
              <div
                className={`grid gap-4 md:gap-6 ${
                  storeConfig.compactGrid
                    ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                    : "grid-cols-1 min-[430px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                }`}
                role="list"
                aria-label="Lista de productos"
              >
                {filteredProducts.map((product) => (
                  <div role="listitem" key={product.id || product.name}>
                    <ProductCard
                      product={product}
                      onSelectProduct={() => handleProductClick(product)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {showMobileBar && (
        <MobileOrderBar
          onOpenCart={handleOpenCart}
          itemCount={cartItems.length}
          total={totalCart}
        />
      )}

      {isAdditionsModalOpen && (
        <AdditionsModal
          onAddToCart={handleAddToCart}
          onClose={handleCloseModal}
          product={selectedProduct}
          editing={editingIndex !== null}
          initial={editingIndex !== null ? cartItems[editingIndex] : undefined}
        />
      )}
    </div>
  )
}

function EmptyResults() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center px-4 py-16 text-center"
    >
      <span className="mb-4 inline-flex size-20 items-center justify-center rounded-full border border-border-subtle bg-bg-elevated text-text-muted">
        <Utensils className="size-10" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold text-text-primary">
        No encontramos resultados
      </h2>
      <p className="mt-2 max-w-sm text-sm text-text-secondary">
        No hay coincidencias con ese nombre o categoría. Prueba buscando otra cosa o revisa
        nuestro menú completo.
      </p>
    </div>
  )
}