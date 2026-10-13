import React, { useId, useState } from "react"
import { ArrowDown, ArrowUp, Check, LayoutGrid, Pencil, Plus, Trash2, X } from "lucide-react"
import {
  MAX_TABLE_ALIAS_LENGTH,
  MAX_TABLE_NUMBER,
  MAX_TABLE_ZONE_LENGTH,
  MIN_TABLE_NUMBER,
  normalizeTableAlias,
  normalizeTableZone,
} from "@burger-page/contracts"
import { Switch } from "@/components/ui/switch"
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal"
import { useRestaurantTables, type TableChanges } from "@/features/crm/tables/useRestaurantTables"
import {
  defaultZone,
  groupTablesByZone,
  nextFreeNumber,
  previewRange,
  previewTableName,
  zoneSuggestions,
} from "@/features/crm/tables/tableZones"
import type { RestaurantTable } from "@/types/restaurant"

export interface CustomizerTablesSectionProps {
  restaurantId?: string
  isDark?: boolean
}

const iconButtonClass =
  "flex size-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"

const primaryButtonClass =
  "flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"

const linkButtonClass =
  "self-start rounded-lg px-1.5 py-0.5 text-xs font-bold text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-400 cursor-pointer"

export const CustomizerTablesSection: React.FC<CustomizerTablesSectionProps> = ({
  restaurantId,
  isDark = false,
}) => {
  const {
    tables,
    isLoading,
    loadError,
    reload,
    createTable,
    createTablesBulk,
    updateTable,
    moveTable,
    deleteTable,
  } = useRestaurantTables(restaurantId)
  const zoneListId = useId()

  // The form fields fall back to values derived from the current tables (most used zone,
  // next free number) until the user types; creating a table clears the number so the
  // suggestion follows the new list.
  const [isRange, setIsRange] = useState(false)
  const [zoneText, setZoneText] = useState<string | null>(null)
  const [numberText, setNumberText] = useState<string | null>(null)
  const [toText, setToText] = useState<string | null>(null)
  const [aliasText, setAliasText] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [rangeResult, setRangeResult] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editZone, setEditZone] = useState("")
  const [editNumber, setEditNumber] = useState("")
  const [editAlias, setEditAlias] = useState("")
  const [tableToDelete, setTableToDelete] = useState<RestaurantTable | null>(null)

  const zone = zoneText ?? defaultZone(tables)
  const number = numberText ?? String(nextFreeNumber(tables, zone))
  const rangeTo = toText ?? number
  const singlePreview = previewTableName(zone, Number(number), aliasText)
  const rangePreview = previewRange(zone, Number(number), Number(rangeTo))
  const groups = groupTablesByZone(tables)

  const changeZone = (value: string) => {
    setZoneText(value)
    setNumberText(null)
    setToText(null)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!singlePreview || isCreating) return
    setIsCreating(true)
    const alias = normalizeTableAlias(aliasText)
    const created = await createTable({
      zone: normalizeTableZone(zone),
      number: Number(number),
      ...(alias ? { alias } : {}),
    })
    setIsCreating(false)
    if (created) {
      setAliasText("")
      setNumberText(null)
    }
  }

  const handleCreateRange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rangePreview || isCreating) return
    setIsCreating(true)
    const result = await createTablesBulk({
      zone: normalizeTableZone(zone),
      from: Number(number),
      to: Number(rangeTo),
    })
    setIsCreating(false)
    if (!result) return
    const created = `Se crearon ${result.created.length} ${result.created.length === 1 ? "mesa" : "mesas"}.`
    setRangeResult(
      result.skipped.length > 0
        ? `${created} Se omitieron ${result.skipped.length} que ya existían: ${result.skipped.join(", ")}.`
        : created
    )
    setNumberText(null)
    setToText(null)
  }

  const switchMode = (range: boolean) => {
    setIsRange(range)
    setRangeResult(null)
    setToText(null)
  }

  const startEditing = (table: RestaurantTable) => {
    setEditingId(table.id)
    setEditZone(table.zone)
    setEditNumber(String(table.number))
    setEditAlias(table.alias ?? "")
  }

  const commitEdit = async (table: RestaurantTable) => {
    const changes: TableChanges = {}
    const nextZone = normalizeTableZone(editZone)
    const nextNumber = Number(editNumber)
    const nextAlias = normalizeTableAlias(editAlias)
    if (nextZone !== table.zone) changes.zone = nextZone
    if (nextNumber !== table.number) changes.number = nextNumber
    if (nextAlias !== table.alias) changes.alias = nextAlias
    if (Object.keys(changes).length === 0) {
      setEditingId(null)
      return
    }
    if (await updateTable(table.id, changes)) setEditingId(null)
  }

  const canSaveEdit = previewTableName(editZone, Number(editNumber)) !== null

  const inputClass = `rounded-xl border px-2.5 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
    isDark ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-900"
  }`
  const numberProps = {
    type: "number",
    inputMode: "numeric",
    min: MIN_TABLE_NUMBER,
    max: MAX_TABLE_NUMBER,
  } as const
  const fieldLabelClass = "text-xs font-bold text-slate-500 dark:text-slate-400"

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
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Estas mesas aparecen al registrar una venta en &quot;Mesa / Salón&quot;. Los cambios se guardan al instante,
        sin usar &quot;Guardar &amp; Publicar&quot;. Desactivá una mesa para ocultarla sin perder su historial.
      </p>

      <form onSubmit={isRange ? handleCreateRange : handleCreate} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-1 basis-32 flex-col gap-1">
            <span className={fieldLabelClass}>Zona</span>
            <input
              type="text"
              list={zoneListId}
              aria-label={isRange ? "Zona de las nuevas mesas" : "Zona de la nueva mesa"}
              maxLength={MAX_TABLE_ZONE_LENGTH}
              placeholder="Ej: Salón, Terraza"
              value={zone}
              onChange={(e) => changeZone(e.target.value)}
              className={`w-full min-w-0 ${inputClass}`}
            />
          </label>
          <datalist id={zoneListId}>
            {zoneSuggestions(tables).map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>

          <label className="flex w-20 shrink-0 flex-col gap-1">
            <span className={fieldLabelClass}>{isRange ? "Desde" : "Número"}</span>
            <input
              {...numberProps}
              aria-label={isRange ? "Desde el número" : "Número de la nueva mesa"}
              value={number}
              onChange={(e) => setNumberText(e.target.value)}
              className={`w-full ${inputClass}`}
            />
          </label>

          {isRange ? (
            <label className="flex w-20 shrink-0 flex-col gap-1">
              <span className={fieldLabelClass}>Hasta</span>
              <input
                {...numberProps}
                aria-label="Hasta el número"
                value={rangeTo}
                onChange={(e) => setToText(e.target.value)}
                className={`w-full ${inputClass}`}
              />
            </label>
          ) : (
            <label className="flex min-w-0 flex-1 basis-32 flex-col gap-1">
              <span className={fieldLabelClass}>Alias (opcional)</span>
              <input
                type="text"
                aria-label="Alias de la nueva mesa"
                maxLength={MAX_TABLE_ALIAS_LENGTH}
                placeholder="Ej: Ventana, VIP"
                value={aliasText}
                onChange={(e) => setAliasText(e.target.value)}
                className={`w-full min-w-0 ${inputClass}`}
              />
            </label>
          )}
        </div>

        {isRange ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {rangePreview ?? "Indicá una zona y un rango válido (hasta 100 mesas)."}
          </p>
        ) : (
          singlePreview && (
            <p className="text-xs text-slate-500 dark:text-slate-400">Se creará: {singlePreview}</p>
          )
        )}

        <div className="flex flex-wrap items-center gap-2">
          {isRange ? (
            <button type="submit" disabled={isCreating || !rangePreview} className={primaryButtonClass}>
              <Plus className="size-3.5" />
              Crear mesas
            </button>
          ) : (
            <button type="submit" disabled={isCreating || !singlePreview} className={primaryButtonClass}>
              <Plus className="size-3.5" />
              Agregar mesa
            </button>
          )}
          <button type="button" onClick={() => switchMode(!isRange)} className={linkButtonClass}>
            {isRange ? "Crear una sola" : "Crear varias"}
          </button>
        </div>

        {isRange && rangeResult && (
          <p role="status" className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            {rangeResult}
          </p>
        )}
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

      {groups.map((group) => (
        <section key={group.zone} className="space-y-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">{group.zone}</h4>
          <ul className="space-y-1.5">
            {group.tables.map((table, index) => (
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
                    disabled={index === group.tables.length - 1}
                    onClick={() => void moveTable(table.id, "down")}
                    className={iconButtonClass}
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  {editingId === table.id ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input
                        autoFocus
                        type="text"
                        list={zoneListId}
                        aria-label={`Zona de ${table.name}`}
                        maxLength={MAX_TABLE_ZONE_LENGTH}
                        value={editZone}
                        onChange={(e) => setEditZone(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditingId(null)
                        }}
                        className={`min-w-0 flex-1 basis-full sm:basis-28 ${inputClass}`}
                      />
                      <input
                        {...numberProps}
                        aria-label={`Número de ${table.name}`}
                        value={editNumber}
                        onChange={(e) => setEditNumber(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditingId(null)
                        }}
                        className={`w-16 shrink-0 ${inputClass}`}
                      />
                      <input
                        type="text"
                        aria-label={`Alias de ${table.name}`}
                        maxLength={MAX_TABLE_ALIAS_LENGTH}
                        placeholder="Alias"
                        value={editAlias}
                        onChange={(e) => setEditAlias(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && canSaveEdit) void commitEdit(table)
                          if (e.key === "Escape") setEditingId(null)
                        }}
                        className={`min-w-0 flex-1 basis-24 ${inputClass}`}
                      />
                      <button
                        type="button"
                        aria-label="Guardar cambios"
                        disabled={!canSaveEdit}
                        onClick={() => void commitEdit(table)}
                        className={iconButtonClass}
                      >
                        <Check className="size-3.5 text-emerald-600" />
                      </button>
                      <button
                        type="button"
                        aria-label="Cancelar edición"
                        onClick={() => setEditingId(null)}
                        className={iconButtonClass}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="block break-words text-sm font-semibold text-slate-900 dark:text-white">
                      {table.name}
                      {!table.isActive && (
                        <span className="ml-2 text-xs font-bold uppercase text-slate-400">Inactiva</span>
                      )}
                    </span>
                  )}
                </div>

                {editingId !== table.id && (
                  <button
                    type="button"
                    aria-label={`Editar ${table.name}`}
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
        </section>
      ))}

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
