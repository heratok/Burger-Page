import React, { useState, useMemo } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import type { Customer } from "@/types/restaurant"
import {
  Search,
  MessageCircle,
  X,
  FileText,
} from "lucide-react"
import { LoyaltyBadge } from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
import { buildWhatsAppUrl } from "@/lib/whatsapp"

export const CustomerCRM: React.FC = () => {
  const { customers, orders, updateCustomer, storeConfig, adminTheme } = useRestaurant()

  const [searchTerm, setSearchTerm] = useState("")
  const [tierFilter, setTierFilter] = useState<string>("ALL")
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [notesEdit, setNotesEdit] = useState("")

  const isDark = adminTheme === "dark"

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchSearch =
        c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.telefono.includes(searchTerm) ||
        c.barrio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.direccion.toLowerCase().includes(searchTerm.toLowerCase())

      const matchTier = tierFilter === "ALL" || c.loyaltyTier === tierFilter

      return matchSearch && matchTier
    })
  }, [customers, searchTerm, tierFilter])

  // Customer Metrics
  const stats = useMemo(() => {
    const totalSpentAll = customers.reduce((sum, c) => sum + c.totalSpent, 0)
    const vipCount = customers.filter((c) => c.loyaltyTier === "vip").length
    const goldCount = customers.filter((c) => c.loyaltyTier === "gold").length
    const avgOrders = customers.length > 0
      ? (customers.reduce((sum, c) => sum + c.totalOrders, 0) / customers.length).toFixed(1)
      : "0"

    return { totalSpentAll, vipCount, goldCount, avgOrders }
  }, [customers])

  const openWhatsAppMarketing = (cust: Customer) => {
    const phone = cust.telefono.replace(/\D/g, "")
    const fullPhone = phone.startsWith("57") ? phone : `57${phone}`
    const greeting =
      cust.loyaltyTier === "vip"
        ? `¡Hola ${cust.nombre}! 👑 Como cliente VIP de *${storeConfig.name}*, queremos regalarte un cupón especial del 15% OFF en tu próximo pedido usando el código *VIPBURGER*. ¿Te gustaría pedir hoy?`
        : `¡Hola ${cust.nombre}! Te saludamos de *${storeConfig.name}*. Tenemos novedades en nuestra carta que seguro te encantarán. ¡Visita nuestra tienda para ver lo nuevo!`

    window.open(buildWhatsAppUrl(fullPhone, greeting), "_blank", "noreferrer")
  }

  const openCustomerModal = (cust: Customer) => {
    setSelectedCustomer(cust)
    setNotesEdit(cust.notes || "")
  }

  const handleSaveNotes = () => {
    if (selectedCustomer) {
      updateCustomer(selectedCustomer.id, { notes: notesEdit })
      setSelectedCustomer((prev) => (prev ? { ...prev, notes: notesEdit } : null))
    }
  }

  const customerOrders = useMemo(() => {
    if (!selectedCustomer) return []
    return orders.filter(
      (o) =>
        o.customer.telefono.replace(/\D/g, "") ===
        selectedCustomer.telefono.replace(/\D/g, "")
    )
  }, [orders, selectedCustomer])

  return (
    <div className="space-y-6">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          className={`rounded-2xl border p-5 shadow-xs ${
            isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
          }`}
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Base de Clientes
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{customers.length}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">registrados</span>
          </div>
        </div>

        <div
          className={`rounded-2xl border p-5 shadow-xs ${
            isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
          }`}
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Clientes VIP & Oro
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {stats.vipCount + stats.goldCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">alta frecuencia</span>
          </div>
        </div>

        <div
          className={`rounded-2xl border p-5 shadow-xs ${
            isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
          }`}
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Gasto Acumulado
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ${stats.totalSpentAll.toLocaleString()}
            </span>
          </div>
        </div>

        <div
          className={`rounded-2xl border p-5 shadow-xs ${
            isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
          }`}
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Promedio Pedidos / Cliente
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {stats.avgOrders}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">órdenes</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between ${
          isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
        }`}
      >
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, teléfono o barrio..."
            className={`w-full rounded-xl border pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isDark
                ? "border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-400"
                : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400"
            }`}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nivel:</span>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className={`rounded-xl border px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isDark
                ? "border-slate-700 bg-slate-800 text-slate-100"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            <option value="ALL">Todos los niveles</option>
            <option value="vip">👑 VIP</option>
            <option value="gold">🥇 Oro</option>
            <option value="silver">🥈 Plata</option>
            <option value="bronze">🥉 Bronce</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div
        className={`overflow-hidden rounded-2xl border shadow-xs ${
          isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`border-b ${isDark ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-500"}`}>
                <th className="py-3 px-4 font-semibold">Cliente</th>
                <th className="py-3 px-4 font-semibold">Teléfono</th>
                <th className="py-3 px-4 font-semibold">Ubicación</th>
                <th className="py-3 px-4 font-semibold text-center">Total Pedidos</th>
                <th className="py-3 px-4 font-semibold">Gasto Total</th>
                <th className="py-3 px-4 font-semibold">Nivel</th>
                <th className="py-3 px-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCustomers.map((cust) => (
                <tr
                  key={cust.id}
                  className={`transition-colors ${
                    isDark ? "hover:bg-slate-800/60" : "hover:bg-slate-50"
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 items-center justify-center rounded-full bg-indigo-500/10 font-bold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                        {cust.nombre.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{cust.nombre}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          Último pedido: {new Date(cust.lastOrderDate).toLocaleDateString("es-CO")}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300">
                    {cust.telefono}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium truncate max-w-[180px] text-slate-900 dark:text-slate-200">
                      {cust.direccion}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{cust.barrio}</div>
                  </td>
                  <td className="py-3 px-4 font-bold text-center text-slate-900 dark:text-slate-100">
                    {cust.totalOrders}
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                    ${cust.totalSpent.toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <LoyaltyBadge tier={cust.loyaltyTier} />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openWhatsAppMarketing(cust)}
                        className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-600 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-300"
                        title="Contactar por WhatsApp"
                      >
                        <MessageCircle className="size-3.5" />
                        <span>Chat</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openCustomerModal(cust)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        title="Ficha del cliente"
                      >
                        <FileText className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Profile & Notes Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
          <div
            className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl transition-all ${
              isDark ? "border-slate-800 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className="flex items-start justify-between border-b pb-4 border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {selectedCustomer.nombre}
                  </h3>
                  <LoyaltyBadge tier={selectedCustomer.loyaltyTier} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Celular: {selectedCustomer.telefono} &middot; {selectedCustomer.barrio}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Spending stats */}
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800 border dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Total Pedidos</span>
                <p className="text-lg font-black text-slate-900 dark:text-white">
                  {selectedCustomer.totalOrders} compras
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800 border dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Inversión Total</span>
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  ${selectedCustomer.totalSpent.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Notes input */}
            <div className="mt-4 space-y-2 text-xs">
              <label className="font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                <FileText className="size-3.5 text-indigo-500" />
                <span>Notas Internas del Cliente (Preferencias, Alergias, etc.)</span>
              </label>
              <textarea
                rows={3}
                value={notesEdit}
                onChange={(e) => setNotesEdit(e.target.value)}
                placeholder="Ej. Prefiere la carne bien cocida. Dejar con portería si no contesta..."
                className="w-full rounded-xl border p-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={handleSaveNotes} className="bg-indigo-600 text-white font-semibold">
                  Guardar Notas
                </Button>
              </div>
            </div>

            {/* Orders History in Modal */}
            <div className="mt-4 border-t pt-3 border-slate-100 dark:border-slate-800 text-xs">
              <h4 className="font-bold mb-2 text-slate-900 dark:text-slate-200">
                Historial de Pedidos Registrados ({customerOrders.length})
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {customerOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 text-xs text-slate-900 dark:text-slate-100 bg-slate-50/80 dark:bg-slate-800"
                  >
                    <div>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        #{ord.orderNumber}
                      </span>{" "}
                      <span className="text-slate-500 dark:text-slate-300">
                        &middot; {new Date(ord.createdAt).toLocaleDateString("es-CO")}
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">
                      ${ord.finalTotal.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
