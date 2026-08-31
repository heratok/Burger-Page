import React, { useState, useMemo } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import type { InventoryItem, Supplier } from "@/types/restaurant"
import { Boxes, Plus, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal"
import { buildWhatsAppUrl } from "@/features/cart"
import { InventoryStats, InventoryTable, SuppliersList, InventoryItemModal, SupplierModal, CATEGORY_LABELS, type InventoryItemFormData, type SupplierFormData } from "./inventory"

export const InventoryManager: React.FC = () => {
  const {
    inventory, suppliers, addInventoryItem, updateInventoryItem, deleteInventoryItem,
    adjustStock, addSupplier, updateSupplier, deleteSupplier, lowStockCount,
    totalInventoryValue, adminTheme, storeConfig,
  } = useRestaurant()

  const isDark = adminTheme === "dark"
  const [activeTab, setActiveTab] = useState<"inventory" | "suppliers">("inventory")
  const [searchTerm, setSearchTerm] = useState(""), [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [onlyLowStock, setOnlyLowStock] = useState(false), [currentPage, setCurrentPage] = useState(1), [pageSize, setPageSize] = useState(10)
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null), [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false), [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false), [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  const filteredInventory = useMemo(() => inventory.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      CATEGORY_LABELS[item.category]?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch && (selectedCategory === "all" || item.category === selectedCategory) &&
      (!onlyLowStock || item.currentStock <= item.minStockAlert)
  }), [inventory, searchTerm, selectedCategory, onlyLowStock])

  const paginatedInventory = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredInventory.slice(start, start + pageSize)
  }, [filteredInventory, currentPage, pageSize])

  const filteredSuppliers = useMemo(() => suppliers.filter((sup) =>
    [sup.name, sup.contactName, sup.category].some((f) => f.toLowerCase().includes(searchTerm.toLowerCase()))
  ), [suppliers, searchTerm])

  const handleSaveItem = (data: InventoryItemFormData) => {
    editingItem ? updateInventoryItem(editingItem.id, data) : addInventoryItem(data)
    setIsItemModalOpen(false)
  }

  const handleSaveSupplier = (data: SupplierFormData) => {
    editingSupplier ? updateSupplier(editingSupplier.id, data) : addSupplier(data)
    setIsSupplierModalOpen(false)
  }

  const handleSendSupplierWhatsApp = (sup: Supplier) => {
    const lowItems = inventory.filter((i) => i.supplierId === sup.id && i.currentStock <= i.minStockAlert)
    let msg = `👋 Hola ${sup.contactName || sup.name}, le escribo de *${storeConfig.name}* para solicitar una reposición de pedido.`
    if (lowItems.length > 0) {
      msg += `\n\n⚠️ *Insumos con stock crítico que necesitamos:*`
      lowItems.forEach((it) => { msg += `\n• ${it.name} (Stock actual: ${it.currentStock} ${it.unit})` })
    }
    msg += `\n\n¿Tienen disponibilidad y fecha estimada de entrega? Muchas gracias.`
    window.open(buildWhatsAppUrl(sup.phone, msg), "_blank")
  }

  return (
    <div className="space-y-6">
      <InventoryStats
        totalItems={inventory.length} lowStockCount={lowStockCount}
        totalInventoryValue={totalInventoryValue} suppliersCount={suppliers.length}
        isDark={isDark} onSelectSuppliers={() => setActiveTab("suppliers")}
        onSelectLowStock={() => { setActiveTab("inventory"); setOnlyLowStock(true) }}
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className={`flex items-center rounded-xl border p-1 ${isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-slate-100"}`}>
          <button
            type="button"
            onClick={() => setActiveTab("inventory")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${activeTab === "inventory" ? "bg-indigo-600 text-white shadow-xs" : isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"}`}
          >
            <Boxes className="size-3.5" />
            <span>Control de Stock</span>
            {lowStockCount > 0 && <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] text-white">{lowStockCount}</span>}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("suppliers")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${activeTab === "suppliers" ? "bg-indigo-600 text-white shadow-xs" : isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"}`}
          >
            <Truck className="size-3.5" />
            <span>Proveedores ({suppliers.length})</span>
          </button>
        </div>

        <Button
          type="button"
          onClick={() => {
            activeTab === "inventory" ? (setEditingItem(null), setIsItemModalOpen(true)) : (setEditingSupplier(null), setIsSupplierModalOpen(true))
          }}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700"
        >
          <Plus className="size-4" />
          <span>{activeTab === "inventory" ? "Nuevo Insumo" : "Registrar Proveedor"}</span>
        </Button>
      </div>

      {activeTab === "inventory" ? (
        <InventoryTable
          items={paginatedInventory} totalItems={filteredInventory.length} suppliers={suppliers}
          searchTerm={searchTerm} onSearchChange={(t) => { setSearchTerm(t); setCurrentPage(1) }}
          selectedCategory={selectedCategory} onCategoryChange={(c) => { setSelectedCategory(c); setCurrentPage(1) }}
          onlyLowStock={onlyLowStock} onToggleOnlyLowStock={() => { setOnlyLowStock(!onlyLowStock); setCurrentPage(1) }}
          currentPage={currentPage} pageSize={pageSize}
          onPageChange={setCurrentPage} onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1) }}
          isDark={isDark} onAdjustStock={adjustStock} onSendSupplierWhatsApp={handleSendSupplierWhatsApp}
          onEditItem={(item) => { setEditingItem(item); setIsItemModalOpen(true) }} onDeleteItem={setItemToDelete}
        />
      ) : (
        <SuppliersList
          suppliers={filteredSuppliers} inventory={inventory}
          searchTerm={searchTerm} onSearchChange={setSearchTerm} isDark={isDark}
          onEditSupplier={(s) => { setEditingSupplier(s); setIsSupplierModalOpen(true) }}
          onDeleteSupplier={setSupplierToDelete} onSendSupplierWhatsApp={handleSendSupplierWhatsApp}
        />
      )}

      <InventoryItemModal
        isOpen={isItemModalOpen} editingItem={editingItem} suppliers={suppliers} isDark={isDark}
        onClose={() => setIsItemModalOpen(false)} onSave={handleSaveItem}
      />
      <SupplierModal
        isOpen={isSupplierModalOpen} editingSupplier={editingSupplier} isDark={isDark}
        onClose={() => setIsSupplierModalOpen(false)} onSave={handleSaveSupplier}
      />
      <ConfirmDeleteModal
        isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)}
        onConfirm={() => { if (itemToDelete) { deleteInventoryItem(itemToDelete.id); setItemToDelete(null) } }}
        title="¿Eliminar insumo del inventario?" targetName={itemToDelete?.name} confirmText="Eliminar insumo"
        description={itemToDelete ? `¿Estás seguro de que deseas eliminar permanentemente el insumo "${itemToDelete.name}" (${itemToDelete.currentStock} ${itemToDelete.unit} en stock)?` : undefined}
      />
      <ConfirmDeleteModal
        isOpen={!!supplierToDelete} onClose={() => setSupplierToDelete(null)}
        onConfirm={() => { if (supplierToDelete) { deleteSupplier(supplierToDelete.id); setSupplierToDelete(null) } }}
        title="¿Eliminar proveedor?" targetName={supplierToDelete?.name} confirmText="Eliminar proveedor"
        description={supplierToDelete ? `¿Estás seguro de que deseas eliminar permanentemente al proveedor "${supplierToDelete.name}"? Los insumos asociados seguirán en el inventario pero sin proveedor vinculado.` : undefined}
      />
    </div>
  )
}
