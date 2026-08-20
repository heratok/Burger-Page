import { describe, expect, it, beforeEach } from "vitest"
import {
  CART_DRAFT_KEY,
  CART_DRAFT_VERSION,
  readDraft,
  writeDraft,
  clearDraft,
} from "./draft"
import type { BurgerCompra } from "@/data/data"

const burger: BurgerCompra = {
  adicion: [
    { name: "Queso extra", price: 2000, cantidad: 1, src: "https://img/queso" },
  ],
  name: "Misisipi",
  src: "https://img/misisipi",
  totalapagar: 29000,
  cantidad: 1,
  observacion: "sin cebolla",
}

function storedRaw(): string | null {
  return window.localStorage.getItem(CART_DRAFT_KEY)
}

describe("draft — round trip", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("persiste los items y readDraft los devuelve iguales", () => {
    writeDraft([burger])
    expect(readDraft()).toEqual([burger])
  })

  it("devuelve null cuando no hay draft guardado", () => {
    expect(readDraft()).toBeNull()
  })

  it("conserva adiciones, observación y cantidad en el rehidratado", () => {
    writeDraft([burger])
    const restored = readDraft()
    expect(restored?.[0].adicion[0].name).toBe("Queso extra")
    expect(restored?.[0].observacion).toBe("sin cebolla")
    expect(restored?.[0].cantidad).toBe(1)
  })
})

describe("draft — payload seguro (CART-4)", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("no persiste campos de cliente (nombre, teléfono, dirección, barrio)", () => {
    writeDraft([burger])
    const raw = storedRaw()
    expect(raw).not.toContain("nombre")
    expect(raw).not.toContain("telefono")
    expect(raw).not.toContain("dir")
    expect(raw).not.toContain("barrio")
  })

  it("guarda la clave de versión y los items", () => {
    writeDraft([burger])
    const parsed = JSON.parse(storedRaw() ?? "{}")
    expect(parsed.version).toBe(CART_DRAFT_VERSION)
    expect(parsed.items).toEqual([burger])
  })
})

describe("draft — descarte seguro (CART-2)", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("devuelve null ante JSON corrupto sin lanzar", () => {
    window.localStorage.setItem(CART_DRAFT_KEY, "{no-es-json")
    expect(readDraft()).toBeNull()
  })

  it("devuelve null ante un payload que falla el schema", () => {
    window.localStorage.setItem(
      CART_DRAFT_KEY,
      JSON.stringify({ version: CART_DRAFT_VERSION, items: [{ mal: true }] })
    )
    expect(readDraft()).toBeNull()
  })

  it("devuelve null ante una versión distinta a la esperada", () => {
    window.localStorage.setItem(
      CART_DRAFT_KEY,
      JSON.stringify({ version: 999, items: [burger] })
    )
    expect(readDraft()).toBeNull()
  })
})

describe("draft — limpieza (CART-1)", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("writeDraft con lista vacía elimina el draft para no restaurar residuos", () => {
    writeDraft([burger])
    expect(readDraft()).toEqual([burger])
    writeDraft([])
    expect(storedRaw()).toBeNull()
    expect(readDraft()).toBeNull()
  })

  it("clearDraft elimina el draft guardado", () => {
    writeDraft([burger])
    clearDraft()
    expect(storedRaw()).toBeNull()
    expect(readDraft()).toBeNull()
  })
})
