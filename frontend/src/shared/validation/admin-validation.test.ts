import { describe, expect, it } from "vitest"
import { ADMIN_LIMITS, modifierSchema, productSchema } from "./admin-validation"

const validProduct = {
  name: "Misisipi",
  price: "27000",
  src: "https://example.com/burger.jpg",
  description: "La clásica de la casa.",
  available: false,
}

const validModifier = {
  name: "Tocineta",
  price: "2500",
  src: "",
  available: true,
}

describe("productSchema", () => {
  it("acepta un producto válido y convierte el precio a número", () => {
    const r = productSchema.safeParse(validProduct)
    expect(r.success).toBe(true)
    expect(r.data?.price).toBe(27000)
    expect(r.data?.available).toBe(false)
  })

  it("recorta espacios del nombre", () => {
    const r = productSchema.safeParse({ ...validProduct, name: "  Misisipi  " })
    expect(r.success).toBe(true)
    expect(r.data?.name).toBe("Misisipi")
  })

  it("rechaza un nombre menor al mínimo", () => {
    const r = productSchema.safeParse({ ...validProduct, name: "X" })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toContain(
      `mín. ${ADMIN_LIMITS.productName.min}`
    )
  })

  it("rechaza un nombre mayor al máximo", () => {
    const r = productSchema.safeParse({
      ...validProduct,
      name: "x".repeat(ADMIN_LIMITS.productName.max + 1),
    })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toContain(
      `máx. ${ADMIN_LIMITS.productName.max}`
    )
  })

  it("rechaza un precio no numérico", () => {
    const r = productSchema.safeParse({ ...validProduct, price: "abc" })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toContain("precio")
  })

  it("rechaza un precio menor al mínimo", () => {
    const r = productSchema.safeParse({
      ...validProduct,
      price: String(ADMIN_LIMITS.price.min - 1),
    })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toContain(
      `mínimo es ${ADMIN_LIMITS.price.min}`
    )
  })

  it("rechaza un precio mayor al máximo", () => {
    const r = productSchema.safeParse({
      ...validProduct,
      price: String(ADMIN_LIMITS.price.max + 1),
    })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toContain(
      `máximo es ${ADMIN_LIMITS.price.max}`
    )
  })

  it("acepta un precio exactamente en el límite máximo", () => {
    const r = productSchema.safeParse({
      ...validProduct,
      price: String(ADMIN_LIMITS.price.max),
    })
    expect(r.success).toBe(true)
    expect(r.data?.price).toBe(ADMIN_LIMITS.price.max)
  })

  it("rechaza una descripción mayor al máximo", () => {
    const r = productSchema.safeParse({
      ...validProduct,
      description: "x".repeat(ADMIN_LIMITS.productDescription.max + 1),
    })
    expect(r.success).toBe(false)
  })

  it("permite omitir src y descripción", () => {
    const r = productSchema.safeParse({ name: "Extra", price: "1000" })
    expect(r.success).toBe(true)
    expect(r.data?.src).toBe("")
    expect(r.data?.description).toBe("")
  })
})

describe("modifierSchema", () => {
  it("acepta un modificador válido y convierte el precio a número", () => {
    const r = modifierSchema.safeParse(validModifier)
    expect(r.success).toBe(true)
    expect(r.data?.price).toBe(2500)
  })

  it("rechaza un nombre vacío", () => {
    const r = modifierSchema.safeParse({ ...validModifier, name: "  " })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toContain(
      `mín. ${ADMIN_LIMITS.modifierName.min}`
    )
  })

  it("rechaza un precio no numérico", () => {
    const r = modifierSchema.safeParse({ ...validModifier, price: "12a" })
    expect(r.success).toBe(false)
  })

  it("acepta un modificador sin imagen", () => {
    const r = modifierSchema.safeParse({ name: "Queso", price: "2700" })
    expect(r.success).toBe(true)
    expect(r.data?.available).toBe(true)
  })
})