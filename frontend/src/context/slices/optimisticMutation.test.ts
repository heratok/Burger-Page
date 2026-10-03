import { describe, expect, it, vi, beforeEach } from "vitest"
import { toast } from "sonner"
import { runOptimisticMutation } from "./optimisticMutation"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

describe("runOptimisticMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("applies optimistically, shows the success toast immediately, and reconciles on success", async () => {
    const rollback = vi.fn()
    const onSuccess = vi.fn()
    const result = await runOptimisticMutation({
      apply: () => "snapshot",
      call: async () => "server-result",
      onSuccess,
      rollback,
      toast: { success: "done", error: "failed" },
    })

    expect(result).toBe("server-result")
    expect(toast.success).toHaveBeenCalledWith("done")
    expect(onSuccess).toHaveBeenCalledWith("server-result")
    expect(rollback).not.toHaveBeenCalled()
  })

  it("defers the success toast until the server confirms when successTiming is 'confirmed'", async () => {
    const callOrder: string[] = []
    await runOptimisticMutation({
      apply: () => "snapshot",
      call: async () => {
        callOrder.push("call")
        return undefined
      },
      rollback: vi.fn(),
      toast: { success: "attached", successTiming: "confirmed", error: "failed" },
    })

    expect(toast.success).toHaveBeenCalledWith("attached")
    expect(toast.success).toHaveBeenCalledTimes(1)
  })

  it("does not roll back or show the error toast when onSuccess throws after the server committed", async () => {
    const rollback = vi.fn()
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    const result = await runOptimisticMutation({
      apply: () => "snapshot",
      call: async () => "server-result",
      onSuccess: () => {
        throw new Error("reconcile bug")
      },
      rollback,
      toast: { success: "done", error: "failed" },
    })

    expect(result).toBe("server-result")
    expect(rollback).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
    expect(logged).toHaveBeenCalled()
    logged.mockRestore()
  })

  it("rolls back and shows the error toast when the call fails", async () => {
    const rollback = vi.fn()
    await runOptimisticMutation({
      apply: () => "snapshot-value",
      call: async () => {
        throw new Error("boom")
      },
      rollback,
      toast: { success: "ok", error: "failed" },
    })

    expect(rollback).toHaveBeenCalledWith("snapshot-value")
    expect(toast.error).toHaveBeenCalledWith("failed")
  })

  it("skips rollback and the error toast when the error matches skipRollbackIfError", async () => {
    const rollback = vi.fn()
    class NotFoundError extends Error {}
    await runOptimisticMutation({
      apply: () => "snapshot",
      call: async () => {
        throw new NotFoundError("gone")
      },
      rollback,
      toast: { error: "failed" },
      skipRollbackIfError: (err) => err instanceof NotFoundError,
    })

    expect(rollback).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("re-throws after rollback when rethrow is set, so callers can react to the failure", async () => {
    const rollback = vi.fn()
    await expect(
      runOptimisticMutation({
        apply: () => "snapshot",
        call: async () => {
          throw new Error("boom")
        },
        rollback,
        toast: { error: "failed" },
        rethrow: true,
      })
    ).rejects.toThrow("boom")

    expect(rollback).toHaveBeenCalledWith("snapshot")
  })

  it("supports a CAS-guarded single-item rollback closure instead of a whole-collection snapshot", async () => {
    let items = [
      { id: "a", status: "pending" },
      { id: "b", status: "pending" },
    ]
    const applySnapshotAndUpdate = () => {
      const previousStatus = items.find((i) => i.id === "a")?.status
      items = items.map((i) => (i.id === "a" ? { ...i, status: "confirmed" } : i))
      return previousStatus
    }

    await runOptimisticMutation({
      apply: applySnapshotAndUpdate,
      call: async () => {
        // Simulate an SSE event moving item "a" to a third state concurrently.
        items = items.map((i) => (i.id === "a" ? { ...i, status: "cancelled" } : i))
        throw new Error("rejected")
      },
      rollback: (previousStatus) => {
        items = items.map((i) =>
          // Only undo our own optimistic change: if it already moved elsewhere
          // (e.g. the concurrent SSE event above), leave it alone.
          i.id === "a" && i.status === "confirmed" ? { ...i, status: previousStatus as string } : i
        )
      },
      toast: { error: "failed" },
    })

    expect(items.find((i) => i.id === "a")?.status).toBe("cancelled")
  })
})
