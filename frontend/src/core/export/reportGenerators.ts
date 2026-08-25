import type { Order, Customer, InventoryItem, Supplier } from "@/types/restaurant"
import { buildCsvString, type CsvColumn } from "./csvExport"

export interface CashCloseoutReport {
  dateRangeLabel: string
  totalSales: number
  totalOrdersCount: number
  deliveredOrdersCount: number
  cancelledOrdersCount: number
  activeOrdersCount: number
  cashTotal: number
  cashOrdersCount: number
  transferTotal: number
  transferOrdersCount: number
  deliveryFeesTotal: number
  avgTicket: number
  generatedAt: string
}

/**
 * Calculates financial metrics for daily/shift closeout from an order list.
 */
export function calculateCashCloseout(orders: Order[], dateLabel: string = "Hoy"): CashCloseoutReport {
  const validOrders = orders.filter((o) => o.status !== "cancelled")
  const deliveredOrders = orders.filter((o) => o.status === "delivered")
  const cancelledOrders = orders.filter((o) => o.status === "cancelled")
  const activeOrders = orders.filter(
    (o) => o.status === "pending" || o.status === "cooking" || o.status === "delivering"
  )

  const cashOrders = validOrders.filter((o) => o.metodo === "Efectivo")
  const transferOrders = validOrders.filter((o) => o.metodo === "Transferencia")

  const totalSales = validOrders.reduce((sum, o) => sum + (o.finalTotal || 0), 0)
  const cashTotal = cashOrders.reduce((sum, o) => sum + (o.finalTotal || 0), 0)
  const transferTotal = transferOrders.reduce((sum, o) => sum + (o.finalTotal || 0), 0)
  const deliveryFeesTotal = validOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0)

  const avgTicket = validOrders.length > 0 ? Math.round(totalSales / validOrders.length) : 0

  return {
    dateRangeLabel: dateLabel,
    totalSales,
    totalOrdersCount: orders.length,
    deliveredOrdersCount: deliveredOrders.length,
    cancelledOrdersCount: cancelledOrders.length,
    activeOrdersCount: activeOrders.length,
    cashTotal,
    cashOrdersCount: cashOrders.length,
    transferTotal,
    transferOrdersCount: transferOrders.length,
    deliveryFeesTotal,
    avgTicket,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Generates an RFC-4180 CSV string for orders.
 */
export function generateSalesCsv(orders: Order[]): string {
  const columns: CsvColumn<Order>[] = [
    { header: "No. Pedido", accessor: (o) => `#${o.orderNumber}` },
    {
      header: "Fecha",
      accessor: (o) => {
        try {
          return new Date(o.createdAt).toLocaleDateString("es-CO")
        } catch {
          return o.createdAt
        }
      },
    },
    {
      header: "Hora",
      accessor: (o) => {
        try {
          return new Date(o.createdAt).toLocaleTimeString("es-CO")
        } catch {
          return ""
        }
      },
    },
    { header: "Cliente", accessor: (o) => o.customer?.nombre || "Anónimo" },
    { header: "Teléfono", accessor: (o) => o.customer?.telefono || "" },
    { header: "Dirección", accessor: (o) => o.customer?.direccion || "" },
    { header: "Barrio", accessor: (o) => o.customer?.barrio || "" },
    {
      header: "Productos Detalle",
      accessor: (o) =>
        (o.items || [])
          .map(
            (i) =>
              `${i.cantidad}x ${i.name}${
                i.adiciones?.length
                  ? ` (+${i.adiciones.map((a) => a.name).join(", ")})`
                  : ""
              }${i.observacion ? ` [${i.observacion}]` : ""}`
          )
          .join(" | "),
    },
    { header: "Subtotal ($)", accessor: (o) => o.total || 0 },
    { header: "Costo Domicilio ($)", accessor: (o) => o.deliveryFee || 0 },
    { header: "Total Cobrado ($)", accessor: (o) => o.finalTotal || 0 },
    { header: "Método de Pago", accessor: (o) => o.metodo || "Efectivo" },
    { header: "Estado", accessor: (o) => o.status },
    { header: "Observaciones", accessor: (o) => o.comentario || "" },
  ]

  return buildCsvString(orders, columns)
}

/**
 * Generates an RFC-4180 CSV string for customers.
 */
export function generateCustomersCsv(customers: Customer[]): string {
  const columns: CsvColumn<Customer>[] = [
    { header: "Nombre", accessor: (c) => c.nombre },
    { header: "Teléfono", accessor: (c) => c.telefono },
    { header: "Dirección", accessor: (c) => c.direccion },
    { header: "Barrio", accessor: (c) => c.barrio },
    { header: "Total Pedidos", accessor: (c) => c.totalOrders || 0 },
    { header: "Gasto Total ($)", accessor: (c) => c.totalSpent || 0 },
    { header: "Nivel Fidelización", accessor: (c) => (c.loyaltyTier || "bronze").toUpperCase() },
    {
      header: "Último Pedido",
      accessor: (c) => {
        if (!c.lastOrderDate) return "Sin registro"
        try {
          return new Date(c.lastOrderDate).toLocaleDateString("es-CO")
        } catch {
          return c.lastOrderDate
        }
      },
    },
    { header: "Notas Internas", accessor: (c) => c.notes || "" },
  ]

  return buildCsvString(customers, columns)
}

/**
 * Generates an RFC-4180 CSV string for inventory stock and valuation.
 */
export function generateInventoryCsv(
  inventory: InventoryItem[],
  suppliers: Supplier[] = []
): string {
  const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]))

  const columns: CsvColumn<InventoryItem>[] = [
    { header: "Insumo / Producto", accessor: (i) => i.name },
    { header: "Categoría", accessor: (i) => i.category },
    { header: "Stock Actual", accessor: (i) => i.currentStock },
    { header: "Unidad", accessor: (i) => i.unit },
    { header: "Alerta Mínima", accessor: (i) => i.minStockAlert },
    {
      header: "Estado Alerta",
      accessor: (i) => (i.currentStock <= i.minStockAlert ? "ALERTA BAJO STOCK" : "OK"),
    },
    { header: "Costo Unitario ($)", accessor: (i) => i.costPerUnit },
    {
      header: "Valuación Total ($)",
      accessor: (i) => (i.currentStock || 0) * (i.costPerUnit || 0),
    },
    {
      header: "Proveedor",
      accessor: (i) => (i.supplierId ? supplierMap.get(i.supplierId) || "N/A" : "N/A"),
    },
    {
      header: "Último Reabastecimiento",
      accessor: (i) => {
        if (!i.lastRestockedAt) return "Sin registro"
        try {
          return new Date(i.lastRestockedAt).toLocaleDateString("es-CO")
        } catch {
          return i.lastRestockedAt
        }
      },
    },
  ]

  return buildCsvString(inventory, columns)
}
