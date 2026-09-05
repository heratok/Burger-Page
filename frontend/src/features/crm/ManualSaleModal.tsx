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
  ShoppingCart,
  Store,
  UtensilsCrossed,
  Bike,
  Check,
  ArrowRight,
  ArrowLeft,
  PlusCircle,
  SlidersHorizontal,
  Upload,
  Image as ImageIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { uploadImageToStorage } from "@/core/storage/supabaseStorage"

export interface ManualSaleModalProps {
  isOpen: boolean
  onClose: () => void
}

type ServiceType = "mostrador" | "mesa" | "domicilio"

export const ManualSaleModal: React.FC<ManualSaleModalProps> = ({ isOpen, onClose }) => {
  const { activeRestaurant, storeConfig, adminTheme, addOrder } = useRestaurant()
  const isDark = adminTheme === "dark"

  // Mobile Tab State
  const [mobileTab, setMobileTab] = useState<"catalog" | "cart">("catalog")

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
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false)

  // Cart & Catalog State
  const [selectedItems, setSelectedItems] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")

  // Additions customization sheet for a specific product
  const [customizingProduct, setCustomizingProduct] = useState<MenuItem | null>(null)
  const [editingCartItemIndex, setEditingCartItemIndex] = useState<number | null>(null)
  const [customAdditions, setCustomAdditions] = useState<Record<string, number>>({})
  const [customItemNote, setCustomItemNote] = useState("")

  // Products from active restaurant
  const catalogProducts = useMemo(() => activeRestaurant.products || [], [activeRestaurant.products])

  // Extract unique categories from catalog
  const categories = useMemo(() => {
    const set = new Set<string>()
    catalogProducts.forEach((p) => {
      if (p.category) set.add(p.category)
    })
    return ["all", ...Array.from(set)]
  }, [catalogProducts])

  // Filtered products based on search & category
  const filteredProducts = useMemo(() => {
    return catalogProducts.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesCategory = selectedCategory === "all" || product.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [catalogProducts, searchQuery, selectedCategory])

  // Subtotal, Delivery and Final Total calculations
  const subtotal = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.total, 0)
  }, [selectedItems])

  const deliveryFee = serviceType === "domicilio" ? (storeConfig.deliveryFee || 0) : 0
  const finalTotal = subtotal + deliveryFee

  const cambio = useMemo(() => {
    if (paymentMethod !== "Efectivo" || !pagoCon) return null
    return calculateChange(finalTotal, pagoCon)
  }, [paymentMethod, pagoCon, finalTotal])

  const totalItemsCount = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.cantidad, 0)
  }, [selectedItems])

  const currentModalAdditionsTotal = useMemo(() => {
    if (!customizingProduct) return 0
    const availableAdditions = activeRestaurant.additions || []
    return Object.entries(customAdditions).reduce((sum, [addId, qty]) => {
      const found = availableAdditions.find((a) => a.id === addId)
      return sum + (found ? found.price * qty : 0)
    }, 0)
  }, [customizingProduct, customAdditions, activeRestaurant.additions])

  const currentModalItemTotal = (customizingProduct?.price || 0) + currentModalAdditionsTotal

  if (!isOpen) return null

  // Cart Handlers
  const handleQuickAddProduct = (product: MenuItem) => {
    const newItem = createCartItem({ product })
    setSelectedItems((prev) => {
      // If item with no additions exists, increment quantity
      const existingIdx = prev.findIndex(
        (item) => item.menuItemId === product.id && (!item.adiciones || item.adiciones.length === 0) && !item.observacion
      )
      if (existingIdx >= 0) {
        const copy = [...prev]
        const current = copy[existingIdx]
        const updatedQty = current.cantidad + 1
        copy[existingIdx] = {
          ...current,
          cantidad: updatedQty,
          total: calculateLineItemTotal({
            price: current.price,
            cantidad: updatedQty,
            adiciones: current.adiciones || [],
          }),
        }
        return copy
      }
      return [...prev, newItem]
    })
  }

  const handleOpenCustomize = (product: MenuItem) => {
    setCustomizingProduct(product)
    setEditingCartItemIndex(null)
    setCustomAdditions({})
    setCustomItemNote("")
  }

  const handleEditCartItem = (index: number) => {
    const item = selectedItems[index]
    if (!item) return
    const product: MenuItem = catalogProducts.find((p) => p.id === item.menuItemId) || {
      id: item.menuItemId || item.id || "temp-item",
      name: item.name,
      price: item.price,
      category: "",
      src: "",
      description: "",
      inStock: true,
    }
    const additionsMap: Record<string, number> = {}
    const availableAdditions = activeRestaurant.additions || []
    ;(item.adiciones || []).forEach((ad) => {
      const found = availableAdditions.find((a) => a.id === ad.id || a.name === ad.name)
      if (found) {
        additionsMap[found.id] = ad.cantidad
      }
    })
    setCustomizingProduct(product)
    setEditingCartItemIndex(index)
    setCustomAdditions(additionsMap)
    setCustomItemNote(item.observacion || "")
  }

  const handleConfirmCustomizedItem = () => {
    if (!customizingProduct) return

    const additionsList: CartAddition[] = []
    const availableAdditions = activeRestaurant.additions || []

    Object.entries(customAdditions).forEach(([additionId, qty]) => {
      if (qty > 0) {
        const found = availableAdditions.find((a) => a.id === additionId)
        if (found) {
          additionsList.push({
            id: found.id,
            name: found.name,
            price: found.price,
            cantidad: qty,
          })
        }
      }
    })

    if (editingCartItemIndex !== null && editingCartItemIndex >= 0) {
      setSelectedItems((prev) => {
        const copy = [...prev]
        const target = copy[editingCartItemIndex]
        if (!target) return prev
        copy[editingCartItemIndex] = {
          ...target,
          adiciones: additionsList,
          observacion: customItemNote.trim() || undefined,
          total: calculateLineItemTotal({
            price: target.price,
            cantidad: target.cantidad,
            adiciones: additionsList,
          }),
        }
        return copy
      })
    } else {
      const newItem = createCartItem({
        product: customizingProduct,
        adiciones: additionsList,
        cantidad: 1,
        observacion: customItemNote.trim() || undefined,
      })
      setSelectedItems((prev) => [...prev, newItem])
    }

    setCustomizingProduct(null)
    setEditingCartItemIndex(null)
  }

  const handleUpdateItemQty = (index: number, delta: number) => {
    setSelectedItems((prev) => {
      const copy = [...prev]
      const target = copy[index]
      const newQty = target.cantidad + delta
      if (newQty <= 0) {
        return copy.filter((_, i) => i !== index)
      }
      copy[index] = {
        ...target,
        cantidad: newQty,
        total: calculateLineItemTotal({
          price: target.price,
          cantidad: newQty,
          adiciones: target.adiciones || [],
        }),
      }
      return copy
    })
  }

  const handleRemoveItem = (index: number) => {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP)")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("La imagen no debe superar los 10MB")
      return
    }

    setReceiptFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setReceiptPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveReceipt = () => {
    setReceiptFile(null)
    setReceiptPreview(null)
  }

  const handleResetForm = () => {
    setSelectedItems([])
    setServiceType("mostrador")
    setTableNumber("")
    setCustomerName("")
    setCustomerPhone("")
    setCustomerAddress("")
    setCustomerBarrio("")
    setOrderNotes("")
    setPaymentMethod("Efectivo")
    setPagoCon("")
    setReceiptFile(null)
    setReceiptPreview(null)
    setIsUploadingReceipt(false)
    setSearchQuery("")
    setSelectedCategory("all")
    setMobileTab("catalog")
  }

  const handleSubmitOrder = async (e: React.FormEvent) => {
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

    let finalReceiptUrl: string | undefined = undefined
    if (paymentMethod === "Transferencia" && (receiptFile || receiptPreview)) {
      setIsUploadingReceipt(true)
      try {
        const uploaded = await uploadImageToStorage(receiptFile || receiptPreview!, {
          restaurantId: activeRestaurant.id,
          folder: "general",
        })
        finalReceiptUrl = uploaded || receiptPreview || undefined
      } catch (err) {
        console.warn("Could not upload receipt to remote storage, using local preview:", err)
        finalReceiptUrl = receiptPreview || undefined
      } finally {
        setIsUploadingReceipt(false)
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
      receiptUrl: finalReceiptUrl,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-md">
      <div
        className={`flex flex-col w-full h-full sm:h-[92vh] sm:max-h-[920px] max-w-6xl rounded-none sm:rounded-2xl border-0 sm:border shadow-2xl overflow-hidden transition-all ${
          isDark ? "border-slate-800 bg-[#0E1322] text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        {/* ======================================================== */}
        {/* TOP BAR HEADER & MOBILE TAB CONTROLS                     */}
        {/* ======================================================== */}
        <header
          className={`flex flex-col border-b ${
            isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between px-3.5 sm:px-6 py-3">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex size-8 sm:size-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
                <ShoppingBag className="size-4 sm:size-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h2 className="text-sm sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                    Punto de Venta — Nueva Venta
                  </h2>
                  <span className="hidden sm:inline-flex items-center rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-semibold text-orange-600 dark:text-orange-400">
                    {storeConfig.name}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                  Registrá ventas en mesa, mostrador o pedidos telefónicos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {totalItemsCount > 0 && (
                <div className="lg:hidden flex items-center gap-1 rounded-lg bg-orange-500/10 px-2 py-1 text-xs font-bold text-orange-600 dark:text-orange-400">
                  <span>{formatCOP(finalTotal)}</span>
                </div>
              )}
              <button
                type="button"
                onClick={handleClose}
                aria-label="Cerrar modal"
                className={`rounded-xl p-2 transition-colors cursor-pointer ${
                  isDark
                    ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                    : "text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                }`}
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* Segmented Mobile Step Navigation (visible only on mobile screens < lg) */}
          <div className="lg:hidden grid grid-cols-2 gap-2 p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
            <button
              type="button"
              onClick={() => setMobileTab("catalog")}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mobileTab === "catalog"
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/25 ring-2 ring-orange-500/50"
                  : "bg-white dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60"
              }`}
            >
              <UtensilsCrossed className="size-3.5" />
              <span>1. Catálogo ({filteredProducts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileTab("cart")}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
                mobileTab === "cart"
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/25 ring-2 ring-orange-500/50"
                  : "bg-white dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60"
              }`}
            >
              <ShoppingCart className="size-3.5" />
              <span>2. Pedido & Cobro</span>
              {totalItemsCount > 0 && (
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                    mobileTab === "cart" ? "bg-white text-orange-600" : "bg-orange-500 text-white"
                  }`}
                >
                  {totalItemsCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* ======================================================== */}
        {/* MAIN BODY: CATALOG (LEFT) & POS CART (RIGHT)             */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden min-h-0">
          {/* ================= LEFT COLUMN: CATALOG & SEARCH ================= */}
          <div
            className={`lg:col-span-7 flex-col border-b lg:border-b-0 lg:border-r overflow-hidden min-h-0 ${
              mobileTab === "catalog" ? "flex" : "hidden lg:flex"
            } ${isDark ? "border-slate-800 bg-[#0B0F1C]" : "border-slate-200 bg-slate-50/50"}`}
          >
            {/* Search & Category Header */}
            <div
              className={`p-3 sm:p-4 border-b space-y-2.5 sm:space-y-3 shrink-0 ${
                isDark ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-white"
              }`}
            >
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  maxLength={60}
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
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
                      className={`shrink-0 rounded-lg px-3 py-1 text-xs font-semibold capitalize transition-all cursor-pointer ${
                        isSelected
                          ? "bg-orange-500 text-white shadow-xs"
                          : isDark
                          ? "bg-slate-800/80 text-slate-300 hover:bg-slate-800"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {cat === "all" ? "Todos Los Productos" : cat}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Product Cards Grid (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
              {filteredProducts.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                  <UtensilsCrossed className="size-10 text-slate-400 mb-2 opacity-50" />
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    No se encontraron productos en el menú
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {filteredProducts.map((product) => {
                    const hasAdditions = (activeRestaurant.additions || []).length > 0
                    const inCartCount = selectedItems
                      .filter((i) => i.menuItemId === product.id)
                      .reduce((sum, i) => sum + i.cantidad, 0)

                    return (
                      <div
                        key={product.id}
                        className={`group relative flex flex-col justify-between rounded-xl border p-3 transition-all hover:border-orange-500/50 ${
                          inCartCount > 0
                            ? "border-orange-500/40 bg-orange-500/5 dark:bg-orange-500/10"
                            : isDark
                            ? "border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/80"
                            : "border-slate-200 bg-white hover:bg-slate-50/80"
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                              {product.name}
                            </h4>
                            {inCartCount > 0 && (
                              <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black text-white shrink-0">
                                {inCartCount} en comanda
                              </span>
                            )}
                          </div>

                          {product.description && (
                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                              {product.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60">
                          <span className="text-xs sm:text-sm font-black text-orange-600 dark:text-orange-400">
                            {formatCOP(product.price)}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {hasAdditions && (
                              <button
                                type="button"
                                onClick={() => handleOpenCustomize(product)}
                                title="Personalizar adiciones y notas de cocina"
                                className="inline-flex items-center gap-1 rounded-lg border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 font-bold px-2 py-1 text-xs transition-all cursor-pointer shadow-2xs active:scale-95"
                              >
                                <PlusCircle className="size-3.5 text-orange-500" />
                                <span>+ Extras</span>
                              </button>
                            )}

                            <Button
                              type="button"
                              size="xs"
                              onClick={() => handleQuickAddProduct(product)}
                              className="rounded-lg bg-orange-500 px-2.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-orange-600 active:scale-95 transition-all cursor-pointer"
                              title="Agregar 1 unidad rápida sin modificadores"
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

            {/* Mobile Bottom Floating Action Bar (when in catalog and cart has items) */}
            {totalItemsCount > 0 && (
              <div className="lg:hidden shrink-0 p-3 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0E1322]/95 backdrop-blur-md flex items-center justify-between shadow-xl">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 font-bold text-xs">
                    {totalItemsCount}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Total Pedido</span>
                    <span className="text-sm font-black text-orange-500 leading-none">
                      {formatCOP(finalTotal)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileTab("cart")}
                  className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-500/25 hover:bg-orange-600 active:scale-95 transition-all cursor-pointer"
                >
                  <span>Ver Pedido / Cobrar</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* ================= RIGHT COLUMN: ORDER SUMMARY & POS REGISTER ================= */}
          <div
            className={`lg:col-span-5 flex-col h-full overflow-hidden min-h-0 ${
              mobileTab === "cart" ? "flex" : "hidden lg:flex"
            }`}
          >
            {/* Mobile Sub-header to go back to catalog */}
            <div className="lg:hidden flex items-center justify-between px-3.5 py-2.5 bg-orange-500/10 border-b border-orange-500/20 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setMobileTab("catalog")}
                className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-bold cursor-pointer"
              >
                <ArrowLeft className="size-3.5" />
                <span>+ Agregar más platos</span>
              </button>
              <span className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                {selectedItems.length} {selectedItems.length === 1 ? "ítem" : "ítems"}
              </span>
            </div>

            <form onSubmit={handleSubmitOrder} className="flex flex-col h-full overflow-hidden min-h-0">
              {/* Service Mode Selector */}
              <div
                className={`p-3 sm:p-3.5 border-b shrink-0 ${
                  isDark ? "border-slate-800 bg-slate-900/30" : "border-slate-200 bg-slate-50"
                }`}
              >
                <label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Tipo de Servicio
                </label>
                <div className="mt-1.5 grid grid-cols-3 gap-1 bg-slate-200/60 dark:bg-slate-950 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setServiceType("mostrador")}
                    className={`flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
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
                    className={`flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
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
                    className={`flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
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

              {/* Scrollable Container for Order Items, Form Details and Payment */}
              <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-100 dark:divide-slate-800/60">
                {/* Order Items Section */}
                <div className="p-3 sm:p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <span>Comanda ({totalItemsCount})</span>
                    {selectedItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedItems([])}
                        className="text-rose-500 hover:underline lowercase font-normal cursor-pointer"
                      >
                        vaciar
                      </button>
                    )}
                  </div>

                  {selectedItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700/60 p-6 text-center">
                      <ShoppingBag className="size-8 text-slate-400 mb-1.5 opacity-40" />
                      <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Venta vacía
                      </h5>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 max-w-[200px]">
                        Seleccioná productos en el catálogo para armar el pedido.
                      </p>
                      <button
                        type="button"
                        onClick={() => setMobileTab("catalog")}
                        className="lg:hidden mt-2.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-xs"
                      >
                        Ir al Catálogo
                      </button>
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

                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              {formatCOP(item.total)}
                            </span>

                            {(activeRestaurant.additions || []).length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleEditCartItem(index)}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                                title="Modificar adiciones o notas de cocina"
                              >
                                <SlidersHorizontal className="size-2.5" />
                                <span>{item.adiciones && item.adiciones.length > 0 ? "Modificar extras / nota" : "+ Extras / nota"}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Stepper + Delete */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQty(index, -1)}
                            className={`size-6 flex items-center justify-center rounded-lg border text-xs cursor-pointer ${
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
                            className={`size-6 flex items-center justify-center rounded-lg border text-xs cursor-pointer ${
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
                            className="ml-1 size-6 flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Customer Details Inputs */}
                <div className={`p-3 sm:p-3.5 space-y-2.5 ${isDark ? "bg-slate-900/40" : "bg-slate-50/70"}`}>
                  {serviceType === "mesa" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Número de Mesa
                        </label>
                        <input
                          type="text"
                          maxLength={25}
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
                          maxLength={80}
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
                            maxLength={80}
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
                            maxLength={20}
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
                            maxLength={150}
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
                            maxLength={80}
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
                          maxLength={80}
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
                          maxLength={20}
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
                      maxLength={250}
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
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
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
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
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
                            maxLength={12}
                            placeholder="Paga con: $..."
                            value={pagoCon}
                            onChange={(e) => setPagoCon(e.target.value.replace(/\D/g, ""))}
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

                    {paymentMethod === "Transferencia" && (
                      <div className="space-y-2 rounded-xl border border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/20 p-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                            <Upload className="size-3 text-indigo-500" />
                            <span>Comprobante de Transferencia (Opcional)</span>
                          </label>
                          {receiptPreview && (
                            <button
                              type="button"
                              onClick={handleRemoveReceipt}
                              className="text-[10px] font-semibold text-rose-500 hover:underline cursor-pointer"
                            >
                              Quitar
                            </button>
                          )}
                        </div>

                        {receiptPreview ? (
                          <div className="flex items-center gap-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800/60 bg-white dark:bg-slate-900 p-2">
                            <img
                              src={receiptPreview}
                              alt="Comprobante"
                              className="size-12 rounded-md object-cover border border-slate-200 dark:border-slate-700"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                {receiptFile?.name || "Comprobante cargado"}
                              </p>
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                ✓ Listo para adjuntar
                              </span>
                            </div>
                            <label
                              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                            >
                              Cambiar
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleReceiptFileChange}
                                className="hidden"
                              />
                            </label>
                          </div>
                        ) : (
                          <label
                            className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-indigo-300 dark:border-indigo-800/80 p-2.5 hover:border-indigo-500 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 cursor-pointer transition-colors ${
                              isDark ? "bg-slate-950/50" : "bg-white/70"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                              <ImageIcon className="size-4" />
                              <span className="text-xs font-semibold">Cargar comprobante</span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              Formatos JPG, PNG, WebP (máx. 10MB)
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleReceiptFileChange}
                              className="hidden"
                            />
                          </label>
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
              </div>

              {/* Action Buttons (Sticky at bottom) */}
              <div
                className={`p-3 sm:p-3.5 border-t flex items-center justify-end gap-2.5 shrink-0 ${
                  isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"
                }`}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  className="rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </Button>

                <button
                  type="submit"
                  disabled={selectedItems.length === 0 || isUploadingReceipt}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2 text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 cursor-pointer"
                >
                  <Check className="size-4" />
                  <span>
                    {isUploadingReceipt
                      ? "Subiendo comprobante..."
                      : `Registrar Venta (${formatCOP(finalTotal)})`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CUSTOMIZE ADDITIONS SUB-MODAL                            */}
        {/* ======================================================== */}
        {customizingProduct && (
          <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 backdrop-blur-xs transition-all">
            <div
              className={`w-full max-w-lg rounded-t-2xl sm:rounded-2xl border p-4 sm:p-5 shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150 ${
                isDark ? "border-slate-800 bg-[#0E1322] text-slate-100" : "border-slate-200 bg-white text-slate-900"
              }`}
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-orange-500/10 px-2 py-0.5 text-[10px] font-black uppercase text-orange-600 dark:text-orange-400">
                      {editingCartItemIndex !== null ? "Modificar ítem" : "Personalizar plato"}
                    </span>
                    {customizingProduct.category && (
                      <span className="text-[10px] font-medium text-slate-400 capitalize">
                        {customizingProduct.category}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                    {customizingProduct.name}
                  </h3>
                  <p className="text-xs text-orange-600 dark:text-orange-400 font-bold">
                    Precio base: {formatCOP(customizingProduct.price)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCustomizingProduct(null)
                    setEditingCartItemIndex(null)
                  }}
                  className="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="flex-1 overflow-y-auto py-3 space-y-3 min-h-0 pr-1">
                {/* Additions list */}
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Adiciones / Modificadores disponibles:
                    </label>
                    <span className="text-[10px] text-slate-400">
                      (Modifican este plato)
                    </span>
                  </div>

                  {(activeRestaurant.additions || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">
                      No hay adiciones registradas para este local.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {(activeRestaurant.additions || []).map((addition) => {
                        const qty = customAdditions[addition.id] || 0
                        const isSelected = qty > 0

                        return (
                          <div
                            key={addition.id}
                            className={`flex items-center justify-between rounded-xl border p-2.5 transition-all ${
                              isSelected
                                ? "border-orange-500/50 bg-orange-500/10 dark:bg-orange-500/15"
                                : isDark
                                ? "border-slate-800/80 bg-slate-900/50 hover:bg-slate-900"
                                : "border-slate-200 bg-slate-50/80 hover:bg-slate-100/60"
                            }`}
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-slate-900 dark:text-white">
                                  {addition.name}
                                </span>
                                {isSelected && (
                                  <span className="size-1.5 rounded-full bg-orange-500" />
                                )}
                              </div>
                              <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                                +{formatCOP(addition.price)} c/u
                              </span>
                            </div>

                            {/* Stepper with comfortable touch targets */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setCustomAdditions((prev) => ({
                                    ...prev,
                                    [addition.id]: Math.max(0, (prev[addition.id] || 0) - 1),
                                  }))
                                }
                                disabled={qty === 0}
                                aria-label={`Quitar ${addition.name}`}
                                className={`size-8 flex items-center justify-center rounded-lg border text-xs transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                                  isDark
                                    ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                <Minus className="size-3.5" />
                              </button>

                              <span className="w-6 text-center text-xs font-black text-slate-900 dark:text-white">
                                {qty}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  setCustomAdditions((prev) => ({
                                    ...prev,
                                    [addition.id]: (prev[addition.id] || 0) + 1,
                                  }))
                                }
                                aria-label={`Agregar ${addition.name}`}
                                className="size-8 flex items-center justify-center rounded-lg bg-orange-500 text-white hover:bg-orange-600 active:scale-95 transition-all shadow-xs cursor-pointer"
                              >
                                <Plus className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Kitchen Observation */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Nota / Observación para cocina</span>
                    <span className="text-[10px] font-normal text-slate-400">Opcional</span>
                  </label>
                  <input
                    type="text"
                    maxLength={150}
                    placeholder="Ej: Término medio, sin salsas, salsa aparte..."
                    value={customItemNote}
                    onChange={(e) => setCustomItemNote(e.target.value)}
                    className={`mt-1.5 w-full rounded-xl border px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all ${
                      isDark
                        ? "border-slate-700 bg-slate-950 text-white placeholder-slate-500"
                        : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
                    }`}
                  />
                </div>
              </div>

              {/* Modal Footer with Live Price Calculation */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
                <div className="flex items-baseline justify-between sm:justify-start sm:gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Total del plato:
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm sm:text-base font-black text-orange-600 dark:text-orange-400">
                      {formatCOP(currentModalItemTotal)}
                    </span>
                    {currentModalAdditionsTotal > 0 && (
                      <span className="text-[10px] font-semibold text-slate-400">
                        (incl. {formatCOP(currentModalAdditionsTotal)} extras)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCustomizingProduct(null)
                      setEditingCartItemIndex(null)
                    }}
                    className="flex-1 sm:flex-none rounded-xl text-xs cursor-pointer"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirmCustomizedItem}
                    className="flex-1 sm:flex-none rounded-xl bg-orange-500 px-4 text-xs font-bold text-white hover:bg-orange-600 active:scale-95 shadow-md shadow-orange-500/20 cursor-pointer"
                  >
                    {editingCartItemIndex !== null ? "Guardar Cambios" : "Agregar a la Venta"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
