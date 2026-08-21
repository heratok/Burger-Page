import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Utensils, ShieldCheck, Flame } from "lucide-react"
import CardBurger from "../components/Card"
import type { BurgerCompra, Burger } from "../data/data"
import type { MenuItem } from "@/types/restaurant"
import Additions from "./Additions"
import Navbar from "../components/Navbar"
import Buscar from "../components/Buscar"
import Nav from "../components/Nav"
import ShoppingCart from "./ShoppingCart"
import Form from "./Form"
import LoadingPage from "../components/LoadingPage"
import { useRestaurant } from "@/context/RestaurantContext"

export default function Home() {
  const { products, storeConfig, setActiveView } = useRestaurant()
  const [click, setClick] = useState(false)
  const [ver, setVer] = useState(false)
  const [openForm, setOpenForm] = useState(false)
  const [selectedBurger, setSelectedBurger] = useState<MenuItem | Burger>(products[0])
  const [lisBuy, setListBuy] = useState<BurgerCompra[]>([])
  const [texto, setTexto] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL")
  const [loading, setLoading] = useState(true)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  // Keep selectedBurger in sync if products load
  useEffect(() => {
    if (products.length > 0 && !selectedBurger) {
      setSelectedBurger(products[0])
    }
  }, [products, selectedBurger])

  const categories = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => {
      if (p.category) set.add(p.category)
    })
    return Array.from(set)
  }, [products])

  const agregarList = (burgerCompra: BurgerCompra) => {
    if (editingIndex !== null) {
      setListBuy((prev) =>
        prev.map((item, i) => (i === editingIndex ? burgerCompra : item))
      )
      setEditingIndex(null)
      toast.success("Cambios guardados")
      return
    }
    setListBuy((prev) => [...prev, burgerCompra])
    toast.success(`${burgerCompra.name} agregada al carrito`)
  }

  const deleteCart = (listActual: BurgerCompra[]) => {
    setListBuy(listActual)
  }

  const onCliked = (hamburguesa: MenuItem | Burger) => {
    setSelectedBurger(hamburguesa)
    setEditingIndex(null)
    setClick(true)
  }

  const editarItem = (index: number) => {
    const item = lisBuy[index]
    if (!item) return
    const burger = products.find((b) => b.name === item.name)
    if (!burger) return
    setSelectedBurger(burger)
    setEditingIndex(index)
    setClick(true)
  }

  const abrirForm = () => setOpenForm(true)
  const mostrar = () => setVer(true)
  const cerrarCarrito = () => setVer(false)
  const cerrarForm = () => setOpenForm(false)
  const cerrar = () => {
    setClick(false)
    setEditingIndex(null)
  }

  const onChangeText = (text: string) => setTexto(text)

  const totalCarrito = useMemo(
    () => lisBuy.reduce((acc, item) => acc + item.totalapagar, 0),
    [lisBuy]
  )

  const filterBurger = useMemo(() => {
    const query = texto.toLowerCase().trim()
    return products.filter((objeto) => {
      const matchQuery =
        !query ||
        objeto.name.toLowerCase().includes(query) ||
        objeto.description.toLowerCase().includes(query)
      const matchCategory =
        selectedCategory === "ALL" || objeto.category === selectedCategory
      return matchQuery && matchCategory
    })
  }, [products, texto, selectedCategory])

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 300)
    return () => window.clearTimeout(t)
  }, [])

  const showFullScreen = ver || openForm
  const showMobileBar = lisBuy.length > 0 && !showFullScreen

  // Determine dynamic background class based on storeConfig
  const getThemeClass = (theme: typeof storeConfig.bgTheme) => {
    switch (theme) {
      case "dark-charcoal":
        return "bg-[#0F1112] text-[#F5F5F7]"
      case "deep-midnight":
        return "bg-[#050607] text-[#FFFFFF]"
      case "warm-cream":
        return "bg-[#FAF6EF] text-[#2A231C]"
      case "clean-white":
        return "bg-[#FFFFFF] text-[#0F172A]"
      default:
        return "bg-bg-base text-text-primary"
    }
  }

  const themeClass = getThemeClass(storeConfig.bgTheme)

  return (
    <div
      style={
        {
          "--color-accent": storeConfig.primaryColor,
          "--color-primary": storeConfig.primaryColor,
          "--color-ring": storeConfig.primaryColor,
        } as React.CSSProperties
      }
      className={`min-h-screen transition-colors duration-200 ${themeClass}`}
    >
      <Navbar cantidad={lisBuy.length} total={totalCarrito} onOpenCart={mostrar} />

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
          ver ? (
            <ShoppingCart
              list={lisBuy}
              deleteCart={deleteCart}
              editarItem={editarItem}
              cerrar={cerrar}
              abrirForm={abrirForm}
              cerrarCarrito={cerrarCarrito}
            />
          ) : (
            <Form
              cerrar={cerrar}
              hamburguesas={lisBuy}
              mostrar={mostrar}
              cerrarForm={cerrarForm}
            />
          )
        ) : (
          <div className="space-y-6">
            {!storeConfig.showBanner && (
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {storeConfig.name}
                </h1>
                <p className="mt-1 text-sm opacity-80 max-w-md mx-auto">
                  {storeConfig.tagline}
                </p>
              </div>
            )}

            {/* Category Pills & Search */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 justify-center sm:justify-start">
                <Buscar onChangeText={onChangeText} total={filterBurger.length} />
              </div>

              {/* Category Pills */}
              {categories.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("ALL")}
                    style={
                      selectedCategory === "ALL"
                        ? { backgroundColor: storeConfig.primaryColor, color: "#FFFFFF" }
                        : undefined
                    }
                    className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                      selectedCategory === "ALL"
                        ? "shadow-sm"
                        : "border border-border-subtle bg-bg-elevated hover:bg-bg-elevated-2"
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
                          ? { backgroundColor: storeConfig.primaryColor, color: "#FFFFFF" }
                          : undefined
                      }
                      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                        selectedCategory === cat
                          ? "shadow-sm"
                          : "border border-border-subtle bg-bg-elevated hover:bg-bg-elevated-2"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {filterBurger.length === 0 ? (
              <EmptyResults />
            ) : (
              <div
                className={`grid gap-4 md:gap-6 ${
                  storeConfig.compactGrid
                    ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                    : "grid-cols-1 min-[430px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                }`}
                role="list"
                aria-label="Lista de hamburguesas"
              >
                {filterBurger.map((hamburger) => (
                  <div role="listitem" key={hamburger.id || hamburger.name}>
                    <CardBurger
                      hamburger={hamburger}
                      onCliked={() => onCliked(hamburger)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Manager CRM Shortcut (Bottom Left) */}
      <div className="fixed bottom-4 left-4 z-40">
        <button
          type="button"
          onClick={() => setActiveView("admin")}
          className="flex items-center gap-2 rounded-full border border-indigo-500/30 bg-slate-900/90 px-3.5 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-md transition-all duration-150 hover:scale-105 hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          title="Ir al Dashboard de Administración CRM"
        >
          <ShieldCheck className="size-4 text-indigo-400" />
          <span className="hidden min-[380px]:inline">Panel de Administración</span>
          <span className="min-[380px]:hidden">CRM</span>
        </button>
      </div>

      {showMobileBar && (
        <Nav mostrar={mostrar} cantidad={lisBuy.length} total={totalCarrito} />
      )}

      {click && (
        <Additions
          agregarList={agregarList}
          cerrar={cerrar}
          hamburger={selectedBurger as Burger}
          editing={editingIndex !== null}
          initial={editingIndex !== null ? lisBuy[editingIndex] : undefined}
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
        No encontramos hamburguesas
      </h2>
      <p className="mt-2 max-w-sm text-sm text-text-secondary">
        No hay coincidencias con ese nombre o categoría. Prueba buscando otra cosa o revisa
        nuestro menú completo.
      </p>
    </div>
  )
}