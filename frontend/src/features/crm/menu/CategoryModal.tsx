import React, { useState } from "react"
import type { MenuItem } from "@/types/restaurant"
import { Tags, X, Plus, Edit2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal"

export interface CategoryModalProps {
  isOpen: boolean
  categories: string[]
  products: MenuItem[]
  isDark?: boolean
  onClose: () => void
  onAddCategory: (name: string) => void
  onUpdateCategory: (oldName: string, newName: string) => void
  onDeleteCategory: (name: string) => void
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  categories,
  products,
  isDark = false,
  onClose,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}) => {
  const [newCategoryName, setNewCategoryName] = useState("")
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null)
  const [editCategoryInputValue, setEditCategoryInputValue] = useState("")
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null)

  if (!isOpen) return null

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    onAddCategory(newCategoryName.trim())
    setNewCategoryName("")
  }

  const handleSaveEdit = (cat: string) => {
    if (editCategoryInputValue.trim()) {
      const newCatName = editCategoryInputValue.trim()
      onUpdateCategory(cat, newCatName)
      setEditingCategoryName(null)
      setEditCategoryInputValue("")
    }
  }

  const handleCloseModal = () => {
    setEditingCategoryName(null)
    onClose()
  }

  return (
    <>
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
              onClick={handleCloseModal}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Create Category Form */}
          <form onSubmit={handleCreateCategory} className="mt-4 flex gap-2">
            <input
              type="text"
              maxLength={50}
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
                        maxLength={50}
                        value={editCategoryInputValue}
                        onChange={(e) => setEditCategoryInputValue(e.target.value)}
                        className="flex-1 rounded-lg border border-indigo-500 bg-white px-2 py-1 text-xs text-slate-900 dark:bg-slate-900 dark:text-white"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(cat)}
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
              onClick={handleCloseModal}
              className="text-xs"
            >
              Cerrar
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Category Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={() => {
          if (categoryToDelete) {
            onDeleteCategory(categoryToDelete)
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
    </>
  )
}
