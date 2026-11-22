import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { StoreBootLoader, StorefrontLoadingFallback } from "./LoadingFallbacks"

const skeleton = '[data-slot="skeleton"]'

describe("StoreBootLoader", () => {
  afterEach(cleanup)

  it("boots with the store shell already drawn instead of a chrome-less void", () => {
    const { container } = render(<StoreBootLoader />)

    expect(screen.getByRole("status", { name: "Cargando" })).toBeDefined()
    // The navbar/brand area exists from the first frame, so the tenant lookup
    // does not paint a bare spinner over an empty page.
    expect(container.querySelector('[data-slot="storefront-skeleton-nav"]')).not.toBeNull()
    // And it continues straight into the catalog skeleton (one loading experience).
    expect(container.querySelector('[data-slot="storefront-skeleton-grid"]')).not.toBeNull()
    expect(screen.queryByText(/Panel Administrativo/i)).toBeNull()
  })
})

describe("StorefrontLoadingFallback - catalog skeleton fidelity", () => {
  afterEach(cleanup)

  it("uses the real catalog grid: 1/2 responsive columns, not 4 columns of tiles", () => {
    const { container } = render(<StorefrontLoadingFallback />)

    const grid = container.querySelector('[data-slot="storefront-skeleton-grid"]')
    expect(grid).not.toBeNull()
    expect(grid!.className).toContain("grid-cols-1")
    expect(grid!.className).toContain("md:grid-cols-2")
    // The settled catalog is `grid-cols-1 md:grid-cols-2`.
    expect(grid!.className).not.toContain("lg:grid-cols-3")
    expect(grid!.className).not.toContain("xl:grid-cols-4")
  })

  it("shows 2 placeholder cards on mobile and 4 from md up", () => {
    const { container } = render(<StorefrontLoadingFallback />)

    const classesOf = (el: Element) => new Set(el.className.split(/\s+/).filter(Boolean))

    // `grid-cols-1 md:grid-cols-2` means 4 desktop cards out of 2 mobile cards.
    const cards = container.querySelectorAll('[data-slot="storefront-skeleton-card"]')
    expect(cards).toHaveLength(4)
    expect(classesOf(cards[0]).has("hidden")).toBe(false)
    expect(classesOf(cards[1]).has("hidden")).toBe(false)
    expect(classesOf(cards[2]).has("hidden")).toBe(true)
    expect(classesOf(cards[2]).has("md:flex")).toBe(true)
    expect(classesOf(cards[3]).has("hidden")).toBe(true)
    expect(classesOf(cards[3]).has("md:flex")).toBe(true)
  })

  it("draws horizontal product cards (thumbnail + two text lines + price/action row), not aspect-video tiles", () => {
    const { container } = render(<StorefrontLoadingFallback />)

    expect(container.querySelector(".aspect-video")).toBeNull()

    const card = container.querySelector('[data-slot="storefront-skeleton-card"]')!
    expect(card.className).toContain("flex-row")
    expect(card.className).toContain("rounded-")
    expect(card.className).toContain("bg-bg-elevated")

    const thumb = card.querySelector('[data-slot="storefront-skeleton-thumb"]')
    expect(thumb).not.toBeNull()
    expect(thumb!.className).toContain("size-24")
    expect(thumb!.className).toContain("rounded-xl")
    expect(thumb!.className).toContain("bg-bg-elevated-2")

    const body = card.querySelector('[data-slot="storefront-skeleton-card-body"]')
    expect(body).not.toBeNull()
    const textLines = body!.querySelectorAll(`${skeleton}:not([data-slot="storefront-skeleton-price"]):not([data-slot="storefront-skeleton-action"])`)
    expect(textLines.length).toBeGreaterThanOrEqual(2)

    expect(body!.querySelector('[data-slot="storefront-skeleton-price"]')).not.toBeNull()
    expect(body!.querySelector('[data-slot="storefront-skeleton-action"]')).not.toBeNull()
  })

  it("mirrors the storefront identity block: title, status pill, delivery line, search pill and category pills", () => {
    const { container } = render(<StorefrontLoadingFallback />)

    for (const slot of [
      "storefront-skeleton-title",
      "storefront-skeleton-status",
      "storefront-skeleton-delivery",
      "storefront-skeleton-search",
      "storefront-skeleton-categories",
    ]) {
      expect(container.querySelector(`[data-slot="${slot}"]`)).not.toBeNull()
    }
  })
})
