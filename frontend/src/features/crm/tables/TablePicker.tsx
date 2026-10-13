import React, { useId, useRef, useState } from "react"
import type { RestaurantTable } from "@/types/restaurant"
import type { NewTableInput } from "./useRestaurantTables"
import { MAX_TABLE_NUMBER, MAX_TABLE_ZONE_LENGTH, MIN_TABLE_NUMBER, normalizeTableZone } from "@burger-page/contracts"
import { defaultZone, groupTablesByZone, nextFreeNumber, previewTableName, zoneSuggestions } from "./tableZones"

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
  readonly onCreateTable: (data: NewTableInput) => Promise<RestaurantTable | null>
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
  const [newZone, setNewZone] = useState("")
  const [newNumber, setNewNumber] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const addButtonRef = useRef<HTMLButtonElement>(null)

  const activeTables = tables.filter((t) => t.isActive)
  const groups = groupTablesByZone(activeTables)
  const zoneListId = useId()
  const parsedNumber = Number(newNumber)
  const preview = previewTableName(newZone, parsedNumber)

  const openCreate = () => {
    const zone = defaultZone(tables)
    setNewZone(zone)
    setNewNumber(String(nextFreeNumber(tables, zone)))
    setIsCreating(true)
  }

  const changeZone = (zone: string) => {
    setNewZone(zone)
    setNewNumber(String(nextFreeNumber(tables, zone)))
  }

  // Not a <form>: this picker lives inside the sale form and nested forms navigate the page.
  const closeCreate = () => {
    setIsCreating(false)
    setNewZone("")
    setNewNumber("")
    requestAnimationFrame(() => addButtonRef.current?.focus())
  }

  const handleCreate = async () => {
    if (!preview || isSaving) return
    setIsSaving(true)
    const created = await onCreateTable({ zone: normalizeTableZone(newZone), number: parsedNumber })
    setIsSaving(false)
    if (created) {
      onSelect(created.id)
      closeCreate()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      e.stopPropagation()
      void handleCreate()
    } else if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      closeCreate()
    }
  }

  const tableButtonClass = (selected: boolean) => {
    if (selected) return "border-orange-500 bg-orange-700 text-white shadow-md shadow-orange-500/25"
    return isDark
      ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-orange-500/60"
      : "border-slate-300 bg-white text-slate-800 hover:border-orange-500/60"
  }

  const inputClass = `w-full rounded-lg border px-2.5 py-1.5 text-base sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 ${
    isDark ? "border-slate-700 bg-slate-950 text-white" : "border-slate-300 bg-white"
  }`

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Mesa *</span>
        {!isCreating && (
          <button
            ref={addButtonRef}
            type="button"
            onClick={openCreate}
            className="rounded-lg px-1.5 py-0.5 text-xs font-bold text-orange-700 hover:bg-orange-500/10 dark:text-orange-400 cursor-pointer"
          >
            + Nueva mesa
          </button>
        )}
      </div>

      {legacyLabel && !selectedTableId && (
        <p className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-300">
          {legacyLabel} — Registrada antes de las mesas. Elegí una mesa para vincularla o dejá este texto como está.
        </p>
      )}

      {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando mesas...</p>}
      {!isLoading && loadError && <p className="text-sm text-rose-600 dark:text-rose-400">{loadError}</p>}

      {!isLoading && !loadError && activeTables.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-3 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <p>No hay mesas activas. Creá una acá o administralas en</p>
          <button
            type="button"
            onClick={onOpenManager}
            className="mt-1 font-bold text-orange-700 underline dark:text-orange-400 cursor-pointer"
          >
            Personalizar → Mesas
          </button>
        </div>
      )}

      {groups.length > 0 && (
        <div className="max-h-44 space-y-2 overflow-y-auto pr-0.5">
          {groups.map((group) => (
            <div key={group.zone} className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{group.zone}</h4>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {group.tables.map((table) => {
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
                      <span className="line-clamp-2 [overflow-wrap:anywhere]">{table.name}</span>
                      {occupied && (
                        <span
                          className={`mt-0.5 rounded-full px-1.5 text-xs font-black uppercase ${
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
            </div>
          ))}
        </div>
      )}

      {isCreating && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              autoFocus
              type="text"
              list={zoneListId}
              aria-label="Zona de la nueva mesa"
              maxLength={MAX_TABLE_ZONE_LENGTH}
              placeholder="Zona"
              value={newZone}
              onChange={(e) => changeZone(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`min-w-0 flex-1 basis-28 ${inputClass}`}
            />
            <datalist id={zoneListId}>
              {zoneSuggestions(tables).map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_TABLE_NUMBER}
              max={MAX_TABLE_NUMBER}
              aria-label="Número de la nueva mesa"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`w-20 shrink-0 ${inputClass}`}
            />
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={isSaving || !preview}
              className="shrink-0 rounded-lg bg-orange-700 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
            >
              Crear
            </button>
            <button
              type="button"
              onClick={closeCreate}
              className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
          {preview && <p className="text-sm text-slate-500 dark:text-slate-400">Se creará: {preview}</p>}
        </div>
      )}
    </div>
  )
}
