import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Utensils } from "lucide-react"
import CardBurger from "../components/Card"
import { hamburguesas, type BurgerCompra } from "../data/data"
import Additions from "./Additions"
import Navbar from "../components/Navbar"
import Buscar from "../components/Buscar"
import Nav from "../components/Nav"
import ShoppingCart from "./ShoppingCart"
import Form from "./Form"
import LoadingPage from "../components/LoadingPage"

export default function Home() {
  const [click, setClick] = useState(false)
  const [ver, setVer] = useState(false)
  const [openForm, setOpenForm] = useState(false)
  const [selectedBurger, setSelectedBurger] = useState(hamburguesas[0])
  const [lisBuy, setListBuy] = useState<BurgerCompra[]>([])
  const [texto, setTexto] = useState("")
  const [loading, setLoading] = useState(true)

  const agregarList = (burgerCompra: BurgerCompra) => {
    setListBuy((prev) => [...prev, burgerCompra])
    toast.success(`${burgerCompra.name} agregada al carrito`)
  }

  const deleteCart = (listActual: BurgerCompra[]) => {
    setListBuy(listActual)
  }

  const onCliked = (hamburguesa: typeof hamburguesas[number]) => {
    setSelectedBurger(hamburguesa)
    setClick(true)
  }

  const abrirForm = () => setOpenForm(true)
  const mostrar = () => setVer(true)
  const cerrarCarrito = () => setVer(false)
  const cerrarForm = () => setOpenForm(false)
  const cerrar = () => setClick(false)

  const onChangeText = (text: string) => setTexto(text)

  const totalCarrito = useMemo(
    () => lisBuy.reduce((acc, item) => acc + item.totalapagar, 0),
    [lisBuy]
  )

  const filterBurger = useMemo(() => {
    const query = texto.toLowerCase().trim()
    if (!query) return hamburguesas
    return hamburguesas.filter((objeto) =>
      objeto.name.toLowerCase().includes(query)
    )
  }, [texto])

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 300)
    return () => window.clearTimeout(t)
  }, [])

  const showFullScreen = ver || openForm
  const showFloatingCart = lisBuy.length > 0 && !showFullScreen

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <Navbar />

      <a id="main" className="sr-only" tabIndex={-1}>
        Inicio del contenido principal
      </a>

      <main className="mx-auto max-w-(--container) px-4 py-6 md:px-6 lg:px-8">
        {loading ? (
          <LoadingPage />
        ) : showFullScreen ? (
          ver ? (
            <ShoppingCart
              list={lisBuy}
              deleteCart={deleteCart}
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
              <Buscar onChangeText={onChangeText} total={filterBurger.length} />
            </div>

            {filterBurger.length === 0 ? (
              <EmptyResults />
            ) : (
              <div
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4"
                role="list"
                aria-label="Lista de hamburguesas"
              >
                {filterBurger.map((hamburger) => (
                  <div role="listitem" key={hamburger.name}>
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

      {showFloatingCart && (
        <Nav mostrar={mostrar} cantidad={lisBuy.length} total={totalCarrito} />
      )}

      {click && (
        <Additions
          agregarList={agregarList}
          cerrar={cerrar}
          hamburger={selectedBurger}
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