import { afterEach, describe, expect, it } from "vitest"
import { renderHook } from "@testing-library/react"
import {
  PLATFORM_TITLE,
  resolveDocumentTitle,
  selectTitleRestaurantName,
  useDocumentTitle,
  type TitleRouteState,
} from "./useDocumentTitle"

describe("resolveDocumentTitle", () => {
  it("uses the restaurant name when present", () => {
    expect(resolveDocumentTitle("rosto")).toBe("rosto")
  })

  it("trims surrounding whitespace", () => {
    expect(resolveDocumentTitle("  La Parrilla  ")).toBe("La Parrilla")
  })

  it("falls back to the platform title when the name is missing or blank", () => {
    expect(resolveDocumentTitle(undefined)).toBe(PLATFORM_TITLE)
    expect(resolveDocumentTitle("   ")).toBe(PLATFORM_TITLE)
  })
})

describe("selectTitleRestaurantName", () => {
  const storefront: TitleRouteState = {
    activeView: "store",
    isNotFound: false,
    isResolving: false,
    sessionRole: "guest",
    adminTab: "dashboard",
    restaurantId: "rest-1",
    restaurantName: "rosto",
  }
  const tenantAdmin: TitleRouteState = {
    ...storefront,
    activeView: "admin",
    sessionRole: "restaurant",
  }

  it("names the restaurant on its loaded storefront", () => {
    expect(selectTitleRestaurantName(storefront)).toBe("rosto")
  })

  it("names the restaurant on a tenant admin tab", () => {
    expect(selectTitleRestaurantName(tenantAdmin)).toBe("rosto")
  })

  it("names the impersonated restaurant when a super admin opens a tenant tab", () => {
    expect(selectTitleRestaurantName({ ...tenantAdmin, sessionRole: "super", adminTab: "orders" })).toBe("rosto")
  })

  it("uses the platform title on the landing page", () => {
    expect(selectTitleRestaurantName({ ...storefront, activeView: "landing" })).toBeUndefined()
  })

  it("uses the platform title on a not-found or failed slug", () => {
    expect(selectTitleRestaurantName({ ...storefront, activeView: "not-found", isNotFound: true })).toBeUndefined()
  })

  it("uses the platform title while a storefront slug is still resolving", () => {
    expect(selectTitleRestaurantName({ ...storefront, isResolving: true })).toBeUndefined()
  })

  it("uses the platform title on the admin login (guest session)", () => {
    expect(selectTitleRestaurantName({ ...tenantAdmin, sessionRole: "guest" })).toBeUndefined()
  })

  it.each(["restaurants", "users", "metrics", "audit"] as const)(
    "uses the platform title on the global super admin tab %s",
    (adminTab) => {
      expect(selectTitleRestaurantName({ ...tenantAdmin, sessionRole: "super", adminTab })).toBeUndefined()
    }
  )

  it("never shows the placeholder tenant name while the restaurant is not loaded yet", () => {
    const placeholder = { restaurantId: "rest-default", restaurantName: "Mi Restaurante" }
    expect(selectTitleRestaurantName({ ...storefront, ...placeholder })).toBeUndefined()
    expect(selectTitleRestaurantName({ ...tenantAdmin, ...placeholder })).toBeUndefined()
  })
})

describe("useDocumentTitle", () => {
  afterEach(() => {
    document.title = ""
  })

  it("sets document.title to the restaurant name and follows changes", () => {
    const { rerender } = renderHook(({ name }) => useDocumentTitle(name), {
      initialProps: { name: "rosto" as string | undefined },
    })
    expect(document.title).toBe("rosto")

    rerender({ name: "Pizzería Nápoles" })
    expect(document.title).toBe("Pizzería Nápoles")

    rerender({ name: undefined })
    expect(document.title).toBe(PLATFORM_TITLE)
  })

  it("restores the platform title on unmount", () => {
    const { unmount } = renderHook(() => useDocumentTitle("rosto"))
    expect(document.title).toBe("rosto")

    unmount()
    expect(document.title).toBe(PLATFORM_TITLE)
  })
})
