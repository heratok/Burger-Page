import { afterEach, describe, expect, it } from "vitest"
import { renderHook } from "@testing-library/react"
import { PLATFORM_TITLE, resolveDocumentTitle, useDocumentTitle } from "./useDocumentTitle"

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
})
