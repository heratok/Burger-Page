import React, { useState, useMemo } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import type {
  InventoryItem,
  Supplier,
  InventoryCategory,
  InventoryUnit,
} from "@/types/restaurant"
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  DollarSign,
  Truck,
  Phone,
  MessageSquare,
  Edit2,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal"
import { Pagination } from "@/components/ui/pagination"
import { formatCurrency } from "@/lib/utils"
import { buildWhatsAppUrl } from "@/features/cart"

const CATEGORY_LABELS: Record<InventoryCategory, string> = {
  ingredients: "Ingredientes & Alimentos",
  beverages: "Bebidas & Refrescos",
  packaging: "Empaques & Descartables",
  cleaning: "Limpieza & Desinfección",
  other: "Otros Insumos",
}

const UNIT_OPTIONS: InventoryUnit[] = [
  "unidades",
  "kg",
  "g",
  "litros",
  "paquetes",
  "cajas",
]

export const InventoryManager: React.FC = () => {
  const {
    inventory,
    suppliers,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    adjustStock,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    lowStockCount,
    totalInventoryValue,
    adminTheme,
    storeConfig,
  } = useRestaurant()

  const isDark = adminTheme === "dark"

  const [activeTab, setActiveTab] = useState<"inventory" | "suppliers">("inventory")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [onlyLowStock, setOnlyLowStock] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null)
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null)

  // Item Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [itemForm, setItemForm] = useState<{
    name: string
    category: InventoryCategory
    currentStock: number
    minStockAlert: number
    unit: InventoryUnit
    costPerUnit: number
    supplierId: string
  }>({
    name: "",
    category: "ingredients",
    currentStock: 10,
    minStockAlert: 5,
    unit: "unidades",
    costPerUnit: 2500,
    supplierId: "",
  })

  // Supplier Modal State
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    category: "Carnes & Proteínas",
    contactName: "",
    phone: "",
    email: "",
    notes: "",
  })

  // Filtered inventory list
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        CATEGORY_LABELS[item.category]?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesCategory =
        selectedCategory === "all" || item.category === selectedCategory

      const matchesLowStock = onlyLowStock
        ? item.currentStock <= item.minStockAlert
        : true

      return matchesSearch && matchesCategory && matchesLowStock
    })
  }, [inventory, searchTerm, selectedCategory, onlyLowStock])

  const paginatedInventory = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredInventory.slice(start, start + pageSize)
  }, [filteredInventory, currentPage, pageSize])

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(
      (sup) =>
        sup.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sup.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sup.category.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [suppliers, searchTerm])

  const openNewItemModal = () => {
    setEditingItem(null)
    setItemForm({
      name: "",
      category: "ingredients",
      currentStock: 20,
      minStockAlert: 5,
      unit: "unidades",
      costPerUnit: 2000,
      supplierId: suppliers[0]?.id || "",
    })
    setIsItemModalOpen(true)
  }

  const openEditItemModal = (item: InventoryItem) => {
    setEditingItem(item)
    setItemForm({
      name: item.name,
      category: item.category,
      currentStock: item.currentStock,
      minStockAlert: item.minStockAlert,
      unit: item.unit,
      costPerUnit: item.costPerUnit,
      supplierId: item.supplierId || "",
    })
    setIsItemModalOpen(true)
  }

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemForm.name.trim()) return

    if (editingItem) {
      updateInventoryItem(editingItem.id, {
        name: itemForm.name.trim(),
        category: itemForm.category,
        currentStock: Number(itemForm.currentStock),
        minStockAlert: Number(itemForm.minStockAlert),
        unit: itemForm.unit,
        costPerUnit: Number(itemForm.costPerUnit),
        supplierId: itemForm.supplierId || undefined,
      })
    } else {
      addInventoryItem({
        name: itemForm.name.trim(),
        category: itemForm.category,
        currentStock: Number(itemForm.currentStock),
        minStockAlert: Number(itemForm.minStockAlert),
        unit: itemForm.unit,
        costPerUnit: Number(itemForm.costPerUnit),
        supplierId: itemForm.supplierId || undefined,
      })
    }
    setIsItemModalOpen(false)
  }

  const openNewSupplierModal = () => {
    setEditingSupplier(null)
    setSupplierForm({
      name: "",
      category: "Alimentos & Insumos",
      contactName: "",
      phone: "",
      email: "",
      notes: "",
    })
    setIsSupplierModalOpen(true)
  }

  const openEditSupplierModal = (sup: Supplier) => {
    setEditingSupplier(sup)
    setSupplierForm({
      name: sup.name,
      category: sup.category,
      contactName: sup.contactName,
      phone: sup.phone,
      email: sup.email || "",
      notes: sup.notes || "",
    })
    setIsSupplierModalOpen(true)
  }

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplierForm.name.trim()) return

    if (editingSupplier) {
      updateSupplier(editingSupplier.id, {
        name: supplierForm.name.trim(),
        category: supplierForm.category,
        contactName: supplierForm.contactName.trim(),
        phone: supplierForm.phone.trim(),
        email: supplierForm.email.trim() || undefined,
        notes: supplierForm.notes.trim() || undefined,
      })
    } else {
      addSupplier({
        name: supplierForm.name.trim(),
        category: supplierForm.category,
        contactName: supplierForm.contactName.trim(),
        phone: supplierForm.phone.trim(),
        email: supplierForm.email.trim() || undefined,
        notes: supplierForm.notes.trim() || undefined,
      })
    }
    setIsSupplierModalOpen(false)
  }

  const handleSendSupplierWhatsApp = (sup: Supplier) => {
    // Find all low stock items linked to this supplier
    const lowItems = inventory.filter(
      (item) => item.supplierId === sup.id && item.currentStock <= item.minStockAlert
    )

    let msg = `👋 Hola ${sup.contactName || sup.name}, le escribo de *${storeConfig.name}* para solicitar una reposición de pedido.`

    if (lowItems.length > 0) {
      msg += `\n\n⚠️ *Insumos con stock crítico que necesitamos:*`
      lowItems.forEach((it) => {
        msg += `\n• ${it.name} (Stock actual: ${it.currentStock} ${it.unit})`
      })
    }

    msg += `\n\n¿Tienen disponibilidad y fecha estimada de entrega? Muchas gracias.`

    window.open(buildWhatsAppUrl(sup.phone, msg), "_blank")
  }

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* HEADER METRICS ROW                                       */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metric 1: Total Items */}
        <div
          className={`rounded-2xl border p-4 transition-all ${
            isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200/80 bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Insumos Registrados
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
              <Boxes className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {inventory.length}
          </div>
          <span className="text-[11px] text-slate-400">Total en catálogo de materias primas</span>
        </div>

        {/* Metric 2: Low Stock Alert */}
        <div
          onClick={() => {
            setActiveTab("inventory")
            setOnlyLowStock(true)
          }}
          className={`rounded-2xl border p-4 transition-all cursor-pointer hover:border-amber-500/50 ${
            lowStockCount > 0
              ? isDark
                ? "border-amber-500/30 bg-amber-500/10"
                : "border-amber-200 bg-amber-50/70"
              : isDark
              ? "border-slate-800 bg-[#0E1322]"
              : "border-slate-200/80 bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Alertas de Bajo Stock
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-500 animate-pulse">
              <AlertTriangle className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-500">
            {lowStockCount}
          </div>
          <span className="text-[11px] text-amber-600/80 dark:text-amber-400/80">
            {lowStockCount > 0 ? "Requieren reposición urgente" : "Stock en niveles óptimos"}
          </span>
        </div>

        {/* Metric 3: Total Inventory Value */}
        <div
          className={`rounded-2xl border p-4 transition-all ${
            isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200/80 bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Valor del Inventario
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <DollarSign className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-500">
            {formatCurrency(totalInventoryValue)}
          </div>
          <span className="text-[11px] text-slate-400">Valorización total a costo actual</span>
        </div>

        {/* Metric 4: Suppliers */}
        <div
          onClick={() => setActiveTab("suppliers")}
          className={`rounded-2xl border p-4 transition-all cursor-pointer hover:border-indigo-500/50 ${
            isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200/80 bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Proveedores Activos
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
              <Truck className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {suppliers.length}
          </div>
          <span className="text-[11px] text-slate-400">Contactos directos de compra</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TABS CONTROLS & ACTION BAR                               */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Subtabs */}
        <div
          className={`flex items-center rounded-xl border p-1 ${
            isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-slate-100"
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab("inventory")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === "inventory"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Boxes className="size-3.5" />
            <span>Control de Stock</span>
            {lowStockCount > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] text-white">
                {lowStockCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("suppliers")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === "suppliers"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Truck className="size-3.5" />
            <span>Proveedores ({suppliers.length})</span>
          </button>
        </div>

        {/* Action Button */}
        {activeTab === "inventory" ? (
          <Button
            type="button"
            onClick={openNewItemModal}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700"
          >
            <Plus className="size-4" />
            <span>Nuevo Insumo</span>
          </Button>
        ) : (
          <Button
            type="button"
            onClick={openNewSupplierModal}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700"
          >
            <Plus className="size-4" />
            <span>Registrar Proveedor</span>
          </Button>
        )}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: INVENTORY ITEMS TABLE                             */}
      {/* ======================================================== */}
      {activeTab === "inventory" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar insumo por nombre o categoría..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className={`w-full rounded-xl border pl-8.5 pr-4 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDark
                    ? "border-slate-800 bg-[#0E1322] text-white placeholder-slate-500"
                    : "border-slate-200 bg-white text-slate-900 placeholder-slate-400"
                }`}
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value)
                setCurrentPage(1)
              }}
              className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                isDark
                  ? "border-slate-800 bg-[#0E1322] text-slate-200"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              <option value="all">Todas las Categorías</option>
              <option value="ingredients">Ingredientes & Alimentos</option>
              <option value="beverages">Bebidas & Refrescos</option>
              <option value="packaging">Empaques & Descartables</option>
              <option value="cleaning">Limpieza</option>
              <option value="other">Otros</option>
            </select>

            {/* Low Stock Toggle */}
            <button
              type="button"
              onClick={() => {
                setOnlyLowStock(!onlyLowStock)
                setCurrentPage(1)
              }}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                onlyLowStock
                  ? "border-amber-500 bg-amber-500/20 text-amber-400 font-bold"
                  : isDark
                  ? "border-slate-800 bg-[#0E1322] text-slate-400 hover:text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:text-slate-900"
              }`}
            >
              <AlertTriangle className="size-3.5" />
              <span>Solo Bajo Stock</span>
            </button>
          </div>

          {/* Table Container */}
          <div
            className={`rounded-2xl border overflow-hidden ${
              isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200/80 bg-white shadow-xs"
            }`}
          >
            {filteredInventory.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Boxes className="size-10 mx-auto mb-2 text-slate-500 opacity-50" />
                <p className="text-sm font-semibold">No se encontraron insumos</p>
                <p className="text-xs mt-1 text-slate-500">
                  {searchTerm || onlyLowStock
                    ? "Probá cambiando los filtros de búsqueda"
                    : "Empezá agregando materias primas para controlar tu stock"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead
                    className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                      isDark
                        ? "border-slate-800 bg-slate-900/50 text-slate-400"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                    }`}
                  >
                    <tr>
                      <th className="px-4 py-3">Insumo</th>
                      <th className="px-4 py-3">Categoría</th>
                      <th className="px-4 py-3">Stock Actual</th>
                      <th className="px-4 py-3">Ajuste Rápido</th>
                      <th className="px-4 py-3">Costo / Valuación</th>
                      <th className="px-4 py-3">Proveedor</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {paginatedInventory.map((item) => {
                      const isLow = item.currentStock <= item.minStockAlert
                      const supplier = suppliers.find((s) => s.id === item.supplierId)
                      const itemValuation = item.currentStock * item.costPerUnit

                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors ${
                            isLow
                              ? "bg-amber-500/5 hover:bg-amber-500/10"
                              : "hover:bg-slate-500/5"
                          }`}
                        >
                          {/* Name */}
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              {isLow && (
                                <span title="Stock por debajo del mínimo">
                                  <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                                </span>
                              )}
                              <span>{item.name}</span>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="px-4 py-3">
                            <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                              {CATEGORY_LABELS[item.category] || item.category}
                            </span>
                          </td>

                          {/* Current Stock */}
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-mono font-bold ${
                                    isLow
                                      ? "text-amber-500 font-extrabold"
                                      : "text-slate-900 dark:text-slate-200"
                                  }`}
                                >
                                  {item.currentStock} {item.unit}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  (Mín: {item.minStockAlert})
                                </span>
                              </div>
                              {/* Progress bar */}
                              <div className="h-1.5 w-24 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    isLow ? "bg-amber-500" : "bg-emerald-500"
                                  }`}
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      (item.currentStock / (item.minStockAlert * 2 || 1)) * 100
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Quick Adjust Buttons */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => adjustStock(item.id, -1)}
                                className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-700"
                                title="Descontar 1"
                              >
                                -1
                              </button>
                              <button
                                type="button"
                                onClick={() => adjustStock(item.id, 1)}
                                className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[11px] font-bold text-indigo-400 hover:bg-indigo-500/20"
                                title="Sumar 1"
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                onClick={() => adjustStock(item.id, 5)}
                                className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[11px] font-bold text-indigo-400 hover:bg-indigo-500/20"
                                title="Sumar 5"
                              >
                                +5
                              </button>
                            </div>
                          </td>

                          {/* Cost / Value */}
                          <td className="px-4 py-3 font-mono">
                            <div className="text-slate-900 dark:text-slate-200">
                              {formatCurrency(item.costPerUnit)} /{item.unit.slice(0, 3)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Total: {formatCurrency(itemValuation)}
                            </div>
                          </td>

                          {/* Supplier */}
                          <td className="px-4 py-3">
                            {supplier ? (
                              <button
                                type="button"
                                onClick={() => handleSendSupplierWhatsApp(supplier)}
                                className="inline-flex items-center gap-1 text-indigo-400 hover:underline"
                                title="Pedir reposición por WhatsApp"
                              >
                                <span className="truncate max-w-[120px]">{supplier.name}</span>
                                <MessageSquare className="size-3 text-emerald-400" />
                              </button>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">Sin asignar</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditItemModal(item)}
                                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                                title="Editar insumo"
                              >
                                <Edit2 className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setItemToDelete(item)}
                                className="rounded-lg p-1 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
                                title="Eliminar insumo"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination for Inventory Table */}
            {filteredInventory.length > 0 && (
              <div className="border-t border-slate-200/80 dark:border-slate-800 px-4 py-2">
                <Pagination
                  currentPage={currentPage}
                  totalItems={filteredInventory.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(size: number) => {
                    setPageSize(size)
                    setCurrentPage(1)
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: SUPPLIERS DIRECTORY                               */}
      {/* ======================================================== */}
      {activeTab === "suppliers" && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar proveedor por nombre, contacto o rubro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full rounded-xl border pl-8.5 pr-4 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDark
                  ? "border-slate-800 bg-[#0E1322] text-white placeholder-slate-500"
                  : "border-slate-200 bg-white text-slate-900 placeholder-slate-400"
              }`}
            />
          </div>

          {filteredSuppliers.length === 0 ? (
            <div
              className={`rounded-2xl border p-12 text-center text-slate-400 ${
                isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"
              }`}
            >
              <Truck className="size-10 mx-auto mb-2 text-slate-500 opacity-50" />
              <p className="text-sm font-semibold">No hay proveedores registrados</p>
              <p className="text-xs mt-1 text-slate-500">
                Registrá tus distribuidores para contactarlos en 1 clic y pedir reposiciones directas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSuppliers.map((sup) => {
                const suppliedItems = inventory.filter((it) => it.supplierId === sup.id)
                const criticalItems = suppliedItems.filter(
                  (it) => it.currentStock <= it.minStockAlert
                )

                return (
                  <div
                    key={sup.id}
                    className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                      isDark
                        ? "border-slate-800 bg-[#0E1322] hover:border-slate-700"
                        : "border-slate-200/80 bg-white hover:border-slate-300 shadow-xs"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400">
                            {sup.category}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">
                            {sup.name}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditSupplierModal(sup)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSupplierToDelete(sup)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
                            title="Eliminar proveedor"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Contact details */}
                      <div className="space-y-1 text-xs text-slate-400 my-3">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">Contacto:</span>
                          <span className="font-medium text-slate-300">
                            {sup.contactName || "No especificado"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="size-3 text-slate-500" />
                          <span className="font-mono text-slate-300">{sup.phone}</span>
                        </div>
                        {sup.notes && (
                          <p className="text-[11px] text-slate-400/90 italic mt-2 bg-slate-900/40 p-2 rounded-xl border border-slate-800">
                            &quot;{sup.notes}&quot;
                          </p>
                        )}
                      </div>

                      {/* Supplied Items Summary */}
                      <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between">
                        <span>{suppliedItems.length} insumos provistos</span>
                        {criticalItems.length > 0 && (
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            <AlertTriangle className="size-3" />
                            {criticalItems.length} por reponer
                          </span>
                        )}
                      </div>
                    </div>

                    {/* WhatsApp Action Button */}
                    <div className="mt-4 pt-3 border-t border-slate-800/60">
                      <Button
                        type="button"
                        onClick={() => handleSendSupplierWhatsApp(sup)}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>Pedir Reposición por WhatsApp</span>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE / EDIT INVENTORY ITEM                      */}
      {/* ======================================================== */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div
            className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl ${
              isDark ? "border-slate-800 bg-[#0E1322] text-white" : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className={`flex items-center justify-between border-b pb-3 mb-4 ${isDark ? "border-slate-800" : "border-slate-200"}`}>
              <h3 className="text-base font-bold flex items-center gap-2">
                <Boxes className="size-4 text-indigo-500" />
                <span>{editingItem ? "Editar Insumo" : "Nuevo Insumo en Inventario"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsItemModalOpen(false)}
                className={`rounded-lg p-1 transition-colors ${
                  isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3.5 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                  Nombre del Insumo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pan Brioche de Papa, Carne Angus 150g, etc."
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className={`w-full rounded-xl border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isDark
                      ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                      : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                    Categoría
                  </label>
                  <select
                    value={itemForm.category}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        category: e.target.value as InventoryCategory,
                      })
                    }
                    className={`w-full rounded-xl border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                      isDark
                        ? "border-slate-700 bg-slate-800 text-white"
                        : "border-slate-300 bg-white text-slate-900"
                    }`}
                  >
                    <option value="ingredients">Ingredientes & Alimentos</option>
                    <option value="beverages">Bebidas & Refrescos</option>
                    <option value="packaging">Empaques & Descartables</option>
                    <option value="cleaning">Limpieza</option>
                    <option value="other">Otros</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                    Unidad de Medida
                  </label>
                  <select
                    value={itemForm.unit}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        unit: e.target.value as InventoryUnit,
                      })
                    }
                    className={`w-full rounded-xl border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                      isDark
                        ? "border-slate-700 bg-slate-800 text-white"
                        : "border-slate-300 bg-white text-slate-900"
                    }`}
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                    Stock Actual
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={itemForm.currentStock}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, currentStock: Number(e.target.value) })
                    }
                    className={`w-full rounded-xl border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isDark
                        ? "border-slate-700 bg-slate-800 text-white"
                        : "border-slate-300 bg-white text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-amber-500">
                    Alerta Mínima
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={itemForm.minStockAlert}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, minStockAlert: Number(e.target.value) })
                    }
                    className={`w-full rounded-xl border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isDark
                        ? "border-slate-700 bg-slate-800 text-white"
                        : "border-slate-300 bg-white text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                    Costo Unitario ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={itemForm.costPerUnit}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, costPerUnit: Number(e.target.value) })
                    }
                    className={`w-full rounded-xl border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isDark
                        ? "border-slate-700 bg-slate-800 text-white"
                        : "border-slate-300 bg-white text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                  Proveedor Asignado
                </label>
                <select
                  value={itemForm.supplierId}
                  onChange={(e) => setItemForm({ ...itemForm, supplierId: e.target.value })}
                  className={`w-full rounded-xl border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                    isDark
                      ? "border-slate-700 bg-slate-800 text-white"
                      : "border-slate-300 bg-white text-slate-900"
                  }`}
                >
                  <option value="">-- Sin proveedor vinculado --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className={`flex items-center justify-end gap-2 pt-3 border-t ${isDark ? "border-slate-800" : "border-slate-200"}`}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsItemModalOpen(false)}
                  className={`rounded-xl ${
                    isDark
                      ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                      : "border-slate-300 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700"
                >
                  Guardar Insumo
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE / EDIT SUPPLIER                            */}
      {/* ======================================================== */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
              isDark ? "border-slate-800 bg-[#0E1322] text-white" : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className={`flex items-center justify-between border-b pb-3 mb-4 ${isDark ? "border-slate-800" : "border-slate-200"}`}>
              <h3 className="text-base font-bold flex items-center gap-2">
                <Truck className="size-4 text-indigo-500" />
                <span>{editingSupplier ? "Editar Proveedor" : "Registrar Nuevo Proveedor"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(false)}
                className={`rounded-lg p-1 transition-colors ${
                  isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3.5 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                  Nombre de la Empresa / Proveedor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Distribuidora Cárnicos San José"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className={`w-full rounded-xl border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isDark
                      ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                      : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                    Rubro / Categoría
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Carnes, Panadería, Bebidas"
                    value={supplierForm.category}
                    onChange={(e) =>
                      setSupplierForm({ ...supplierForm, category: e.target.value })
                    }
                    className={`w-full rounded-xl border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isDark
                        ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                        : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                    Persona de Contacto
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Carlos Gómez"
                    value={supplierForm.contactName}
                    onChange={(e) =>
                      setSupplierForm({ ...supplierForm, contactName: e.target.value })
                    }
                    className={`w-full rounded-xl border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isDark
                        ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                        : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                  Teléfono / WhatsApp para Pedidos *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 573105551234"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  className={`w-full rounded-xl border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isDark
                      ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                      : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
                  }`}
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                  Notas / Días de Entrega / Mínimos
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Entregan martes y viernes. Pedido mínimo $150.000."
                  value={supplierForm.notes}
                  onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                  className={`w-full rounded-xl border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isDark
                      ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                      : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
                  }`}
                />
              </div>

              <div className={`flex items-center justify-end gap-2 pt-3 border-t ${isDark ? "border-slate-800" : "border-slate-200"}`}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className={`rounded-xl ${
                    isDark
                      ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                      : "border-slate-300 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700"
                >
                  Guardar Proveedor
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => {
          if (itemToDelete) {
            deleteInventoryItem(itemToDelete.id)
            setItemToDelete(null)
          }
        }}
        title="¿Eliminar insumo del inventario?"
        targetName={itemToDelete?.name}
        description={
          itemToDelete
            ? `¿Estás seguro de que deseas eliminar permanentemente el insumo "${itemToDelete.name}" (${itemToDelete.currentStock} ${itemToDelete.unit} en stock)?`
            : undefined
        }
        confirmText="Eliminar insumo"
      />

      {/* Delete Supplier Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!supplierToDelete}
        onClose={() => setSupplierToDelete(null)}
        onConfirm={() => {
          if (supplierToDelete) {
            deleteSupplier(supplierToDelete.id)
            setSupplierToDelete(null)
          }
        }}
        title="¿Eliminar proveedor?"
        targetName={supplierToDelete?.name}
        description={
          supplierToDelete
            ? `¿Estás seguro de que deseas eliminar permanentemente al proveedor "${supplierToDelete.name}"? Los insumos asociados seguirán en el inventario pero sin proveedor vinculado.`
            : undefined
        }
        confirmText="Eliminar proveedor"
      />
    </div>
  )
}
