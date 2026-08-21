import { useEffect, useMemo, useState } from "react"
import { Utensils } from "lucide-react"
import CardBurger from "../components/Card"
import { hamburguesas, type Burger } from "../data/data"
import Additions from "./Additions"
import Navbar from "../components/Navbar"
import Buscar from "../components/Buscar"
import Nav from "../components/Nav"
import ShoppingCart from "./ShoppingCart"
import Form from "./Form"
import LoadingPage from "../components/LoadingPage"
import { useCart } from "../hooks/useCart"
import { Button } from "../components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog"

export default function Home() {
  const [click, setClick] = useState(false)
  const [ver, setVer] = useState(false)
  const [openForm, setOpenForm] = useState(false)
  const [selectedBurger, setSelectedBurger] = useState<Burger>(hamburguesas[0])
  const [texto, setTexto] = useState("")
  const [loading, setLoading] = useState(true)

  const {
    items: lisBuy,
    total: totalCarrito,
    itemCount,
    showRecovery,
    setShowRecovery,
    editingIndex,
    editingItem,
    addItem,
    replaceCart,
    clearAll,
    discardDraft,
    dismissRecovery,
    startEditing,
    cancelEditing,
  } = useCart()

  const onCliked = (hamburguesa: Burger) => {
    setSelectedBurger(hamburguesa)
    cancelEditing()
    setClick(true)
  }

  const editarItem = (index: number) => {
    const item = lisBuy[index]
    if (!item) return
    const burger = hamburguesas.find((b) => b.name === item.name)
    if (!burger) return
    setSelectedBurger(burger)
    startEditing(index)
    setClick(true)
  }

  const abrirForm = () => setOpenForm(true)
  const mostrar = () => setVer(true)
  const cerrarCarrito = () => setVer(false)
  const cerrarForm = () => setOpenForm(false)
  const cerrar = () => {
    setClick(false)
    cancelEditing()
  }

  const onChangeText = (text: string) => setTexto(text)

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
  const showMobileBar = itemCount > 0 && !showFullScreen

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <Navbar cantidad={itemCount} total={totalCarrito} onOpenCart={mostrar} />

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
            <ShoppingCart
              list={lisBuy}
              deleteCart={replaceCart}
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
              onOrderSent={clearAll}
            />
          )
        ) : (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                Rosto
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
                className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4"
                role="list"
                aria-label="Lista de productos"
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

      {showMobileBar && (
        <Nav mostrar={mostrar} cantidad={itemCount} total={totalCarrito} />
      )}

      {click && (
        <Additions
          agregarList={addItem}
          cerrar={cerrar}
          hamburger={selectedBurger}
          editing={editingIndex !== null}
          initial={editingItem ?? undefined}
        />
      )}

      <Dialog
        open={showRecovery}
        onOpenChange={(open) => {
          if (!open) setShowRecovery(false)
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Recuperar tu carrito</DialogTitle>
            <DialogDescription>
              Encontramos un pedido anterior que no llegaste a enviar. ¿Quieres
              continuar con él?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={discardDraft}>
              Descartar
            </Button>
            <Button type="button" onClick={dismissRecovery}>
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
        No encontramos productos
      </h2>
      <p className="mt-2 max-w-sm text-sm text-text-secondary">
        No hay coincidencias con ese nombre. Prueba buscando otra cosa o revisa
        nuestro catálogo completo.
      </p>
    </div>
  )
}