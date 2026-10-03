import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { PLATFORM_FAVICON, resolveFaviconHref, useDocumentFavicon } from "./useDocumentFavicon"

class MockImage {
  static instances: MockImage[] = []
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  src = ""
  constructor() {
    MockImage.instances.push(this)
  }
}

const getIcon = () => document.head.querySelector<HTMLLinkElement>('link[rel="icon"]')

describe("resolveFaviconHref", () => {
  it("falls back to the platform favicon when missing or blank", () => {
    expect(resolveFaviconHref(undefined)).toBe(PLATFORM_FAVICON)
    expect(resolveFaviconHref("")).toBe(PLATFORM_FAVICON)
    expect(resolveFaviconHref("   ")).toBe(PLATFORM_FAVICON)
  })

  it("returns the trimmed logo url", () => {
    expect(resolveFaviconHref("  https://cdn.test/logo.png ")).toBe("https://cdn.test/logo.png")
  })
})

describe("useDocumentFavicon", () => {
  beforeEach(() => {
    MockImage.instances = []
    vi.stubGlobal("Image", MockImage)
    document.head.querySelectorAll('link[rel="icon"]').forEach((el) => el.remove())
    const link = document.createElement("link")
    link.rel = "icon"
    link.type = "image/jpeg"
    link.href = PLATFORM_FAVICON
    document.head.appendChild(link)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("keeps the platform favicon when there is no logo", () => {
    renderHook(() => useDocumentFavicon(undefined))
    expect(getIcon()?.getAttribute("href")).toBe(PLATFORM_FAVICON)
    expect(MockImage.instances).toHaveLength(0)
  })

  it("swaps to the tenant logo only after it loads and drops the type", () => {
    renderHook(() => useDocumentFavicon("https://cdn.test/a.png"))
    expect(getIcon()?.getAttribute("href")).toBe(PLATFORM_FAVICON)
    MockImage.instances[0].onload?.()
    expect(getIcon()?.getAttribute("href")).toBe("https://cdn.test/a.png")
    expect(getIcon()?.hasAttribute("type")).toBe(false)
  })

  it("stays on the platform favicon when the logo fails to load", () => {
    renderHook(() => useDocumentFavicon("https://cdn.test/broken.png"))
    MockImage.instances[0].onerror?.()
    expect(getIcon()?.getAttribute("href")).toBe(PLATFORM_FAVICON)
  })

  it("ignores a stale load after the logo changed", () => {
    const { rerender } = renderHook(({ url }) => useDocumentFavicon(url), {
      initialProps: { url: "https://cdn.test/a.png" as string | undefined },
    })
    rerender({ url: "https://cdn.test/b.png" })
    MockImage.instances[0].onload?.()
    expect(getIcon()?.getAttribute("href")).toBe(PLATFORM_FAVICON)
    MockImage.instances[1].onload?.()
    expect(getIcon()?.getAttribute("href")).toBe("https://cdn.test/b.png")
  })

  it("returns to the platform favicon when the logo is removed", () => {
    const { rerender } = renderHook(({ url }) => useDocumentFavicon(url), {
      initialProps: { url: "https://cdn.test/a.png" as string | undefined },
    })
    MockImage.instances[0].onload?.()
    rerender({ url: undefined })
    expect(getIcon()?.getAttribute("href")).toBe(PLATFORM_FAVICON)
  })

  it("ignores a pending load after unmount and resets to platform", () => {
    const { unmount } = renderHook(() => useDocumentFavicon("https://cdn.test/a.png"))
    unmount()
    MockImage.instances[0].onload?.()
    expect(getIcon()?.getAttribute("href")).toBe(PLATFORM_FAVICON)
  })

  it("resets to the platform favicon on unmount after a tenant logo loaded", () => {
    const { unmount } = renderHook(() => useDocumentFavicon("https://cdn.test/a.png"))
    MockImage.instances[0].onload?.()
    unmount()
    expect(getIcon()?.getAttribute("href")).toBe(PLATFORM_FAVICON)
  })

  it("creates the icon link when missing", () => {
    getIcon()?.remove()
    renderHook(() => useDocumentFavicon(undefined))
    expect(getIcon()?.getAttribute("href")).toBe(PLATFORM_FAVICON)
  })
})
