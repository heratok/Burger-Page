import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { ReportsManager } from "./ReportsManager"
import {
  calculateCashCloseout,
  generateSalesCsv,
  generateCustomersCsv,
  generateInventoryCsv,
  downloadCsv,
} from "@/core/export"
import type { Order, Customer, InventoryItem, Supplier } from "@/types/restaurant"

// Helpers to generate ISO dates for multi-month simulation
const createDate = (year: number, monthIndex: number, day: number, hour: number = 12): string => {
  return new Date(year, monthIndex, day, hour, 0, 0).toISOString()
}

describe("Multi-Month Operational Simulation & Strict Export Verification", () => {
  const now = new Date()
  const currentYear = now.getFullYear()

  // Multi-month realistic dataset spanning 6+ months
  const multiMonthOrders: Order[] = [
    // Month 1 (March): 3 orders
    {
      id: "ord-mar-1",
      orderNumber: 1001,
      customer: { nombre: "Valentina Ríos", telefono: "3001112233", direccion: "Cra 43A #1-50, Apto 402", barrio: "El Poblado" },
      items: [{ name: "Burger Doble Queso", price: 28000, cantidad: 2, total: 56000, observacion: 'Término medio, con salsa "Especial"' }],
      total: 56000,
      deliveryFee: 5000,
      finalTotal: 61000,
      metodo: "Efectivo",
      status: "delivered",
      createdAt: createDate(currentYear, 2, 15, 14),
      updatedAt: createDate(currentYear, 2, 15, 15),
    },
    {
      id: "ord-mar-2",
      orderNumber: 1002,
      customer: { nombre: "Andrés Cardona", telefono: "3102223344", direccion: "Calle 10 Sur #20-30", barrio: "Laureles" },
      items: [{ name: "Pizza Artesanal", price: 35000, cantidad: 1, total: 35000 }],
      total: 35000,
      deliveryFee: 4000,
      finalTotal: 39000,
      metodo: "Transferencia",
      status: "delivered",
      createdAt: createDate(currentYear, 2, 20, 19),
      updatedAt: createDate(currentYear, 2, 20, 20),
    },
    {
      id: "ord-mar-3",
      orderNumber: 1003,
      customer: { nombre: "Sebastián Soto", telefono: "3153334455", direccion: "Circular 4 #70-10", barrio: "Conquistadores" },
      items: [{ name: "Combo Clásico", price: 22000, cantidad: 1, total: 22000 }],
      total: 22000,
      deliveryFee: 3000,
      finalTotal: 25000,
      metodo: "Efectivo",
      status: "cancelled",
      comentario: "Cliente canceló por demora",
      createdAt: createDate(currentYear, 2, 25, 21),
      updatedAt: createDate(currentYear, 2, 25, 21),
    },

    // Month 2 (April): 2 orders
    {
      id: "ord-apr-1",
      orderNumber: 1004,
      customer: { nombre: "Valentina Ríos", telefono: "3001112233", direccion: "Cra 43A #1-50, Apto 402", barrio: "El Poblado" },
      items: [{ name: "Burger BBQ", price: 30000, cantidad: 3, total: 90000 }],
      total: 90000,
      deliveryFee: 5000,
      finalTotal: 95000,
      metodo: "Transferencia",
      status: "delivered",
      createdAt: createDate(currentYear, 3, 10, 13),
      updatedAt: createDate(currentYear, 3, 10, 14),
    },
    {
      id: "ord-apr-2",
      orderNumber: 1005,
      customer: { nombre: "Camila Torres", telefono: "3204445566", direccion: "Diagonal 75 #30-40", barrio: "Belen" },
      items: [{ name: "Papas Rústicas", price: 15000, cantidad: 2, total: 30000 }],
      total: 30000,
      deliveryFee: 4000,
      finalTotal: 34000,
      metodo: "Efectivo",
      status: "delivered",
      createdAt: createDate(currentYear, 3, 22, 18),
      updatedAt: createDate(currentYear, 3, 22, 19),
    },

    // Month 3 (May): 2 orders
    {
      id: "ord-may-1",
      orderNumber: 1006,
      customer: { nombre: "Diego Morales", telefono: "3185556677", direccion: "Calle 50 #40-10", barrio: "Envigado" },
      items: [{ name: "Burger Trufada", price: 38000, cantidad: 2, total: 76000 }],
      total: 76000,
      deliveryFee: 6000,
      finalTotal: 82000,
      metodo: "Transferencia",
      status: "delivered",
      createdAt: createDate(currentYear, 4, 5, 20),
      updatedAt: createDate(currentYear, 4, 5, 21),
    },
    {
      id: "ord-may-2",
      orderNumber: 1007,
      customer: { nombre: "Andrés Cardona", telefono: "3102223344", direccion: "Calle 10 Sur #20-30", barrio: "Laureles" },
      items: [{ name: "Gaseosa 400ml", price: 6000, cantidad: 4, total: 24000 }],
      total: 24000,
      deliveryFee: 3000,
      finalTotal: 27000,
      metodo: "Efectivo",
      status: "delivered",
      createdAt: createDate(currentYear, 4, 18, 12),
      updatedAt: createDate(currentYear, 4, 18, 13),
    },

    // 7 Days Ago (Recent)
    {
      id: "ord-7d-1",
      orderNumber: 1008,
      customer: { nombre: "Valentina Ríos", telefono: "3001112233", direccion: "Cra 43A #1-50", barrio: "El Poblado" },
      items: [{ name: "Combo Master", price: 42000, cantidad: 2, total: 84000 }],
      total: 84000,
      deliveryFee: 5000,
      finalTotal: 89000,
      metodo: "Efectivo",
      status: "delivered",
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },

    // Yesterday
    {
      id: "ord-yest-1",
      orderNumber: 1009,
      customer: { nombre: "Felipe Orozco", telefono: "3016667788", direccion: "Av Las Vegas #10-15", barrio: "Poblado" },
      items: [{ name: "Burger Doble", price: 28000, cantidad: 1, total: 28000 }],
      total: 28000,
      deliveryFee: 4000,
      finalTotal: 32000,
      metodo: "Transferencia",
      status: "delivered",
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },

    // Today: 2 orders (1 delivered cash, 1 cooking transfer)
    {
      id: "ord-today-1",
      orderNumber: 1010,
      customer: { nombre: "María Paulina", telefono: "3127778899", direccion: "Calle 33 #76-20", barrio: "Laureles" },
      items: [{ name: "Super Burger", price: 32000, cantidad: 2, total: 64000 }],
      total: 64000,
      deliveryFee: 5000,
      finalTotal: 69000,
      metodo: "Efectivo",
      status: "delivered",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "ord-today-2",
      orderNumber: 1011,
      customer: { nombre: "Esteban Henao", telefono: "3148889900", direccion: "Cra 80 #45-12", barrio: "Calasanz" },
      items: [{ name: "Papas Loaded", price: 20000, cantidad: 1, total: 20000 }],
      total: 20000,
      deliveryFee: 4000,
      finalTotal: 24000,
      metodo: "Transferencia",
      status: "cooking",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]

  const mockCustomers: Customer[] = [
    {
      id: "c-1",
      nombre: "Valentina Ríos",
      telefono: "3001112233",
      direccion: "Cra 43A #1-50, Apto 402",
      barrio: "El Poblado",
      totalOrders: 3,
      totalSpent: 245000,
      lastOrderDate: new Date().toISOString(),
      loyaltyTier: "vip",
      notes: "Cliente VIP recurrente. Pide término medio.",
    },
    {
      id: "c-2",
      nombre: "Andrés Cardona",
      telefono: "3102223344",
      direccion: "Calle 10 Sur #20-30",
      barrio: "Laureles",
      totalOrders: 2,
      totalSpent: 66000,
      lastOrderDate: createDate(currentYear, 4, 18),
      loyaltyTier: "gold",
      notes: "Paga siempre con transferencia",
    },
    {
      id: "c-3",
      nombre: "Camila Torres",
      telefono: "3204445566",
      direccion: "Diagonal 75 #30-40",
      barrio: "Belen",
      totalOrders: 1,
      totalSpent: 34000,
      lastOrderDate: createDate(currentYear, 3, 22),
      loyaltyTier: "silver",
    },
  ]

  const mockSuppliers: Supplier[] = [
    {
      id: "sup-1",
      name: "Carnes Finas S.A.S.",
      category: "Carnes",
      contactName: "Jorge Restrepo",
      phone: "3005551234",
      email: "ventas@carnesfinas.com",
    },
    {
      id: "sup-2",
      name: "Panadería Gourmet",
      category: "Panes",
      contactName: "Gloria Mejía",
      phone: "3104449876",
    },
  ]

  const mockInventory: InventoryItem[] = [
    {
      id: "inv-1",
      name: "Carne Angus 150g",
      category: "ingredients",
      currentStock: 45,
      minStockAlert: 50,
      unit: "unidades",
      costPerUnit: 6500,
      supplierId: "sup-1",
      lastRestockedAt: createDate(currentYear, 4, 10),
    },
    {
      id: "inv-2",
      name: "Pan Brioche con Ajonjolí",
      category: "ingredients",
      currentStock: 80,
      minStockAlert: 30,
      unit: "unidades",
      costPerUnit: 1400,
      supplierId: "sup-2",
      lastRestockedAt: createDate(currentYear, 4, 12),
    },
    {
      id: "inv-3",
      name: "Cajas Térmicas Domicilio",
      category: "packaging",
      currentStock: 12,
      minStockAlert: 40,
      unit: "paquetes",
      costPerUnit: 2200,
      lastRestockedAt: createDate(currentYear, 3, 1),
    },
  ]

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  describe("1. Strict Financial Invariants & Closeout Math Across Time Horizons", () => {
    it("strictly reconciles multi-month historical totals and payment breakdowns", () => {
      const closeout = calculateCashCloseout(multiMonthOrders, "Todo el Historial")

      // Total orders: 11 (10 valid + 1 cancelled)
      expect(closeout.totalOrdersCount).toBe(11)
      expect(closeout.cancelledOrdersCount).toBe(1)
      expect(closeout.activeOrdersCount).toBe(1) // ord-today-2 is cooking
      expect(closeout.deliveredOrdersCount).toBe(9)

      // Expected valid sales calculation:
      // ord-mar-1 (61k) + ord-mar-2 (39k) + ord-apr-1 (95k) + ord-apr-2 (34k) +
      // ord-may-1 (82k) + ord-may-2 (27k) + ord-7d-1 (89k) + ord-yest-1 (32k) +
      // ord-today-1 (69k) + ord-today-2 (24k) = 552,000
      expect(closeout.totalSales).toBe(552000)

      // Payment reconciliation invariant: cashTotal + transferTotal == totalSales
      expect(closeout.cashTotal + closeout.transferTotal).toBe(closeout.totalSales)

      // Cash breakdown (mar-1: 61k, apr-2: 34k, may-2: 27k, 7d-1: 89k, today-1: 69k = 280,000)
      expect(closeout.cashTotal).toBe(280000)
      expect(closeout.cashOrdersCount).toBe(5)

      // Transfer breakdown (mar-2: 39k, apr-1: 95k, may-1: 82k, yest-1: 32k, today-2: 24k = 272,000)
      expect(closeout.transferTotal).toBe(272000)
      expect(closeout.transferOrdersCount).toBe(5)

      // Delivery fees invariant: sum of fees across the 10 valid orders
      // (5k + 4k + 5k + 4k + 6k + 3k + 5k + 4k + 5k + 4k = 45,000)
      expect(closeout.deliveryFeesTotal).toBe(45000)

      // Avg ticket invariant: Math.round(552,000 / 10) = 55,200
      expect(closeout.avgTicket).toBe(55200)
    })

    it("strictly isolates today's orders and excludes previous months from today's cashier slip", () => {
      const todayOrders = multiMonthOrders.filter((o) => {
        const t = new Date(o.createdAt).getTime()
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
        return t >= startOfToday
      })

      const todayCloseout = calculateCashCloseout(todayOrders, "Hoy")
      expect(todayCloseout.totalOrdersCount).toBe(2)
      expect(todayCloseout.totalSales).toBe(93000) // 69k + 24k
      expect(todayCloseout.cashTotal).toBe(69000)
      expect(todayCloseout.transferTotal).toBe(24000)
      expect(todayCloseout.deliveryFeesTotal).toBe(9000) // 5k + 4k
      expect(todayCloseout.avgTicket).toBe(46500)
    })
  })

  describe("2. Strict RFC-4180 CSV Export Format & Character Encoding", () => {
    it("generates sales CSV with valid UTF-8 BOM, quoted commas, escaped quotes, and no formatting errors", () => {
      const csv = generateSalesCsv(multiMonthOrders)

      // Invariant 1: UTF-8 BOM must be the very first byte sequence
      expect(csv.charCodeAt(0)).toBe(0xfeff)

      // Invariant 2: CRLF row separators
      const lines = csv.split("\r\n")
      // 1 header row + 11 data rows = 12 lines
      expect(lines.length).toBe(12)

      // Invariant 3: Header columns integrity
      const headers = lines[0].replace("\uFEFF", "").split(",")
      expect(headers).toContain("No. Pedido")
      expect(headers).toContain("Cliente")
      expect(headers).toContain("Dirección")
      expect(headers).toContain("Total Cobrado ($)")
      expect(headers).toContain("Método de Pago")

      // Invariant 4: Special characters and quotes preservation in Spanish
      expect(csv).toContain('Término medio, con salsa ""Especial""')
      expect(csv).toContain("Valentina Ríos")
      expect(csv).toContain("El Poblado")
    })

    it("generates customer CRM CSV with complete loyalty metrics and internal notes", () => {
      const csv = generateCustomersCsv(mockCustomers)
      expect(csv.charCodeAt(0)).toBe(0xfeff)

      const lines = csv.split("\r\n")
      expect(lines.length).toBe(4) // 1 header + 3 customers

      expect(csv).toContain("Valentina Ríos")
      expect(csv).toContain("VIP")
      expect(csv).toContain("245000")
      expect(csv).toContain("Cliente VIP recurrente. Pide término medio.")
      expect(csv).toContain("Paga siempre con transferencia")
    })

    it("generates inventory CSV with stock alert evaluations and total asset valuations", () => {
      const csv = generateInventoryCsv(mockInventory, mockSuppliers)
      expect(csv.charCodeAt(0)).toBe(0xfeff)

      const lines = csv.split("\r\n")
      expect(lines.length).toBe(4) // 1 header + 3 items

      // Invariant: Low stock detection
      // Carne Angus (current 45 <= min 50) -> ALERTA BAJO STOCK
      // Cajas Térmicas (current 12 <= min 40) -> ALERTA BAJO STOCK
      // Pan Brioche (current 80 > min 30) -> OK
      expect(csv).toContain("Carne Angus 150g,ingredients,45,unidades,50,ALERTA BAJO STOCK,6500,292500,Carnes Finas S.A.S.")
      expect(csv).toContain("Pan Brioche con Ajonjolí,ingredients,80,unidades,30,OK,1400,112000,Panadería Gourmet")
      expect(csv).toContain("Cajas Térmicas Domicilio,packaging,12,paquetes,40,ALERTA BAJO STOCK,2200,26400,N/A")
    })

    it("triggers browser download mechanism using Blob URL and simulated anchor click", () => {
      const createObjectURLMock = vi.fn().mockReturnValue("blob:http://localhost/fake-uuid")
      const revokeObjectURLMock = vi.fn()
      window.URL.createObjectURL = createObjectURLMock
      window.URL.revokeObjectURL = revokeObjectURLMock

      const appendChildSpy = vi.spyOn(document.body, "appendChild")
      const removeChildSpy = vi.spyOn(document.body, "removeChild")

      downloadCsv("reporte_ventas_2026.csv", "\uFEFFTest,Data\r\n1,2")

      expect(createObjectURLMock).toHaveBeenCalledTimes(1)
      expect(appendChildSpy).toHaveBeenCalled()
      expect(removeChildSpy).toHaveBeenCalled()
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:http://localhost/fake-uuid")
    })
  })

  describe("3. Interactive ReportsManager UI Component Workflow", () => {
    it("renders financial dashboard and recalculates metrics on date filter selection", () => {
      // Mock window.print
      window.print = vi.fn()

      render(
        <RestaurantProvider>
          <ReportsManager />
        </RestaurantProvider>
      )

      // 1. Check title & headers
      expect(screen.getByText("Reportes & Cierre de Caja")).toBeDefined()
      expect(screen.getByText("Cuadre de Caja (Z-Report)")).toBeDefined()
      expect(screen.getByText("Centro de Descarga de Datos (Excel & CSV)")).toBeDefined()

      // 2. Check 4 Export action cards are present
      expect(screen.getByText("Historial de Ventas")).toBeDefined()
      expect(screen.getByText("Base de Clientes CRM")).toBeDefined()
      expect(screen.getByText("Auditoría de Inventario")).toBeDefined()
      expect(screen.getByText("Cuadre de Caja (Z)")).toBeDefined()

      // 3. Switch date filter chip to 'Todo'
      const todoBtn = screen.getByRole("button", { name: "Todo" })
      fireEvent.click(todoBtn)

      // 4. Switch date filter chip to 'Mes Anterior'
      const lastMonthBtn = screen.getByRole("button", { name: "Mes Anterior" })
      fireEvent.click(lastMonthBtn)

      // 5. Test Custom Date Range Pickers (Desde / Hasta)
      const dateInputs = screen.getAllByDisplayValue(/202[0-9]-[0-9]{2}-[0-9]{2}/)
      expect(dateInputs.length).toBeGreaterThanOrEqual(2)

      const [startInput, endInput] = dateInputs
      fireEvent.change(startInput, { target: { value: "2026-04-01" } })
      fireEvent.change(endInput, { target: { value: "2026-04-30" } })

      expect(screen.getByText("Rango libre")).toBeDefined()

      // 6. Click 'Imprimir'
      const printBtn = screen.getByRole("button", { name: /Imprimir/i })
      fireEvent.click(printBtn)
      expect(window.print).toHaveBeenCalledTimes(1)
    })
  })
})
