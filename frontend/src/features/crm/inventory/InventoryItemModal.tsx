import React, { useState, useEffect } from "react"
import type {
  InventoryItem,
  Supplier,
  InventoryCategory,
  InventoryUnit,
} from "@/types/restaurant"
import { Boxes, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"

const UNIT_OPTIONS: InventoryUnit[] = [
  "unidades",
  "kg",
  "g",
  "litros",
  "paquetes",
  "cajas",
]

export interface InventoryItemFormData {
  name: string
  category: InventoryCategory
  currentStock: number
  minStockAlert: number
  unit: InventoryUnit
  costPerUnit: number
  supplierId?: string
}

export interface InventoryItemModalProps {
  isOpen: boolean
  editingItem: InventoryItem | null
  suppliers: Supplier[]
  isDark: boolean
  onClose: () => void
  onSave: (data: InventoryItemFormData) => void
}

export const InventoryItemModal: React.FC<InventoryItemModalProps> = ({
  isOpen,
  editingItem,
  suppliers,
  isDark,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<{
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
    currentStock: 20,
    minStockAlert: 5,
    unit: "unidades",
    costPerUnit: 2000,
    supplierId: suppliers[0]?.id || "",
  })

  useEffect(() => {
    if (editingItem) {
      setFormData({
        name: editingItem.name,
        category: editingItem.category,
        currentStock: editingItem.currentStock,
        minStockAlert: editingItem.minStockAlert,
        unit: editingItem.unit,
        costPerUnit: editingItem.costPerUnit,
        supplierId: editingItem.supplierId || "",
      })
    } else {
      setFormData({
        name: "",
        category: "ingredients",
        currentStock: 20,
        minStockAlert: 5,
        unit: "unidades",
        costPerUnit: 2000,
        supplierId: suppliers[0]?.id || "",
      })
    }
  }, [editingItem, isOpen, suppliers])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    onSave({
      name: formData.name.trim(),
      category: formData.category,
      currentStock: Number(formData.currentStock),
      minStockAlert: Number(formData.minStockAlert),
      unit: formData.unit,
      costPerUnit: Number(formData.costPerUnit),
      supplierId: formData.supplierId || undefined,
    })
  }

  return (
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
            onClick={onClose}
            className={`rounded-lg p-1 transition-colors ${
              isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className={`block font-semibold mb-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
              Nombre del Insumo *
            </label>
            <input
              type="text"
              required
              maxLength={80}
              placeholder="Ej: Pan Brioche de Papa, Carne Angus 150g, etc."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full rounded-xl border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDark
                  ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                  : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Categoría"
              size="md"
              value={formData.category}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  category: e.target.value as InventoryCategory,
                })
              }
              options={[
                { value: "ingredients", label: "Ingredientes & Alimentos" },
                { value: "beverages", label: "Bebidas & Refrescos" },
                { value: "packaging", label: "Empaques & Descartables" },
                { value: "cleaning", label: "Limpieza" },
                { value: "other", label: "Otros" },
              ]}
            />

            <Select
              label="Unidad de Medida"
              size="md"
              value={formData.unit}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  unit: e.target.value as InventoryUnit,
                })
              }
              options={UNIT_OPTIONS.map((u) => ({
                value: u,
                label: u,
              }))}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={`block font-semibold mb-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                Stock Actual
              </label>
              <input
                type="number"
                min="0"
                max={1000000}
                step="any"
                required
                value={formData.currentStock}
                onChange={(e) =>
                  setFormData({ ...formData, currentStock: Number(e.target.value) })
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
                min="0"
                max={100000}
                required
                value={formData.minStockAlert}
                onChange={(e) =>
                  setFormData({ ...formData, minStockAlert: Number(e.target.value) })
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
                max={50000000}
                required
                value={formData.costPerUnit}
                onChange={(e) =>
                  setFormData({ ...formData, costPerUnit: Number(e.target.value) })
                }
                className={`w-full rounded-xl border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDark
                    ? "border-slate-700 bg-slate-800 text-white"
                    : "border-slate-300 bg-white text-slate-900"
                }`}
              />
            </div>
          </div>

          <Select
            label="Proveedor Asignado"
            size="md"
            value={formData.supplierId}
            onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
            options={[
              { value: "", label: "Sin proveedor específico" },
              ...suppliers.map((s) => ({
                value: s.id,
                label: s.name,
              })),
            ]}
          />

          <div className={`flex items-center justify-end gap-2 pt-3 border-t ${isDark ? "border-slate-800" : "border-slate-200"}`}>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
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
  )
}
