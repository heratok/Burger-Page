import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { StoreBootLoader, StorefrontLoadingFallback } from "./LoadingFallbacks"
import ProductCard from "@/features/storefront/ProductCard"
import { RestaurantProvider } from "@/context/RestaurantContext"
import type { MenuItem } from "@/types/restaurant"

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

  // S6 residual — the shrunken skeleton delta (-42px mobile / -68px desktop) was
  // measured live but nothing protected it: the previous shape was a 6-card grid
  // of `aspect-video` tiles that collapsed the mobile page by 1541px in one
  // frame. jsdom has no layout, so the contract is pinned structurally against
  // the real ProductCard itself: same grid, same thumbnail box, same padding,
  // two text lines and the price/action row.
  it("reserves the real ProductCard geometry, so the catalog cannot collapse when data lands", () => {
    const product: MenuItem = {
      id: "p1",
      name: "Hamburguesa Clásica",
      price: 25000,
      category: "Hamburguesas",
      src: "/images/classic.jpg",
      description: "Carne 150g, cheddar y salsa de la casa",
      inStock: true,
    }

    const tokens = (element: Element) => new Set(element.className.split(/\s+/).filter(Boolean))
    /** Every candidate the reference element really carries. */
    const shared = (reference: Element, candidates: string[]) =>
      candidates.filter((token) => tokens(reference).has(token))

    // 1. Reference: the settled card of the real storefront.
    const real = render(
      <RestaurantProvider>
        <ProductCard product={product} onSelectProduct={() => {}} />
      </RestaurantProvider>
    )
    const realCard = real.container.querySelector<HTMLElement>('[role="button"]')!
    const realThumb = realCard.querySelector<HTMLElement>(".aspect-square")!
    const realBody = realCard.children[1] as HTMLElement
    const realPriceRow = realBody.lastElementChild as HTMLElement

    expect(shared(realCard, ["flex-row", "items-stretch", "p-3", "sm:p-4"])).toEqual([
      "flex-row",
      "items-stretch",
      "p-3",
      "sm:p-4",
    ])
    expect(shared(realThumb, ["size-24", "min-[400px]:size-28", "sm:size-32", "aspect-square", "self-center"])).toEqual([
      "size-24",
      "min-[400px]:size-28",
      "sm:size-32",
      "aspect-square",
      "self-center",
    ])
    expect(shared(realBody, ["flex-1", "pl-3", "sm:pl-4", "justify-between"])).toEqual([
      "flex-1",
      "pl-3",
      "sm:pl-4",
      "justify-between",
    ])
    expect(shared(realPriceRow, ["mt-3", "pt-1", "items-center", "justify-between"])).toEqual([
      "mt-3",
      "pt-1",
      "items-center",
      "justify-between",
    ])
    real.unmount()

    // 2. The placeholder must carry those same boxes.
    const placeholder = render(<StorefrontLoadingFallback />)
    const grid = placeholder.container.querySelector('[data-slot="storefront-skeleton-grid"]')!
    const card = grid.querySelector<HTMLElement>('[data-slot="storefront-skeleton-card"]')!
    const thumb = card.querySelector<HTMLElement>('[data-slot="storefront-skeleton-thumb"]')!
    const body = card.querySelector<HTMLElement>('[data-slot="storefront-skeleton-card-body"]')!
    const priceRow = body.lastElementChild as HTMLElement

    for (const token of ["flex-row", "items-stretch", "p-3", "sm:p-4"]) {
      expect(tokens(card).has(token), `card lost ${token}`).toBe(true)
    }
    for (const token of ["size-24", "min-[400px]:size-28", "sm:size-32", "aspect-square", "self-center"]) {
      expect(tokens(thumb).has(token), `thumbnail lost ${token}`).toBe(true)
    }
    for (const token of ["flex-1", "pl-3", "sm:pl-4", "justify-between"]) {
      expect(tokens(body).has(token), `card body lost ${token}`).toBe(true)
    }
    for (const token of ["mt-3", "pt-1", "items-center", "justify-between"]) {
      expect(tokens(priceRow).has(token), `price/action row lost ${token}`).toBe(true)
    }

    // Two text lines under the title block, then the price/action row.
    const textBlock = body.firstElementChild as HTMLElement
    expect(textBlock.querySelectorAll(skeleton).length).toBeGreaterThanOrEqual(2)
    expect(priceRow.querySelector('[data-slot="storefront-skeleton-price"]')).not.toBeNull()
    expect(priceRow.querySelector('[data-slot="storefront-skeleton-action"]')).not.toBeNull()

    // 3. The old shape stays gone, and the responsive rule still holds.
    expect(placeholder.container.querySelector(".aspect-video")).toBeNull()
    expect(grid.className).toContain("grid-cols-1")
    expect(grid.className).toContain("md:grid-cols-2")
    const cards = grid.querySelectorAll('[data-slot="storefront-skeleton-card"]')
    expect(cards).toHaveLength(4)
    expect(tokens(cards[0]).has("hidden")).toBe(false)
    expect(tokens(cards[1]).has("hidden")).toBe(false)
    expect(tokens(cards[2]).has("hidden")).toBe(true)
    expect(tokens(cards[2]).has("md:flex")).toBe(true)
    expect(tokens(cards[3]).has("hidden")).toBe(true)
    expect(tokens(cards[3]).has("md:flex")).toBe(true)
  })
})
