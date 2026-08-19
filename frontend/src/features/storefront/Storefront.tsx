import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router"
import { toast } from "sonner"
import { Utensils } from "lucide-react"
import ProductCard from "./ProductCard"
import { storage } from "@/shared/storage/storage"
import { useCart } from "@/store/cart-context"
import type { CartItem, Product } from "@/shared/domain/domain"
import type { DirectoryRepository, RestaurantRepository } from "@/shared/storage/repository"
import { ThemeScope } from "@/shared/ui/ThemeScope"
import NotFoundState from "@/shared/ui/NotFoundState"
import ProductCustomize from "./ProductCustomize"
import CartNavbar from "./CartNavbar"
import SearchMenu from "./SearchMenu"
import MobileCartBar from "./MobileCartBar"
import CartView from "./CartView"
import CheckoutForm from "./CheckoutForm"
import LoadingPage from "@/shared/ui/LoadingPage"

/**
 * Scoped storefront (design D4, spec ST-1/ST-2/ST-3, RD-2): resolves the
 * active restaurant by slug through an injectable directory seam (defaulting
 * to the `storage` singleton), applies its palette and serves every data read
 * through the scoped repository. Unknown slugs render a not-found state
 * linking back to the directory.
 */
interface StorefrontProps {
  /** Directory seam (spec ST-3); tests inject a fake, production uses the singleton. */
  directory?: DirectoryRepository
}

export default function Storefront({ directory = storage }: StorefrontProps) {
  const { slug } = useParams()
  const restaurant = directory.getBySlug(slug ?? "")

  if (!restaurant) {
    return <NotFoundState />
  }

  return (
    <ThemeScope palette={restaurant.palette}>
      <StorefrontContent repo={directory.getRepositoryFor(restaurant.id)} />
    </ThemeScope>
  )
}

interface StorefrontContentProps {
  repo: RestaurantRepository
}

function StorefrontContent({ repo }: StorefrontContentProps) {
  const [click, setClick] = useState(false)
  const [ver, setVer] = useState(false)
  const [openForm, setOpenForm] = useState(false)
  const [selectedBurger, setSelectedBurger] = useState<Product | undefined>(
    () => {
      const first = (repo.listProducts() ?? []).find((p) => p.available)
      return first
    }
  )
  const [texto, setTexto] = useState("")
  const [loading, setLoading] = useState(true)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const { items: lisBuy, addItem, updateItem, total: totalCarrito } = useCart()

  const products = (repo.listProducts() ?? []).filter((p) => p.available)

  const agregarList = (item: CartItem) => {
    if (editingIndex !== null) {
      updateItem(editingIndex, item)
      setEditingIndex(null)
      toast.success("Cambios guardados")
      return
    }
    addItem(item)
    toast.success(`${item.name} agregada al carrito`)
  }

  const onCliked = (product: Product) => {
    setSelectedBurger(product)
    setEditingIndex(null)
    setClick(true)
  }

  const editarItem = (index: number) => {
    const item = lisBuy[index]
    if (!item) return
    const product = (repo.listProducts() ?? []).find((p) => p.id === item.productId)
    if (!product) return
    setSelectedBurger(product)
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

  const filterBurger = useMemo(() => {
    const query = texto.toLowerCase().trim()
    if (!query) return products
    return products.filter((objeto) =>
      objeto.name.toLowerCase().includes(query)
    )
  }, [texto, products])

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 300)
    return () => window.clearTimeout(t)
  }, [])

  const showFullScreen = ver || openForm
  const showMobileBar = lisBuy.length > 0 && !showFullScreen

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <CartNavbar
        cantidad={lisBuy.length}
        total={totalCarrito}
        onOpenCart={mostrar}
        repo={repo}
      />

      <a id="main" className="sr-only" tabIndex={-1}>
        Inicio del contenido principal
      </a>

      <main
        className={`mx-auto max-w-(--container) px-4 pt-6 md:px-6 lg:px-8 ${
          showMobileBar ? "pb-44 sm:pb-6" : "pb-6"
        }`}
      >
        {loading ? (
          <LoadingPage />
        ) : showFullScreen ? (
          ver ? (
            <CartView
              cerrar={cerrar}
              editarItem={editarItem}
              abrirForm={abrirForm}
              cerrarCarrito={cerrarCarrito}
            />
          ) : (
            <CheckoutForm
              cerrar={cerrar}
              items={lisBuy}
              mostrar={mostrar}
              cerrarForm={cerrarForm}
              repo={repo}
            />
          )
        ) : (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                Burger Menu
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                Elige tu favorita y personalízala a tu gusto.
              </p>
            </div>

            <div className="mb-6 flex justify-center">
              <SearchMenu onChangeText={onChangeText} total={filterBurger.length} />
            </div>

            {filterBurger.length === 0 ? (
              <EmptyResults />
            ) : (
              <div
                className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4"
                role="list"
                aria-label="Lista de hamburguesas"
              >
                {filterBurger.map((hamburger) => (
                  <div role="listitem" key={hamburger.name}>
                    <ProductCard
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

      {showMobileBar && (
        <MobileCartBar mostrar={mostrar} cantidad={lisBuy.length} total={totalCarrito} />
      )}

      {click && selectedBurger && (
        <ProductCustomize
          agregarList={agregarList}
          cerrar={cerrar}
          hamburger={selectedBurger}
          editing={editingIndex !== null}
          initial={editingIndex !== null ? lisBuy[editingIndex] : undefined}
          repo={repo}
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
        No hay coincidencias con ese nombre. Prueba buscando otra cosa o revisa
        nuestro menú completo.
      </p>
    </div>
  )
}