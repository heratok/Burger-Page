import { describe, it, expect } from "vitest"
import { getOrderTableLabel, getOrderLocationText, isOrderOnTable, parseLegacyTableLabel } from "./orderTable"
import type { Order } from "@/types/restaurant"

const baseOrder = (over: Partial<Order> = {}, customer: Partial<Order["customer"]> = {}): Order => ({
  id: "o1",
  orderNumber: 1,
  customer: { nombre: "Ana", telefono: "300", direccion: "Calle 1", barrio: "Centro", ...customer },
  items: [],
  total: 0,
  deliveryFee: 0,
  finalTotal: 0,
  metodo: "Efectivo",
  status: "pending",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
})

describe("parseLegacyTableLabel", () => {
  it("reads the number out of the legacy 'Salón - Mesa N' address", () => {
    expect(parseLegacyTableLabel("Salón - Mesa 8", "Cliente")).toBe("Mesa 8")
  })

  it("falls back to the legacy customer name 'Mesa N'", () => {
    expect(parseLegacyTableLabel("Salón", "Mesa 3")).toBe("Mesa 3")
  })

  it("keeps the free text of a legacy table such as 'Terraza 1'", () => {
    expect(parseLegacyTableLabel("Salón - Mesa Terraza 1", "x")).toBe("Mesa Terraza 1")
  })

  it("returns undefined for a generic salon order, a counter order and a delivery", () => {
    expect(parseLegacyTableLabel("Salón - Mesa general", "x")).toBeUndefined()
    expect(parseLegacyTableLabel("Mostrador / Para llevar", "Cliente Mostrador")).toBeUndefined()
    expect(parseLegacyTableLabel("Calle 10 # 4-20", "Pedro")).toBeUndefined()
  })
})

describe("getOrderTableLabel", () => {
  it("prefers the table label over the legacy text", () => {
    const order = baseOrder({ tableId: "tbl_1", tableLabel: "Terraza 2" }, { direccion: "Salón - Mesa 8" })
    expect(getOrderTableLabel(order)).toBe("Terraza 2")
  })

  it("keeps the label of a deleted table (no tableId)", () => {
    expect(getOrderTableLabel(baseOrder({ tableLabel: "Mesa 1" }))).toBe("Mesa 1")
  })

  it("uses the legacy address text when there is no label", () => {
    expect(getOrderTableLabel(baseOrder({}, { direccion: "Salón - Mesa 8" }))).toBe("Mesa 8")
  })

  it("is undefined for orders without a table", () => {
    expect(getOrderTableLabel(baseOrder())).toBeUndefined()
  })
})

describe("getOrderLocationText", () => {
  it("shows the salon table instead of a barrio/address pair", () => {
    const order = baseOrder({ tableLabel: "Mesa 4" }, { direccion: "Salón", barrio: "Local" })
    expect(getOrderLocationText(order)).toBe("Salón · Mesa 4")
  })

  it("keeps barrio and address for deliveries", () => {
    expect(getOrderLocationText(baseOrder())).toBe("Centro - Calle 1")
  })
})

describe("isOrderOnTable", () => {
  it("matches the order table id", () => {
    expect(isOrderOnTable(baseOrder({ tableId: "tbl_1" }), "tbl_1")).toBe(true)
    expect(isOrderOnTable(baseOrder({ tableId: "tbl_2" }), "tbl_1")).toBe(false)
    expect(isOrderOnTable(baseOrder(), "tbl_1")).toBe(false)
  })
})
