import { useEffect, useMemo, useRef, useState } from "react"
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
import { getFontFamilyClass, getStoreThemeStyles } from "@/features/crm/utils/customizerStyles"
import { getContrastForeground } from "@/lib/utils"

export default function Home() {
  const { products, storeConfig, categories: contextCategories } = useRestaurant()
  const [isAdditionsModalOpen, setIsAdditionsModalOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<MenuItem>(products[0])
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [searchText, setSearchText] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL")
  const [loading, setLoading] = useState(true)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const pillContainerRef = useRef<HTMLDivElement>(null)
  const pillRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const handleCategoryClick = (cat: string) => {
    setSelectedCategory(cat)
    const activeBtn = pillRefs.current.get(cat)
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
    }
    const catalogEl = document.getElementById("storefront-catalog")
    if (catalogEl) {
      catalogEl.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  // Keep selectedProduct in sync if products load
  useEffect(() => {
    if (products.length > 0 && !selectedProduct) {
      setSelectedProduct(products[0])
    }
  }, [products, selectedProduct])

  const categories = useMemo(() => {
    const set = new Set<string>(contextCategories || [])
    products.forEach((p) => {
      if (p.category) set.add(p.category)
    })
    return Array.from(set)
  }, [products, contextCategories])

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

  const handleOpenCheckout = () => {
    setIsCartOpen(false)
    setIsCheckoutOpen(true)
  }
  const handleOpenCart = () => {
    setIsCheckoutOpen(false)
    setIsCartOpen(true)
  }
  const handleCloseCart = () => {
    setIsCartOpen(false)
    setIsCheckoutOpen(false)
  }
  const handleCloseCheckout = () => {
    setIsCheckoutOpen(false)
    setIsCartOpen(false)
    setCartItems([])
  }
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

  const sections = useMemo(() => {
    if (filteredProducts.length === 0) return []

    // If a specific category is selected, return only that category
    if (selectedCategory !== "ALL") {
      const items = filteredProducts.filter(
        (p) => p.category === selectedCategory
      )
      if (items.length > 0) {
        return [{ category: selectedCategory, items }]
      }
      return []
    }

    // When "ALL" is selected, group products preserving designated categories order
    const map = new Map<string, MenuItem[]>()
    categories.forEach((cat) => {
      map.set(cat, [])
    })

    filteredProducts.forEach((prod) => {
      const cat = prod.category?.trim() || "Otros"
      if (!map.has(cat)) {
        map.set(cat, [])
      }
      map.get(cat)!.push(prod)
    })

    const result: { category: string; items: MenuItem[] }[] = []
    for (const [category, items] of map.entries()) {
      if (items.length > 0) {
        result.push({ category, items })
      }
    }
    return result
  }, [categories, filteredProducts, selectedCategory])

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 300)
    return () => window.clearTimeout(t)
  }, [])

  const showFullScreen = isCartOpen || isCheckoutOpen
  const showMobileBar = cartItems.length > 0 && !showFullScreen

  const primaryForeground = getContrastForeground(storeConfig.primaryColor)
  const themeStyles = getStoreThemeStyles(storeConfig.bgTheme, storeConfig.primaryColor)
  const fontClass = getFontFamilyClass(storeConfig.fontFamily)

  return (
    <div
      style={themeStyles}
      className={`min-h-screen transition-colors duration-200 ${fontClass}`}
    >
      <Navbar
        cantidad={cartItems.length}
        total={totalCart}
        onOpenCart={handleOpenCart}
        onGoToMenu={handleCloseCart}
      />

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
                style={{
                  backgroundColor: storeConfig.primaryColor,
                  color: primaryForeground,
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black shadow-md uppercase tracking-wider mb-2"
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
                <h1
                  style={{ color: "var(--color-text-primary)" }}
                  className="text-2xl font-black tracking-tight sm:text-3xl"
                >
                  {storeConfig.name}
                </h1>
                <p
                  style={{ color: "var(--color-text-secondary)" }}
                  className="mt-1 text-sm max-w-md mx-auto font-normal"
                >
                  {storeConfig.tagline}
                </p>
              </div>
            )}

            {/* Search Input */}
            <div className="flex justify-center sm:justify-start">
              <ProductSearch onChangeText={(text) => setSearchText(text)} total={filteredProducts.length} />
            </div>

            {/* Category Pills Bar (Horizontal slider, sticky under header) */}
            {categories.length > 0 && (
              <div
                className={`sticky ${
                  storeConfig.showAnnouncement && storeConfig.announcementText
                    ? "top-[92px]"
                    : "top-16"
                } z-20 -mx-4 px-4 py-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b border-border-subtle backdrop-blur-md transition-colors`}
                style={{
                  backgroundColor: "color-mix(in srgb, var(--color-bg-base) 92%, transparent)",
                }}
              >
                <div
                  ref={pillContainerRef}
                  className="flex items-center gap-1.5 overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  aria-label="Categorías del menú"
                >
                  <button
                    ref={(el) => {
                      if (el) pillRefs.current.set("ALL", el)
                    }}
                    type="button"
                    onClick={() => handleCategoryClick("ALL")}
                    style={
                      selectedCategory === "ALL"
                        ? {
                            backgroundColor: storeConfig.primaryColor,
                            color: primaryForeground,
                            borderColor: storeConfig.primaryColor,
                          }
                        : undefined
                    }
                    className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                      selectedCategory === "ALL"
                        ? "shadow-sm"
                        : "border border-border-subtle bg-bg-elevated text-text-primary hover:bg-bg-elevated-2 hover:border-border-strong"
                    }`}
                  >
                    Todos ({products.length})
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      ref={(el) => {
                        if (el) pillRefs.current.set(cat, el)
                      }}
                      type="button"
                      onClick={() => handleCategoryClick(cat)}
                      style={
                        selectedCategory === cat
                          ? {
                              backgroundColor: storeConfig.primaryColor,
                              color: primaryForeground,
                              borderColor: storeConfig.primaryColor,
                            }
                          : undefined
                      }
                      className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                        selectedCategory === cat
                          ? "shadow-sm"
                          : "border border-border-subtle bg-bg-elevated text-text-primary hover:bg-bg-elevated-2 hover:border-border-strong"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredProducts.length === 0 ? (
              <EmptyResults />
            ) : (
              <div id="storefront-catalog" className="space-y-8 sm:space-y-10">
                {sections.map(({ category, items }) => (
                  <section
                    key={category}
                    id={`category-section-${encodeURIComponent(category)}`}
                    className="scroll-mt-32 sm:scroll-mt-36 space-y-3 sm:space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                      <div className="flex items-center gap-2">
                        <h2
                          style={{ color: "var(--color-text-primary)" }}
                          className="text-lg font-black tracking-tight sm:text-xl"
                        >
                          {category}
                        </h2>
                        <span
                          style={{
                            backgroundColor: "var(--color-bg-elevated-2)",
                            color: "var(--color-text-muted)",
                            borderColor: "var(--color-border-subtle)",
                          }}
                          className="rounded-full border px-2 py-0.5 text-xs font-semibold"
                        >
                          {items.length}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`grid gap-4 md:gap-6 ${
                        storeConfig.compactGrid
                          ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                          : "grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
                      }`}
                      role="list"
                      aria-label={`Productos de ${category}`}
                    >
                      {items.map((product) => (
                        <div role="listitem" key={product.id || product.name} className="h-full w-full flex flex-col">
                          <ProductCard
                            product={product}
                            onSelectProduct={() => handleProductClick(product)}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
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
      <span
        style={{
          backgroundColor: "var(--color-bg-elevated)",
          borderColor: "var(--color-border-subtle)",
          color: "var(--color-text-muted)",
        }}
        className="mb-4 inline-flex size-20 items-center justify-center rounded-full border shadow-xs"
      >
        <Utensils className="size-10" aria-hidden="true" />
      </span>
      <h2
        style={{ color: "var(--color-text-primary)" }}
        className="text-lg font-bold"
      >
        No encontramos resultados
      </h2>
      <p
        style={{ color: "var(--color-text-secondary)" }}
        className="mt-2 max-w-sm text-sm font-normal"
      >
        No hay coincidencias con ese nombre o categoría. Prueba buscando otra cosa o revisa
        nuestro menú completo.
      </p>
    </div>
  )
}