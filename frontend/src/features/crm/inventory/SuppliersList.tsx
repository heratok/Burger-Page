import React from "react"
import type { Supplier, InventoryItem } from "@/types/restaurant"
import {
  Search,
  Truck,
  Phone,
  Edit2,
  Trash2,
  AlertTriangle,
  MessageSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export interface SuppliersListProps {
  suppliers: Supplier[]
  inventory: InventoryItem[]
  searchTerm: string
  onSearchChange: (term: string) => void
  isDark: boolean
  onEditSupplier: (supplier: Supplier) => void
  onDeleteSupplier: (supplier: Supplier) => void
  onSendSupplierWhatsApp: (supplier: Supplier) => void
}

export const SuppliersList: React.FC<SuppliersListProps> = ({
  suppliers,
  inventory,
  searchTerm,
  onSearchChange,
  isDark,
  onEditSupplier,
  onDeleteSupplier,
  onSendSupplierWhatsApp,
}) => {
  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar proveedor por nombre, contacto o rubro..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className={`w-full rounded-xl border pl-8.5 pr-4 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            isDark
              ? "border-slate-800 bg-[#0E1322] text-white placeholder-slate-500"
              : "border-slate-200 bg-white text-slate-900 placeholder-slate-400"
          }`}
        />
      </div>

      {suppliers.length === 0 ? (
        <div
          className={`rounded-2xl border p-12 text-center text-slate-400 ${
            isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"
          }`}
        >
          <Truck className="size-10 mx-auto mb-2 text-slate-500 opacity-50" />
          <p className="text-sm font-semibold">No hay proveedores registrados</p>
          <p className="text-xs mt-1 text-slate-500">
            Registrá tus distribuidores para contactarlos en 1 clic y pedir reposiciones directas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((sup) => {
            const suppliedItems = inventory.filter((it) => it.supplierId === sup.id)
            const criticalItems = suppliedItems.filter(
              (it) => it.currentStock <= it.minStockAlert
            )

            return (
              <div
                key={sup.id}
                className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                  isDark
                    ? "border-slate-800 bg-[#0E1322] hover:border-slate-700"
                    : "border-slate-200/80 bg-white hover:border-slate-300 shadow-xs"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400">
                        {sup.category}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">
                        {sup.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEditSupplier(sup)}
                        className={`rounded-lg p-1 transition-colors ${
                          isDark
                            ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                            : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        }`}
                        title="Editar proveedor"
                      >
                        <Edit2 className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSupplier(sup)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
                        title="Eliminar proveedor"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Contact details */}
                  <div className="space-y-1.5 text-xs my-3">
                    <div className="flex items-center gap-2">
                      <span className={isDark ? "text-slate-400" : "text-slate-500"}>Contacto:</span>
                      <span className={`font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                        {sup.contactName || "No especificado"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className={`size-3 ${isDark ? "text-slate-400" : "text-slate-500"}`} />
                      <span className={`font-mono font-medium ${isDark ? "text-slate-200" : "text-slate-800"}`}>{sup.phone}</span>
                    </div>
                    {sup.notes && (
                      <p
                        className={`text-[11px] italic mt-2.5 p-2.5 rounded-xl border transition-colors ${
                          isDark
                            ? "border-slate-800 bg-slate-900/60 text-slate-300"
                            : "border-slate-200 bg-slate-50 text-slate-700 font-medium"
                        }`}
                      >
                        &quot;{sup.notes}&quot;
                      </p>
                    )}
                  </div>

                  {/* Supplied Items Summary */}
                  <div
                    className={`pt-2.5 border-t text-[11px] flex items-center justify-between ${
                      isDark ? "border-slate-800/60 text-slate-400" : "border-slate-100 text-slate-500"
                    }`}
                  >
                    <span>{suppliedItems.length} insumos provistos</span>
                    {criticalItems.length > 0 && (
                      <span className="text-amber-500 font-bold flex items-center gap-1">
                        <AlertTriangle className="size-3" />
                        {criticalItems.length} por reponer
                      </span>
                    )}
                  </div>
                </div>

                {/* WhatsApp Action Button */}
                <div className={`mt-4 pt-3 border-t ${isDark ? "border-slate-800/60" : "border-slate-100"}`}>
                  <Button
                    type="button"
                    onClick={() => onSendSupplierWhatsApp(sup)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                  >
                    <MessageSquare className="size-3.5" />
                    <span>Pedir Reposición por WhatsApp</span>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
