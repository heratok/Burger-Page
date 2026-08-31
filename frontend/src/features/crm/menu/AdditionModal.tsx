import React, { useState, useEffect } from "react"
import type { AdditionItem } from "@/types/restaurant"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export interface AdditionModalProps {
  isOpen: boolean
  editingAddition: AdditionItem | null
  isDark?: boolean
  onClose: () => void
  onSave: (data: { name: string; price: number; available: boolean }) => void
}

export const AdditionModal: React.FC<AdditionModalProps> = ({
  isOpen,
  editingAddition,
  isDark = false,
  onClose,
  onSave,
}) => {
  const [additionForm, setAdditionForm] = useState({
    name: "",
    price: 3000,
    available: true,
  })

  useEffect(() => {
    if (!isOpen) return

    if (editingAddition) {
      setAdditionForm({
        name: editingAddition.name,
        price: editingAddition.price,
        available: editingAddition.available,
      })
    } else {
      setAdditionForm({
        name: "",
        price: 3000,
        available: true,
      })
    }
  }, [isOpen, editingAddition])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = additionForm.name.trim()
    if (!trimmedName) {
      toast.error("El nombre del adicional no puede estar vacío")
      return
    }
    if (additionForm.price < 0 || isNaN(additionForm.price)) {
      toast.error("El precio del adicional no puede ser negativo")
      return
    }

    onSave({ ...additionForm, name: trimmedName })
  }

  return (
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
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs">
          <div>
            <label className="font-semibold block mb-1 text-slate-800 dark:text-slate-200">
              Nombre de la Adición
            </label>
            <input
              type="text"
              required
              maxLength={60}
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
              max={10000000}
              step={500}
              value={additionForm.price}
              onChange={(e) => setAdditionForm({ ...additionForm, price: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 cursor-pointer"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
