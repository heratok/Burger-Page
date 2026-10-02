import React, { useState, useMemo, useEffect, useCallback } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import type { RestaurantRecord } from "@/types/restaurant"
import { apiClient, type DeletedRestaurantRecord } from "@/core/api/apiClient"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Sliders,
  Trash2,
  Search,
  Eye,
  Pencil,
  RotateCcw,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react"
import { GlobalPlatformSummary } from "./GlobalPlatformSummary"
import { CreateRestaurantModal } from "./CreateRestaurantModal"
import { EditRestaurantModal } from "./EditRestaurantModal"
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal"
import { Pagination } from "@/components/ui/pagination"
import { TableSkeleton } from "@/components/ui/Skeletons"
import { useAppRouter } from "@/core/router/useAppRouter"
import { formatCurrency } from "@/lib/utils"

export const RestaurantsDirectory: React.FC = () => {
  const {
    restaurants,
    activeRestaurantId,
    switchRestaurant,
    updateRestaurant,
    deleteRestaurant,
    refreshRestaurants,
    isSyncing,
    adminTheme,
  } = useRestaurant()

  const { navigateTo } = useAppRouter()

  const [activeTab, setActiveTab] = useState<"active" | "deleted">("active")
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [restaurantToEdit, setRestaurantToEdit] = useState<RestaurantRecord | null>(null)
  const [restaurantToDelete, setRestaurantToDelete] = useState<RestaurantRecord | null>(null)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Deleted restaurants state
  const [deletedRestaurants, setDeletedRestaurants] = useState<DeletedRestaurantRecord[]>([])
  const [isLoadingDeleted, setIsLoadingDeleted] = useState(false)
  const [restaurantToRestore, setRestaurantToRestore] = useState<DeletedRestaurantRecord | null>(null)
  const [restoreSlug, setRestoreSlug] = useState("")
  const [isSlugConflict, setIsSlugConflict] = useState(false)
  const [slugConflictError, setSlugConflictError] = useState<string | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)

  const isDark = adminTheme === "dark"

  const loadDeletedRestaurants = useCallback(async () => {
    setIsLoadingDeleted(true)
    try {
      const data = await apiClient.listDeletedRestaurants()
      setDeletedRestaurants(data || [])
    } catch {
      toast.error("No se pudieron cargar los restaurantes eliminados")
      setDeletedRestaurants([])
    } finally {
      setIsLoadingDeleted(false)
    }
  }, [])

  useEffect(() => {
    loadDeletedRestaurants()
  }, [loadDeletedRestaurants])

  const filteredRestaurants = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return restaurants.filter((r) => {
      if (!term) return true;
      const name = (r.config?.name || r.name || "").toLowerCase();
      const slug = (r.slug || "").toLowerCase();
      const tagline = (r.config?.tagline || r.tagline || "").toLowerCase();
      return name.includes(term) || slug.includes(term) || tagline.includes(term);
    });
  }, [restaurants, searchTerm]);

  const filteredDeletedRestaurants = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    return deletedRestaurants.filter((r) => {
      if (!term) return true
      const name = (r.name || "").toLowerCase()
      const slug = (r.slug || "").toLowerCase()
      return name.includes(term) || slug.includes(term)
    })
  }, [deletedRestaurants, searchTerm])

  const paginatedRestaurants = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRestaurants.slice(start, start + pageSize)
  }, [filteredRestaurants, currentPage, pageSize])

  const paginatedDeletedRestaurants = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredDeletedRestaurants.slice(start, start + pageSize)
  }, [filteredDeletedRestaurants, currentPage, pageSize])

  const handleManage = (r: RestaurantRecord) => {
    switchRestaurant(r.id)
    navigateTo("/admin/dashboard")
  }

  const handleViewStore = (r: RestaurantRecord) => {
    switchRestaurant(r.id)
    navigateTo(`/${r.slug}`)
  }

  const handleOpenRestore = (r: DeletedRestaurantRecord) => {
    setRestaurantToRestore(r)
    setRestoreSlug(r.slug)
    setIsSlugConflict(false)
    setSlugConflictError(null)
  }

  const handleConfirmRestore = async () => {
    if (!restaurantToRestore) return
    setIsRestoring(true)
    try {
      const payload = isSlugConflict && restoreSlug.trim() ? { slug: restoreSlug.trim().toLowerCase() } : {}
      const res = await apiClient.restoreRestaurant(restaurantToRestore.id, payload)
      if (res.renamedUsers && res.renamedUsers.length > 0) {
        const names = res.renamedUsers.map((u) => `El usuario ${u.from} volvió como ${u.to}`).join(", ")
        toast.info(`Restaurado con éxito. Nota: ${names}`, { duration: 6000 })
      }
      toast.success(`Restaurante "${restaurantToRestore.name}" restaurado correctamente`)
      await refreshRestaurants()
      await loadDeletedRestaurants()
      setRestaurantToRestore(null)
    } catch (err: any) {
      const isConflict =
        err?.status === 409 ||
        err?.code === "CONFLICT" ||
        err?.message?.includes("409") ||
        err?.message?.toLowerCase().includes("taken") ||
        err?.message?.toLowerCase().includes("already exists") ||
        err?.message?.toLowerCase().includes("en uso")

      if (isConflict) {
        setIsSlugConflict(true)
        setSlugConflictError("El slug original ya está en uso. Por favor ingresá un nuevo slug para restaurarlo:")
      } else {
        toast.error(err?.message || "No se pudo restaurar el restaurante")
      }
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Global Summary Cards */}
      <GlobalPlatformSummary onOpenCreateModal={() => setIsCreateOpen(true)} />

      {/* Directory Table Container */}
      {isSyncing && restaurants.length === 0 ? (
        <TableSkeleton isDark={isDark} rows={5} columns={6} />
      ) : (
        <div
          className={`rounded-2xl border shadow-xs overflow-hidden transition-colors ${
            isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"
          }`}
        >
          {/* Table Header Controls */}
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-xl">
              {/* Tab Switcher */}
              <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("active")
                    setCurrentPage(1)
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "active"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Activos ({restaurants.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("deleted")
                    setCurrentPage(1)
                    loadDeletedRestaurants()
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "deleted"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Eliminados {deletedRestaurants.length > 0 ? `(${deletedRestaurants.length})` : ""}
                </button>
              </div>

              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  maxLength={50}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  placeholder={
                    activeTab === "active"
                      ? "Buscar por nombre, slug o tipo..."
                      : "Buscar restaurante eliminado..."
                  }
                  className={`w-full rounded-xl border pl-9 pr-4 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isDark
                      ? "border-slate-700 bg-slate-800 text-white placeholder-slate-400"
                      : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400"
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {activeTab === "active" ? (
                  <>Mostrando <strong>{filteredRestaurants.length}</strong> de {restaurants.length} restaurantes</>
                ) : (
                  <>Mostrando <strong>{filteredDeletedRestaurants.length}</strong> de {deletedRestaurants.length} eliminados</>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          {activeTab === "deleted" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3.5">Restaurante & Slug Original</th>
                    <th className="px-4 py-3.5">Fecha de Eliminación</th>
                    <th className="px-4 py-3.5">ID Interno</th>
                    <th className="px-4 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:border-slate-800">
                  {isLoadingDeleted ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-xs text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="size-4 animate-spin text-indigo-500" />
                          <span>Cargando restaurantes eliminados...</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedDeletedRestaurants.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-xs text-slate-400">
                        {searchTerm
                          ? "No se encontraron restaurantes eliminados con ese criterio."
                          : "No hay restaurantes eliminados en este momento."}
                      </td>
                    </tr>
                  ) : (
                    paginatedDeletedRestaurants.map((dr) => (
                      <tr
                        key={dr.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-4 py-4">
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                              {dr.name}
                            </span>
                            <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                              /{dr.slug}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                          {dr.deletedAt
                            ? new Date(dr.deletedAt).toLocaleString("es-CO", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Fecha desconocida"}
                        </td>
                        <td className="px-4 py-4 font-mono text-[11px] text-slate-400">
                          {dr.id}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenRestore(dr)}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                            title={`Restaurar restaurante ${dr.name}`}
                            aria-label={`Restaurar restaurante ${dr.name}`}
                          >
                            <RotateCcw className="size-3.5" />
                            <span>Restaurar</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3.5">Restaurante & Slug</th>
                    <th className="px-4 py-3.5">Estado</th>
                    <th className="px-4 py-3.5">Catálogo</th>
                    <th className="px-4 py-3.5">Ventas Acumuladas</th>
                    <th className="px-4 py-3.5">Pedidos</th>
                    <th className="px-4 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:border-slate-800">
                  {paginatedRestaurants.map((r) => {
                    const totalSales = r.orders
                      .filter((o) => o.status !== "cancelled")
                      .reduce((sum, o) => sum + o.finalTotal, 0)
                    const isSelected = r.id === activeRestaurantId
                    const isDeleting = deletingIds.has(r.id)

                    return (
                      <tr
                        key={r.id}
                        className={`transition-all duration-300 ${
                          isDeleting ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"
                        } hover:bg-slate-50/50 dark:hover:bg-slate-800/40 ${
                          isSelected ? "bg-indigo-500/5 dark:bg-indigo-500/10" : ""
                        }`}
                      >
                        {/* Brand & Slug */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={r.config.logoUrl}
                              alt={r.config.name}
                              className="size-10 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700 shadow-xs"
                            />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 dark:text-white text-sm">
                                  {r.config.name}
                                </span>
                                {isSelected && (
                                  <span className="rounded-full bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-300">
                                    Seleccionado
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                                <span>/{r.slug}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Status switch (Pause vs Delete distinction) */}
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => updateRestaurant(r.id, { isActive: !r.isActive })}
                            title={r.isActive ? "Pausar restaurante temporalmente (conserva visibilidad en SaaS)" : "Reactivar restaurante"}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                              r.isActive
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                r.isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                              }`}
                            />
                            <span>{r.isActive ? "Operando" : "Pausado"}</span>
                          </button>
                        </td>

                        {/* Products Count */}
                        <td className="px-4 py-4">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {r.products.length} productos
                          </span>
                          <span className="text-[11px] text-slate-400 ml-1">
                            ({r.additions.length} adiciones)
                          </span>
                        </td>

                        {/* Total Sales */}
                        <td className="px-4 py-4 font-bold text-slate-900 dark:text-white">
                          {formatCurrency(totalSales)}
                        </td>

                        {/* Orders count */}
                        <td className="px-4 py-4">
                          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-bold text-slate-700 dark:text-slate-300">
                            {r.orders.length} pedidos
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleViewStore(r)}
                              className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                              title="Ver Tienda Pública de este local"
                            >
                              <Eye className="size-3.5 text-slate-400" />
                              <span>Tienda</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setRestaurantToEdit(r)}
                              className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                              title="Editar datos y administradores del restaurante"
                              aria-label={`Editar restaurante ${r.config.name}`}
                            >
                              <Pencil className="size-3.5 text-slate-400" />
                              <span>Editar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleManage(r)}
                              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors flex items-center gap-1"
                              title="Administrar pedidos, menú y diseño de este local"
                            >
                              <Sliders className="size-3.5" />
                              <span>Administrar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setRestaurantToDelete(r)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/20 dark:hover:text-rose-400 transition-colors cursor-pointer"
                              title="Eliminar restaurante"
                              aria-label={`Eliminar restaurante ${r.config.name}`}
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

          {/* Directory Pagination */}
          {activeTab === "active" && filteredRestaurants.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-2">
              <Pagination
                currentPage={currentPage}
                totalItems={filteredRestaurants.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setCurrentPage(1)
                }}
              />
            </div>
          )}

          {activeTab === "deleted" && filteredDeletedRestaurants.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-2">
              <Pagination
                currentPage={currentPage}
                totalItems={filteredDeletedRestaurants.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setCurrentPage(1)
                }}
              />
            </div>
          )}
        </div>
      )}

      <CreateRestaurantModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      <EditRestaurantModal
        isOpen={!!restaurantToEdit}
        onClose={() => setRestaurantToEdit(null)}
        restaurant={restaurantToEdit}
        onSaved={refreshRestaurants}
      />

      <ConfirmDeleteModal
        isOpen={!!restaurantToDelete}
        onClose={() => setRestaurantToDelete(null)}
        onConfirm={async () => {
          if (restaurantToDelete) {
            const idToDelete = restaurantToDelete.id
            setDeletingIds((prev) => new Set(prev).add(idToDelete))
            setRestaurantToDelete(null)
            try {
              await deleteRestaurant(idToDelete)
              await refreshRestaurants()
              await loadDeletedRestaurants()
            } finally {
              setDeletingIds((prev) => {
                const next = new Set(prev)
                next.delete(idToDelete)
                return next
              })
            }
          }
        }}
        title="¿Eliminar restaurante?"
        targetName={restaurantToDelete?.config.name}
        description={
          restaurantToDelete
            ? `¿Estás seguro de que deseas eliminar a "${restaurantToDelete.config.name}" (/${restaurantToDelete.slug})? El restaurante dejará de estar visible y se bloqueará el acceso a sus administradores. Sus datos históricos y pedidos se conservarán en el sistema.`
            : undefined
        }
        confirmText="Eliminar restaurante"
      />

      {/* Modal Restaurar Restaurante */}
      {restaurantToRestore && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-restaurant-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          onKeyDown={(e) => {
            if (e.key === "Escape" && !isRestoring) {
              setRestaurantToRestore(null)
            }
          }}
        >
          <div
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
              isDark ? "border-slate-800 bg-[#0E1322] text-slate-100" : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
                  <RotateCcw className="size-5" />
                </div>
                <div>
                  <h3 id="restore-restaurant-title" className="text-base font-bold">
                    ¿Restaurar restaurante?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {restaurantToRestore.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestaurantToRestore(null)}
                disabled={isRestoring}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Cerrar modal"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                El restaurante volverá en estado PAUSADO y sus administradores serán reactivados automáticamente. Deberás reactivarlo manualmente cuando desees que comience a operar.
              </p>

              {isSlugConflict && (
                <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-500" />
                    <span>{slugConflictError}</span>
                  </div>
                  <div>
                    <label
                      htmlFor="restore-new-slug"
                      className="block font-bold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Nuevo slug para restaurar
                    </label>
                    <input
                      id="restore-new-slug"
                      aria-label="Nuevo slug para restaurar"
                      type="text"
                      required
                      value={restoreSlug}
                      onChange={(e) => setRestoreSlug(e.target.value.toLowerCase())}
                      placeholder="nuevo-slug"
                      className={`w-full rounded-xl border px-3.5 py-2 text-xs font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        isDark
                          ? "border-slate-700 bg-slate-800 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-900"
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5 border-t pt-4 border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRestaurantToRestore(null)}
                disabled={isRestoring}
                className="rounded-xl text-xs font-semibold"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring || (isSlugConflict && !restoreSlug.trim())}
                className="rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
              >
                {isRestoring ? (
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Restaurando...</span>
                  </div>
                ) : isSlugConflict ? (
                  "Reintentar Restauración"
                ) : (
                  "Confirmar Restauración"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
