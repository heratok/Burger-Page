import React, { useState } from "react"
import { ArrowDown, ArrowUp, Check, LayoutGrid, Pencil, Plus, Trash2, X } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal"
import { useRestaurantTables } from "@/features/crm/tables/useRestaurantTables"
import type { RestaurantTable } from "@/types/restaurant"

const MAX_TABLE_NAME_LENGTH = 40

export interface CustomizerTablesSectionProps {
  restaurantId?: string
  isDark?: boolean
}

const iconButtonClass =
  "flex size-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"

export const CustomizerTablesSection: React.FC<CustomizerTablesSectionProps> = ({
  restaurantId,
  isDark = false,
}) => {
  const { tables, isLoading, loadError, reload, createTable, updateTable, moveTable, deleteTable } =
    useRestaurantTables(restaurantId)

  const [newName, setNewName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [tableToDelete, setTableToDelete] = useState<RestaurantTable | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name || isCreating) return
    setIsCreating(true)
    const created = await createTable(name)
    setIsCreating(false)
    if (created) setNewName("")
  }

  const startEditing = (table: RestaurantTable) => {
    setEditingId(table.id)
    setEditingName(table.name)
  }

  const commitRename = async (table: RestaurantTable) => {
    const name = editingName.trim()
    if (!name || name === table.name) {
      setEditingId(null)
      return
    }
    if (await updateTable(table.id, { name })) setEditingId(null)
  }

  const inputClass = `rounded-xl border px-2.5 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
    isDark ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-900"
  }`

  return (
    <div
      className={`rounded-2xl border p-5 shadow-xs space-y-4 text-xs ${
        isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-2">
        <LayoutGrid className="size-4 text-sky-500" />
        <h3 className="font-bold text-sm text-slate-900 dark:text-white">Mesas del salón</h3>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Estas mesas aparecen al registrar una venta en &quot;Mesa / Salón&quot;. Los cambios se guardan al instante,
        sin usar &quot;Guardar &amp; Publicar&quot;. Desactivá una mesa para ocultarla sin perder su historial.
      </p>

      <form onSubmit={handleCreate} className="flex items-center gap-2">
        <input
          type="text"
          aria-label="Nombre de la nueva mesa"
          maxLength={MAX_TABLE_NAME_LENGTH}
          placeholder="Ej: Mesa 4, Terraza 1"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className={`min-w-0 flex-1 ${inputClass}`}
        />
        <button
          type="submit"
          disabled={isCreating || !newName.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          <Plus className="size-3.5" />
          Agregar mesa
        </button>
      </form>

      {isLoading && <p className="text-slate-500 dark:text-slate-400">Cargando mesas...</p>}

      {!isLoading && loadError && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-300/50 bg-rose-50 p-3 text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-300">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-lg border border-rose-300 px-2 py-1 font-bold cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {!isLoading && !loadError && tables.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Todavía no tenés mesas. Agregá la primera arriba para poder elegirla al vender en el salón.
        </div>
      )}

      {tables.length > 0 && (
        <ul className="space-y-1.5">
          {tables.map((table, index) => (
            <li
              key={table.id}
              className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${
                isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-slate-50/60"
              } ${table.isActive ? "" : "opacity-60"}`}
            >
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  aria-label={`Subir ${table.name}`}
                  disabled={index === 0}
                  onClick={() => void moveTable(table.id, "up")}
                  className={iconButtonClass}
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Bajar ${table.name}`}
                  disabled={index === tables.length - 1}
                  onClick={() => void moveTable(table.id, "down")}
                  className={iconButtonClass}
                >
                  <ArrowDown className="size-3.5" />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                {editingId === table.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      type="text"
                      aria-label={`Nuevo nombre de ${table.name}`}
                      maxLength={MAX_TABLE_NAME_LENGTH}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void commitRename(table)
                        if (e.key === "Escape") setEditingId(null)
                      }}
                      className={`min-w-0 flex-1 ${inputClass}`}
                    />
                    <button type="button" aria-label="Guardar nombre" onClick={() => void commitRename(table)} className={iconButtonClass}>
                      <Check className="size-3.5 text-emerald-600" />
                    </button>
                    <button type="button" aria-label="Cancelar edición" onClick={() => setEditingId(null)} className={iconButtonClass}>
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {table.name}
                    {!table.isActive && (
                      <span className="ml-2 text-[10px] font-bold uppercase text-slate-400">Inactiva</span>
                    )}
                  </span>
                )}
              </div>

              {editingId !== table.id && (
                <button
                  type="button"
                  aria-label={`Renombrar ${table.name}`}
                  onClick={() => startEditing(table)}
                  className={iconButtonClass}
                >
                  <Pencil className="size-3.5" />
                </button>
              )}
              <Switch
                aria-label={`Activar ${table.name}`}
                checked={table.isActive}
                onCheckedChange={(checked) => void updateTable(table.id, { isActive: checked })}
              />
              <button
                type="button"
                aria-label={`Eliminar ${table.name}`}
                onClick={() => setTableToDelete(table)}
                className={`${iconButtonClass} hover:text-rose-600`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDeleteModal
        isOpen={tableToDelete !== null}
        onClose={() => setTableToDelete(null)}
        onConfirm={() => {
          if (tableToDelete) void deleteTable(tableToDelete.id)
        }}
        title="¿Eliminar mesa?"
        targetName={tableToDelete?.name}
        description={
          tableToDelete
            ? `Vas a eliminar "${tableToDelete.name}". Los pedidos anteriores conservan el nombre de la mesa, pero ya no podrás elegirla en nuevas ventas.`
            : undefined
        }
      />
    </div>
  )
}
