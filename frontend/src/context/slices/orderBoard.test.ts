import { describe, expect, it } from "vitest"
import { mapBackendOrderToDomain } from "./orderBoard"
import type { Order } from "@/types/restaurant"

const baseBackendOrder = {
  id: "ord-1",
  orderNumber: 1001,
  status: "pending",
  subtotal: 25000,
  deliveryFee: 0,
  finalTotal: 25000,
  paymentMethod: "Efectivo",
  items: [],
  customer: { name: "Ana", phone: "3001234567", address: "", barrio: "" },
  createdAt: "2026-11-15T00:00:00.000Z",
  updatedAt: "2026-11-15T00:00:00.000Z",
}

const baseExistingOrder: Order = {
  id: "ord-1",
  orderNumber: 1001,
  status: "pending",
  total: 25000,
  deliveryFee: 0,
  finalTotal: 25000,
  metodo: "Efectivo",
  items: [],
  customer: { nombre: "Ana", telefono: "3001234567", direccion: "", barrio: "" },
  createdAt: "2026-11-15T00:00:00.000Z",
  updatedAt: "2026-11-15T00:00:00.000Z",
}

describe("mapBackendOrderToDomain — orderType", () => {
  it("preserves orderType 'recoger' from backend order", () => {
    const mapped = mapBackendOrderToDomain({ ...baseBackendOrder, orderType: "recoger" })
    expect(mapped.orderType).toBe("recoger")
  })

  it("preserves orderType 'domicilio' from backend order", () => {
    const mapped = mapBackendOrderToDomain({ ...baseBackendOrder, orderType: "domicilio" })
    expect(mapped.orderType).toBe("domicilio")
  })

  it("falls back to existing.orderType when absent on backend payload", () => {
    const mapped = mapBackendOrderToDomain(baseBackendOrder, {
      ...baseExistingOrder,
      orderType: "recoger",
    })
    expect(mapped.orderType).toBe("recoger")
  })

  it("omits orderType when neither backend payload nor existing order has it", () => {
    const mapped = mapBackendOrderToDomain(baseBackendOrder, baseExistingOrder)
    expect("orderType" in mapped).toBe(false)
    expect(mapped.orderType).toBeUndefined()
  })
})
