import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiClient } from "@/core/api/apiClient"
import { createTestQueryClient } from "@/test/testQueryClient"
import { useRestaurantTables } from "./useRestaurantTables"

const t = (id: string, name: string, sortOrder = 0, isActive = true) => ({ id, name, sortOrder, isActive })

const wrapperFor = (client: QueryClient) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return Wrapper
}

const tablesKey = (client: QueryClient, restaurantId: string) =>
  client
    .getQueryCache()
    .getAll()
    .find((q) => q.queryKey[0] === "tables" && q.queryKey[1] === restaurantId)

describe("useRestaurantTables server state (tables query)", () => {
  let client: QueryClient

  beforeEach(() => {
    client = createTestQueryClient()
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
  })

  it("reuses the cached tables on remount instead of fetching again", async () => {
    const fetchSpy = vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "Mesa 1")])

    const first = renderHook(() => useRestaurantTables("rest-1"), { wrapper: wrapperFor(client) })
    await waitFor(() => expect(first.result.current.tables).toHaveLength(1))
    first.unmount()

    const second = renderHook(() => useRestaurantTables("rest-1"), { wrapper: wrapperFor(client) })
    expect(second.result.current.isLoading).toBe(false)
    expect(second.result.current.tables).toEqual([t("a", "Mesa 1")])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("keys the cache by tenant and role", async () => {
    vi.spyOn(apiClient, "fetchTables").mockImplementation(async (id) => [t(`${id}-t`, "Mesa")])

    const { result, rerender } = renderHook(({ id }) => useRestaurantTables(id), {
      wrapper: wrapperFor(client),
      initialProps: { id: "rest-1" },
    })
    await waitFor(() => expect(result.current.tables[0]?.id).toBe("rest-1-t"))

    rerender({ id: "rest-2" })
    await waitFor(() => expect(result.current.tables[0]?.id).toBe("rest-2-t"))

    expect(tablesKey(client, "rest-1")?.queryKey).toEqual(["tables", "rest-1", "guest"])
    expect(tablesKey(client, "rest-2")?.queryKey).toEqual(["tables", "rest-2", "guest"])
  })

  it("writes the created table into the shared cache and marks it stale", async () => {
    const fetchSpy = vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "Mesa 1")])
    vi.spyOn(apiClient, "createTable").mockResolvedValue(t("b", "Mesa 2", 1))

    const editor = renderHook(() => useRestaurantTables("rest-1"), { wrapper: wrapperFor(client) })
    const picker = renderHook(() => useRestaurantTables("rest-1"), { wrapper: wrapperFor(client) })
    await waitFor(() => expect(editor.result.current.tables).toHaveLength(1))

    await act(async () => {
      await editor.result.current.createTable("Mesa 2")
    })

    // Every consumer of the tenant's tables sees the confirmed row at once.
    expect(picker.result.current.tables.map((x) => x.name)).toEqual(["Mesa 1", "Mesa 2"])
    expect(tablesKey(client, "rest-1")?.state.isInvalidated).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("shows the new order while the reorder is in flight and rolls back on rejection", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "A"), t("b", "B", 1)])
    let reject!: (err: Error) => void
    vi.spyOn(apiClient, "reorderTables").mockReturnValue(
      new Promise((_resolve, rej) => {
        reject = rej
      })
    )
    const errorToast = vi.spyOn(toast, "error").mockImplementation((() => "") as any)

    const { result } = renderHook(() => useRestaurantTables("rest-1"), { wrapper: wrapperFor(client) })
    await waitFor(() => expect(result.current.tables).toHaveLength(2))

    let move!: Promise<void>
    act(() => {
      move = result.current.moveTable("b", "up")
    })
    await waitFor(() => expect(result.current.tables.map((x) => x.id)).toEqual(["b", "a"]))

    await act(async () => {
      reject(new Error("nope"))
      await move
    })
    expect(result.current.tables.map((x) => x.id)).toEqual(["a", "b"])
    expect(errorToast).toHaveBeenCalledWith("nope")
  })

  it("shows the loading state again while retrying after a failed read", async () => {
    const fetchSpy = vi.spyOn(apiClient, "fetchTables").mockRejectedValueOnce(new Error("boom"))

    const { result } = renderHook(() => useRestaurantTables("rest-1"), { wrapper: wrapperFor(client) })
    await waitFor(() => expect(result.current.loadError).toBe("boom"))

    let resolve!: (value: any) => void
    fetchSpy.mockReturnValueOnce(new Promise((res) => (resolve = res)))
    let reload!: Promise<void>
    act(() => {
      reload = result.current.reload()
    })
    await waitFor(() => expect(result.current.isLoading).toBe(true))

    await act(async () => {
      resolve([t("a", "Mesa 1")])
      await reload
    })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.loadError).toBeNull()
    expect(result.current.tables).toEqual([t("a", "Mesa 1")])
  })
})
