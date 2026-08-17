import { afterEach, describe, expect, it, vi } from "vitest"
import { LocalStorageRepository, STORAGE_KEY, STORAGE_VERSION } from "./storage"
import { DEFAULT_CONFIG, initialModifiers, initialProducts } from "../data/data"
import type { Order, Product } from "./domain"

function makePayload(
  partial: Partial<Omit<Order, "id" | "status" | "createdAt">> = {}
): Omit<Order, "id" | "status" | "createdAt"> {
  return {
    items: [],
    customer: {
      nombre: "Ana",
      telefono: "3001234567",
      direccion: "Calle 1",
      barrio: "Centro",
    },
    metodo: "Efectivo",
    total: 0,
    ...partial,
  }
}

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe("LocalStorageRepository seed", () => {
  it("seeds default config, menu and modifiers when storage is empty", () => {
    const repo = new LocalStorageRepository(localStorage)

    expect(repo.getConfig()).toEqual(DEFAULT_CONFIG)
    expect(repo.listProducts()).toEqual(initialProducts)
    expect(repo.listModifiers()).toEqual(initialModifiers)
    expect(repo.listOrders()).toEqual([])

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")
    expect(stored.version).toBe(STORAGE_VERSION)
    expect(stored.products).toHaveLength(initialProducts.length)
    expect(stored.modifiers).toHaveLength(initialModifiers.length)
  })
})

describe("LocalStorageRepository migration", () => {
  it("migrates a stale version, keeping stored data and seeding missing collections", () => {
    const customProduct: Product = { ...initialProducts[0], id: "custom-1", name: "Custom" }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 0, products: [customProduct], config: { name: "Nuevo Nombre" } })
    )

    const repo = new LocalStorageRepository(localStorage)

    expect(repo.getConfig().name).toBe("Nuevo Nombre")
    expect(repo.getConfig().whatsapp).toBe(DEFAULT_CONFIG.whatsapp)
    expect(repo.listProducts()).toEqual([customProduct])
    expect(repo.listModifiers()).toEqual(initialModifiers)
    expect(repo.listOrders()).toEqual([])

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")
    expect(stored.version).toBe(STORAGE_VERSION)
  })
})

describe("LocalStorageRepository persistence", () => {
  it("persists product, modifier and config changes across instances", () => {
    const repo = new LocalStorageRepository(localStorage)
    repo.saveProduct({ ...initialProducts[0], price: 31000 })
    repo.saveConfig({ ...DEFAULT_CONFIG, name: "Otro Nombre" })
    repo.deleteProduct("p2")

    const other = new LocalStorageRepository(localStorage)
    expect(other.listProducts().find((p) => p.id === "p1")?.price).toBe(31000)
    expect(other.listProducts().find((p) => p.id === "p2")).toBeUndefined()
    expect(other.getConfig().name).toBe("Otro Nombre")
  })

  it("persists modifier changes across instances", () => {
    const repo = new LocalStorageRepository(localStorage)
    repo.saveModifier({ ...initialModifiers[0], price: 6000 })
    repo.deleteModifier("m2")

    const other = new LocalStorageRepository(localStorage)
    expect(other.listModifiers().find((m) => m.id === "m1")?.price).toBe(6000)
    expect(other.listModifiers().find((m) => m.id === "m2")).toBeUndefined()
  })
})

describe("LocalStorageRepository saveOrder", () => {
  it("assigns a unique 6-digit id, status new, ISO createdAt and persists", () => {
    const repo = new LocalStorageRepository(localStorage)
    const saved = repo.saveOrder(makePayload({ total: 27000 }))

    expect(saved.id).toBeGreaterThanOrEqual(100000)
    expect(saved.id).toBeLessThanOrEqual(999999)
    expect(saved.status).toBe("new")
    expect(Number.isNaN(Date.parse(saved.createdAt))).toBe(false)

    const other = new LocalStorageRepository(localStorage)
    expect(other.listOrders()).toEqual([saved])
  })

  it("retries when the random id collides with an existing order id", () => {
    // Math.random 0.5 → 550000; the second save must not reuse it.
    vi.spyOn(Math, "random").mockReturnValue(0.5)
    const repo = new LocalStorageRepository(localStorage)

    const first = repo.saveOrder(makePayload())
    const second = repo.saveOrder(makePayload())

    expect(first.id).toBe(550000)
    expect(second.id).not.toBe(550000)
    expect(new Set([first.id, second.id]).size).toBe(2)
  })
})

describe("LocalStorageRepository updateOrderStatus", () => {
  it("transitions status and persists; rejects invalid transitions and unknown ids", () => {
    const repo = new LocalStorageRepository(localStorage)
    const saved = repo.saveOrder(makePayload())

    expect(repo.updateOrderStatus(saved.id, "confirmed")).toBe(true)
    expect(repo.updateOrderStatus(saved.id, "delivered")).toBe(true)
    expect(repo.updateOrderStatus(saved.id, "confirmed")).toBe(false)
    expect(repo.updateOrderStatus(999999, "confirmed")).toBe(false)

    const other = new LocalStorageRepository(localStorage)
    expect(other.listOrders()[0].status).toBe("delivered")
  })
})