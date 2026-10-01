import React, { useState } from "react"
import type { RestaurantTable } from "@/types/restaurant"

export interface TablePickerProps {
  readonly isDark: boolean
  readonly tables: RestaurantTable[]
  readonly isLoading: boolean
  readonly loadError: string | null
  readonly selectedTableId: string | null
  /** Ids of the tables that have an order in progress. They stay selectable. */
  readonly occupiedTableIds: ReadonlySet<string>
  readonly onSelect: (tableId: string) => void
  /** Resolves the created table, or null when it was rejected (already reported). */
  readonly onCreateTable: (name: string) => Promise<RestaurantTable | null>
  readonly onOpenManager: () => void
  /** Table text of an order registered before tables existed (edit mode only). */
  readonly legacyLabel?: string
}

export function TablePicker({
  isDark,
  tables,
  isLoading,
  loadError,
  selectedTableId,
  occupiedTableIds,
  onSelect,
  onCreateTable,
  onOpenManager,
  legacyLabel,
}: Readonly<TablePickerProps>) {
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const activeTables = tables.filter((t) => t.isActive)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name || isSaving) return
    setIsSaving(true)
    const created = await onCreateTable(name)
    setIsSaving(false)
    if (created) {
      onSelect(created.id)
      setNewName("")
      setIsCreating(false)
    }
  }

  const tableButtonClass = (selected: boolean) => {
    if (selected) return "border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-500/25"
    return isDark
      ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-orange-500/60"
      : "border-slate-300 bg-white text-slate-800 hover:border-orange-500/60"
  }

  const inputClass = `w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 ${
    isDark ? "border-slate-700 bg-slate-950 text-white" : "border-slate-300 bg-white"
  }`

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Mesa *</span>
        {!isCreating && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="rounded-lg px-1.5 py-0.5 text-[10px] font-bold text-orange-600 hover:bg-orange-500/10 dark:text-orange-400 cursor-pointer"
          >
            + Nueva mesa
          </button>
        )}
      </div>

      {legacyLabel && !selectedTableId && (
        <p className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
          {legacyLabel} — Registrada antes de las mesas. Elegí una mesa para vincularla o dejá este texto como está.
        </p>
      )}

      {isLoading && <p className="text-[11px] text-slate-500 dark:text-slate-400">Cargando mesas...</p>}
      {!isLoading && loadError && <p className="text-[11px] text-rose-600 dark:text-rose-400">{loadError}</p>}

      {!isLoading && !loadError && activeTables.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-3 text-center text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <p>No hay mesas activas. Creá una acá o administralas en</p>
          <button
            type="button"
            onClick={onOpenManager}
            className="mt-1 font-bold text-orange-600 underline dark:text-orange-400 cursor-pointer"
          >
            Personalizar → Mesas
          </button>
        </div>
      )}

      {activeTables.length > 0 && (
        <div className="grid max-h-36 grid-cols-3 gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-4">
          {activeTables.map((table) => {
            const selected = table.id === selectedTableId
            const occupied = occupiedTableIds.has(table.id)
            return (
              <button
                key={table.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(table.id)}
                className={`flex min-h-10 flex-col items-center justify-center rounded-lg border px-1.5 py-1 text-center text-xs font-bold transition-all cursor-pointer ${tableButtonClass(
                  selected
                )}`}
              >
                <span className="line-clamp-1 break-all">{table.name}</span>
                {occupied && (
                  <span
                    className={`mt-0.5 rounded-full px-1.5 text-[9px] font-black uppercase ${
                      selected ? "bg-white/25 text-white" : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    Ocupada
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {isCreating && (
        <form onSubmit={handleCreate} className="flex items-center gap-1.5">
          <input
            autoFocus
            type="text"
            aria-label="Nombre de la nueva mesa"
            maxLength={40}
            placeholder="Ej: Mesa 12"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={isSaving || !newName.trim()}
            className="shrink-0 rounded-lg bg-orange-500 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
          >
            Crear
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreating(false)
              setNewName("")
            }}
            className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancelar
          </button>
        </form>
      )}
    </div>
  )
}
