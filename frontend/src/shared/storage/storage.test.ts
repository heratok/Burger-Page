import { afterEach, describe, expect, it, vi } from "vitest"
import { LocalStorageRepository, STORAGE_KEY, STORAGE_VERSION } from "./storage"
import {
  DEFAULT_CONFIG,
  DEFAULT_PALETTE,
  DEFAULT_SUPER_ADMIN_PASSWORD,
  SEED_RESTAURANTS,
  initialModifiers,
  initialProducts,
} from "../../data/data"
import type { Modifier, Order, Product, RestaurantConfig } from "../domain/domain"

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

describe("LocalStorageRepository directory API", () => {
  function createInput(
    overrides: Partial<{ name: string; whatsapp: string; logo: string; adminPassword: string; slug: string }> = {}
  ): Parameters<LocalStorageRepository["createRestaurant"]>[0] {
    return {
      name: "Burger Page",
      whatsapp: "573022575805",
      logo: "/logo.jpg",
      adminPassword: "admin",
      palette: { ...DEFAULT_PALETTE },
      ...overrides,
    }
  }

  function singleRestaurantEnvelope(slug = "only-one", name = "Solo"): void {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        superAdminPassword: DEFAULT_SUPER_ADMIN_PASSWORD,
        restaurants: [
          {
            id: "rest-only-one",
            slug,
            config: { ...DEFAULT_CONFIG, name },
            palette: { ...DEFAULT_PALETTE },
            products: [],
            modifiers: [],
            orders: [],
          },
        ],
      })
    )
  }

  it("lists every restaurant in the envelope", () => {
    const repo = new LocalStorageRepository(localStorage)

    expect(repo.listRestaurants().map((r) => r.slug)).toEqual([
      "burger-page",
      "pizza-roma",
      "sushi-tokio",
    ])
  })

  it("gets a restaurant by slug", () => {
    const repo = new LocalStorageRepository(localStorage)

    expect(repo.getBySlug("pizza-roma")?.config.name).toBe("PIZZA ROMA")
    expect(repo.getBySlug("pizza-roma")?.palette.accent).toBe("#E63946")
  })

  it("returns undefined for an unknown slug without throwing (MT-2)", () => {
    const repo = new LocalStorageRepository(localStorage)

    expect(repo.getBySlug("unknown-restaurant")).toBeUndefined()
  })

  it("creates a restaurant with an auto-generated slug and persists it", () => {
    const repo = new LocalStorageRepository(localStorage)

    const created = repo.createRestaurant(createInput({ name: "Ñoquis Bar", adminPassword: "noquis" }))

    expect(created.id).toBe("rest-noquis-bar")
    expect(created.slug).toBe("noquis-bar")
    expect(created.config).toEqual({
      name: "Ñoquis Bar",
      whatsapp: "573022575805",
      logo: "/logo.jpg",
      accent: DEFAULT_PALETTE.accent,
      adminPassword: "noquis",
    })
    expect(created.products).toEqual([])
    expect(created.orders).toEqual([])

    const other = new LocalStorageRepository(localStorage)
    expect(other.getBySlug("noquis-bar")?.config.name).toBe("Ñoquis Bar")
  })

  it("assigns the lowest free -2/-3 suffix when the auto-slug collides (SA-2 Slug auto)", () => {
    const repo = new LocalStorageRepository(localStorage)

    const created = repo.createRestaurant(createInput({ name: "Pizza Roma" }))

    expect(created.slug).toBe("pizza-roma-2")

    const second = repo.createRestaurant(createInput({ name: "Pizza Roma" }))
    expect(second.slug).toBe("pizza-roma-3")
  })

  it("rejects a manual slug that is already taken and writes nothing (SA-2 Slug manual)", () => {
    const repo = new LocalStorageRepository(localStorage)

    expect(() => repo.createRestaurant(createInput({ name: "Roma Clon", slug: "pizza-roma" }))).toThrow()

    const other = new LocalStorageRepository(localStorage)
    expect(other.listRestaurants()).toHaveLength(SEED_RESTAURANTS.length)
  })

  it("deletes a restaurant with all its data and frees the slug (SA-3)", () => {
    const repo = new LocalStorageRepository(localStorage)

    expect(repo.deleteRestaurant("rest-pizza-roma")).toBe(true)

    const other = new LocalStorageRepository(localStorage)
    expect(other.getBySlug("pizza-roma")).toBeUndefined()
    expect(other.listRestaurants().map((r) => r.slug)).toEqual(["burger-page", "sushi-tokio"])

    const recreated = other.createRestaurant(createInput({ name: "Pizza Roma" }))
    expect(recreated.slug).toBe("pizza-roma")
  })

  it("refuses to delete the last restaurant and returns false (SA-3 Last)", () => {
    singleRestaurantEnvelope()
    const repo = new LocalStorageRepository(localStorage)

    expect(repo.deleteRestaurant("rest-only-one")).toBe(false)

    const other = new LocalStorageRepository(localStorage)
    expect(other.listRestaurants()).toHaveLength(1)
    expect(other.getBySlug("only-one")).toBeDefined()
  })

  it("returns false for an unknown restaurant id on delete", () => {
    const repo = new LocalStorageRepository(localStorage)

    expect(repo.deleteRestaurant("rest-ghost")).toBe(false)
    expect(repo.listRestaurants()).toHaveLength(SEED_RESTAURANTS.length)
  })

  it("updates config fields and palette but keeps the slug on rename (SA-2 Rename)", () => {
    const repo = new LocalStorageRepository(localStorage)

    repo.updateRestaurant("rest-pizza-roma", {
      name: "Pizza Roma Centro",
      palette: { accent: "#C1121F", primary: "#C1121F", background: "#0F1112", surface: "#181A1B" },
    })

    const updated = repo.getBySlug("pizza-roma")
    expect(updated?.config.name).toBe("Pizza Roma Centro")
    expect(updated?.slug).toBe("pizza-roma")
    expect(updated?.palette.accent).toBe("#C1121F")
    // D1 invariant: config.accent follows palette.accent.
    expect(updated?.config.accent).toBe("#C1121F")
    expect(updated?.config.whatsapp).toBe("573001234567")
  })

  it("isolates scoped views per restaurant (MT-2 Isolation)", () => {
    const pizza = new LocalStorageRepository(localStorage, "rest-pizza-roma")
    const burger = new LocalStorageRepository(localStorage, "rest-burger-page")

    pizza.saveOrder(makePayload({ total: 45000 }))

    expect(pizza.listOrders()).toHaveLength(1)
    expect(burger.listOrders()).toEqual([])

    const scopedPizza = new LocalStorageRepository(localStorage).getRepositoryFor("rest-pizza-roma")
    expect(scopedPizza.listOrders()).toHaveLength(1)
    expect(scopedPizza.getConfig().name).toBe("PIZZA ROMA")
  })

  it("keeps scoped data intact after the envelope reloads (MT-2 Reload)", () => {
    const scoped = new LocalStorageRepository(localStorage, "rest-sushi-tokio")
    scoped.saveProduct({ ...initialProducts[0], id: "sushi-own", name: "Roll de la casa", price: 30000 })
    scoped.saveConfig({ ...scoped.getConfig(), whatsapp: "573119999999" })

    const reloaded = new LocalStorageRepository(localStorage, "rest-sushi-tokio")
    expect(reloaded.listProducts().map((p) => p.id)).toContain("sushi-own")
    expect(reloaded.getConfig().whatsapp).toBe("573119999999")

    const burger = new LocalStorageRepository(localStorage, "rest-burger-page")
    expect(burger.listProducts().map((p) => p.id)).not.toContain("sushi-own")
  })

  it("reads and updates the super admin password (SA-4)", () => {
    const repo = new LocalStorageRepository(localStorage)

    expect(repo.getSuperAdminPassword()).toBe(DEFAULT_SUPER_ADMIN_PASSWORD)

    repo.setSuperAdminPassword("nueva-clave")

    const other = new LocalStorageRepository(localStorage)
    expect(other.getSuperAdminPassword()).toBe("nueva-clave")
  })
})