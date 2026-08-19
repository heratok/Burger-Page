import { describe, expect, it } from "vitest"
import {
  RESERVED_SLUGS,
  ensureUniqueSlug,
  isSlugTaken,
  slugify,
} from "./slug"

describe("slugify", () => {
  it("transliterates non-ASCII Spanish characters (SA-2 Non-ASCII)", () => {
    expect(slugify("Ñoquis Bar")).toBe("noquis-bar")
  })

  it("lowercases and converts spaces to dashes", () => {
    expect(slugify("Pizza Roma")).toBe("pizza-roma")
  })

  it("strips accents and other diacritics", () => {
    expect(slugify("Café del Ángel")).toBe("cafe-del-angel")
    expect(slugify("Über Sushi")).toBe("uber-sushi")
  })

  it("removes punctuation and replaces it with a dash", () => {
    expect(slugify("Sushi Tokio!")).toBe("sushi-tokio")
    expect(slugify("La & Mega")).toBe("la-mega")
  })

  it("collapses repeated separators and trims leading/trailing dashes", () => {
    expect(slugify("  La   Mega   Burger  ")).toBe("la-mega-burger")
    expect(slugify("-Hamburguesa-")).toBe("hamburguesa")
  })

  it("keeps digits and single-letter separators URL-safe", () => {
    expect(slugify("Burger 2x1")).toBe("burger-2x1")
    expect(slugify("Über ñoquis")).toMatch(/^[a-z0-9-]+$/)
  })

  it("returns an empty string for input with no slug-safe characters", () => {
    expect(slugify("!!!")).toBe("")
  })
})

describe("ensureUniqueSlug", () => {
  it("returns the slug unchanged when it is free", () => {
    expect(ensureUniqueSlug("pizza-roma", ["burger-page", "sushi-tokio"])).toBe(
      "pizza-roma"
    )
  })

  it("appends -2 when the slug is taken (SA-2 Slug auto)", () => {
    expect(ensureUniqueSlug("pizza-roma", ["pizza-roma"])).toBe("pizza-roma-2")
  })

  it("increments the suffix past every collision", () => {
    expect(
      ensureUniqueSlug("pizza-roma", ["pizza-roma", "pizza-roma-2", "pizza-roma-3"])
    ).toBe("pizza-roma-4")
  })

  it("does not skip numbers already used by other slugs", () => {
    expect(ensureUniqueSlug("pizza-roma", ["pizza-roma", "pizza-roma-3"])).toBe(
      "pizza-roma-2"
    )
  })
})

describe("isSlugTaken", () => {
  it("reports a manual slug that already exists (SA-2 Slug manual)", () => {
    expect(isSlugTaken("pizza-roma", ["pizza-roma"])).toBe(true)
  })

  it("accepts a manual slug that is free", () => {
    expect(isSlugTaken("pizza-roma", ["burger-page"])).toBe(false)
  })
})

describe("RESERVED_SLUGS (direct /:slug routes must never collide)", () => {
  it("reserves every current app route segment and legacy prefix", () => {
    expect(RESERVED_SLUGS).toEqual(
      expect.arrayContaining([
        "r",
        "admin",
        "restaurants",
        "products",
        "orders",
        "sales",
        "config",
        "password",
        "new",
        "edit",
        "login",
        "contacto",
        "cart",
        "form",
        "settings",
        "pedido",
        "perfil",
        "api",
        "assets",
      ])
    )
  })

  it("treats a reserved slug as taken even when no restaurant uses it", () => {
    expect(isSlugTaken("admin", [])).toBe(true)
    expect(isSlugTaken("config", [])).toBe(true)
    expect(isSlugTaken("pizza-roma", [])).toBe(false)
  })

  it("suffixes an auto slug that collides with a reserved slug", () => {
    expect(ensureUniqueSlug("admin", [])).toBe("admin-2")
    expect(ensureUniqueSlug("r", [])).toBe("r-2")
  })

  it("increments past both reserved and existing collisions", () => {
    expect(ensureUniqueSlug("config", ["config-2"])).toBe("config-3")
    expect(ensureUniqueSlug("admin", ["admin", "admin-2"])).toBe("admin-3")
  })

  it("never returns a reserved slug from ensureUniqueSlug", () => {
    for (const reserved of RESERVED_SLUGS) {
      expect(RESERVED_SLUGS).not.toContain(ensureUniqueSlug(reserved, []))
    }
  })
})