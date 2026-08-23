import React, { useState, useMemo } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import type { RestaurantRecord } from "@/types/restaurant"
import {
  Sliders,
  Trash2,
  Search,
  Eye,
} from "lucide-react"
import { GlobalPlatformSummary } from "./GlobalPlatformSummary"
import { CreateRestaurantModal } from "./CreateRestaurantModal"
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal"
import { useAppRouter } from "@/core/router/useAppRouter"

export const RestaurantsDirectory: React.FC = () => {
  const {
    restaurants,
    activeRestaurantId,
    switchRestaurant,
    updateRestaurant,
    deleteRestaurant,
    adminTheme,
  } = useRestaurant()

  const { navigateTo } = useAppRouter()

  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [restaurantToDelete, setRestaurantToDelete] = useState<RestaurantRecord | null>(null)

  const isDark = adminTheme === "dark"

  const filteredRestaurants = useMemo(() => {
    return restaurants.filter(
      (r) =>
        r.config.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.config.tagline.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [restaurants, searchTerm])

  const handleManage = (r: RestaurantRecord) => {
    switchRestaurant(r.id)
    navigateTo("/admin/dashboard")
  }

  const handleViewStore = (r: RestaurantRecord) => {
    switchRestaurant(r.id)
    navigateTo(`/${r.slug}`)
  }

  return (
    <div className="space-y-6">
      {/* Global Summary Cards */}
      <GlobalPlatformSummary onOpenCreateModal={() => setIsCreateOpen(true)} />

      {/* Directory Table Container */}
      <div
        className={`rounded-2xl border shadow-xs overflow-hidden transition-colors ${
          isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"
        }`}
      >
        {/* Table Header Controls */}
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, slug o tipo..."
              className={`w-full rounded-xl border pl-9 pr-4 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDark
                  ? "border-slate-700 bg-slate-800 text-white placeholder-slate-400"
                  : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400"
              }`}
            />
          </div>

          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Mostrando <strong>{filteredRestaurants.length}</strong> de {restaurants.length} restaurantes
          </div>
        </div>

        {/* Table */}
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRestaurants.map((r) => {
                const totalSales = r.orders
                  .filter((o) => o.status !== "cancelled")
                  .reduce((sum, o) => sum + o.finalTotal, 0)
                const isSelected = r.id === activeRestaurantId

                return (
                  <tr
                    key={r.id}
                    className={`transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/40 ${
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

                    {/* Status switch */}
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => updateRestaurant(r.id, { isActive: !r.isActive })}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${
                          r.isActive
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25"
                            : "bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25"
                        }`}
                      >
                        <span className={`size-1.5 rounded-full ${r.isActive ? "bg-emerald-500" : "bg-rose-500"}`} />
                        <span>{r.isActive ? "Operando" : "Pausado"}</span>
                      </button>
                    </td>

                    {/* Products Count */}
                    <td className="px-4 py-4">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {r.products.length} platos
                      </span>
                      <span className="text-[11px] text-slate-400 ml-1">
                        ({r.additions.length} toppings)
                      </span>
                    </td>

                    {/* Total Sales */}
                    <td className="px-4 py-4 font-bold text-slate-900 dark:text-white">
                      ${totalSales.toLocaleString()}
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
      </div>

      <CreateRestaurantModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      <ConfirmDeleteModal
        isOpen={!!restaurantToDelete}
        onClose={() => setRestaurantToDelete(null)}
        onConfirm={() => {
          if (restaurantToDelete) {
            deleteRestaurant(restaurantToDelete.id)
            setRestaurantToDelete(null)
          }
        }}
        title="¿Eliminar restaurante?"
        targetName={restaurantToDelete?.config.name}
        description={
          restaurantToDelete
            ? `¿Estás seguro de que deseas eliminar permanentemente a "${restaurantToDelete.config.name}" (/${restaurantToDelete.slug})? Se borrarán sus productos, adiciones, inventario y pedidos acumulados.`
            : undefined
        }
        confirmText="Eliminar restaurante"
      />
    </div>
  )
}
