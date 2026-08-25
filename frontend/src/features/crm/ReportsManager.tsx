import React, { useState, useMemo } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import {
  FileSpreadsheet,
  Printer,
  DollarSign,
  CreditCard,
  Banknote,
  TrendingUp,
  Users,
  Boxes,
  Download,
  Receipt,
  Truck,
  Calendar,
  CalendarDays,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { OrderStatusBadge } from "@/components/ui/status-badge"
import { Pagination } from "@/components/ui/pagination"
import { toast } from "sonner"
import {
  calculateCashCloseout,
  generateSalesCsv,
  generateCustomersCsv,
  generateInventoryCsv,
  downloadCsv,
  buildCsvString,
  type CsvColumn,
} from "@/core/export"
import type { Order } from "@/types/restaurant"

export type DatePreset =
  | "today"
  | "yesterday"
  | "7days"
  | "this_month"
  | "last_month"
  | "all"
  | "custom"

const toIsoDateString = (d: Date): string => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export const ReportsManager: React.FC = () => {
  const { orders, customers, inventory, suppliers, storeConfig, activeRestaurant, adminTheme } =
    useRestaurant()

  const todayStr = useMemo(() => toIsoDateString(new Date()), [])

  const [datePreset, setDatePreset] = useState<DatePreset>("today")
  const [startDate, setStartDate] = useState<string>(todayStr)
  const [endDate, setEndDate] = useState<string>(todayStr)
  const [previewPage, setPreviewPage] = useState(1)
  const [previewPageSize, setPreviewPageSize] = useState(10)

  const isDark = adminTheme === "dark"

  // Preset switch handler
  const handleSelectPreset = (preset: DatePreset) => {
    setDatePreset(preset)
    setPreviewPage(1)
    const now = new Date()

    switch (preset) {
      case "today": {
        const str = toIsoDateString(now)
        setStartDate(str)
        setEndDate(str)
        break
      }
      case "yesterday": {
        const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
        const str = toIsoDateString(y)
        setStartDate(str)
        setEndDate(str)
        break
      }
      case "7days": {
        const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
        setStartDate(toIsoDateString(sevenDaysAgo))
        setEndDate(toIsoDateString(now))
        break
      }
      case "this_month": {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        setStartDate(toIsoDateString(firstDay))
        setEndDate(toIsoDateString(now))
        break
      }
      case "last_month": {
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
        setStartDate(toIsoDateString(firstDayLastMonth))
        setEndDate(toIsoDateString(lastDayLastMonth))
        break
      }
      case "all": {
        setStartDate("")
        setEndDate("")
        break
      }
      case "custom":
      default:
        break
    }
  }

  // Filter orders according to active start & end date or preset
  const { filteredOrders, presetLabel } = useMemo(() => {
    let filtered: Order[] = []
    let label = "Personalizado"

    if (datePreset === "all" || (!startDate && !endDate)) {
      filtered = [...orders]
      label = "Todo el Historial"
    } else {
      const startTimestamp = startDate
        ? new Date(`${startDate}T00:00:00`).getTime()
        : 0
      const endTimestamp = endDate
        ? new Date(`${endDate}T23:59:59.999`).getTime()
        : Number.MAX_SAFE_INTEGER

      filtered = orders.filter((o) => {
        const t = new Date(o.createdAt).getTime()
        return t >= startTimestamp && t <= endTimestamp
      })

      if (datePreset === "today") {
        label = `Hoy (${startDate})`
      } else if (datePreset === "yesterday") {
        label = `Ayer (${startDate})`
      } else if (datePreset === "this_month") {
        label = `Este Mes (${startDate} al ${endDate})`
      } else if (datePreset === "last_month") {
        label = `Mes Anterior (${startDate} al ${endDate})`
      } else if (datePreset === "7days") {
        label = `Últimos 7 Días (${startDate} al ${endDate})`
      } else {
        label = `Rango: ${startDate || "Inicio"} al ${endDate || "Hoy"}`
      }
    }

    return { filteredOrders: filtered, presetLabel: label }
  }, [orders, datePreset, startDate, endDate])

  const paginatedOrders = useMemo(() => {
    const start = (previewPage - 1) * previewPageSize
    return filteredOrders.slice(start, start + previewPageSize)
  }, [filteredOrders, previewPage, previewPageSize])

  // Calculated closeout report for the active filter
  const closeout = useMemo(() => {
    return calculateCashCloseout(filteredOrders, presetLabel)
  }, [filteredOrders, presetLabel])

  // Export handlers
  const handleExportSales = () => {
    if (filteredOrders.length === 0) {
      toast.warning("No hay pedidos en el período seleccionado para exportar.")
      return
    }
    const csv = generateSalesCsv(filteredOrders)
    const suffix = startDate && endDate ? `${startDate}_al_${endDate}` : datePreset
    const filename = `ventas_${activeRestaurant.slug}_${suffix}.csv`
    downloadCsv(filename, csv)
    toast.success(`Reporte de ventas exportado (${filteredOrders.length} pedidos)`)
  }

  const handleExportCashCloseout = () => {
    const columns: CsvColumn<typeof closeout>[] = [
      { header: "Período", accessor: (c) => c.dateRangeLabel },
      { header: "Ventas Totales ($)", accessor: (c) => c.totalSales },
      { header: "Total Pedidos", accessor: (c) => c.totalOrdersCount },
      { header: "Pedidos Entregados", accessor: (c) => c.deliveredOrdersCount },
      { header: "Pedidos Cancelados", accessor: (c) => c.cancelledOrdersCount },
      { header: "Pedidos en Proceso", accessor: (c) => c.activeOrdersCount },
      { header: "Total Efectivo ($)", accessor: (c) => c.cashTotal },
      { header: "Pedidos Efectivo", accessor: (c) => c.cashOrdersCount },
      { header: "Total Transferencias ($)", accessor: (c) => c.transferTotal },
      { header: "Pedidos Transferencia", accessor: (c) => c.transferOrdersCount },
      { header: "Total Domicilios ($)", accessor: (c) => c.deliveryFeesTotal },
      { header: "Ticket Promedio ($)", accessor: (c) => c.avgTicket },
      { header: "Fecha Generación", accessor: (c) => c.generatedAt },
    ]

    const csv = buildCsvString([closeout], columns)
    const suffix = startDate && endDate ? `${startDate}_al_${endDate}` : datePreset
    const filename = `cierre_caja_${activeRestaurant.slug}_${suffix}.csv`
    downloadCsv(filename, csv)
    toast.success("Resumen de cierre de caja exportado a CSV")
  }

  const handleExportCustomers = () => {
    if (customers.length === 0) {
      toast.warning("No hay clientes registrados para exportar.")
      return
    }
    const csv = generateCustomersCsv(customers)
    const filename = `clientes_crm_${activeRestaurant.slug}_${new Date().toISOString().slice(0, 10)}.csv`
    downloadCsv(filename, csv)
    toast.success(`Base de clientes exportada (${customers.length} contactos)`)
  }

  const handleExportInventory = () => {
    if (inventory.length === 0) {
      toast.warning("No hay insumos en inventario para exportar.")
      return
    }
    const csv = generateInventoryCsv(inventory, suppliers)
    const filename = `inventario_stock_${activeRestaurant.slug}_${new Date().toISOString().slice(0, 10)}.csv`
    downloadCsv(filename, csv)
    toast.success(`Auditoría de inventario exportada (${inventory.length} insumos)`)
  }

  const handlePrintCloseout = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Header & Advanced Date Range Selector */}
      <div
        className={`flex flex-col gap-5 rounded-2xl border p-6 shadow-xs ${
          isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-400">
                <FileSpreadsheet className="size-4" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                Reportes & Cierre de Caja
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Filtra por períodos rápidos o selecciona cualquier rango de fechas para cierres y descargas.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 self-start sm:self-auto">
            <CalendarDays className="size-4" />
            <span>{presetLabel}</span>
          </div>
        </div>

        {/* Filter Controls: Quick Presets + Custom Date Pickers */}
        <div className="flex flex-col gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 lg:flex-row lg:items-center lg:justify-between">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-800/60">
            {(
              [
                { id: "today", label: "Hoy" },
                { id: "yesterday", label: "Ayer" },
                { id: "7days", label: "7 Días" },
                { id: "this_month", label: "Este Mes" },
                { id: "last_month", label: "Mes Anterior" },
                { id: "all", label: "Todo" },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  datePreset === preset.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers (Desde / Hasta) */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Desde:</span>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setDatePreset("custom")
                    setPreviewPage(1)
                  }}
                  className={`rounded-xl border px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isDark
                      ? "border-slate-700 bg-slate-800 text-slate-100"
                      : "border-slate-200 bg-slate-50 text-slate-800"
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Hasta:</span>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setDatePreset("custom")
                    setPreviewPage(1)
                  }}
                  className={`rounded-xl border px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isDark
                      ? "border-slate-700 bg-slate-800 text-slate-100"
                      : "border-slate-200 bg-slate-50 text-slate-800"
                  }`}
                />
              </div>
            </div>

            {datePreset === "custom" && (
              <span className="rounded-lg bg-amber-500/15 px-2 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Calendar className="size-3" />
                Rango libre
              </span>
            )}
          </div>
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Sales */}
        <div
          className={`rounded-2xl border p-5 shadow-xs transition-all ${
            isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Ventas Totales
            </span>
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <DollarSign className="size-4" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              ${closeout.totalSales.toLocaleString()}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {closeout.deliveredOrdersCount} entregados
            </span>
            <span>&middot; {closeout.totalOrdersCount} pedidos tot.</span>
          </div>
        </div>

        {/* Cash Income */}
        <div
          className={`rounded-2xl border p-5 shadow-xs transition-all ${
            isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Efectivo en Caja
            </span>
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <Banknote className="size-4" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400">
              ${closeout.cashTotal.toLocaleString()}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-medium">{closeout.cashOrdersCount} órdenes cobradas en efectivo</span>
          </div>
        </div>

        {/* Bank Transfer Income */}
        <div
          className={`rounded-2xl border p-5 shadow-xs transition-all ${
            isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Transferencias
            </span>
            <span className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <CreditCard className="size-4" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black tracking-tight text-blue-600 dark:text-blue-400">
              ${closeout.transferTotal.toLocaleString()}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-medium">{closeout.transferOrdersCount} órdenes por transferencia</span>
          </div>
        </div>

        {/* Avg Ticket & Deliveries */}
        <div
          className={`rounded-2xl border p-5 shadow-xs transition-all ${
            isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Ticket Promedio
            </span>
            <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
              <TrendingUp className="size-4" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              ${closeout.avgTicket.toLocaleString()}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <Truck className="size-3 text-slate-400" />
            <span>Domicilios: ${closeout.deliveryFeesTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Cash Closeout Slip & Export Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Printable Cashier Closeout Voucher (Z-Report) */}
        <div
          id="cash-closeout-voucher"
          className={`rounded-2xl border p-6 shadow-xs lg:col-span-1 ${
            isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Receipt className="size-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Cuadre de Caja (Z-Report)
              </h2>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handlePrintCloseout}
              className="gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <Printer className="size-3.5" />
              <span>Imprimir</span>
            </Button>
          </div>

          <div className="mt-4 space-y-4 text-xs">
            {/* Restaurant Info Header */}
            <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60 border dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                {storeConfig.name}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {presetLabel}
              </p>
              <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                Generado: {new Date().toLocaleString("es-CO")}
              </p>
            </div>

            {/* Financial Breakdown Table */}
            <div className="space-y-2 divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              <div className="flex items-center justify-between pt-1">
                <span>Ventas Totales Brutas</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ${closeout.totalSales.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="flex items-center gap-1">
                  <Banknote className="size-3 text-amber-500" /> Efectivo Recibido
                </span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  ${closeout.cashTotal.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="flex items-center gap-1">
                  <CreditCard className="size-3 text-blue-500" /> Transferencias
                </span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  ${closeout.transferTotal.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span>Total Fletes / Domicilios</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  ${closeout.deliveryFeesTotal.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span>Órdenes Entregadas</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {closeout.deliveredOrdersCount}
                </span>
              </div>
              {closeout.cancelledOrdersCount > 0 && (
                <div className="flex items-center justify-between pt-2 text-rose-500">
                  <span>Órdenes Canceladas</span>
                  <span className="font-bold">{closeout.cancelledOrdersCount}</span>
                </div>
              )}
            </div>

            {/* Signatures for physical cashier closing */}
            <div className="mt-6 pt-4 border-t border-dashed border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex justify-between gap-4 text-[10px] text-slate-400">
                <div className="w-1/2 border-t border-slate-300 pt-1 text-center dark:border-slate-700">
                  Firma Cajero
                </div>
                <div className="w-1/2 border-t border-slate-300 pt-1 text-center dark:border-slate-700">
                  Firma Administrador
                </div>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleExportCashCloseout}
              variant="outline"
              className="w-full gap-1.5 text-xs font-semibold cursor-pointer mt-2"
            >
              <Download className="size-3.5 text-indigo-500" />
              <span>Exportar Resumen Z a CSV</span>
            </Button>
          </div>
        </div>

        {/* 1-Click Export Suite Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div
            className={`rounded-2xl border p-6 shadow-xs ${
              isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
            }`}
          >
            <div className="border-b pb-4 border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Centro de Descarga de Datos (Excel & CSV)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Archivos codificados con UTF-8 BOM listos para abrir en Microsoft Excel y Google Sheets.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Sales Orders Export */}
              <div className="flex flex-col justify-between rounded-xl border p-4 transition-all hover:border-indigo-500/40 border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                      <DollarSign className="size-4" />
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Historial de Ventas
                    </h3>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Detalle de órdenes, clientes, productos, fletes, medios de pago y observaciones.
                  </p>
                  <div className="mt-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                    {filteredOrders.length} pedidos en rango ({presetLabel})
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleExportSales}
                  className="mt-4 w-full gap-1.5 rounded-lg bg-indigo-600 font-semibold text-white hover:bg-indigo-700 cursor-pointer"
                >
                  <Download className="size-3.5" />
                  <span>Descargar Ventas CSV</span>
                </Button>
              </div>

              {/* Customers CRM Export */}
              <div className="flex flex-col justify-between rounded-xl border p-4 transition-all hover:border-indigo-500/40 border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                      <Users className="size-4" />
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Base de Clientes CRM
                    </h3>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Directorio completo con celulares, direcciones, niveles VIP/Oro, gasto acumulado y notas.
                  </p>
                  <div className="mt-2 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                    {customers.length} contactos registrados
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleExportCustomers}
                  className="mt-4 w-full gap-1.5 rounded-lg bg-purple-600 font-semibold text-white hover:bg-purple-700 cursor-pointer"
                >
                  <Download className="size-3.5" />
                  <span>Descargar Clientes CSV</span>
                </Button>
              </div>

              {/* Inventory Stock & Valuations Export */}
              <div className="flex flex-col justify-between rounded-xl border p-4 transition-all hover:border-indigo-500/40 border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                      <Boxes className="size-4" />
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Auditoría de Inventario
                    </h3>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Stock actual, alertas de nivel mínimo, costos unitarios, valuación y proveedores.
                  </p>
                  <div className="mt-2 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    {inventory.length} insumos catalogados
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleExportInventory}
                  className="mt-4 w-full gap-1.5 rounded-lg bg-amber-600 font-semibold text-white hover:bg-amber-700 cursor-pointer"
                >
                  <Download className="size-3.5" />
                  <span>Descargar Inventario CSV</span>
                </Button>
              </div>

              {/* Cash Closeout Summary Export */}
              <div className="flex flex-col justify-between rounded-xl border p-4 transition-all hover:border-indigo-500/40 border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                      <Receipt className="size-4" />
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Cuadre de Caja (Z)
                    </h3>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Totales financieros consolidados por medio de pago para libros contables.
                  </p>
                  <div className="mt-2 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                    Período: {presetLabel}
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleExportCashCloseout}
                  className="mt-4 w-full gap-1.5 rounded-lg bg-blue-600 font-semibold text-white hover:bg-blue-700 cursor-pointer"
                >
                  <Download className="size-3.5" />
                  <span>Descargar Cierre Z CSV</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Orders Preview Table for Selected Period */}
          <div
            className={`rounded-2xl border p-6 shadow-xs ${
              isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Vista Previa de Pedidos del Período ({filteredOrders.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {presetLabel}
                </p>
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No hay transacciones registradas en este rango de fechas.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className={`border-b ${isDark ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-500"}`}>
                      <th className="py-2 px-3 font-semibold">Orden</th>
                      <th className="py-2 px-3 font-semibold">Fecha / Hora</th>
                      <th className="py-2 px-3 font-semibold">Cliente</th>
                      <th className="py-2 px-3 font-semibold">Total</th>
                      <th className="py-2 px-3 font-semibold">Método</th>
                      <th className="py-2 px-3 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedOrders.map((ord) => (
                      <tr
                        key={ord.id}
                        className={`transition-colors ${
                          isDark ? "hover:bg-slate-800/60" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="py-2.5 px-3 font-bold text-indigo-600 dark:text-indigo-400">
                          #{ord.orderNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {new Date(ord.createdAt).toLocaleDateString("es-CO", {
                            day: "2-digit",
                            month: "2-digit",
                          })}{" "}
                          {new Date(ord.createdAt).toLocaleTimeString("es-CO", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-200 truncate max-w-[140px]">
                          {ord.customer.nombre}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                          ${ord.finalTotal.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              ord.metodo === "Efectivo"
                                ? "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                                : "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
                            }`}
                          >
                            {ord.metodo}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <OrderStatusBadge status={ord.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination for Preview Table */}
            {filteredOrders.length > 0 && (
              <div className="border-t border-slate-100 dark:border-slate-800 pt-2 mt-3">
                <Pagination
                  currentPage={previewPage}
                  totalItems={filteredOrders.length}
                  pageSize={previewPageSize}
                  onPageChange={setPreviewPage}
                  onPageSizeChange={(size) => {
                    setPreviewPageSize(size)
                    setPreviewPage(1)
                  }}
                  pageSizeOptions={[5, 10, 25, 50]}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
