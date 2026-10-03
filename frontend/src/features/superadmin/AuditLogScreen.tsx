import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import { apiClient, type AuditLogItem } from "@/core/api/apiClient"
import {
  ClipboardList,
  Filter,
  User,
  Store,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { parseLocalDateRange } from "./auditLogUtils"

const AUDIT_ACTION_LABELS: Record<string, string> = {
  "restaurant.create": "Creación de restaurante",
  "restaurant.update": "Actualización de restaurante",
  "restaurant.pause": "Pausa de restaurante",
  "restaurant.activate": "Activación de restaurante",
  "restaurant.delete": "Eliminación de restaurante",
  "restaurant.restore": "Restauración de restaurante",
  "user.create": "Creación de usuario",
  "user.update": "Actualización de usuario",
  "user.activate": "Activación de usuario",
  "user.deactivate": "Desactivación de usuario",
  "user.delete": "Eliminación de usuario",
  "user.reset_password": "Restablecimiento de contraseña",
}

const FIELD_TRANSLATIONS: Record<string, string> = {
  name: "nombre",
  slug: "slug",
  tagline: "eslogan",
  whatsappNumber: "WhatsApp",
  timezone: "zona horaria",
  currency: "moneda",
  currencySymbol: "símbolo moneda",
  role: "rol",
  restaurantId: "restaurante asignado",
  isActive: "estado",
  password: "contraseña",
  primaryColor: "color de marca",
}

function getActionColorBadge(action: string): string {
  if (action.includes("create") || action.includes("activate") || action.includes("restore")) {
    return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
  }
  if (action.includes("delete") || action.includes("deactivate")) {
    return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
  }
  if (action.includes("pause") || action.includes("reset_password")) {
    return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
  }
  return "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
}

function formatAuditDetails(details?: Record<string, unknown>): string {
  if (!details || Object.keys(details).length === 0) {
    return "Sin detalles adicionales"
  }

  // Format changedFields if present
  if (Array.isArray(details.changedFields) && details.changedFields.length > 0) {
    const translated = details.changedFields.map(
      (f: string) => FIELD_TRANSLATIONS[f] || f
    )
    return `Modificado: ${translated.join(", ")}`
  }

  // Check scalar attributes
  const parts: string[] = []
  for (const [key, val] of Object.entries(details)) {
    if (key === "changedFields") continue
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      const translatedKey = FIELD_TRANSLATIONS[key] || key
      parts.push(`${translatedKey}: ${val}`)
    }
  }

  return parts.length > 0 ? parts.join(" · ") : "Actualización registrada"
}

export const AuditLogScreen: React.FC = () => {
  const { restaurants, adminTheme } = useRestaurant()
  const isDark = adminTheme === "dark"

  const [items, setItems] = useState<AuditLogItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [actionFilter, setActionFilter] = useState<string>("")
  const [restaurantFilter, setRestaurantFilter] = useState<string>("")
  const [fromDate, setFromDate] = useState<string>("")
  const [toDate, setToDate] = useState<string>("")

  const activeRequestIdRef = useRef(0)

  const restaurantMap = useMemo(() => {
    const map = new Map<string, string>()
    restaurants.forEach((r) => map.set(r.id, r.config?.name || r.name || ""))
    return map
  }, [restaurants])

  // Derived once; the desktop table and mobile cards both render from this
  // so the two views can't silently drift on what a row's fields mean.
  const rows = useMemo(
    () =>
      items.map((item) => ({
        item,
        humanAction: AUDIT_ACTION_LABELS[item.action] || item.action,
        badgeClass: getActionColorBadge(item.action),
        restName: item.restaurantId ? restaurantMap.get(item.restaurantId) || item.restaurantId : "Global",
        dateFormatted: new Date(item.createdAt).toLocaleString("es-CO", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        targetLabel: item.targetLabel || `${item.targetType}: ${item.targetId || ""}`,
        detailsText: formatAuditDetails(item.details),
      })),
    [items, restaurantMap]
  )

  const loadAuditLog = useCallback(async (reset = true, cursorToUse?: string) => {
    let requestId: number
    if (reset) {
      setIsLoading(true)
      setError(null)
      requestId = ++activeRequestIdRef.current
    } else {
      setIsLoadingMore(true)
      requestId = activeRequestIdRef.current
    }

    try {
      const query: any = {
        limit: 25,
      }
      if (cursorToUse) query.cursor = cursorToUse
      if (actionFilter) query.action = actionFilter
      if (restaurantFilter) query.restaurantId = restaurantFilter
      if (fromDate) {
        const fromIso = parseLocalDateRange(fromDate, false)
        if (fromIso) query.from = fromIso
      }
      if (toDate) {
        const toIso = parseLocalDateRange(toDate, true)
        if (toIso) query.to = toIso
      }

      const res = await apiClient.fetchAuditLog(query)
      if (requestId !== activeRequestIdRef.current) {
        return
      }

      if (reset) {
        setItems(res.items || [])
      } else {
        setItems((prev) => [...prev, ...(res.items || [])])
      }
      setNextCursor(res.nextCursor || null)
    } catch (err: any) {
      if (requestId !== activeRequestIdRef.current) {
        return
      }
      setError(err?.message || "Ocurrió un error al cargar el registro de auditoría.")
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    }
  }, [actionFilter, restaurantFilter, fromDate, toDate])

  useEffect(() => {
    loadAuditLog(true)
  }, [loadAuditLog])

  const handleLoadMore = () => {
    if (nextCursor && !isLoading && !isLoadingMore) {
      loadAuditLog(false, nextCursor)
    }
  }

  const handleResetFilters = () => {
    setActionFilter("")
    setRestaurantFilter("")
    setFromDate("")
    setToDate("")
  }

  const inputDateClass = `rounded-xl border px-3 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
    isDark
      ? "border-slate-800 bg-slate-900 text-slate-200"
      : "border-slate-200 bg-white text-slate-700"
  }`

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div
        className={`flex flex-col gap-4 rounded-2xl border p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between ${
          isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Super Administrador · Seguridad & Trazabilidad
            </span>
          </div>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Registro de Auditoría
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Historial inmutable de modificaciones sobre restaurantes, usuarios y configuraciones clave.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadAuditLog(true)}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Filter Controls */}
      <div
        className={`rounded-2xl border p-4 shadow-xs space-y-3 ${
          isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
          <Filter className="size-3.5 text-indigo-500" />
          <span>Filtros de búsqueda</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Action Filter */}
          <div className="space-y-1">
            <Select
              id="filter-action"
              label="Filtrar por acción"
              aria-label="Filtrar por acción"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="Todas las acciones"
              searchable={true}
              searchPlaceholder="Buscar acción..."
              options={[
                { value: "", label: "Todas las acciones" },
                ...Object.entries(AUDIT_ACTION_LABELS).map(([actionKey, label]) => ({
                  value: actionKey,
                  label,
                })),
              ]}
            />
          </div>

          {/* Restaurant Filter */}
          <div className="space-y-1">
            <Select
              id="filter-restaurant"
              label="Filtrar por restaurante"
              aria-label="Filtrar por restaurante"
              value={restaurantFilter}
              onChange={(e) => setRestaurantFilter(e.target.value)}
              placeholder="Todos los restaurantes"
              searchable={restaurants.length > 5}
              searchPlaceholder="Buscar restaurante..."
              options={[
                { value: "", label: "Todos los restaurantes" },
                ...restaurants.map((r) => ({
                  value: r.id,
                  label: (r.config?.name || r.name) ?? "Restaurante",
                })),
              ]}
            />
          </div>

          {/* From Date */}
          <div className="space-y-1">
            <label
              htmlFor="filter-from-date"
              className="text-[11px] font-bold text-slate-500 dark:text-slate-400"
            >
              Fecha desde
            </label>
            <input
              id="filter-from-date"
              aria-label="Fecha desde"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={`w-full ${inputDateClass}`}
            />
          </div>

          {/* To Date */}
          <div className="space-y-1">
            <label
              htmlFor="filter-to-date"
              className="text-[11px] font-bold text-slate-500 dark:text-slate-400"
            >
              Fecha hasta
            </label>
            <input
              id="filter-to-date"
              aria-label="Fecha hasta"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={`w-full ${inputDateClass}`}
            />
          </div>
        </div>

        {(actionFilter || restaurantFilter || fromDate || toDate) && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Main Content: Error / Loading / Empty / Tables */}
      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center space-y-3">
          <AlertTriangle className="size-8 mx-auto text-rose-500" />
          <div className="text-sm font-bold text-rose-600 dark:text-rose-400">
            Ocurrió un error al cargar el registro de auditoría.
          </div>
          <p className="text-xs text-rose-500/80">{error}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => loadAuditLog(true)}
            className="mt-2 text-xs"
          >
            Reintentar
          </Button>
        </div>
      ) : isLoading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
          <Loader2 className="size-6 animate-spin text-indigo-500" />
          <span className="text-xs font-medium">Cargando registros de auditoría...</span>
        </div>
      ) : items.length === 0 ? (
        <div
          className={`rounded-2xl border p-12 text-center shadow-xs ${
            isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"
          }`}
        >
          <ClipboardList className="size-10 mx-auto text-slate-400/40 mb-3" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            No se encontraron registros de auditoría
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            No hay operaciones registradas con los filtros actuales. Podés cambiar los criterios de búsqueda.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View (hidden on small screens) */}
          <div
            className={`hidden md:block rounded-2xl border shadow-xs overflow-hidden ${
              isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"
            }`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3.5">Fecha y Hora</th>
                    <th className="px-4 py-3.5">Actor</th>
                    <th className="px-4 py-3.5">Acción</th>
                    <th className="px-4 py-3.5">Objetivo</th>
                    <th className="px-4 py-3.5">Restaurante</th>
                    <th className="px-4 py-3.5">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map(({ item, humanAction, badgeClass, restName, dateFormatted, targetLabel, detailsText }) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Fecha */}
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <Clock className="size-3 text-slate-400" />
                          <span>{dateFormatted}</span>
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                          <User className="size-3 text-indigo-500" />
                          <span>{item.actorUsername || item.actorUserId || "Sistema"}</span>
                        </div>
                      </td>

                      {/* Acción */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${badgeClass}`}
                        >
                          {humanAction}
                        </span>
                      </td>

                      {/* Objetivo */}
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        <span>{targetLabel}</span>
                      </td>

                      {/* Restaurante */}
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1">
                          <Store className="size-3 text-slate-400" />
                          <span>{restName}</span>
                        </div>
                      </td>

                      {/* Detalles */}
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {detailsText}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards View (hidden on md and larger) */}
          <div className="md:hidden space-y-3">
            {rows.map(({ item, humanAction, badgeClass, restName, dateFormatted, targetLabel, detailsText }) => (
              <div
                key={item.id}
                className={`rounded-2xl border p-4 shadow-xs space-y-2.5 text-xs ${
                  isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${badgeClass}`}
                  >
                    {humanAction}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="size-3" />
                    {dateFormatted}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
                    <User className="size-3 text-indigo-500" />
                    <span>{item.actorUsername || item.actorUserId || "Sistema"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[11px]">
                    <Store className="size-3 text-slate-400" />
                    <span>{restName}</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-2 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                    {targetLabel}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl">
                  {detailsText}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {nextCursor && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoading || isLoadingMore}
                className="rounded-xl px-5 text-xs font-bold"
              >
                {isLoadingMore ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Cargando más...</span>
                  </div>
                ) : (
                  "Cargar más"
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
export default AuditLogScreen
