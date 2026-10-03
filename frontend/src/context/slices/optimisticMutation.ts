import { toast } from "sonner"

/**
 * Shared shape for every optimistic write in the context slices: apply a
 * local change immediately, call the backend, and roll back on failure.
 * `apply`/`rollback` stay call-site-specific (whole-collection snapshot vs a
 * CAS-guarded single item) since that choice is what actually varies; this
 * module owns the toast sequencing, the try/catch, and the skip-on-404 case
 * that were previously re-implemented by hand at every call site.
 *
 * Gotcha: `apply()`'s return value is read synchronously, but a React state
 * setter's updater function only runs when React next flushes the queue —
 * NOT synchronously when the setter is called. So a snapshot captured as a
 * side effect inside the updater (`setX((current) => { previous = current; ... })`)
 * is not yet assigned when `apply()` returns. For that pattern, declare the
 * `let previous` in the call site's own outer scope and have `rollback`
 * close over it directly (ignoring the snapshot argument) instead of relying
 * on `apply`'s return value — by the time `rollback` runs (after the awaited
 * `call()` rejects), React has already flushed and `previous` is correct.
 */
export interface OptimisticMutationConfig<TSnapshot, TResult = void> {
  /** Perform the optimistic local update and return whatever `rollback` needs to undo it. */
  apply: () => TSnapshot
  /** The backend call. */
  call: () => Promise<TResult>
  /** Reconcile local state with the server response on success (e.g. temp id -> real id). */
  onSuccess?: (result: TResult) => void
  /** Undo the optimistic update. See the gotcha above about where to read the snapshot from. */
  rollback: (snapshot: TSnapshot) => void
  toast?: {
    /** Shown via toast.success. Default timing is "optimistic" (right after apply). */
    success?: string
    successTiming?: "optimistic" | "confirmed"
    /** Shown via toast.info instead of toast.success, right after apply. */
    info?: string
    /** Shown via toast.error when the call fails and is not skipped. */
    error: string
  }
  /** When true for a given error, the failure is ignored: no rollback, no error toast. */
  skipRollbackIfError?: (err: unknown) => boolean
  /** Re-throw the error after rollback, for callers that need to know the mutation failed. */
  rethrow?: boolean
  /** Logged via console.warn when a call fails and isn't skipped (omitted in tests). */
  warnMessage?: string
}

export async function runOptimisticMutation<TSnapshot, TResult = void>(
  config: OptimisticMutationConfig<TSnapshot, TResult>
): Promise<TResult | undefined> {
  const snapshot = config.apply()

  if (config.toast?.success && config.toast.successTiming !== "confirmed") {
    toast.success(config.toast.success)
  } else if (config.toast?.info) {
    toast.info(config.toast.info)
  }

  try {
    const result = await config.call()
    config.onSuccess?.(result)
    if (config.toast?.success && config.toast.successTiming === "confirmed") {
      toast.success(config.toast.success)
    }
    return result
  } catch (err) {
    if (config.skipRollbackIfError?.(err)) {
      return undefined
    }
    if (import.meta.env?.MODE !== "test" && config.warnMessage) {
      console.warn(config.warnMessage, err)
    }
    config.rollback(snapshot)
    if (config.toast?.error) {
      toast.error(config.toast.error)
    }
    if (config.rethrow) {
      throw err
    }
    return undefined
  }
}
