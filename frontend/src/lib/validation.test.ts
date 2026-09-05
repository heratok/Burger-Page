import { describe, expect, it } from "vitest"
import {
  formSchema,
  LIMITS,
  ADMIN_LIMITS,
  adminAuthSchema,
  createRestaurantSchema,
  productSchema,
  supplierSchema,
} from "./validation"

const baseValues = {
  nombre: "Juan Pérez",
  telefono: "3001234567",
  dir: "Calle 123 #45-67",
  barrio: "Centro",
  metodo: "Efectivo" as const,
}

function result(field: keyof typeof baseValues, value: string) {
  return formSchema.safeParse({ ...baseValues, [field]: value })
}

describe("formSchema — límites de longitud storefront", () => {
  describe("nombre", () => {
    it("acepta un nombre válido", () => {
      expect(result("nombre", "Ana").success).toBe(true)
    })

    it("rechaza nombres menores al mínimo", () => {
      const r = result("nombre", "A")
      expect(r.success).toBe(false)
      expect(r.error?.issues[0].message).toContain(`mín. ${LIMITS.nombre.min}`)
    })

    it("rechaza nombres mayores al máximo", () => {
      const r = result("nombre", "x".repeat(LIMITS.nombre.max + 1))
      expect(r.success).toBe(false)
      expect(r.error?.issues[0].message).toContain(`máx. ${LIMITS.nombre.max}`)
    })

    it("acepta exactamente el máximo", () => {
      expect(result("nombre", "x".repeat(LIMITS.nombre.max)).success).toBe(true)
    })
  })

  describe("telefono", () => {
    it("acepta un celular válido y conserva solo dígitos", () => {
      const r = result("telefono", "+57 300 123 4567")
      expect(r.success).toBe(true)
      expect(r.data?.telefono).toBe("573001234567")
    })

    it("rechaza menos del mínimo de dígitos", () => {
      const r = result("telefono", "12345")
      expect(r.success).toBe(false)
      expect(r.error?.issues[0].message).toContain(`mín. ${LIMITS.telefono.min}`)
    })

    it("rechaza más del máximo de dígitos", () => {
      const r = result("telefono", "3".repeat(LIMITS.telefono.max + 1))
      expect(r.success).toBe(false)
      expect(r.error?.issues[0].message).toContain(`máx. ${LIMITS.telefono.max}`)
    })
  })

  describe("dir", () => {
    it("rechaza dirección vacía", () => {
      expect(result("dir", "   ").success).toBe(false)
    })

    it("rechaza dirección mayor al máximo", () => {
      const r = result("dir", "x".repeat(LIMITS.dir.max + 1))
      expect(r.success).toBe(false)
      expect(r.error?.issues[0].message).toContain(`máx. ${LIMITS.dir.max}`)
    })
  })

  describe("barrio", () => {
    it("rechaza barrio vacío", () => {
      expect(result("barrio", "").success).toBe(false)
    })

    it("rechaza barrio mayor al máximo", () => {
      const r = result("barrio", "x".repeat(LIMITS.barrio.max + 1))
      expect(r.success).toBe(false)
      expect(r.error?.issues[0].message).toContain(`máx. ${LIMITS.barrio.max}`)
    })
  })
})

describe("formSchema — campos opcionales", () => {
  it("permite omitir pagoCon y mensaje", () => {
    const r = formSchema.safeParse(baseValues)
    expect(r.success).toBe(true)
    expect(r.data?.pagoCon).toBeUndefined()
    expect(r.data?.mensaje).toBeUndefined()
  })

  it("acepta pagoCon de hasta 9 dígitos", () => {
    const r = formSchema.safeParse({ ...baseValues, pagoCon: "1000000" })
    expect(r.success).toBe(true)
  })

  it("rechaza pagoCon con más de 9 dígitos", () => {
    const r = formSchema.safeParse({ ...baseValues, pagoCon: "1".repeat(LIMITS.pagoCon.max + 1) })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toContain(`Máximo ${LIMITS.pagoCon.max} dígitos`)
  })

  it("rechaza pagoCon con caracteres no numéricos", () => {
    const r = formSchema.safeParse({ ...baseValues, pagoCon: "abc123" })
    expect(r.success).toBe(false)
  })

  it("rechaza mensaje mayor al máximo", () => {
    const r = formSchema.safeParse({ ...baseValues, mensaje: "x".repeat(LIMITS.mensaje.max + 1) })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toContain(`máx. ${LIMITS.mensaje.max}`)
  })

  it("acepta mensaje exactamente del máximo", () => {
    const r = formSchema.safeParse({ ...baseValues, mensaje: "x".repeat(LIMITS.mensaje.max) })
    expect(r.success).toBe(true)
  })

  it("rechaza un método de pago inválido", () => {
    const r = formSchema.safeParse({ ...baseValues, metodo: "Bitcoin" })
    expect(r.success).toBe(false)
  })
})

describe("Admin Validation Schemas (TDD)", () => {
  describe("adminAuthSchema", () => {
    it("valida credenciales válidas", () => {
      const r = adminAuthSchema.safeParse({ username: "superadmin", password: "password123" })
      expect(r.success).toBe(true)
    })

    it("rechaza username muy corto o password muy corto", () => {
      expect(adminAuthSchema.safeParse({ username: "ab", password: "123" }).success).toBe(false)
    })

    it("rechaza username o password que exceden el límite máximo", () => {
      const longUser = "u".repeat(ADMIN_LIMITS.auth.username.max + 1)
      const longPass = "p".repeat(ADMIN_LIMITS.auth.password.max + 1)
      expect(adminAuthSchema.safeParse({ username: longUser, password: "valid" }).success).toBe(false)
      expect(adminAuthSchema.safeParse({ username: "valid", password: longPass }).success).toBe(false)
    })
  })

  describe("createRestaurantSchema", () => {
    it("valida creación de restaurante con slug y credenciales de admin", () => {
      const valid = {
        name: "Burger Craft",
        slug: "burger-craft",
        adminUsername: "admin_craft",
        adminPassword: "password123",
        deliveryFee: 5000,
        minOrderAmount: 20000,
      }
      expect(createRestaurantSchema.safeParse(valid).success).toBe(true)
    })

    it("rechaza slugs con caracteres especiales o mayúsculas", () => {
      const invalid = {
        name: "Burger Craft",
        slug: "Burger Craft @ 123",
        adminUsername: "admin_craft",
        adminPassword: "password123",
      }
      const r = createRestaurantSchema.safeParse(invalid)
      expect(r.success).toBe(false)
      expect(r.error?.issues[0].message).toContain("letras minúsculas, números y guiones")
    })
  })

  describe("productSchema", () => {
    it("valida un producto con datos correctos", () => {
      const valid = {
        name: "Hamburguesa Doble",
        price: 25000,
        description: "Doble carne 150g con queso cheddar",
        category: "Hamburguesas",
        preparationTimeMinutes: 15,
      }
      expect(productSchema.safeParse(valid).success).toBe(true)
    })

    it("rechaza precios negativos o menores a $100", () => {
      const invalid = {
        name: "Hamburguesa Doble",
        price: 0,
        category: "Hamburguesas",
      }
      expect(productSchema.safeParse(invalid).success).toBe(false)
    })
  })

  describe("supplierSchema", () => {
    it("valida proveedor con campos opcionales correctos", () => {
      const valid = {
        name: "Distribuidora Carnes SAS",
        contactName: "Carlos Gómez",
        phone: "3001234567",
        email: "carlos@carnes.com",
        notes: "Entregas los martes a las 8am",
      }
      expect(supplierSchema.safeParse(valid).success).toBe(true)
    })
  })
})
