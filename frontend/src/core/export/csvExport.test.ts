import { describe, it, expect } from "vitest"
import {
  formatCsvCell,
  buildCsvString,
  calculateCashCloseout,
  generateSalesCsv,
  generateCustomersCsv,
  generateInventoryCsv,
} from "./index"
import type { Order, Customer, InventoryItem } from "@/types/restaurant"

describe("CSV Export Core Engine", () => {
  describe("formatCsvCell", () => {
    it("handles null and undefined as empty quoted cell", () => {
      expect(formatCsvCell(null)).toBe('""')
      expect(formatCsvCell(undefined)).toBe('""')
    })

    it("leaves simple strings and numbers unquoted", () => {
      expect(formatCsvCell("Burger")).toBe("Burger")
      expect(formatCsvCell(12500)).toBe("12500")
    })

    it("quotes strings containing commas", () => {
      expect(formatCsvCell("Calle 10, #45-20")).toBe('"Calle 10, #45-20"')
    })

    it("escapes quotes by doubling them per RFC-4180", () => {
      expect(formatCsvCell('Burger "Especial"')).toBe('"Burger ""Especial"""')
    })

    it("quotes strings with newlines", () => {
      expect(formatCsvCell("Línea 1\nLínea 2")).toBe('"Línea 1\nLínea 2"')
    })
  })

  describe("buildCsvString", () => {
    it("prepends UTF-8 BOM and joins rows with CRLF", () => {
      const data = [{ name: "Hambúrguer", price: 25000 }]
      const columns = [
        { header: "Plato", accessor: (d: typeof data[0]) => d.name },
        { header: "Precio", accessor: (d: typeof data[0]) => d.price },
      ]

      const csv = buildCsvString(data, columns)
      expect(csv.startsWith("\uFEFF")).toBe(true)
      expect(csv).toContain("Plato,Precio\r\nHambúrguer,25000")
    })
  })
})

describe("Report Generators & Cash Closeout Math", () => {
  const mockOrders: Order[] = [
    {
      id: "ord-1",
      orderNumber: 101,
      customer: { nombre: "Carlos", telefono: "3001234567", direccion: "Calle 1", barrio: "Poblado" },
      items: [{ name: "Burger Doble", price: 28000, cantidad: 2, total: 56000 }],
      total: 56000,
      deliveryFee: 5000,
      finalTotal: 61000,
      metodo: "Efectivo",
      status: "delivered",
      createdAt: "2026-08-24T12:00:00.000Z",
      updatedAt: "2026-08-24T12:30:00.000Z",
    },
    {
      id: "ord-2",
      orderNumber: 102,
      customer: { nombre: "Ana", telefono: "3109876543", direccion: "Cra 15", barrio: "Laureles" },
      items: [{ name: "Papas", price: 12000, cantidad: 1, total: 12000 }],
      total: 12000,
      deliveryFee: 4000,
      finalTotal: 16000,
      metodo: "Transferencia",
      status: "cooking",
      createdAt: "2026-08-24T13:00:00.000Z",
      updatedAt: "2026-08-24T13:05:00.000Z",
    },
    {
      id: "ord-3",
      orderNumber: 103,
      customer: { nombre: "Pedro", telefono: "3201112233", direccion: "Trans 5", barrio: "Envigado" },
      items: [{ name: "Combo", price: 30000, cantidad: 1, total: 30000 }],
      total: 30000,
      deliveryFee: 5000,
      finalTotal: 35000,
      metodo: "Efectivo",
      status: "cancelled",
      createdAt: "2026-08-24T14:00:00.000Z",
      updatedAt: "2026-08-24T14:10:00.000Z",
    },
  ]

  describe("calculateCashCloseout", () => {
    it("correctly aggregates sales and separates cash vs transfer while excluding cancelled from revenue", () => {
      const closeout = calculateCashCloseout(mockOrders, "Hoy")

      // Total valid orders: ord-1 ($61,000) + ord-2 ($16,000) = $77,000
      expect(closeout.totalSales).toBe(77000)
      expect(closeout.totalOrdersCount).toBe(3)
      expect(closeout.deliveredOrdersCount).toBe(1)
      expect(closeout.activeOrdersCount).toBe(1)
      expect(closeout.cancelledOrdersCount).toBe(1)

      // Payment methods breakdown
      expect(closeout.cashTotal).toBe(61000)
      expect(closeout.cashOrdersCount).toBe(1)
      expect(closeout.transferTotal).toBe(16000)
      expect(closeout.transferOrdersCount).toBe(1)

      // Delivery fees & avg ticket
      expect(closeout.deliveryFeesTotal).toBe(9000) // 5000 + 4000
      expect(closeout.avgTicket).toBe(Math.round(77000 / 2)) // 38500
    })

    it("returns zero metrics when orders array is empty", () => {
      const closeout = calculateCashCloseout([], "Hoy")
      expect(closeout.totalSales).toBe(0)
      expect(closeout.totalOrdersCount).toBe(0)
      expect(closeout.avgTicket).toBe(0)
    })
  })

  describe("generateSalesCsv", () => {
    it("generates a valid CSV with correct headers and order rows", () => {
      const csv = generateSalesCsv(mockOrders)
      expect(csv.startsWith("\uFEFF")).toBe(true)
      expect(csv).toContain("No. Pedido")
      expect(csv).toContain("Cliente")
      expect(csv).toContain("Total Cobrado ($)")
      expect(csv).toContain("#101")
      expect(csv).toContain("Carlos")
      expect(csv).toContain("61000")
      expect(csv).toContain("Efectivo")
    })
  })

  describe("generateCustomersCsv", () => {
    it("generates customer CSV with loyalty tiers and spend totals", () => {
      const mockCustomers: Customer[] = [
        {
          id: "cust-1",
          nombre: "Laura Gómez",
          telefono: "3004445566",
          direccion: "Calle 50 #10-20",
          barrio: "Centro",
          totalOrders: 8,
          totalSpent: 240000,
          loyaltyTier: "vip",
          lastOrderDate: "2026-08-24T10:00:00.000Z",
          notes: "Alergia a la cebolla",
        },
      ]

      const csv = generateCustomersCsv(mockCustomers)
      expect(csv.startsWith("\uFEFF")).toBe(true)
      expect(csv).toContain("Laura Gómez")
      expect(csv).toContain("VIP")
      expect(csv).toContain("240000")
      expect(csv).toContain("Alergia a la cebolla")
    })
  })

  describe("generateInventoryCsv", () => {
    it("generates inventory CSV with stock, alerts and valuations", () => {
      const mockInventory: InventoryItem[] = [
        {
          id: "inv-1",
          name: "Pan Brioche",
          category: "ingredients",
          currentStock: 15,
          minStockAlert: 20,
          unit: "unidades",
          costPerUnit: 1200,
        },
      ]

      const csv = generateInventoryCsv(mockInventory)
      expect(csv.startsWith("\uFEFF")).toBe(true)
      expect(csv).toContain("Pan Brioche")
      expect(csv).toContain("ALERTA BAJO STOCK")
      expect(csv).toContain("18000") // 15 * 1200
    })
  })
})
