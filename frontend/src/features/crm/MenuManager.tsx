import React, { useState, useRef } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import { useMenuFilter } from "./hooks/useMenuFilter"
import type { MenuItem, AdditionItem } from "@/types/restaurant"
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Sparkles,
  Flame,
  X,
  LayoutGrid,
  List,
  Tags,
  Upload,
  Image as ImageIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal"
import { Pagination } from "@/components/ui/pagination"
import { toast } from "sonner"
import { optimizeImageToWebP } from "@/lib/imageOptimizer"

export const MenuManager: React.FC = () => {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleProductStock,
    additions,
    addAddition,
    updateAddition,
    deleteAddition,
    categories: restaurantCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    adminTheme,
  } = useRestaurant()

  const [activeSubTab, setActiveSubTab] = useState<"dishes" | "additions">("dishes")
  const [productToDelete, setProductToDelete] = useState<MenuItem | null>(null)
  const [additionToDelete, setAdditionToDelete] = useState<AdditionItem | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)

  // Category Management Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null)
  const [editCategoryInputValue, setEditCategoryInputValue] = useState("")
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null)

  const {
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    viewMode,
    setViewMode,
    categories,
    filteredProducts,
  } = useMenuFilter(products, restaurantCategories)

  const paginatedProducts = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredProducts.slice(start, start + pageSize)
  }, [filteredProducts, currentPage, pageSize])

  // Modal State for Products
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<MenuItem | null>(null)
  const [isCustomCategoryInput, setIsCustomCategoryInput] = useState(false)
  const [productForm, setProductForm] = useState({
    name: "",
    price: 25000,
    category: "Platos Principales",
    src: "",
    description: "",
    inStock: true,
    isPopular: false,
    isNew: false,
    preparationTimeMinutes: 15,
  })

  // Modal State for Additions
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingAddition, setEditingAddition] = useState<AdditionItem | null>(null)
  const [additionForm, setAdditionForm] = useState({
    name: "",
    price: 3000,
    available: true,
  })

  const productFileInputRef = useRef<HTMLInputElement>(null)
  const [isOptimizingImage, setIsOptimizingImage] = useState(false)

  const handleProductImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      toast.error("La imagen original debe ser menor a 10MB")
      return
    }

    try {
      setIsOptimizingImage(true)
      const optimizedWebP = await optimizeImageToWebP(file, {
        maxWidth: 800,
        maxHeight: 600,
        quality: 0.82,
      })
      setProductForm((prev) => ({ ...prev, src: optimizedWebP }))
      toast.success("Foto optimizada y cargada en formato WebP")
    } catch (err: any) {
      console.error("Failed to optimize product image:", err)
      toast.error("No se pudo procesar la imagen seleccionada")
    } finally {
      setIsOptimizingImage(false)
      e.target.value = ""
    }
  }

  const isDark = adminTheme === "dark"

  const openNewProductModal = () => {
    setEditingProduct(null)
    setIsCustomCategoryInput(false)
    setProductForm({
      name: "",
      price: 26000,
      category: categories[0] || "Platos Principales",
      src: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80",
      description: "",
      inStock: true,
      isPopular: false,
      isNew: true,
      preparationTimeMinutes: 15,
    })
    setIsProductModalOpen(true)
  }

  const openEditProductModal = (product: MenuItem) => {
    setEditingProduct(product)
    setProductForm({
      name: product.name,
      price: product.price,
      category: product.category,
      src: product.src,
      description: product.description,
      inStock: product.inStock,
      isPopular: !!product.isPopular,
      isNew: !!product.isNew,
      preparationTimeMinutes: product.preparationTimeMinutes || 15,
    })
    setIsProductModalOpen(true)
  }

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault()
    if (!productForm.name.trim()) return

    if (editingProduct) {
      updateProduct(editingProduct.id, productForm)
    } else {
      addProduct(productForm)
    }
    setIsProductModalOpen(false)
  }

  const openNewAdditionModal = () => {
    setEditingAddition(null)
    setAdditionForm({ name: "", price: 3000, available: true })
    setIsAddModalOpen(true)
  }

  const openEditAdditionModal = (add: AdditionItem) => {
    setEditingAddition(add)
    setAdditionForm({ name: add.name, price: add.price, available: add.available })
    setIsAddModalOpen(true)
  }

  const handleSaveAddition = (e: React.FormEvent) => {
    e.preventDefault()
    if (!additionForm.name.trim()) return
    if (editingAddition) {
      updateAddition(editingAddition.id, additionForm)
    } else {
      addAddition(additionForm)
    }
    setIsAddModalOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Top Strip */}
      <div
        className={`flex flex-col gap-4 rounded-2xl border p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between ${
          isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex items-center gap-2">
          {/* Sub-tabs: Dishes vs Additions */}
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800 border dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveSubTab("dishes")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeSubTab === "dishes"
                  ? "bg-white text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Platos & Productos ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("additions")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeSubTab === "additions"
                  ? "bg-white text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Adicionales & Extras ({additions.length})
            </button>
          </div>
        </div>

        {activeSubTab === "dishes" ? (
          <Button
            type="button"
            onClick={openNewProductModal}
            className="gap-2 rounded-xl bg-indigo-600 font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Crear Producto</span>
          </Button>
        ) : (
          <Button
            type="button"
            onClick={openNewAdditionModal}
            className="gap-2 rounded-xl bg-indigo-600 font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Añadir Adicional</span>
          </Button>
        )}
      </div>

      {activeSubTab === "dishes" && (
        <>
          {/* Filters & Search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {/* Category Pills */}
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("ALL")
                  setCurrentPage(1)
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  selectedCategory === "ALL"
                    ? "bg-indigo-600 text-white"
                    : isDark
                    ? "bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-750"
                    : "bg-white border text-slate-700 hover:bg-slate-50"
                }`}
              >
                Todos ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat)
                    setCurrentPage(1)
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    selectedCategory === cat
                      ? "bg-indigo-600 text-white"
                      : isDark
                      ? "bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-750"
                      : "bg-white border text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {cat}
                </button>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCategoryModalOpen(true)}
                className="gap-1.5 rounded-xl border-dashed border-indigo-400/50 bg-indigo-50/50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/30 dark:text-indigo-400 dark:hover:bg-indigo-900/40 text-xs font-semibold cursor-pointer"
              >
                <Tags className="size-3.5" />
                <span>Gestionar Categorías</span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {/* Search Box */}
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  placeholder="Buscar plato..."
                  className={`w-full rounded-xl border pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isDark
                      ? "border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-400"
                      : "border-slate-200 bg-white text-slate-800 placeholder-slate-400"
                  }`}
                />
              </div>

              {/* View Switcher */}
              <div className="flex rounded-xl border p-0.5 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`rounded-lg p-1.5 text-xs ${
                    viewMode === "grid"
                      ? "bg-white shadow-xs text-slate-900 dark:bg-slate-700 dark:text-white"
                      : "text-slate-400"
                  }`}
                  title="Cuadrícula"
                >
                  <LayoutGrid className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`rounded-lg p-1.5 text-xs ${
                    viewMode === "table"
                      ? "bg-white shadow-xs text-slate-900 dark:bg-slate-700 dark:text-white"
                      : "text-slate-400"
                  }`}
                  title="Lista"
                >
                  <List className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Dishes Grid Mode */}
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedProducts.map((product) => (
                <div
                  key={product.id}
                  className={`group relative overflow-hidden rounded-2xl border transition-all duration-200 hover:shadow-md ${
                    isDark
                      ? "border-slate-800 bg-slate-900 hover:border-slate-700"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  } ${!product.inStock ? "opacity-60" : ""}`}
                >
                  {/* Image with overlay tags */}
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img
                      src={product.src}
                      alt={product.name}
                      className="size-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                      <span className="rounded-md bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                        {product.category}
                      </span>
                      {product.isPopular && (
                        <span className="flex items-center gap-1 rounded-md bg-amber-500/95 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                          <Flame className="size-3" />
                          Popular
                        </span>
                      )}
                      {product.isNew && (
                        <span className="flex items-center gap-1 rounded-md bg-emerald-500/95 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                          <Sparkles className="size-3" />
                          Nuevo
                        </span>
                      )}
                    </div>

                    {!product.inStock && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/65 backdrop-blur-2xs">
                        <span className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-black text-white uppercase tracking-wider">
                          Agotado Temporalmente
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold tracking-tight line-clamp-1 text-slate-900 dark:text-white">
                        {product.name}
                      </h3>
                      <span className="text-base font-black text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        ${product.price.toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 min-h-[32px]">
                      {product.description}
                    </p>

                    {/* Stock switch & Actions */}
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                      <Switch
                        checked={product.inStock}
                        onCheckedChange={() => toggleProductStock(product.id)}
                        label={product.inStock ? "Disponible" : "Agotado"}
                      />

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditProductModal(product)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-300"
                          title="Editar plato"
                        >
                          <Edit2 className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductToDelete(product)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="Eliminar plato"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Table Mode */
            <div
              className={`overflow-hidden rounded-2xl border shadow-xs ${
                isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
              }`}
            >
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={`border-b ${isDark ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-500"}`}>
                    <th className="py-3 px-4 font-semibold">Producto</th>
                    <th className="py-3 px-4 font-semibold">Categoría</th>
                    <th className="py-3 px-4 font-semibold">Precio</th>
                    <th className="py-3 px-4 font-semibold">Tags</th>
                    <th className="py-3 px-4 font-semibold">Disponibilidad</th>
                    <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedProducts.map((prod) => (
                    <tr
                      key={prod.id}
                      className={`transition-colors ${
                        isDark ? "hover:bg-slate-800/60" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={prod.src}
                            alt=""
                            className="size-10 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 border dark:border-slate-700"
                          />
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">{prod.name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 max-w-xs">
                              {prod.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300 border dark:border-slate-700">
                          {prod.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                        ${prod.price.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          {prod.isPopular && (
                            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border dark:border-amber-500/30">
                              Popular
                            </span>
                          )}
                          {prod.isNew && (
                            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border dark:border-emerald-500/30">
                              Nuevo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Switch
                          checked={prod.inStock}
                          onCheckedChange={() => toggleProductStock(prod.id)}
                          label={prod.inStock ? "Disponible" : "Agotado"}
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEditProductModal(prod)}
                          className="mr-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-300"
                        >
                          <Edit2 className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductToDelete(prod)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Dishes Pagination */}
          {filteredProducts.length > 0 && (
            <div className="rounded-2xl border p-2 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <Pagination
                currentPage={currentPage}
                totalItems={filteredProducts.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setCurrentPage(1)
                }}
                pageSizeOptions={[6, 12, 24, 48]}
              />
            </div>
          )}
        </>
      )}

      {/* Additions Sub-Tab */}
      {activeSubTab === "additions" && (
        <div
          className={`rounded-2xl border p-6 shadow-xs ${
            isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Adiciones y Extras para la Tienda
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Opciones que los clientes pueden sumar al personalizar sus pedidos
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {additions.map((add) => (
              <div
                key={add.id}
                className={`flex items-center justify-between rounded-xl border p-3.5 transition-all ${
                  isDark ? "border-slate-800 bg-slate-850" : "border-slate-200 bg-slate-50/50"
                }`}
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{add.name}</h4>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    +${add.price.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditAdditionModal(add)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <Edit2 className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdditionToDelete(add)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40 cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Add / Edit Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
          <div
            className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl transition-all ${
              isDark ? "border-slate-800 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingProduct ? `Editar "${editingProduct.name}"` : "Nuevo Producto"}
              </h3>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                    Nombre del Producto *
                  </label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="Ej. Plato Especial de la Casa"
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 font-medium"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                    Precio ($ COP) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1000}
                    step={500}
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-800 dark:text-slate-200">
                      Categoría
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomCategoryInput(!isCustomCategoryInput)}
                      className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {isCustomCategoryInput ? "Elegir existente" : "+ Nueva categoría"}
                    </button>
                  </div>

                  {isCustomCategoryInput ? (
                    <input
                      type="text"
                      required
                      value={productForm.category}
                      onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                      placeholder="Ej. Entradas, Postres, Bebidas"
                      className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  ) : (
                    <select
                      value={productForm.category}
                      onChange={(e) => {
                        if (e.target.value === "__NEW__") {
                          setIsCustomCategoryInput(true)
                          setProductForm({ ...productForm, category: "" })
                        } else {
                          setProductForm({ ...productForm, category: e.target.value })
                        }
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option value="__NEW__">+ Crear nueva categoría...</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                    Tiempo Estimado (Minutos)
                  </label>
                  <input
                    type="number"
                    value={productForm.preparationTimeMinutes}
                    onChange={(e) =>
                      setProductForm({ ...productForm, preparationTimeMinutes: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                  Foto del Producto
                </label>

                <input
                  ref={productFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  onChange={handleProductImageFile}
                  className="hidden"
                />

                {productForm.src ? (
                  <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-2.5 space-y-2">
                    <div className="relative h-36 w-full overflow-hidden rounded-lg bg-slate-900 border border-slate-200/50 dark:border-slate-700">
                      <img src={productForm.src} alt="Preview" className="size-full object-cover" />
                      <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                        <Sparkles className="size-3 text-emerald-400" />
                        <span>Vista Previa (WebP Optimizado)</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isOptimizingImage}
                        onClick={() => productFileInputRef.current?.click()}
                        className="gap-1.5 text-xs font-semibold cursor-pointer"
                      >
                        <Upload className="size-3.5 text-indigo-500" />
                        <span>{isOptimizingImage ? "Procesando..." : "Cambiar Foto"}</span>
                      </Button>
                      <button
                        type="button"
                        onClick={() => setProductForm({ ...productForm, src: "" })}
                        className="text-xs text-rose-500 hover:text-rose-600 font-semibold px-2 py-1 cursor-pointer"
                      >
                        Quitar Foto
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div
                      onClick={() => !isOptimizingImage && productFileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 p-5 text-center hover:border-indigo-500 dark:hover:border-indigo-400 cursor-pointer transition-all"
                    >
                      <div className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 p-2 text-indigo-600 dark:text-indigo-400">
                        <Upload className="size-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {isOptimizingImage ? "Optimizando a WebP..." : "Subir foto desde tu teléfono o PC"}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Se comprime automáticamente a formato WebP ultraliviano
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                      <span className="text-[10px] uppercase font-bold text-slate-400">o ingresa una URL</span>
                      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    </div>

                    <input
                      type="url"
                      value={productForm.src}
                      onChange={(e) => setProductForm({ ...productForm, src: e.target.value })}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full rounded-xl border border-slate-300 bg-white p-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                  Descripción e Ingredientes
                </label>
                <textarea
                  rows={3}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="Describe los ingredientes, preparación y acompañamientos..."
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={productForm.isPopular}
                    onChange={(e) => setProductForm({ ...productForm, isPopular: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span>Destacar como &quot;Popular 🔥&quot;</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={productForm.isNew}
                    onChange={(e) => setProductForm({ ...productForm, isNew: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span>Etiqueta &quot;Nuevo ✨&quot;</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsProductModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                  Guardar en Menú
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Addition Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div
            className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl transition-all ${
              isDark ? "border-slate-800 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {editingAddition ? "Editar Adicional" : "Nuevo Adicional / Extra"}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAddition} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                  Nombre de la Adición
                </label>
                <input
                  type="text"
                  required
                  value={additionForm.name}
                  onChange={(e) => setAdditionForm({ ...additionForm, name: e.target.value })}
                  placeholder="Ej. Tocineta ahumada extra"
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                  Precio Extra ($ COP)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  step={500}
                  value={additionForm.price}
                  onChange={(e) => setAdditionForm({ ...additionForm, price: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer">
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
          <div
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
              isDark ? "border-slate-800 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Tags className="size-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Gestionar Categorías del Menú
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCategoryModalOpen(false)
                  setEditingCategoryName(null)
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Create Category Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!newCategoryName.trim()) return
                addCategory(newCategoryName.trim())
                setNewCategoryName("")
              }}
              className="mt-4 flex gap-2"
            >
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nueva categoría (ej. Pizzas, Entradas, Postres)..."
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <Button
                type="submit"
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl cursor-pointer"
              >
                <Plus className="size-3.5 mr-1" />
                Agregar
              </Button>
            </form>

            {/* Existing Categories List */}
            <div className="mt-4 max-h-64 overflow-y-auto space-y-2 pr-1 text-xs">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Categorías Activas ({categories.length})
              </p>
              {categories.map((cat) => {
                const count = products.filter((p) => p.category === cat).length
                const isEditing = editingCategoryName === cat

                return (
                  <div
                    key={cat}
                    className={`flex items-center justify-between rounded-xl border p-2.5 transition-all ${
                      isDark
                        ? "border-slate-800 bg-slate-800/60"
                        : "border-slate-100 bg-slate-50/80"
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex flex-1 items-center gap-2 mr-2">
                        <input
                          type="text"
                          value={editCategoryInputValue}
                          onChange={(e) => setEditCategoryInputValue(e.target.value)}
                          className="flex-1 rounded-lg border border-indigo-500 bg-white px-2 py-1 text-xs text-slate-900 dark:bg-slate-900 dark:text-white"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (editCategoryInputValue.trim()) {
                              updateCategory(cat, editCategoryInputValue.trim())
                              setEditingCategoryName(null)
                              setEditCategoryInputValue("")
                            }
                          }}
                          className="rounded-lg bg-indigo-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-indigo-700 cursor-pointer"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCategoryName(null)}
                          className="rounded-lg bg-slate-200 dark:bg-slate-700 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {cat}
                          </span>
                          <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-400">
                            {count} {count === 1 ? "producto" : "productos"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategoryName(cat)
                              setEditCategoryInputValue(cat)
                            }}
                            className="rounded-lg p-1 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600 dark:hover:bg-indigo-950/40 cursor-pointer"
                            title="Renombrar categoría"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCategoryToDelete(cat)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40 cursor-pointer"
                            title="Eliminar categoría"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-5 flex justify-end border-t pt-3 border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsCategoryModalOpen(false)
                  setEditingCategoryName(null)
                }}
                className="text-xs"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={() => {
          if (categoryToDelete) {
            deleteCategory(categoryToDelete)
            setCategoryToDelete(null)
          }
        }}
        title="¿Eliminar categoría?"
        targetName={categoryToDelete || undefined}
        description={
          categoryToDelete
            ? `¿Estás seguro de que deseas eliminar la categoría "${categoryToDelete}"? Los productos asignados a esta categoría se moverán automáticamente a otra categoría activa.`
            : undefined
        }
        confirmText="Eliminar categoría"
      />

      {/* Delete Product Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={() => {
          if (productToDelete) {
            deleteProduct(productToDelete.id)
            setProductToDelete(null)
          }
        }}
        title="¿Eliminar producto del menú?"
        targetName={productToDelete?.name}
        description={
          productToDelete
            ? `¿Estás seguro de que deseas eliminar "${productToDelete.name}" ($${productToDelete.price.toLocaleString()}) del menú? Ya no estará disponible para los clientes.`
            : undefined
        }
        confirmText="Eliminar producto"
      />

      {/* Delete Addition Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!additionToDelete}
        onClose={() => setAdditionToDelete(null)}
        onConfirm={() => {
          if (additionToDelete) {
            deleteAddition(additionToDelete.id)
            setAdditionToDelete(null)
          }
        }}
        title="¿Eliminar adición / extra?"
        targetName={additionToDelete?.name}
        description={
          additionToDelete
            ? `¿Estás seguro de que deseas eliminar la adición "${additionToDelete.name}" (+${additionToDelete.price.toLocaleString()})?`
            : undefined
        }
        confirmText="Eliminar adición"
      />
    </div>
  )
}
