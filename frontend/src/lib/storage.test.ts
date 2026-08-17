import { afterEach, describe, expect, it, vi } from "vitest"
import { LocalStorageRepository, STORAGE_KEY, STORAGE_VERSION } from "./storage"
import {
  DEFAULT_CONFIG,
  DEFAULT_PALETTE,
  DEFAULT_SUPER_ADMIN_PASSWORD,
  SEED_RESTAURANTS,
  initialModifiers,
  initialProducts,
} from "../data/data"
import type { Modifier, Order, Product, RestaurantConfig } from "./domain"

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

function readStored(): Record<string, unknown> {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Record<string, unknown>
}

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe("LocalStorageRepository seed", () => {
  it("seeds the v2 envelope with the seeded restaurants when storage is empty", () => {
    const repo = new LocalStorageRepository(localStorage)

    // The default scoped view is the first seed restaurant (burger-page).
    expect(repo.getConfig()).toEqual(DEFAULT_CONFIG)
    expect(repo.listProducts()).toEqual(initialProducts)
    expect(repo.listModifiers()).toEqual(initialModifiers)
    expect(repo.listOrders()).toEqual([])

    const stored = readStored()
    expect(stored.version).toBe(STORAGE_VERSION)
    expect(stored.superAdminPassword).toBe(DEFAULT_SUPER_ADMIN_PASSWORD)
    expect(stored.restaurants).toHaveLength(SEED_RESTAURANTS.length)
    const first = (stored.restaurants as Array<Record<string, unknown>>)[0]
    expect(first.slug).toBe("burger-page")
    expect(first.products).toHaveLength(initialProducts.length)
    expect(first.modifiers).toHaveLength(initialModifiers.length)
    expect(first.orders).toEqual([])
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

    const stored = readStored()
    expect(stored.version).toBe(STORAGE_VERSION)
    expect((stored.restaurants as Array<Record<string, unknown>>)[0].products).toEqual([
      customProduct,
    ])
  })

  it("migrates a v1 envelope into the first restaurant preserving data exactly (MT-1 Migrate)", () => {
    const v1Config: RestaurantConfig = {
      name: "Mi Hamburguesa",
      whatsapp: "573001112233",
      logo: "/custom-logo.png",
      accent: "#123456",
      adminPassword: "secreto",
    }
    const v1Products: Product[] = [
      { ...initialProducts[0], id: "vp1", name: "Vegana", price: 31000, available: true },
      { ...initialProducts[1], id: "vp2", name: "Doble", price: 34000, available: false },
    ]
    const v1Modifiers: Modifier[] = [
      { ...initialModifiers[0], id: "vm1", name: "Aguacate", price: 3000 },
    ]
    const v1Order: Order = {
      id: 123456,
      items: [],
      customer: {
        nombre: "Ana",
        telefono: "3001234567",
        direccion: "Calle 1",
        barrio: "Centro",
      },
      metodo: "Efectivo",
      total: 31000,
      status: "new",
      createdAt: "2026-08-01T10:00:00.000Z",
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        config: v1Config,
        products: v1Products,
        modifiers: v1Modifiers,
        orders: [v1Order],
      })
    )

    const repo = new LocalStorageRepository(localStorage)

    expect(repo.getConfig()).toEqual(v1Config)
    expect(repo.listProducts()).toEqual(v1Products)
    expect(repo.listModifiers()).toEqual(v1Modifiers)
    expect(repo.listOrders()).toEqual([v1Order])

    const stored = readStored()
    expect(stored.version).toBe(STORAGE_VERSION)
    const first = (stored.restaurants as Array<Record<string, unknown>>)[0]
    expect(first.slug).toBe("burger-page")
    expect(first.config).toEqual(v1Config)
    expect(first.products).toEqual(v1Products)
    expect(first.modifiers).toEqual(v1Modifiers)
    expect(first.orders).toEqual([v1Order])
    // Palette derives from config.accent plus the default background/surface.
    const palette = first.palette as Record<string, string>
    expect(palette.accent).toBe(v1Config.accent)
    expect(palette.primary).toBe(v1Config.accent)
    expect(palette.background).toBe(DEFAULT_PALETTE.background)
    expect(palette.surface).toBe(DEFAULT_PALETTE.surface)
    expect(stored.superAdminPassword).toBe(DEFAULT_SUPER_ADMIN_PASSWORD)
  })

  it("migrates v0 data through the chain without loss (MT-1 Chain)", () => {
    const v0Products: Product[] = [{ ...initialProducts[2], id: "old-1", name: "Clásica" }]
    const v0Order: Order = {
      id: 654321,
      items: [],
      customer: {
        nombre: "Luis",
        telefono: "3110000000",
        direccion: "Av 2",
        barrio: "Norte",
      },
      metodo: "Transferencia",
      total: 27000,
      status: "new",
      createdAt: "2026-08-02T12:00:00.000Z",
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ products: v0Products, orders: [v0Order] })
    )

    const repo = new LocalStorageRepository(localStorage)

    expect(repo.listProducts()).toEqual(v0Products)
    expect(repo.listOrders()).toEqual([v0Order])
    expect(repo.getConfig()).toEqual(DEFAULT_CONFIG)

    const stored = readStored()
    expect(stored.version).toBe(STORAGE_VERSION)
    const first = (stored.restaurants as Array<Record<string, unknown>>)[0]
    expect(first.products).toEqual(v0Products)
    expect(first.orders).toEqual([v0Order])
  })

  it("reseeds corrupt envelopes instead of crashing (MT-1)", () => {
    localStorage.setItem(STORAGE_KEY, "{not-json")

    const repo = new LocalStorageRepository(localStorage)

    expect(repo.getConfig()).toEqual(DEFAULT_CONFIG)
    expect(repo.listProducts()).toEqual(initialProducts)

    const stored = readStored()
    expect(stored.version).toBe(STORAGE_VERSION)
    expect(stored.restaurants).toHaveLength(SEED_RESTAURANTS.length)
  })

  it("reseeds a parseable envelope with an invalid v2 shape", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, restaurants: "oops" }))

    const repo = new LocalStorageRepository(localStorage)

    expect(repo.getConfig()).toEqual(DEFAULT_CONFIG)
    const stored = readStored()
    expect(Array.isArray(stored.restaurants)).toBe(true)
    expect(stored.restaurants).toHaveLength(SEED_RESTAURANTS.length)
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