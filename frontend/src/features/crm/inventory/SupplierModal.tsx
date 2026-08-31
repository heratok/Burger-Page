import React, { useState, useEffect } from "react"
import type { Supplier } from "@/types/restaurant"
import { Truck, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface SupplierFormData {
  name: string
  category: string
  contactName: string
  phone: string
  email?: string
  notes?: string
}

export interface SupplierModalProps {
  isOpen: boolean
  editingSupplier: Supplier | null
  isDark: boolean
  onClose: () => void
  onSave: (data: SupplierFormData) => void
}

export const SupplierModal: React.FC<SupplierModalProps> = ({
  isOpen,
  editingSupplier,
  isDark,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    category: "Alimentos & Insumos",
    contactName: "",
    phone: "",
    email: "",
    notes: "",
  })

  useEffect(() => {
    if (editingSupplier) {
      setFormData({
        name: editingSupplier.name,
        category: editingSupplier.category,
        contactName: editingSupplier.contactName,
        phone: editingSupplier.phone,
        email: editingSupplier.email || "",
        notes: editingSupplier.notes || "",
      })
    } else {
      setFormData({
        name: "",
        category: "Alimentos & Insumos",
        contactName: "",
        phone: "",
        email: "",
        notes: "",
      })
    }
  }, [editingSupplier, isOpen])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    onSave({
      name: formData.name.trim(),
      category: formData.category,
      contactName: formData.contactName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim() || undefined,
      notes: formData.notes.trim() || undefined,
    })
  }

  return (
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
              Nombre de la Empresa / Proveedor *
            </label>
            <input
              type="text"
              required
              maxLength={80}
              placeholder="Ej: Distribuidora Cárnicos San José"
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
            <div>
              <label className={`block font-semibold mb-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                Rubro / Categoría
              </label>
              <input
                type="text"
                required
                maxLength={50}
                placeholder="Ej: Carnes, Panadería, Bebidas"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
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
                maxLength={80}
                placeholder="Ej: Carlos Gómez"
                value={formData.contactName}
                onChange={(e) =>
                  setFormData({ ...formData, contactName: e.target.value })
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
              maxLength={20}
              placeholder="Ej: 573105551234"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
              maxLength={300}
              placeholder="Ej: Entregan martes y viernes. Pedido mínimo $150.000."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
              Guardar Proveedor
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
