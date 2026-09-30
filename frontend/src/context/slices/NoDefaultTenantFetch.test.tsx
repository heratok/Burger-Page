import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, cleanup } from "@testing-library/react"
import React from "react"
import { RestaurantProvider, useRestaurant } from "@/context/RestaurantContext"

const listing = [
  { id: "rest-burger-craft", slug: "burger-craft", name: "Burger Craft", config: { name: "Burger Craft" } },
  { id: "rest-mine", slug: "mine", name: "Mine", config: { name: "Mine" } },
]

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("no hardcoded default tenant (F1)", () => {
  const urls: string[] = []

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    urls.length = 0
    window.history.pushState({}, "", "/admin/login")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        urls.push(url)
        if (url.endsWith("/restaurants")) return jsonResponse(200, listing)
        return jsonResponse(200, [])
      })
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <RestaurantProvider>{children}</RestaurantProvider>
  )

  it("a guest on the login page never triggers tenant-scoped fetches for the first listed tenant", async () => {
    const { result } = renderHook(() => useRestaurant(), { wrapper })
    await waitFor(() => expect(result.current.restaurants).toHaveLength(2))
    await new Promise((r) => setTimeout(r, 50))
    expect(urls.filter((u) => /\/(products|additions)\b/.test(u))).toEqual([])
  })

  it("a super admin with no selected restaurant triggers no tenant-scoped catalog fetch", async () => {
    sessionStorage.setItem(
      "burger_page_session_v2",
      JSON.stringify({ role: "super", authenticatedAt: new Date().toISOString() })
    )
    const { result } = renderHook(() => useRestaurant(), { wrapper })
    await waitFor(() => expect(result.current.restaurants).toHaveLength(2))
    await new Promise((r) => setTimeout(r, 50))
    expect(urls.filter((u) => /\/(products|additions)\b/.test(u))).toEqual([])
  })

  it("a restaurant admin only requests catalog data for their own tenant", async () => {
    sessionStorage.setItem(
      "burger_page_session_v2",
      JSON.stringify({
        role: "restaurant",
        restaurantId: "rest-mine",
        authenticatedAt: new Date().toISOString(),
      })
    )
    const { result } = renderHook(() => useRestaurant(), { wrapper })
    await waitFor(() => expect(result.current.restaurants).toHaveLength(2))
    await waitFor(() => expect(urls.some((u) => u.includes("/products"))).toBe(true))
    await new Promise((r) => setTimeout(r, 50))
    const catalog = urls.filter((u) => /\/(products|additions)\b/.test(u))
    expect(catalog.length).toBeGreaterThan(0)
    expect(catalog.filter((u) => u.includes("burger-craft"))).toEqual([])
    expect(catalog.every((u) => u.includes("restaurantId=rest-mine"))).toBe(true)
  })
})
