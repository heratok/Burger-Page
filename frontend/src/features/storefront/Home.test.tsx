import { describe, it, expect, beforeEach, afterEach, vi, afterAll } from "vitest"
import { render, screen, cleanup, act } from "@testing-library/react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import { RestaurantProvider } from "@/context/RestaurantContext"
import Home from "@/features/storefront/Home"
import { apiClient } from "@/core/api/apiClient"
import { seedBlankActiveTenant, seedCatalog, TEST_PRODUCTS } from "@/test/fixtures"

/** Records the observed element and lets a test drive the measured height. */
const observed: Array<{ target: Element; trigger: (height: number) => void }> = []

class MockResizeObserver {
  private cb: ResizeObserverCallback

  constructor(cb: ResizeObserverCallback) {
    this.cb = cb
  }

  observe(target: Element) {
    observed.push({
      target,
      trigger: (height: number) =>
        this.cb(
          [
            {
              target,
              contentRect: { height } as DOMRectReadOnly,
              // The observer reports the border box (navbar bottom border included).
              borderBoxSize: [{ blockSize: height, inlineSize: 0 }],
            } as unknown as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver,
        ),
    })
  }

  unobserve() {}

  disconnect() {}
}

function renderHome() {
  return render(
    <RestaurantProvider>
      <Home />
    </RestaurantProvider>
  )
}

describe("Home - catalog loading keeps the store shell", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it("keeps the navbar mounted and draws the catalog skeleton while the catalog loads", () => {
    seedBlankActiveTenant()
    const never = new Promise<never>(() => {})
    vi.spyOn(apiClient, "fetchProducts").mockReturnValue(never)
    vi.spyOn(apiClient, "fetchAdditions").mockReturnValue(never)

    const { container } = renderHome()

    // One continuous experience: store chrome stays, content becomes a skeleton
    // shaped like the settled catalog instead of a second full-page loader.
    expect(container.querySelector("header")).not.toBeNull()
    expect(container.querySelector('[data-slot="storefront-skeleton-grid"]')).not.toBeNull()
    expect(screen.queryByPlaceholderText("Buscar en el menú...")).toBeNull()
  })
})

describe("Home - pinned category bar offset", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
    observed.length = 0
    vi.stubGlobal("ResizeObserver", MockResizeObserver)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("pins the category bar to the measured navbar height, not a hardcoded px offset", async () => {
    seedBlankActiveTenant()
    seedCatalog(TEST_PRODUCTS)

    const { container } = renderHome()
    await screen.findByPlaceholderText("Buscar en el menú...")

    const bar = container.querySelector<HTMLElement>('[data-slot="storefront-category-bar"]')
    expect(bar).not.toBeNull()
    expect(bar!.style.top).toBe("var(--store-nav-h, 64px)")
    // 92px was correct only for one announcement-bar configuration; it is not
    // allowed to come back as a fixed offset.
    expect(bar!.className).not.toMatch(/top-\[/)
    expect(bar!.className).not.toMatch(/(^|\s)top-16(\s|$)/)
  })

  it("measures the store header and exposes it as --store-nav-h on the shell", async () => {
    seedBlankActiveTenant()
    seedCatalog(TEST_PRODUCTS)

    const { container } = renderHome()
    await screen.findByPlaceholderText("Buscar en el menú...")

    expect(observed).toHaveLength(1)
    expect(observed[0].target.tagName).toBe("HEADER")

    const shell = container.firstElementChild as HTMLElement
    act(() => observed[0].trigger(109))

    // 390x844 with a wrapped announcement: the real navbar is 109px tall.
    expect(shell.style.getPropertyValue("--store-nav-h")).toBe("109px")
  })
})

// S5 — the store header must be measured before the browser paints. In a
// `useEffect` the first frame pins the category bar at the 64px CSS fallback and
// then jumps to the real 109px navbar (a ~45px overlap for one frame on a 390px
// viewport with a wrapped announcement). This app is a client-only Vite SPA
// (main.tsx createRoot, no SSR entry), so `useLayoutEffect` has no server
// warning and no hydration mismatch to fear; `ResizeObserver` stays for later
// changes.
describe("Home - header measured before the first paint (S5)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
    observed.length = 0
    vi.stubGlobal("ResizeObserver", MockResizeObserver)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("exposes --store-nav-h in the same commit as the first render, before effects are flushed", () => {
    seedBlankActiveTenant()
    // jsdom has no layout engine: report the real 109px header of a 390x844
    // viewport with a two-line announcement.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      height: 109,
      width: 390,
      top: 0,
      left: 0,
      bottom: 109,
      right: 390,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)

    const host = document.createElement("div")
    document.body.appendChild(host)
    const root = createRoot(host)

    // Deliberately outside act(): `flushSync` commits the tree and runs layout
    // effects, but leaves passive effects queued — exactly the state the browser
    // paints in. The act environment flag is disabled so React does not flag the
    // intended call.
    const globalWithActFlag = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    const previousActEnv = globalWithActFlag.IS_REACT_ACT_ENVIRONMENT
    globalWithActFlag.IS_REACT_ACT_ENVIRONMENT = false
    try {
      flushSync(() => {
        root.render(
          <RestaurantProvider>
            <Home />
          </RestaurantProvider>
        )
      })
    } finally {
      globalWithActFlag.IS_REACT_ACT_ENVIRONMENT = previousActEnv
    }

    try {
      const shell = host.firstElementChild as HTMLElement
      expect(shell).not.toBeNull()
      // Pre-paint: no second frame is allowed to move the pinned bar.
      expect(shell.style.getPropertyValue("--store-nav-h")).toBe("109px")
      // The observer still tracks later changes (announcement wrap on resize).
      expect(observed).toHaveLength(1)
      expect(observed[0].target.tagName).toBe("HEADER")
    } finally {
      act(() => root.unmount())
      host.remove()
    }
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
})
