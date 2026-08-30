import React, { useState, useMemo } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import type { MenuItem } from "@/types/restaurant"
import {
  CartItem,
  createCartItem,
  calculateLineItemTotal,
  cartItemToOrderItem,
  type CartAddition,
} from "@/features/cart/cartEngine"
import { formatCOP, calculateChange } from "@/features/cart/whatsapp"
import {
  X,
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  Store,
  UtensilsCrossed,
  Bike,
  Check,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export interface ManualSaleModalProps {
  isOpen: boolean
  onClose: () => void
}

type ServiceType = "mostrador" | "mesa" | "domicilio"

export const ManualSaleModal: React.FC<ManualSaleModalProps> = ({ isOpen, onClose }) => {
  const { activeRestaurant, storeConfig, adminTheme, addOrder } = useRestaurant()
  const isDark = adminTheme === "dark"

  // Service and Customer State
  const [serviceType, setServiceType] = useState<ServiceType>("mostrador")
  const [tableNumber, setTableNumber] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerAddress, setCustomerAddress] = useState("")
  const [customerBarrio, setCustomerBarrio] = useState("")
  const [orderNotes, setOrderNotes] = useState("")

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<"Efectivo" | "Transferencia">("Efectivo")
  const [pagoCon, setPagoCon] = useState("")

  // Cart & Catalog State
  const [selectedItems, setSelectedItems] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")

  // Additions customization sheet for a specific product
  const [customizingProduct, setCustomizingProduct] = useState<MenuItem | null>(null)
  const [customAdditions, setCustomAdditions] = useState<Record<string, number>>({})
  const [customItemNote, setCustomItemNote] = useState("")

  // Categories extraction
  const categories = useMemo(() => {
    const set = new Set<string>()
    activeRestaurant.products.forEach((p) => {
      if (p.category) set.add(p.category)
    })
    return ["all", ...Array.from(set)]
  }, [activeRestaurant.products])

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return activeRestaurant.products.filter((p) => {
      const matchCat = selectedCategory === "all" || p.category === selectedCategory
      const matchQuery =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      return matchCat && matchQuery
    })
  }, [activeRestaurant.products, selectedCategory, searchQuery])

  // Calculations
  const subtotal = useMemo(() => {
    return selectedItems.reduce((acc, item) => acc + item.total, 0)
  }, [selectedItems])

  const deliveryFee = serviceType === "domicilio" ? storeConfig.deliveryFee : 0
  const finalTotal = subtotal + deliveryFee
  const cambio = calculateChange(finalTotal, pagoCon)

  if (!isOpen) return null

  // Cart handlers
  const handleAddSimpleProduct = (product: MenuItem) => {
    if (!product.inStock) {
      toast.error(`"${product.name}" está agotado`)
      return
    }

    setSelectedItems((prev) => {
      const existingIndex = prev.findIndex(
        (i) => i.menuItemId === product.id && (!i.adiciones || i.adiciones.length === 0)
      )
      if (existingIndex > -1) {
        const item = prev[existingIndex]
        const newQty = item.cantidad + 1
        const updated = [...prev]
        updated[existingIndex] = {
          ...item,
          cantidad: newQty,
          total: calculateLineItemTotal({
            price: item.price,
            cantidad: newQty,
            adiciones: item.adiciones,
          }),
        }
        return updated
      } else {
        const newItem = createCartItem({
          product,
          cantidad: 1,
        })
        return [...prev, newItem]
      }
    })
  }

  const handleOpenCustomizer = (product: MenuItem) => {
    if (!product.inStock) {
      toast.error(`"${product.name}" está agotado`)
      return
    }
    setCustomizingProduct(product)
    setCustomAdditions({})
    setCustomItemNote("")
  }

  const handleConfirmCustomizedItem = () => {
    if (!customizingProduct) return

    const selectedAdds: CartAddition[] = (activeRestaurant.additions || [])
      .filter((a) => customAdditions[a.id] && customAdditions[a.id] > 0)
      .map((a) => ({
        id: a.id,
        name: a.name,
        price: a.price,
        cantidad: customAdditions[a.id],
      }))

    const newItem = createCartItem({
      product: customizingProduct,
      cantidad: 1,
      adiciones: selectedAdds,
      observacion: customItemNote,
    })

    setSelectedItems((prev) => [...prev, newItem])
    setCustomizingProduct(null)
    setCustomAdditions({})
    setCustomItemNote("")
  }

  const handleUpdateItemQty = (index: number, delta: number) => {
    setSelectedItems((prev) => {
      const updated = [...prev]
      const item = updated[index]
      const newQty = item.cantidad + delta
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index)
      }
      updated[index] = {
        ...item,
        cantidad: newQty,
        total: calculateLineItemTotal({
          price: item.price,
          cantidad: newQty,
          adiciones: item.adiciones,
        }),
      }
      return updated
    })
  }

  const handleRemoveItem = (index: number) => {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleResetForm = () => {
    setSelectedItems([])
    setCustomerName("")
    setCustomerPhone("")
    setCustomerAddress("")
    setCustomerBarrio("")
    setTableNumber("")
    setOrderNotes("")
    setPagoCon("")
    setPaymentMethod("Efectivo")
    setServiceType("mostrador")
  }

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedItems.length === 0) {
      toast.error("Agrega al menos un producto a la venta")
      return
    }

    if (serviceType === "domicilio") {
      if (!customerAddress.trim()) {
        toast.error("Ingresa la dirección para el domicilio")
        return
      }
      if (!customerBarrio.trim()) {
        toast.error("Ingresa el barrio para el domicilio")
        return
      }
    }

    // Determine customer display name
    let finalCustomerName = customerName.trim()
    if (!finalCustomerName) {
      if (serviceType === "mesa") {
        finalCustomerName = tableNumber.trim() ? `Mesa ${tableNumber.trim()}` : "Mesa Salón"
      } else if (serviceType === "mostrador") {
        finalCustomerName = "Cliente Mostrador"
      } else {
        finalCustomerName = "Cliente Domicilio"
      }
    }

    const orderData = {
      customer: {
        nombre: finalCustomerName,
        telefono: customerPhone.trim() || "N/A",
        direccion:
          serviceType === "domicilio"
            ? customerAddress.trim()
            : serviceType === "mesa"
            ? `Salón - ${tableNumber.trim() ? `Mesa ${tableNumber.trim()}` : "Mesa general"}`
            : "Mostrador / Para llevar",
        barrio: serviceType === "domicilio" ? customerBarrio.trim() : "Local",
      },
      items: selectedItems.map(cartItemToOrderItem),
      total: subtotal,
      deliveryFee,
      finalTotal,
      metodo: paymentMethod,
      pagoCon: paymentMethod === "Efectivo" && pagoCon.trim() ? pagoCon.trim() : undefined,
      cambio: paymentMethod === "Efectivo" && cambio ? cambio : undefined,
      comentario: orderNotes.trim() || undefined,
      status: "pending" as const,
    }

    addOrder(orderData)
    toast.success("¡Venta manual registrada en el sistema!", {
      description: `${finalCustomerName} • Total: ${formatCOP(finalTotal)}`,
    })

    handleResetForm()
    onClose()
  }

  const handleClose = () => {
    handleResetForm()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-md">
      <div
        className={`flex flex-col w-full max-w-6xl h-[92vh] max-h-[920px] rounded-2xl border shadow-2xl overflow-hidden transition-all ${
          isDark ? "border-slate-800 bg-[#0E1322] text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        {/* TOP BAR HEADER */}
        <header
          className={`flex items-center justify-between px-4 sm:px-6 py-3.5 border-b ${
            isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
              <ShoppingBag className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  Punto de Venta — Nueva Venta
                </h2>
                <span className="hidden sm:inline-flex items-center rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-semibold text-orange-600 dark:text-orange-400">
                  {storeConfig.name}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Registrá pedidos de mostrador, salón o telefónicos directamente en el sistema
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar modal"
            className={`rounded-xl p-2 transition-colors ${
              isDark
                ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                : "text-slate-500 hover:bg-slate-200 hover:text-slate-900"
            }`}
          >
            <X className="size-5" />
          </button>
        </header>

        {/* MAIN BODY GRID: LEFT CATALOG (60%), RIGHT POS CART (40%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          {/* ================= LEFT COLUMN: CATALOG & SEARCH ================= */}
          <div
            className={`lg:col-span-7 flex flex-col border-b lg:border-b-0 lg:border-r overflow-hidden ${
              isDark ? "border-slate-800 bg-[#0B0F1C]" : "border-slate-200 bg-slate-50/50"
            }`}
          >
            {/* Search & Category Header */}
            <div
              className={`p-3.5 sm:p-4 border-b space-y-3 ${
                isDark ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-white"
              }`}
            >
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full rounded-xl border pl-9 pr-4 py-2 text-xs sm:text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                    isDark
                      ? "border-slate-800 bg-slate-950 text-white placeholder-slate-500"
                      : "border-slate-200 bg-white text-slate-900 placeholder-slate-400"
                  }`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`shrink-0 rounded-lg px-3 py-1 text-xs font-semibold capitalize transition-all ${
                        isSelected
                          ? "bg-orange-500 text-white shadow-xs"
                          : isDark
                          ? "bg-slate-800/80 text-slate-300 hover:bg-slate-800"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {cat === "all" ? "Todos los productos" : cat}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-4">
              {filteredProducts.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 text-center">
                  <ShoppingBag className="size-8 text-slate-500 mb-2 opacity-50" />
                  <p className="text-xs font-medium text-slate-400">
                    No se encontraron productos para esta búsqueda
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3">
                  {filteredProducts.map((product) => {
                    const hasAdditions =
                      activeRestaurant.additions && activeRestaurant.additions.length > 0
                    return (
                      <div
                        key={product.id}
                        className={`group relative flex flex-col justify-between rounded-xl border p-3 transition-all duration-150 ${
                          !product.inStock
                            ? "opacity-50 cursor-not-allowed border-slate-800 bg-slate-900/30"
                            : isDark
                            ? "border-slate-800 bg-slate-900/80 hover:border-orange-500/50 hover:bg-slate-800/80"
                            : "border-slate-200 bg-white hover:border-orange-300 hover:shadow-xs"
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                              {product.name}
                            </h4>
                            {!product.inStock && (
                              <span className="shrink-0 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-500">
                                Agotado
                              </span>
                            )}
                          </div>
                          {product.description && (
                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                              {product.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/60">
                          <span className="text-xs sm:text-sm font-black text-orange-600 dark:text-orange-400">
                            {formatCOP(product.price)}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {hasAdditions && product.inStock && (
                              <button
                                type="button"
                                title="Personalizar con adiciones"
                                onClick={() => handleOpenCustomizer(product)}
                                className={`rounded-lg p-1.5 text-xs transition-colors ${
                                  isDark
                                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                }`}
                              >
                                <Sparkles className="size-3.5 text-amber-500" />
                              </button>
                            )}

                            <Button
                              type="button"
                              size="sm"
                              disabled={!product.inStock}
                              onClick={() => handleAddSimpleProduct(product)}
                              className="h-7 rounded-lg bg-orange-500 px-2.5 text-xs font-bold text-white hover:bg-orange-600 shadow-xs"
                            >
                              <Plus className="size-3 mr-0.5" />
                              <span>Agregar</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ================= RIGHT COLUMN: ORDER SUMMARY & POS REGISTER ================= */}
          <div className="lg:col-span-5 flex flex-col h-full overflow-hidden">
            <form onSubmit={handleSubmitOrder} className="flex flex-col h-full">
              {/* Service Mode Selector */}
              <div
                className={`p-3.5 border-b ${
                  isDark ? "border-slate-800 bg-slate-900/30" : "border-slate-200 bg-slate-50"
                }`}
              >
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Tipo de Servicio
                </label>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5 bg-slate-200/60 dark:bg-slate-950 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setServiceType("mostrador")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all ${
                      serviceType === "mostrador"
                        ? "bg-white dark:bg-orange-500 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Store className="size-3.5" />
                    <span>Mostrador</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setServiceType("mesa")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all ${
                      serviceType === "mesa"
                        ? "bg-white dark:bg-orange-500 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <UtensilsCrossed className="size-3.5" />
                    <span>Mesa / Salón</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setServiceType("domicilio")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all ${
                      serviceType === "domicilio"
                        ? "bg-white dark:bg-orange-500 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Bike className="size-3.5" />
                    <span>Domicilio</span>
                  </button>
                </div>
              </div>

              {/* Order Items List (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
                {selectedItems.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/60 p-6 text-center">
                    <ShoppingBag className="size-10 text-slate-500 mb-2 opacity-40" />
                    <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Venta vacía
                    </h5>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 max-w-[220px]">
                      Seleccioná productos en el catálogo izquierdo para armar el pedido.
                    </p>
                  </div>
                ) : (
                  selectedItems.map((item, index) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 ${
                        isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-black text-orange-600 dark:text-orange-400">
                            {item.cantidad}x
                          </span>
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {item.name}
                          </h5>
                        </div>

                        {/* Additions list */}
                        {item.adiciones && item.adiciones.length > 0 && (
                          <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            + {item.adiciones.map((a) => `${a.name} (${a.cantidad})`).join(", ")}
                          </div>
                        )}

                        {/* Observacion */}
                        {item.observacion && (
                          <div className="mt-0.5 text-[10px] italic text-amber-600 dark:text-amber-400 truncate">
                            &ldquo;{item.observacion}&rdquo;
                          </div>
                        )}

                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {formatCOP(item.total)}
                        </span>
                      </div>

                      {/* Stepper + Delete */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQty(index, -1)}
                          className={`size-6 flex items-center justify-center rounded-lg border text-xs ${
                            isDark
                              ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                              : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-bold">{item.cantidad}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQty(index, 1)}
                          className={`size-6 flex items-center justify-center rounded-lg border text-xs ${
                            isDark
                              ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                              : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          <Plus className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          title="Eliminar producto"
                          className="ml-1 size-6 flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-500/10"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Customer & Delivery Details Fields (Collapsible / Compact) */}
              <div
                className={`p-3.5 border-t space-y-2.5 ${
                  isDark ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-slate-50/70"
                }`}
              >
                {/* Dynamic inputs based on service type */}
                {serviceType === "mesa" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        Número de Mesa
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: 3, Terraza 1"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        className={`mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                          isDark ? "border-slate-700 bg-slate-950 text-white" : "border-slate-300 bg-white"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        Nombre Cliente (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Nombre o apodo"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className={`mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                          isDark ? "border-slate-700 bg-slate-950 text-white" : "border-slate-300 bg-white"
                        }`}
                      />
                    </div>
                  </div>
                ) : serviceType === "domicilio" ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Nombre Cliente *
                        </label>
                        <input
                          type="text"
                          placeholder="Nombre completo"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className={`mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                            isDark ? "border-slate-700 bg-slate-950 text-white" : "border-slate-300 bg-white"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Teléfono
                        </label>
                        <input
                          type="text"
                          placeholder="300 123 4567"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className={`mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                            isDark ? "border-slate-700 bg-slate-950 text-white" : "border-slate-300 bg-white"
                          }`}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Dirección de Entrega *
                        </label>
                        <input
                          type="text"
                          placeholder="Calle 10 # 4-20"
                          value={customerAddress}
                          onChange={(e) => setCustomerAddress(e.target.value)}
                          className={`mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                            isDark ? "border-slate-700 bg-slate-950 text-white" : "border-slate-300 bg-white"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Barrio *
                        </label>
                        <input
                          type="text"
                          placeholder="Barrio o sector"
                          value={customerBarrio}
                          onChange={(e) => setCustomerBarrio(e.target.value)}
                          className={`mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                            isDark ? "border-slate-700 bg-slate-950 text-white" : "border-slate-300 bg-white"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        Nombre Cliente (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Cliente Mostrador"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className={`mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                          isDark ? "border-slate-700 bg-slate-950 text-white" : "border-slate-300 bg-white"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        Teléfono (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Para fidelización"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className={`mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                          isDark ? "border-slate-700 bg-slate-950 text-white" : "border-slate-300 bg-white"
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* General Order Notes / Kitchen Observations */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>Observaciones del Pedido (Opcional)</span>
                    <span className="text-[9px] font-normal text-slate-400">Cocina & Entrega</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Sin cebolla, salsas aparte, observaciones del cliente..."
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className={`mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                      isDark ? "border-slate-700 bg-slate-950 text-white placeholder-slate-500" : "border-slate-300 bg-white placeholder-slate-400"
                    }`}
                  />
                </div>

                {/* Payment Method & Cash Change */}
                <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Método de Pago
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("Efectivo")}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                          paymentMethod === "Efectivo"
                            ? "bg-emerald-500 text-white shadow-xs"
                            : isDark
                            ? "bg-slate-800 text-slate-300"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        💵 Efectivo
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("Transferencia")}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                          paymentMethod === "Transferencia"
                            ? "bg-indigo-500 text-white shadow-xs"
                            : isDark
                            ? "bg-slate-800 text-slate-300"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        💳 Transferencia
                      </button>
                    </div>
                  </div>

                  {paymentMethod === "Efectivo" && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Paga con: $..."
                          value={pagoCon}
                          onChange={(e) => setPagoCon(e.target.value)}
                          className={`w-full rounded-lg border px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                            isDark ? "border-slate-700 bg-slate-950 text-white" : "border-slate-300 bg-white"
                          }`}
                        />
                      </div>
                      {cambio !== null && (
                        <div className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          Cambio: {formatCOP(cambio)}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Subtotal, Fee and Grand Total Breakdown */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Subtotal productos:</span>
                    <span>{formatCOP(subtotal)}</span>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Costo de envío:</span>
                      <span>{formatCOP(deliveryFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm sm:text-base font-black text-slate-900 dark:text-white pt-1">
                    <span>Total a Cobrar:</span>
                    <span className="text-orange-600 dark:text-orange-400">{formatCOP(finalTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                className={`p-3.5 border-t flex items-center justify-end gap-2.5 ${
                  isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"
                }`}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  className="rounded-xl text-xs"
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={selectedItems.length === 0}
                  className="gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 cursor-pointer"
                >
                  <Check className="size-4" />
                  <span>Registrar Venta ({formatCOP(finalTotal)})</span>
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* CUSTOMIZE ADDITIONS SUB-MODAL */}
        {customizingProduct && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div
              className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl ${
                isDark ? "border-slate-800 bg-[#0E1322] text-slate-100" : "border-slate-200 bg-white text-slate-900"
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-bold">{customizingProduct.name}</h3>
                  <p className="text-xs text-orange-500 font-semibold">{formatCOP(customizingProduct.price)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomizingProduct(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="py-3 max-h-60 overflow-y-auto space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Adiciones disponibles:
                </label>
                {(activeRestaurant.additions || []).map((addition) => {
                  const qty = customAdditions[addition.id] || 0
                  return (
                    <div
                      key={addition.id}
                      className={`flex items-center justify-between rounded-xl border p-2 text-xs ${
                        isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">{addition.name}</span>
                        <span className="ml-1.5 text-slate-500 dark:text-slate-400">+{formatCOP(addition.price)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setCustomAdditions((prev) => ({
                              ...prev,
                              [addition.id]: Math.max(0, (prev[addition.id] || 0) - 1),
                            }))
                          }
                          className="size-5 rounded bg-slate-800 text-white flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="w-4 text-center font-bold">{qty}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setCustomAdditions((prev) => ({
                              ...prev,
                              [addition.id]: (prev[addition.id] || 0) + 1,
                            }))
                          }
                          className="size-5 rounded bg-orange-500 text-white flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}

                <div className="pt-2">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Observación de cocina:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Sin cebolla, término medio..."
                    value={customItemNote}
                    onChange={(e) => setCustomItemNote(e.target.value)}
                    className={`mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                      isDark ? "border-slate-700 bg-slate-950 text-white" : "border-slate-300 bg-white"
                    }`}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomizingProduct(null)}
                  className="rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirmCustomizedItem}
                  className="rounded-xl bg-orange-500 px-4 text-xs font-bold text-white hover:bg-orange-600 cursor-pointer"
                >
                  Agregar a la venta
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
