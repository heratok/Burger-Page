import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, cleanup } from "@testing-library/react"
import React from "react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { useAppRouter } from "./useAppRouter"

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("useAppRouter - unknown slug is requested exactly once (F5)", () => {
  const calls: string[] = []

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    calls.length = 0
    window.history.pushState({}, "", "/no-such-place")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        calls.push(url)
        if (url.includes("/restaurants/no-such-place")) {
          return jsonResponse(404, { title: "Not Found", status: 404, detail: "Restaurant not found" })
        }
        if (url.endsWith("/restaurants")) return jsonResponse(200, [])
        return jsonResponse(404, {})
      })
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("does not re-request a slug that already answered 404", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RestaurantProvider>{children}</RestaurantProvider>
    )
    const { result } = renderHook(() => useAppRouter(), { wrapper })
    await waitFor(() => expect(result.current.isNotFound).toBe(true))
    // Let any post-mount provider refreshes settle.
    await new Promise((r) => setTimeout(r, 100))
    const slugCalls = calls.filter((u) => u.includes("/restaurants/no-such-place"))
    expect(slugCalls).toHaveLength(1)
  })
})

describe("useAppRouter - an unresolved storefront slug is never rendered as a store", () => {
  let resolve404: (() => void) | undefined

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    resolve404 = undefined
    window.history.pushState({}, "", "/rost")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes("/restaurants/rost")) {
          await new Promise<void>((r) => (resolve404 = r))
          return jsonResponse(404, { title: "Not Found", status: 404, detail: "Restaurant not found" })
        }
        if (url.endsWith("/restaurants")) return jsonResponse(200, [])
        return jsonResponse(404, {})
      })
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    window.history.pushState({}, "", "/")
  })

  it("reports the slug as resolving until the backend answers, then as not found", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RestaurantProvider>{children}</RestaurantProvider>
    )
    const { result } = renderHook(() => useAppRouter(), { wrapper })

    expect(result.current.isResolving).toBe(true)
    expect(result.current.isNotFound).toBe(false)

    // The slug request is in flight and still unanswered.
    await waitFor(() => expect(resolve404).toBeDefined())
    expect(result.current.isResolving).toBe(true)
    resolve404!()

    await waitFor(() => expect(result.current.isNotFound).toBe(true))
    expect(result.current.isResolving).toBe(false)
  })
})

describe("useAppRouter - a valid slug not loaded yet resolves into its storefront", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    window.history.pushState({}, "", "/")
  })

  it("reports resolving while the slug loads, then renders the store", async () => {
    localStorage.clear()
    sessionStorage.clear()
    window.history.pushState({}, "", "/casa-nueva")
    const { apiClient } = await import("@/core/api/apiClient")
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([])
    let answer: ((value: any) => void) | undefined
    vi.spyOn(apiClient, "fetchRestaurant").mockReturnValue(new Promise((r) => (answer = r)))

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RestaurantProvider>{children}</RestaurantProvider>
    )
    const { result } = renderHook(() => useAppRouter(), { wrapper })

    await waitFor(() => expect(answer).toBeDefined())
    expect(result.current.isResolving).toBe(true)

    answer!({ id: "rest-casa-nueva", slug: "casa-nueva", name: "Casa Nueva" })

    await waitFor(() => expect(result.current.isResolving).toBe(false))
    expect(result.current.isNotFound).toBe(false)
    expect(result.current.activeView).toBe("store")
  })
})
