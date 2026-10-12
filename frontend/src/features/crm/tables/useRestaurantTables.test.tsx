import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import { apiClient } from "@/core/api/apiClient"
import { useRestaurantTables } from "./useRestaurantTables"
import { TestQueryProvider } from "@/test/queryClientWrapper"

const t = (id: string, name: string, sortOrder = 0, isActive = true) => {
  const match = /^(.*?)\s*(\d+)$/.exec(name)
  return { id, zone: match ? match[1] : name, number: match ? Number(match[2]) : 1, alias: null, name, sortOrder, isActive }
}

describe("useRestaurantTables", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
  })

  it("loads the tables of the restaurant", async () => {
    const fetchSpy = vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "Mesa 1")])

    const { result } = renderHook(() => useRestaurantTables("rest-1"), { wrapper: TestQueryProvider })

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.tables).toEqual([t("a", "Mesa 1")])
    expect(fetchSpy).toHaveBeenCalledWith("rest-1")
  })

  it("does not fetch without a session token", () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(false)
    const fetchSpy = vi.spyOn(apiClient, "fetchTables").mockResolvedValue([])

    const { result } = renderHook(() => useRestaurantTables("rest-1"), { wrapper: TestQueryProvider })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
  })

  it("does not fetch without a restaurant", () => {
    const fetchSpy = vi.spyOn(apiClient, "fetchTables").mockResolvedValue([])

    const { result } = renderHook(() => useRestaurantTables(undefined), { wrapper: TestQueryProvider })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.current.tables).toEqual([])
  })

  it("exposes a load error and keeps an empty list", async () => {
    vi.spyOn(apiClient, "fetchTables").mockRejectedValue(new Error("boom"))

    const { result } = renderHook(() => useRestaurantTables("rest-1"), { wrapper: TestQueryProvider })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.loadError).toBe("boom")
    expect(result.current.tables).toEqual([])
  })

  it("creates a table at the end and returns it", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "Mesa 1")])
    vi.spyOn(apiClient, "createTable").mockResolvedValue(t("b", "Mesa 2", 1))
    const { result } = renderHook(() => useRestaurantTables("rest-1"), { wrapper: TestQueryProvider })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let created: unknown
    await act(async () => {
      created = await result.current.createTable({ zone: "Mesa", number: 2 })
    })

    expect(created).toEqual(t("b", "Mesa 2", 1))
    expect(result.current.tables.map((x) => x.name)).toEqual(["Mesa 1", "Mesa 2"])
    expect(apiClient.createTable).toHaveBeenCalledWith({ zone: "Mesa", number: 2 }, "rest-1")
  })

  it("reports a rejected create with the server message and returns null", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([])
    vi.spyOn(apiClient, "createTable").mockRejectedValue(new Error("Ya existe la mesa Mesa 1."))
    const errorToast = vi.spyOn(toast, "error").mockImplementation((() => "") as any)
    const { result } = renderHook(() => useRestaurantTables("rest-1"), { wrapper: TestQueryProvider })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let created: unknown = "unset"
    await act(async () => {
      created = await result.current.createTable({ zone: "Mesa", number: 1 })
    })

    expect(created).toBeNull()
    expect(errorToast).toHaveBeenCalledWith(expect.stringContaining("Ya existe"))
  })

  it("edits and toggles a table in place", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "Mesa 1"), t("b", "Mesa 2", 1)])
    vi.spyOn(apiClient, "updateTable").mockImplementation(async (id, data) => ({
      ...t(id, "x"),
      ...(id === "a" ? t("a", "Terraza 1") : t("b", "Mesa 2", 1)),
      ...data,
    }))
    const { result } = renderHook(() => useRestaurantTables("rest-1"), { wrapper: TestQueryProvider })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.updateTable("a", { zone: "Terraza", number: 1 })
      await result.current.updateTable("b", { isActive: false })
    })

    expect(result.current.tables).toEqual([t("a", "Terraza 1"), t("b", "Mesa 2", 1, false)])
  })

  it("moves a table up and persists the new order, rolling back on failure", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "Mesa 1"), t("b", "Mesa 2", 1), t("c", "Mesa 3", 2)])
    const reorder = vi.spyOn(apiClient, "reorderTables").mockResolvedValue([t("b", "Mesa 2"), t("a", "Mesa 1", 1), t("c", "Mesa 3", 2)])
    vi.spyOn(toast, "error").mockImplementation((() => "") as any)
    const { result } = renderHook(() => useRestaurantTables("rest-1"), { wrapper: TestQueryProvider })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.moveTable("b", "up")
    })
    expect(reorder).toHaveBeenCalledWith(["b", "a", "c"], "rest-1")
    expect(result.current.tables.map((x) => x.id)).toEqual(["b", "a", "c"])

    reorder.mockRejectedValueOnce(new Error("nope"))
    await act(async () => {
      await result.current.moveTable("c", "up")
    })
    expect(result.current.tables.map((x) => x.id)).toEqual(["b", "a", "c"])
  })

  it("moves a table only past tables of its own zone", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("s1", "Salón 1"), t("t1", "Terraza 1", 1), t("s2", "Salón 2", 2)])
    const reorder = vi
      .spyOn(apiClient, "reorderTables")
      .mockResolvedValue([t("s2", "Salón 2"), t("t1", "Terraza 1", 1), t("s1", "Salón 1", 2)])
    const { result } = renderHook(() => useRestaurantTables("rest-1"), { wrapper: TestQueryProvider })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.moveTable("s2", "up")
      await result.current.moveTable("t1", "up")
    })

    expect(reorder).toHaveBeenCalledTimes(1)
    expect(reorder).toHaveBeenCalledWith(["s2", "t1", "s1"], "rest-1")
  })

  it("creates a range, adds the created tables and tells which numbers were skipped", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "Mesa 1")])
    const bulk = vi
      .spyOn(apiClient, "createTablesBulk")
      .mockResolvedValue({ created: [t("b", "Mesa 2", 1), t("c", "Mesa 3", 2)], skipped: [1] })
    const info = vi.spyOn(toast, "info").mockImplementation((() => "") as any)
    const { result } = renderHook(() => useRestaurantTables("rest-1"), { wrapper: TestQueryProvider })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let outcome: unknown
    await act(async () => {
      outcome = await result.current.createTablesBulk({ zone: "Mesa", from: 1, to: 3 })
    })

    expect(bulk).toHaveBeenCalledWith({ zone: "Mesa", from: 1, to: 3 }, "rest-1")
    expect(outcome).toEqual({ created: [t("b", "Mesa 2", 1), t("c", "Mesa 3", 2)], skipped: [1] })
    expect(result.current.tables.map((x) => x.name)).toEqual(["Mesa 1", "Mesa 2", "Mesa 3"])
    expect(info).toHaveBeenCalledWith(expect.stringMatching(/omitieron.*1/))
  })

  it("does not toast when nothing was skipped and reports a rejected range with null", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([])
    const bulk = vi.spyOn(apiClient, "createTablesBulk").mockResolvedValueOnce({ created: [t("a", "Mesa 1")], skipped: [] })
    const info = vi.spyOn(toast, "info").mockImplementation((() => "") as any)
    const errorToast = vi.spyOn(toast, "error").mockImplementation((() => "") as any)
    const { result } = renderHook(() => useRestaurantTables("rest-1"), { wrapper: TestQueryProvider })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.createTablesBulk({ zone: "Mesa", from: 1, to: 1 })
    })
    expect(info).not.toHaveBeenCalled()

    bulk.mockRejectedValueOnce(new Error("Máximo 100 mesas"))
    let outcome: unknown = "unset"
    await act(async () => {
      outcome = await result.current.createTablesBulk({ zone: "Mesa", from: 1, to: 200 })
    })
    expect(outcome).toBeNull()
    expect(errorToast).toHaveBeenCalledWith(expect.stringContaining("Máximo"))
  })

  it("ignores a move past either end", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "Mesa 1"), t("b", "Mesa 2", 1)])
    const reorder = vi.spyOn(apiClient, "reorderTables").mockResolvedValue([])
    const { result } = renderHook(() => useRestaurantTables("rest-1"), { wrapper: TestQueryProvider })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.moveTable("a", "up")
      await result.current.moveTable("b", "down")
    })

    expect(reorder).not.toHaveBeenCalled()
  })

  it("deletes a table", async () => {
    vi.spyOn(apiClient, "fetchTables").mockResolvedValue([t("a", "Mesa 1"), t("b", "Mesa 2", 1)])
    vi.spyOn(apiClient, "deleteTable").mockResolvedValue(undefined)
    const { result } = renderHook(() => useRestaurantTables("rest-1"), { wrapper: TestQueryProvider })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.deleteTable("a")
    })

    expect(result.current.tables.map((x) => x.id)).toEqual(["b"])
    expect(apiClient.deleteTable).toHaveBeenCalledWith("a", "rest-1")
  })
})
