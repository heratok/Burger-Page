import React, { useState, useMemo } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import { useMenuFilter } from "./hooks/useMenuFilter"
import type { MenuItem, AdditionItem } from "@/types/restaurant"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal"
import { Pagination } from "@/components/ui/pagination"
import { formatCurrency } from "@/lib/utils"
import {
  ProductGrid,
  ProductTable,
  ProductModal,
  CategoryModal,
  AdditionsManager,
  AdditionModal,
  MenuFilterBar,
} from "./menu"

export const MenuManager: React.FC = () => {
  const {
    activeRestaurant,
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
  const [deletingProductIds, setDeletingProductIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<MenuItem | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingAddition, setEditingAddition] = useState<AdditionItem | null>(null)

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

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredProducts.slice(start, start + pageSize)
  }, [filteredProducts, currentPage, pageSize])

  const isDark = adminTheme === "dark"

  const handleSaveProduct = (payload: Omit<MenuItem, "id">) => {
    if (editingProduct) updateProduct(editingProduct.id, payload)
    else addProduct(payload)
    setIsProductModalOpen(false)
  }

  const handleSaveAddition = (payload: { name: string; price: number; available: boolean }) => {
    if (editingAddition) updateAddition(editingAddition.id, payload)
    else addAddition(payload)
    setIsAddModalOpen(false)
  }

  const handleDeleteProduct = () => {
    if (!productToDelete) return
    const id = productToDelete.id
    setDeletingProductIds((prev) => new Set(prev).add(id))
    setProductToDelete(null)
    deleteProduct(id)
  }

  return (
    <div className="space-y-6">
      {/* Top Strip */}
      <div className={`flex flex-col gap-4 rounded-2xl border p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between ${isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800 border dark:border-slate-700">
            <button type="button" onClick={() => setActiveSubTab("dishes")} className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${activeSubTab === "dishes" ? "bg-white text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"}`}>
              Platos & Productos ({products.length})
            </button>
            <button type="button" onClick={() => setActiveSubTab("additions")} className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${activeSubTab === "additions" ? "bg-white text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"}`}>
              Adicionales & Extras ({additions.length})
            </button>
          </div>
        </div>

        <Button type="button" onClick={() => { if (activeSubTab === "dishes") { setEditingProduct(null); setIsProductModalOpen(true) } else { setEditingAddition(null); setIsAddModalOpen(true) } }} className="gap-2 rounded-xl bg-indigo-600 font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 cursor-pointer">
          <Plus className="size-4" />
          <span>{activeSubTab === "dishes" ? "Crear Producto" : "Añadir Adicional"}</span>
        </Button>
      </div>

      {activeSubTab === "dishes" && (
        <>
          <MenuFilterBar categories={categories} selectedCategory={selectedCategory} totalProductsCount={products.length} searchTerm={searchTerm} viewMode={viewMode} isDark={isDark} onSelectCategory={(cat) => { setSelectedCategory(cat); setCurrentPage(1) }} onSearchChange={(term) => { setSearchTerm(term); setCurrentPage(1) }} onViewModeChange={setViewMode} onOpenCategoryModal={() => setIsCategoryModalOpen(true)} />

          {viewMode === "grid" ? (
            <ProductGrid products={paginatedProducts} deletingProductIds={deletingProductIds} isDark={isDark} onToggleStock={toggleProductStock} onEditProduct={(p) => { setEditingProduct(p); setIsProductModalOpen(true) }} onDeleteProduct={setProductToDelete} />
          ) : (
            <ProductTable products={paginatedProducts} isDark={isDark} onToggleStock={toggleProductStock} onEditProduct={(p) => { setEditingProduct(p); setIsProductModalOpen(true) }} onDeleteProduct={setProductToDelete} />
          )}

          {filteredProducts.length > 0 && (
            <div className="rounded-2xl border p-2 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <Pagination currentPage={currentPage} totalItems={filteredProducts.length} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1) }} pageSizeOptions={[6, 12, 24, 48]} />
            </div>
          )}
        </>
      )}

      {activeSubTab === "additions" && (
        <AdditionsManager additions={additions} isDark={isDark} onEditAddition={(a) => { setEditingAddition(a); setIsAddModalOpen(true) }} onDeleteAddition={setAdditionToDelete} />
      )}

      <ProductModal isOpen={isProductModalOpen} editingProduct={editingProduct} categories={categories} restaurantId={activeRestaurant?.id} isDark={isDark} onClose={() => setIsProductModalOpen(false)} onSave={handleSaveProduct} />
      <CategoryModal isOpen={isCategoryModalOpen} categories={categories} products={products} isDark={isDark} onClose={() => setIsCategoryModalOpen(false)} onAddCategory={addCategory} onUpdateCategory={(oldCat, newCat) => { updateCategory(oldCat, newCat); if (selectedCategory === oldCat) setSelectedCategory(newCat) }} onDeleteCategory={(cat) => { deleteCategory(cat); if (selectedCategory === cat) setSelectedCategory("ALL") }} />
      <AdditionModal isOpen={isAddModalOpen} editingAddition={editingAddition} isDark={isDark} onClose={() => setIsAddModalOpen(false)} onSave={handleSaveAddition} />
      <ConfirmDeleteModal isOpen={!!productToDelete} onClose={() => setProductToDelete(null)} onConfirm={handleDeleteProduct} title="¿Eliminar producto del menú?" targetName={productToDelete?.name} description={productToDelete ? `¿Estás seguro de que deseas eliminar "${productToDelete.name}" (${formatCurrency(productToDelete.price)}) del menú? Ya no estará disponible para los clientes.` : undefined} confirmText="Eliminar producto" />
      <ConfirmDeleteModal isOpen={!!additionToDelete} onClose={() => setAdditionToDelete(null)} onConfirm={() => { if (additionToDelete) { deleteAddition(additionToDelete.id); setAdditionToDelete(null) } }} title="¿Eliminar adición / extra?" targetName={additionToDelete?.name} description={additionToDelete ? `¿Estás seguro de que deseas eliminar la adición "${additionToDelete.name}" (+${formatCurrency(additionToDelete.price)})?` : undefined} confirmText="Eliminar adición" />
    </div>
  )
}
